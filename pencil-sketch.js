// SPDX-License-Identifier: MIT OR Apache-2.0
// Part of solidcraft-ipad (unofficial); see FORK-NOTICE.md.
/*
 * Skizzieren mit dem Apple Pencil ohne Werkzeugwahl (nach dem Vorbild von Shapr3D)
 * ---------------------------------------------------------------------------------
 * AP 5  Skizze automatisch:  Ein Pencil-Strich auf eine ebene Körperfläche oder ins Leere startet
 *       eine Skizze auf dieser Fläche bzw. auf der Grundebene. Ein Pencil-Tipp ins Leere beendet
 *       die Skizze, wenn nichts ausgewählt ist.
 * AP 6  Linie/Bogen automatisch:  Ein gerader Strich wird zur Linie, ein gebogener zum Bogen durch
 *       Anfang, Ende und den am weitesten ausgebogenen Punkt. Endpunkte rasten an vorhandenen
 *       Punkten ein, fast waagrechte oder senkrechte Linien werden ausgerichtet (mit Bedingung),
 *       ein Bogen, der eine Linie fortsetzt, wird tangential angeschlossen.
 *
 * Hängt sich über window.solidcraftTouchNav.extension an touch-nav.js. Greift nur, wenn kein
 * Werkzeug und kein Dialog aktiv ist; ein Strich, der auf vorhandener Skizzengeometrie beginnt,
 * zieht diese wie bisher. Abschalten: ?pencilsketch=off
 */
(() => {
  "use strict";
  if (new URLSearchParams(location.search).get("pencilsketch") === "off") return;

  // ---------- Einstellungen ----------
  const SNAP_PX = 16; // Endpunkt rastet an Punkten in diesem Abstand ein
  const STRAIGHT = 0.07; // Ausbiegung / Sehnenlänge, bis zu der ein Strich als gerade gilt
  const STRAIGHT_PX = 5; // ... oder bis zu dieser absoluten Ausbiegung in Pixeln
  const AXIS_DEG = 6; // Abweichung von waagrecht/senkrecht, bis zu der ausgerichtet wird
  const TANGENT_DEG = 12; // Winkelabweichung, bis zu der ein Bogen tangential anschließt
  const CHAIN_MS = 8000; // so lange setzt ein Strich am letzten Endpunkt die Kette fort
  const MIN_LEN_PX = 14; // kürzere Striche werden ignoriert

  let nav = null; // window.solidcraftTouchNav.internal, sobald touch-nav.js bereit ist
  const api = () => (typeof window.solidcraft === "object" && window.solidcraft) || null;
  const req = (m, p) => api().request(m, p || {});
  const exec = (c, p) => api().execute(c, p || {});
  const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
  const note = (s) => nav && nav.note && nav.note("skizze: " + s);

  // ---------- Tinte: der Strich wird sofort sichtbar, bis er in Geometrie umgewandelt ist ----------
  let inkSvg = null;
  function inkLayer() {
    if (inkSvg && inkSvg.isConnected) return inkSvg;
    inkSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    inkSvg.setAttribute("id", "sc-ipad-ink");
    inkSvg.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:2147482999";
    document.body.appendChild(inkSvg);
    return inkSvg;
  }
  function inkStart() {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "#4c8dff");
    path.setAttribute("stroke-width", "2.5");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    inkLayer().appendChild(path);
    return path;
  }
  function inkDraw(path, pts) {
    path.setAttribute("points", pts.map((p) => p.x.toFixed(1) + "," + p.y.toFixed(1)).join(" "));
  }
  function inkFade(path) {
    if (!path) return;
    path.style.transition = "opacity .25s";
    path.style.opacity = "0";
    setTimeout(() => path.remove(), 300);
  }

  // ---------- Geometrie ----------
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  function deviation(pts) {
    // größte Abweichung der Strichpunkte von der Sehne Anfang–Ende
    const a = pts[0], b = pts[pts.length - 1];
    const L = Math.max(1e-6, dist(a, b));
    let best = 0, at = pts[Math.floor(pts.length / 2)];
    for (const p of pts) {
      const d = Math.abs((b.x - a.x) * (a.y - p.y) - (a.x - p.x) * (b.y - a.y)) / L;
      if (d > best) { best = d; at = p; }
    }
    return { d: best, at, L };
  }

  // Abbildung Skizze ↔ Bildschirm: In der Skizze zeigt SolidCraft parallel (ohne Perspektive),
  // die Abbildung ist also affin und aus drei Punkten bestimmt.
  async function sketchMap() {
    const s = await req("ui.sketchToScreen", { points: [[0, 0], [1, 0], [0, 1]] });
    if (!Array.isArray(s) || s.some((p) => !p)) throw new Error("keine aktive Skizze");
    const [o, ex, ey] = s;
    const a = ex[0] - o[0], b = ey[0] - o[0], c = ex[1] - o[1], d = ey[1] - o[1];
    const det = a * d - b * c;
    if (Math.abs(det) < 1e-9) throw new Error("Skizze steht hochkant zur Ansicht");
    const toSketch = (p) => {
      const x = p.x - o[0], y = p.y - o[1];
      return [(d * x - b * y) / det, (-c * x + a * y) / det];
    };
    const toScreen = (q) => ({ x: o[0] + a * q[0] + b * q[1], y: o[1] + c * q[0] + d * q[1] });
    return { toSketch, toScreen, scale: Math.hypot(a, c) };
  }

  // ---------- Skizze bei Bedarf anlegen ----------
  async function ensureSketch(start) {
    const info = await req("ui.inspect");
    if (info.ui && info.ui.tab === "SKETCH") return true;
    let plane = null;
    try {
      const hit = await nav.pickAt(start.x, start.y);
      if (hit && hit.body && Array.isArray(hit.point) && Number.isInteger(hit.face)) {
        plane = { face: hit.point, body: hit.body, index: hit.face };
      }
    } catch (_) {}
    const up = (info.ui && info.ui.upAxis) || "z";
    const ground = up === "y" ? "XZ" : "XY";
    let made = null;
    if (plane) {
      try { made = await exec("sketch.create", { plane, project_edges: false }); } catch (e) { note("fläche nicht nutzbar: " + e.message); }
    }
    if (!made) made = await exec("sketch.create", { plane: ground });
    await exec("sketch.edit", { sketch: made.name });
    await frame(); await frame();
    note("neue skizze " + made.name + (plane ? " auf fläche" : " auf " + ground));
    return true;
  }

  // ---------- Strich in Linie oder Bogen umwandeln ----------
  let chainDocument = null;
  let committing = false;
  let chain = null; // { ref, at: {x,y}, curve, dir: [dx,dy] in Skizze, t }

  function snapRef(pointsScreen, p, prefer) {
    if (prefer && dist(prefer.at, p) < SNAP_PX * 1.4) return prefer.ref;
    let best = null, bd = SNAP_PX;
    for (const q of pointsScreen) {
      const d = dist(q.at, p);
      if (d < bd) { bd = d; best = q.id; }
    }
    return best;
  }

  async function commit(pts, expected) {
    const before = await exec("document.revision");
    if (!expected || before.document_id !== expected.document_id || before.revision !== expected.revision) throw new Error("Entwurf wurde während des Strichs geändert");
    if (chainDocument !== before.document_id) { chain = null; chainDocument = before.document_id; }
    await ensureSketch(pts[0]);
    const context = await exec("document.revision");
    const map = await sketchMap();
    const si = await exec("sketch.inspect", {});
    const current = await exec("document.revision");
    if (current.document_id !== context.document_id || current.revision !== context.revision) throw new Error("Entwurf wurde während des Strichs geändert");
    const pointsScreen = (si.points || []).map((q) => ({ id: q.id, at: map.toScreen(q.at) }));
    const a = pts[0], b = pts[pts.length - 1];
    const fresh = chain && performance.now() - chain.t < CHAIN_MS ? chain : null;
    const refA = snapRef(pointsScreen, a, fresh);
    const refB = snapRef(pointsScreen, b, null);
    let A = refA ? (pointsScreen.find((q) => q.id === refA) || { at: a }).at : a;
    let B = refB ? (pointsScreen.find((q) => q.id === refB) || { at: b }).at : b;
    const { d, at, L } = deviation(pts);
    const straight = d < Math.max(STRAIGHT_PX, STRAIGHT * L);
    const sA = map.toSketch(A), sB0 = map.toSketch(B);

    if (straight) {
      let sB = sB0;
      // fast waagrecht/senkrecht: ausrichten, die Bedingung setzt infer
      if (!refB) {
        const ang = Math.atan2(sB[1] - sA[1], sB[0] - sA[0]) * 180 / Math.PI;
        const m = ((ang % 180) + 180) % 180;
        if (Math.min(m, 180 - m) < AXIS_DEG) sB = [sB[0], sA[1]];
        else if (Math.abs(m - 90) < AXIS_DEG) sB = [sA[0], sB[1]];
      }
      const r = await exec("sketch.line", { points: [refA || sA, refB || sB], infer: true });
      const id = r.curves && r.curves[0];
      chain = id ? { ref: id + ".end", at: map.toScreen(sB), curve: id, dir: [sB[0] - sA[0], sB[1] - sA[1]], t: performance.now() } : null;
      note("linie " + (refA ? "an " + refA : "") + (refB ? " bis " + refB : ""));
    } else {
      const sM = map.toSketch(at);
      const r = await exec("sketch.arc.three_point", { start: refA || sA, end: refB || sB0, through: sM });
      const id = r.curves && r.curves[0];
      // Tangential an eine vorangehende Linie anschließen, wenn die Richtung passt
      if (id && fresh && refA === fresh.ref && fresh.dir) {
        const v1 = fresh.dir, v2 = [sM[0] - sA[0], sM[1] - sA[1]];
        const t0 = [pts[Math.min(3, pts.length - 1)].x - a.x, pts[Math.min(3, pts.length - 1)].y - a.y];
        const sT = map.toSketch({ x: A.x + t0[0], y: A.y + t0[1] });
        const v3 = [sT[0] - sA[0], sT[1] - sA[1]];
        const angle = (u, v) => Math.acos(Math.max(-1, Math.min(1, (u[0] * v[0] + u[1] * v[1]) / (Math.hypot(...u) * Math.hypot(...v) || 1)))) * 180 / Math.PI;
        if (angle(v1, v3) < TANGENT_DEG || angle(v1, v2) < TANGENT_DEG * 2) {
          try { await exec("sketch.constraint.tangent", { a: fresh.curve, b: id }); note("tangential"); } catch (_) {}
        }
      }
      chain = id ? { ref: id + ".end", at: map.toScreen(sB0), curve: id, dir: null, t: performance.now() } : null;
      note("bogen");
    }
  }

  // ---------- Anbindung an touch-nav.js ----------
  // claim(s): bei der ersten Bewegung eines Pencil-Strichs gefragt. true = dieser Strich gehört uns.
  // touch-nav.js ruft dann move(s, t) und end(s, at, cancelled) statt seiner eigenen Behandlung.
  const ext = {
    prefetch(s) {
      // Was liegt unter dem Stift, und ist etwas ausgewählt? Für die Entscheidung bei Bewegung bzw. Tipp.
      s.info = Promise.all([frame().then(frame).then(() => req("ui.inspect")), req("ui.selection"), exec("document.revision")])
        .then(([info, sel, context]) => ({ context, hover: info.hover || null, tab: info.ui && info.ui.tab, tool: info.tool, dialog: info.dialog != null, home: !!info.home, selected: (sel.selection || []).length }))
        .catch(() => null);
    },
    claim(s) {
      if (!nav || !api() || committing) return false;
      const st = nav.appState;
      if (st.tool || st.dialog || st.home || s.held) return false;
      if (nav.zoneAt(s.x, s.y) !== null) return false; // auf Bedienelementen nie
      s.pts = [{ x: s.x, y: s.y }];
      s.ink = inkStart();
      s.mode = "pending";
      s.info.then((info) => {
        if (s.mode !== "pending") return;
        if (!info) { s.mode = "off"; inkFade(s.ink); return; }
        if (chainDocument !== info.context.document_id) chain = null;
        const onSketchGeometry = info && info.tab === "SKETCH" && info.hover && /^Sketch/.test(String(info.hover));
        const onChainEnd = chain && performance.now() - chain.t < CHAIN_MS && dist(chain.at, s) < SNAP_PX * 1.4;
        if (onSketchGeometry && !onChainEnd) {
          // vorhandene Skizzengeometrie ziehen wie bisher
          s.mode = "drag";
          inkFade(s.ink);
          nav.hover(s.x, s.y);
          nav.press(s.x, s.y, 0);
          for (const p of s.pts.slice(1)) nav.move(p.x, p.y);
          if (s.endAt) requestAnimationFrame(() => nav.releaseAfterMoves(s.endAt.x, s.endAt.y));
          note("ziehen");
        } else {
          s.mode = "draw";
          if (s.endAt) ext.finish(s);
        }
      });
      return true;
    },
    move(s, t) {
      const p = { x: t.clientX, y: t.clientY };
      if (s.mode === "drag") { nav.move(p.x, p.y); return; }
      const last = s.pts[s.pts.length - 1];
      if (dist(last, p) >= 1.5) s.pts.push(p);
      if (s.ink) inkDraw(s.ink, s.pts);
    },
    end(s, at, cancelled) {
      if (s.mode === "drag") { nav.releaseAfterMoves(at.x, at.y); return; }
      if (cancelled) { s.mode = "off"; inkFade(s.ink); return; }
      if (dist(s.pts[s.pts.length - 1], at) >= 1) s.pts.push(at);
      s.endAt = at;
      if (s.mode === "draw") ext.finish(s);
    },
    async finish(s) {
      s.mode = "done";
      const pts = s.pts;
      if (pts.length < 2 || dist(pts[0], pts[pts.length - 1]) < MIN_LEN_PX) { inkFade(s.ink); return; }
      if (committing) { inkFade(s.ink); return; }
      committing = true;
      try {
        const info = await s.info;
        await commit(pts, info && info.context);
      } catch (e) {
        note("fehler " + (e && e.message));
        console.warn("pencil-sketch:", e);
      } finally { committing = false; }
      inkFade(s.ink);
      nav.pollState();
    },
    // Pencil-Tipp ohne Bewegung: im Skizzenmodus ins Leere bei leerer Auswahl beendet die Skizze.
    async tap(s) {
      const info = await s.info;
      if (!info || info.tab !== "SKETCH" || info.tool || info.dialog || info.hover || info.selected) return;
      if (nav.zoneAt(s.x, s.y) !== null) return;
      try {
        const current = await exec("document.revision");
        if (current.document_id !== info.context.document_id || current.revision !== info.context.revision) return;
        await exec("sketch.finish");
        chain = null;
        note("skizze beendet");
      } catch (_) {}
    },
  };

  const wait = setInterval(() => {
    const tn = window.solidcraftTouchNav;
    if (!tn || !tn.internal) return;
    clearInterval(wait);
    nav = tn.internal;
    tn.extension = ext;
  }, 100);
  setTimeout(() => clearInterval(wait), 60000);
})();
