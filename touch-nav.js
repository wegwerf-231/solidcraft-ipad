// SPDX-License-Identifier: MIT OR Apache-2.0
// Modified for solidcraft-ipad: version metadata and opt-in diagnostics; see FORK-NOTICE.md.
/*
 * SolidCraft iPad-Bedienung (inoffizielle, eigenständige Erweiterung)
 * ------------------------------------------------------
 * Ergänzung zur offiziellen Web-Version von SolidCraft; die App selbst bleibt unverändert.
 *
 * Grundsatz: Der Apple Pencil konstruiert, die Finger navigieren.
 *
 *   Apple Pencil ............. auswählen, skizzieren, ziehen (wie linke Maustaste)
 *   Pencil auf Bemaßung ...... Wert sofort bearbeiten (Ziffernfeld)
 *   1 Finger ziehen .......... drehen (Orbit um den berührten Punkt)
 *   2 Finger ziehen/spreizen . verschieben und zoomen
 *   3 Finger ziehen .......... drehen
 *   2 / 3 Finger tippen ...... Rückgängig / Wiederholen
 *   1 Finger tippen .......... nur auf Bedienelementen (Leisten, Dialoge, Browser); auf dem
 *                              Modell bewirkt ein Finger nie eine Auswahl oder Zeichnung
 *   1 Finger halten .......... Kontextmenü
 *
 * Zahlenfelder (Bemaßung, Radius, Abstand …) öffnen ein eigenes Ziffernfeld statt der
 * Bildschirmtastatur; die Tastatur erscheint nur für Texteingaben oder über „ABC“.
 * Eine Kontextleiste bietet zur Auswahl passende Befehle an (Abrunden, Fase, Extrudieren,
 * Skizze, Bemaßen).
 *
 * Abschalten: ?touchnav=off an die Adresse anhängen.
 */
(() => {
  "use strict";
  const query = new URLSearchParams(location.search);
  if (query.get("touchnav") === "off") return;

  // ---------- Einstellungen ----------
  const MOVE_SLOP = 8; // px: ab hier Ziehen statt Tippen
  const LONG_PRESS_MS = 550; // Halten für Kontextmenü
  const TAP_MS = Number(query.get("touchtap")) || 350; // Mehrfinger-Tipp
  const MOUSE_GUARD_MS = 800; // Kompatibilitäts-Mausereignisse nach Fingerberührung verwerfen
  const ZONE_PAD = 28; // px Rand um Bedienelemente
  const UI_ID = "sc-ipad-ui";

  const debug = { log: [] };
  const VERSION = window.SOLIDCRAFT_IPAD_RELEASE.version;
  const t0 = performance.now();
  const note = (s) => {
    const line = ((performance.now() - t0) / 1000).toFixed(1) + " " + s;
    (debug.allLog || (debug.allLog = [])).push(line);
    debug.log.push(line);
    if (debug.log.length > 60) debug.log.shift();
  };
  debug.errors = [];
  addEventListener("error", (e) => { debug.errors.push(String(e.message || e.error).slice(0, 160)); });
  addEventListener("unhandledrejection", (e) => { debug.errors.push("promise: " + String(e.reason).slice(0, 160)); });

  let sketchTools = null;
  let touchShell = null;
  let keypadTools = null;
  let synthetic = false;
  let lastFingerTime = 0;
  let stylusDown = 0;

  const canvas = () => document.getElementById("solidcraft_canvas");
  const api = () => (typeof window.solidcraft === "object" && window.solidcraft) || null;
  const req = (m, p) => api().request(m, p || {});
  const exec = (c, p) => api().execute(c, p || {});
  const isStylus = (t) => t.touchType === "stylus";
  const inOverlay = (e) => !!(e.target && e.target.closest && e.target.closest("#" + UI_ID + ", #fork-info"));
  const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // =====================================================================================
  // Nachgebildete Mausereignisse
  // =====================================================================================
  const BUTTONS = { 0: 1, 1: 4, 2: 2 };
  function fire(type, x, y, button = 0, down = false, additive = false) {
    const c = canvas();
    if (!c) return;
    const init = {
      bubbles: true, cancelable: true, composed: true, view: window,
      clientX: x, clientY: y, screenX: x, screenY: y,
      button, buttons: down ? BUTTONS[button] : 0,
      shiftKey: additive,
      pointerId: 1, pointerType: "mouse", isPrimary: true,
    };
    synthetic = true;
    try {
      const Ev = type.startsWith("pointer") && typeof PointerEvent === "function" ? PointerEvent : MouseEvent;
      c.dispatchEvent(new Ev(type, init));
    } finally {
      synthetic = false;
    }
  }
  const hover = (x, y) => fire("mousemove", x, y, 0, false);
  const press = (x, y, b = 0, additive = false) => { hover(x, y); fire("pointerdown", x, y, b, true, additive); note("press b" + b + " " + Math.round(x) + "," + Math.round(y)); };
  const release = (x, y, b = 0, additive = false) => { fire("pointerup", x, y, b, false, additive); note("release b" + b); };
  const clickAt = (x, y, b = 0, additive = false) => { press(x, y, b, additive); release(x, y, b, additive); };

  // Klick wie von einer Maus: erst hinbewegen, zwei Frames warten (die App ordnet den Druck dem
  // Element unter dem Zeiger des vorigen Frames zu), dann drücken.
  async function clickUI(x, y, double = false, additive = false) {
    fieldPos = { x, y };
    hover(x, y);
    await frame();
    await frame();
    clickAt(x, y, 0, additive);
    if (double) clickAt(x, y);
  }

  // Bewegungen höchstens einmal pro Frame; Loslassen nie im selben Frame wie die letzte Bewegung.
  let queuedMove = null, moveFrame = 0;
  function move(x, y) {
    queuedMove = { x, y };
    if (!moveFrame) moveFrame = requestAnimationFrame(flushMove);
  }
  function flushMove() {
    moveFrame = 0;
    if (queuedMove) { fire("mousemove", queuedMove.x, queuedMove.y, 0, true); queuedMove = null; }
  }
  function releaseAfterMoves(x, y) {
    if (moveFrame) { cancelAnimationFrame(moveFrame); moveFrame = 0; }
    if (queuedMove) {
      fire("mousemove", queuedMove.x, queuedMove.y, 0, true);
      queuedMove = null;
      requestAnimationFrame(() => release(x, y, 0));
    } else {
      release(x, y, 0);
    }
  }

  // =====================================================================================
  // Bereiche der Bedienoberfläche (Finger dürfen nur dort klicken)
  // =====================================================================================
  // Die App meldet über ui.handles die Mittelpunkte ihrer Bedienelemente. Daraus werden Rechtecke
  // für Leisten, Browser, Dialoge, Navigationsleiste usw. gebildet. Alles außerhalb davon ist die
  // 3D-Fläche, auf der Finger nur navigieren.
  const zones = { rects: [], viewport: null, names: [], at: 0 };
  let zoneRequest = null;

  function groupOf(name) {
    const p = name.split(":")[0];
    if (["browser", "row", "eye", "fold", "indent", "left-browser-rail", "family"].includes(p)) return "browser";
    if (["dialog", "sketch_palette", "normal", "construction", "centerline", "infinite", "motion"].includes(p)) return "dialog";
    if (["tab", "toolbar", "button", "panel", "ribbon", "dropdown", "dropdown_hot", "dropdown_pin", "customize", "shortcut", "palette"].includes(p)) return "ribbon";
    if (["appbar", "titlebar"].includes(p)) return "appbar";
    if (["history", "timeline"].includes(p)) return "timeline";
    if (["axis_view", "navigation_cube"].includes(p)) return "axis";
    if (p === "nav") return "nav";
    return null;
  }

  function buildZones(handles, viewport) {
    const groups = new Map();
    const singles = [];
    for (const h of handles) {
      if (!Number.isFinite(h.x) || !Number.isFinite(h.y)) continue;
      const g = groupOf(h.name);
      if (!g) { singles.push(h); continue; }
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(h);
    }
    const vpArea = viewport ? viewport[2] * viewport[3] : innerWidth * innerHeight;
    const rects = [];
    for (const [g, hs] of groups) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const h of hs) { x0 = Math.min(x0, h.x); y0 = Math.min(y0, h.y); x1 = Math.max(x1, h.x); y1 = Math.max(y1, h.y); }
      const card = g === "dialog" && hs.find((h) => h.name === "dialog:card");
      if (card) {
        // Dialogkarte: symmetrisch um ihren Mittelpunkt
        const half = Math.max(...hs.map((h) => Math.abs(h.x - card.x))) + ZONE_PAD + 4;
        x0 = card.x - half; x1 = card.x + half;
      } else {
        x0 -= ZONE_PAD; x1 += ZONE_PAD;
      }
      y0 -= ZONE_PAD; y1 += ZONE_PAD;
      if ((x1 - x0) * (y1 - y0) > 0.45 * vpArea) {
        for (const h of hs) singles.push(h); // unplausibel groß: lieber einzeln
      } else {
        rects.push({ x0, y0, x1, y1, g });
      }
    }
    for (const h of singles) rects.push({ x0: h.x - ZONE_PAD, y0: h.y - ZONE_PAD, x1: h.x + ZONE_PAD, y1: h.y + ZONE_PAD, g: h.name });
    return rects;
  }

  function refreshZones() {
    if (!api() || zoneRequest) return zoneRequest;
    zoneRequest = Promise.all([req("ui.handles"), req("ui.inspect")])
      .then(([handles, info]) => {
        const list = Array.isArray(handles) ? handles : (handles && handles.handles) || [];
        zones.viewport = info.viewport || null;
        zones.count = list.length;
        zones.rects = buildZones(list, zones.viewport);
        zones.names = list.map((h) => h.name);
        zones.handles = list;
        zones.at = performance.now();
      })
      .catch((err) => { zones.error = String(err).slice(0, 160); note("zones failed " + zones.error); })
      .finally(() => { zoneRequest = null; });
    return zoneRequest;
  }

  function zoneAt(x, y) {
    const vp = zones.viewport;
    if (vp && (x < vp[0] || y < vp[1] || x > vp[0] + vp[2] || y > vp[1] + vp[3])) return "outside";
    for (const r of zones.rects) if (x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1) return r.g;
    return null;
  }
  const isUI = (x, y) => zoneAt(x, y) !== null || !!(touchShell && touchShell.containsPoint(x,y));

  // Menüs (Kontextmenü, Datei-Menü, Aufklappmenüs) melden keine Bedienelemente. Nachdem ein
  // Fingertipp eines geöffnet haben kann, geht der nächste Fingertipp deshalb in jedem Fall an die App.
  const MENU_OPENERS = /^(appbar:(file|folder|home)|titlebar:home|panel:|ribbon:(section|add_tab|workspace)|tab:overflow|nav:view|nav:slot:(visual_style|display)|dropdown|dialog:(Type|Extent Type|Operation|Direction|Chamfer Type|Line Type)$)/;
  function mayOpenMenu(x, y) {
    let best = null, bd = 40;
    for (const h of zones.handles || []) {
      const d = Math.hypot(h.x - x, h.y - y);
      if (d < bd) { bd = d; best = h; }
    }
    return !!best && MENU_OPENERS.test(best.name);
  }

  // =====================================================================================
  // Kamera über die eingebaute Browser-API
  // =====================================================================================
  const cam = { camera: null, viewport: [1, 1], anchor: null, busy: false, pan: [0, 0], orbit: [0, 0], zoom: 1, gen: 0 };

  async function beginCamera(cx, cy) {
    if (!api()) return;
    const gen = ++cam.gen;
    cam.camera = null; cam.anchor = null; cam.pan = [0, 0]; cam.orbit = [0, 0]; cam.zoom = 1;
    try {
      const dpr = window.devicePixelRatio || 1;
      const [info, pick] = await Promise.all([
        req("ui.inspect"),
        req("ui.pick", { pixels: [[cx * dpr, cy * dpr]] }).catch(() => null),
      ]);
      if (gen !== cam.gen) return;
      cam.camera = info.camera;
      const vp = info.viewport || [0, 0, innerWidth, innerHeight];
      cam.viewport = [Math.max(1, vp[2]), Math.max(1, vp[3])];
      const hit = Array.isArray(pick) ? pick[0] : pick && (pick.hits || pick.results || [])[0];
      if (hit && Array.isArray(hit.point)) cam.anchor = hit.point;
      pump();
    } catch (_) { /* App noch nicht bereit */ }
  }

  async function navigate(params) {
    const r = await exec("view.navigate", Object.assign({ camera: cam.camera }, params));
    if (r && r.camera) cam.camera = r.camera;
  }

  async function pump() {
    if (cam.busy || !cam.camera || !api()) return;
    cam.busy = true;
    const gen = cam.gen;
    try {
      while (gen === cam.gen) {
        const { pan, orbit, zoom } = cam;
        if (zoom === 1 && !pan[0] && !pan[1] && !orbit[0] && !orbit[1]) break;
        cam.pan = [0, 0]; cam.orbit = [0, 0]; cam.zoom = 1;
        if (zoom !== 1) {
          const p = { motion: "zoom", factor: Math.min(20, Math.max(0.05, 1 / zoom)) };
          if (cam.anchor) p.anchor = cam.anchor;
          await navigate(p);
        }
        if (pan[0] || pan[1]) await navigate({ motion: "pan", delta: pan, viewport: cam.viewport });
        if (orbit[0] || orbit[1]) {
          const p = { motion: "orbit", delta: orbit, viewport: cam.viewport };
          if (cam.anchor) p.pivot = cam.anchor;
          await navigate(p);
        }
      }
    } catch (e) {
      console.warn("touch-nav:", e);
    } finally {
      cam.busy = false;
    }
  }

  // =====================================================================================
  // Fingergesten
  // =====================================================================================
  // idle → pending (1 Finger, unentschieden) → drag (auf Bedienelement, als Maus weitergegeben)
  //                                         → orbit (auf der 3D-Fläche)
  //                                         → multi (2/3 Finger)
  //                                         → done (Kontextmenü ausgelöst)
  let state = "idle";
  const fingers = new Map();
  let start = null, last = null, longTimer = 0, multi = null;
  let menuMaybeOpen = false;
  let lastTap = null;

  function centroid() {
    let x = 0, y = 0;
    for (const f of fingers.values()) { x += f.x; y += f.y; }
    const n = Math.max(1, fingers.size);
    x /= n; y /= n;
    let d = 0;
    for (const f of fingers.values()) d += Math.hypot(f.x - x, f.y - y);
    return { x, y, d: d / n };
  }
  function clearLong() { if (longTimer) { clearTimeout(longTimer); longTimer = 0; } }

  function enterMulti() {
    clearLong();
    if (state === "drag" && last) releaseAfterMoves(last.x, last.y);
    state = "multi";
    const c = centroid();
    multi = { cx: c.x, cy: c.y, dist: c.d, count: fingers.size, maxCount: fingers.size, moved: false, t: start ? start.t : 0 };
    beginCamera(c.x, c.y);
  }
  function rebaseMulti() {
    const c = centroid();
    multi.cx = c.x; multi.cy = c.y; multi.dist = c.d; multi.count = fingers.size;
    multi.maxCount = Math.max(multi.maxCount, fingers.size);
  }
  function onMultiMove() {
    if (fingers.size !== multi.count) { rebaseMulti(); return; }
    const c = centroid();
    const dx = c.x - multi.cx, dy = c.y - multi.cy;
    if (Math.hypot(dx, dy) > MOVE_SLOP / 2 || Math.abs(c.d - multi.dist) > MOVE_SLOP / 2) multi.moved = true;
    if (fingers.size >= 3) {
      cam.orbit = [cam.orbit[0] + dx, cam.orbit[1] + dy];
    } else if (fingers.size === 2) {
      cam.pan = [cam.pan[0] + dx, cam.pan[1] + dy];
      if (multi.dist > 4 && c.d > 4) cam.zoom *= c.d / multi.dist;
    }
    multi.cx = c.x; multi.cy = c.y; multi.dist = c.d;
    pump();
  }

  function block(e) { e.preventDefault(); e.stopImmediatePropagation(); }

  function logTouch(e) {
    const ts = [...e.changedTouches].map((t) => (t.touchType || "?") + "@" + Math.round(t.clientX) + "," + Math.round(t.clientY)).join(" ");
    note(e.type + " " + ts + " n=" + e.touches.length + " " + state + (inOverlay(e) ? " overlay" : ""));
  }
  function onTouchStart(e) {
    logTouch(e);
    if (inOverlay(e)) return;
    const changed = [...e.changedTouches];
    if (((sketchTools && sketchTools.editing) || (keypadTools && keypadTools.active)) && changed.length) { if (keypadTools && keypadTools.active) keypadTools.cancel(); else sketchTools.cancel(); block(e); return; }
    lastFingerTime = performance.now();
    block(e);
    if (changed.some(isStylus)) { stylusDown += changed.filter(isStylus).length; onStylusStart(changed.find(isStylus)); return; }
    if (stylusDown > 0) return; // Handballen beim Zeichnen
    for (const t of changed) fingers.set(t.identifier, { x: t.clientX, y: t.clientY });

    if (state === "idle" && fingers.size === 1) {
      const t = changed[0];
      state = "pending";
      start = { x: t.clientX, y: t.clientY, t: e.timeStamp };
      last = { x: t.clientX, y: t.clientY };
      refreshZones();
      longTimer = setTimeout(() => {
        longTimer = 0;
        // erst nach dem nächsten Frame: wartende Berührungen werden vorher verarbeitet
        requestAnimationFrame(() => {
          if (state !== "pending" || !last) return;
          state = "done";
          hover(last.x, last.y);
          requestAnimationFrame(() => { clickAt(last.x, last.y, 2); });
          menuMaybeOpen = true;
          lastTap = { x: last.x, y: last.y };
          note("long-press");
        });
      }, LONG_PRESS_MS);
    } else if (state === "idle" && fingers.size >= 2) {
      const t = changed[0];
      start = { x: t.clientX, y: t.clientY, t: e.timeStamp };
      last = null;
      enterMulti();
    } else if (state === "pending" || state === "drag" || state === "orbit") {
      enterMulti();
    } else if (state === "multi") {
      rebaseMulti();
    }
  }

  function onTouchMove(e) {
    if (inOverlay(e)) return;
    const changed = [...e.changedTouches];
    lastFingerTime = performance.now();
    block(e);
    const pen = changed.find(isStylus);
    if (pen) { onStylusMove(pen); return; }
    if (stylusDown > 0) return;
    for (const t of changed) if (fingers.has(t.identifier)) fingers.set(t.identifier, { x: t.clientX, y: t.clientY });
    const t = changed[0];

    if (state === "pending") {
      if (Math.hypot(t.clientX - start.x, t.clientY - start.y) > MOVE_SLOP) {
        clearLong();
        if (isUI(start.x, start.y)) {
          state = "drag";
          hover(start.x, start.y);
          press(start.x, start.y, 0);
          move(t.clientX, t.clientY);
          note("drag ui " + zoneAt(start.x, start.y));
        } else {
          state = "orbit";
          beginCamera(start.x, start.y);
          cam.orbit = [t.clientX - start.x, t.clientY - start.y];
          note("orbit");
        }
        last = { x: t.clientX, y: t.clientY };
      }
    } else if (state === "drag") {
      move(t.clientX, t.clientY);
      last = { x: t.clientX, y: t.clientY };
    } else if (state === "orbit") {
      cam.orbit = [cam.orbit[0] + t.clientX - last.x, cam.orbit[1] + t.clientY - last.y];
      last = { x: t.clientX, y: t.clientY };
      pump();
    } else if (state === "multi") {
      onMultiMove();
    }
  }

  function onTouchEnd(e) {
    logTouch(e);
    if (inOverlay(e)) return;
    const changed = [...e.changedTouches];
    lastFingerTime = performance.now();
    block(e);
    if (changed.some(isStylus)) {
      stylusDown = Math.max(0, stylusDown - changed.filter(isStylus).length);
      if (e.touches.length === 0) stylusDown = 0;
      onStylusEnd(changed.find(isStylus), e.type === "touchcancel");
      return;
    }
    for (const t of changed) fingers.delete(t.identifier);
    const t = changed[0];

    if (state === "pending") {
      clearLong();
      if (e.type === "touchend") fingerTap(start.x, start.y);
      state = "idle";
    } else if (state === "drag") {
      releaseAfterMoves(t.clientX, t.clientY);
      state = "idle";
    } else if (state === "orbit") {
      state = "idle";
    } else if (state === "multi") {
      if (fingers.size === 0) {
        const quick = e.timeStamp - multi.t < TAP_MS;
        debug.lastMulti = { ms: Math.round(e.timeStamp - multi.t), moved: multi.moved, fingers: multi.maxCount };
        if (e.type === "touchend" && quick && !multi.moved && api()) {
          if (multi.maxCount === 2) exec("edit.undo").catch(() => {});
          else if (multi.maxCount === 3) exec("edit.redo").catch(() => {});
        }
        multi = null;
        state = "idle";
      } else {
        rebaseMulti();
      }
    } else if (state === "done" && fingers.size === 0) {
      state = "idle";
    }
    if (e.touches.length === 0 || [...e.touches].every(isStylus)) {
      clearLong();
      fingers.clear();
      if (state !== "idle") { state = "idle"; multi = null; }
    }
  }

  // Fingertipp: nur auf Bedienelementen (oder in ein offenes Menü) wird geklickt.
  function fingerTap(x, y) {
    const zone = zoneAt(x, y);
    // Ohne Kenntnis der Bedienelemente (noch nicht geladen oder Fehler) lieber klicken als nichts tun.
    const unknown = !zones.count;
    if (zone !== null || menuMaybeOpen || unknown) {
      const wasMenu = menuMaybeOpen;
      menuMaybeOpen = zone !== null && mayOpenMenu(x, y);
      // Der Zeiger muss schon im Frame davor über dem Element stehen; iOS verlangt den Fokus des
      // Textfelds aber während der Berührung. Darum: hinbewegen, sofort klicken, Fokus erneuern.
      hover(x, y);
      fieldPos = { x, y };
      requestAnimationFrame(() => requestAnimationFrame(() => { clickAt(x, y); scheduleSelectionCheck(); }));
      lastTap = { x, y };
      note("tap ui " + zone + (wasMenu ? " (menu)" : ""));
    } else {
      ripple(x, y);
      const now = performance.now();
      if (lastCanvasTap && now - lastCanvasTap.t < 400 && Math.hypot(x - lastCanvasTap.x, y - lastCanvasTap.y) < 40) {
        lastCanvasTap = null;
        lookAtFace(x, y);
      } else {
        lastCanvasTap = { x, y, t: now };
        note("tap canvas ignored");
      }
    }
  }
  let lastCanvasTap = null;

  async function pickAt(x, y) {
    const dpr = window.devicePixelRatio || 1;
    const r = await req("ui.pick", { pixels: [[x * dpr, y * dpr]] });
    return (r && r.hits && r.hits[0]) || null;
  }

  // Doppeltipp mit dem Finger auf eine Fläche: senkrecht darauf schauen (wie in Shapr3D).
  async function lookAtFace(x, y) {
    if (!api()) return;
    try {
      const hit = await pickAt(x, y);
      if (!hit || !Array.isArray(hit.normal)) { await exec("view.fit"); note("doppeltipp: einpassen"); return; }
      const [nx, ny, nz] = hit.normal;
      const pitch = Math.asin(Math.max(-1, Math.min(1, nz)));
      const yaw = Math.abs(nz) > 0.999 ? 0 : Math.atan2(-nx, -ny);
      await req("ui.camera", { target: hit.point, yaw, pitch, roll: 0 });
      note("doppeltipp: blick auf fläche");
    } catch (e) {
      note("lookAt fehler " + e);
    }
  }

  // Zeigerereignisse von Fingern verwerfen (die App bekommt die nachgebildeten Mausereignisse).
  function onPointer(e) {
    if (!synthetic && (e.type === "pointerdown" || e.type === "pointerup")) note(e.type + " " + e.pointerType + (inOverlay(e) ? " overlay" : "") + " " + Math.round(e.clientX) + "," + Math.round(e.clientY));
    if (synthetic || inOverlay(e)) return;
    // Pencil schwebt über dem Display (iPad mit Hover-Unterstützung): als Zeigerbewegung weitergeben,
    // damit Fangpunkte, Vorschau und Hervorhebung schon vor dem Aufsetzen erscheinen.
    if (e.pointerType === "pen" && e.type === "pointermove" && e.buttons === 0 && !stylusStart) {
      hoverPen(e.clientX, e.clientY);
    }
    if (e.pointerType === "touch" || e.pointerType === "pen") block(e);
  }
  let penHover = null, penHoverFrame = 0;
  function hoverPen(x, y) {
    penHover = { x, y };
    if (!penHoverFrame) penHoverFrame = requestAnimationFrame(() => {
      penHoverFrame = 0;
      if (penHover && (!stylusStart || stylusStart.draw)) hover(penHover.x, penHover.y);
      penHover = null;
    });
  }
  function onMouse(e) {
    if (synthetic || inOverlay(e)) return;
    if (performance.now() - lastFingerTime < MOUSE_GUARD_MS) block(e);
  }
  function onGesture(e) { if (!inOverlay(e)) block(e); }

  // =====================================================================================
  // Apple Pencil: als Maus mit linker Taste an die App
  // =====================================================================================
  // Der Druck folgt zwei Frames nach dem Hinbewegen, damit die App ihn dem richtigen Element
  // zuordnet (3D-Fläche, Dialog, Leiste). Bewegungen gehen einmal pro Frame weiter.
  // Pencil: Der Druck wird erst ausgelöst, wenn feststeht, was gemeint ist. Bewegt sich der Stift,
  // wird gezogen (Druck am Startpunkt, dann Bewegung); hebt er ab, ist es ein Klick; bleibt er
  // ruhig liegen, öffnet sich das Kontextmenü. So entsteht kein ungewolltes „Halten“ in der App.
  let stylusStart = null;
  function onStylusStart(t) {
    if (!t) return;
    const s = { x: t.clientX, y: t.clientY, moved: false, pressed: false, menu: false, pressure: t.force };
    fieldPos = { x: s.x, y: s.y };
    stylusStart = s;
    lastTap = { x: t.clientX, y: t.clientY };
    menuMaybeOpen = false;
    hideBar();
    hover(s.x, s.y);
    const extension = window.solidcraftTouchNav && window.solidcraftTouchNav.extension;
    if (extension && extension.prefetch) extension.prefetch(s);
    // Gedrückt halten (wie in Shapr3D): danach ziehen = Bereichsauswahl, ohne Ziehen abheben = Kontextmenü.
    s.timer = setTimeout(() => {
      if (stylusStart !== s || s.moved || s.pressed) return;
      s.held = true;
      ripple(s.x, s.y);
      note("pencil gehalten");
    }, LONG_PRESS_MS);
  }
  function onStylusMove(t) {
    const s = stylusStart;
    if (!t || !s || s.menu) return;
    if (s.ext) { s.ext.move(s, t); return; }
    if (!s.moved && Math.hypot(t.clientX - s.x, t.clientY - s.y) > MOVE_SLOP / 2) {
      s.moved = true;
      clearTimeout(s.timer);
      const extension = window.solidcraftTouchNav && window.solidcraftTouchNav.extension;
      if (s.held) {
        // Bereichsauswahl: Rahmen von der Startstelle aus aufziehen
        hover(s.x, s.y);
        press(s.x, s.y, 0);
        s.pressed = true;
        note("bereichsauswahl");
      } else if (extension && extension.claim(s)) {
        s.ext = extension;
        s.ext.move(s, t);
        return;
      } else if (isDrawTool()) {
        // Zeichnen: erster Punkt als Klick, danach nur Zeigerbewegung (Vorschau), Klick beim Abheben.
        s.draw = true;
        const continues = chainEnd && /^sketch\.line/.test(appState.tool) && Math.hypot(s.x - chainEnd.x, s.y - chainEnd.y) < 14;
        if (!continues) clickAt(s.x, s.y, 0);
        note("zeichnen " + appState.tool + (continues ? " (kette)" : ""));
      } else {
        hover(s.x, s.y);
        press(s.x, s.y, 0);
        s.pressed = true;
      }
    }
    if (s.draw) hoverPen(t.clientX, t.clientY);
    else if (s.pressed) move(t.clientX, t.clientY);
  }
  function onStylusEnd(t, cancelled) {
    const s = stylusStart;
    stylusStart = null;
    if (!s) return;
    clearTimeout(s.timer);
    if (s.menu) return;
    const at = t ? { x: t.clientX, y: t.clientY } : s;
    if (s.ext) { s.ext.end(s, at, cancelled); setTimeout(scheduleSelectionCheck, 120); return; }
    if (s.held && !s.moved && !cancelled) {
      const openMenu = () => { clickAt(s.x,s.y,2);menuMaybeOpen=true;hideBar();note("pencil kontextmenü"); };
      const extension=window.solidcraftTouchNav && window.solidcraftTouchNav.extension;
      if(extension && extension.hold)Promise.resolve(extension.hold(s)).then(handled=>{if(!handled)openMenu();scheduleSelectionCheck();}).catch(()=>openMenu());
      else openMenu();
      return;
    }
    if (s.draw) {
      if (!cancelled) {
        hover(at.x, at.y);
        requestAnimationFrame(() => requestAnimationFrame(() => clickAt(at.x, at.y, 0)));
        chainEnd = /^sketch\.line/.test(appState.tool || "") ? at : null;
      }
      setTimeout(pollState, 120);
      return;
    }
    if (s.pressed) releaseAfterMoves(at.x, at.y);
    else if (!cancelled) {
      const additive = !!(sketchTools && sketchTools.additiveAt(s.x, s.y));
      requestAnimationFrame(() => requestAnimationFrame(() => clickAt(s.x, s.y, 0, additive)));
      const extension = window.solidcraftTouchNav && window.solidcraftTouchNav.extension;
      if (!additive && extension && extension.tap) setTimeout(() => extension.tap(s), 150);
      chainEnd = /^sketch\.line/.test(appState.tool || "") ? { x: s.x, y: s.y } : null;
    }
    setTimeout(pollState, 120);
    if (!s.moved && !cancelled) {
      const now = performance.now();
      if (lastPencilTap && now - lastPencilTap.t < 400 && Math.hypot(s.x - lastPencilTap.x, s.y - lastPencilTap.y) < 30) {
        lastPencilTap = null;
        setTimeout(() => selectBodyAt(s.x, s.y), 80);
      } else {
        lastPencilTap = { x: s.x, y: s.y, t: now };
        setTimeout(() => editTappedDimension(s.x, s.y), 60);
      }
    }
    setTimeout(scheduleSelectionCheck, 60);
  }

  let lastPencilTap = null;

  // Aktives Werkzeug, regelmäßig abgefragt: entscheidet, wie ein Pencil-Zug gemeint ist.
  const appState = { tool: null, dialog: false, home: false, tab: "" };
  let stateBusy = false;
  async function pollState() {
    if (!api() || stateBusy || document.hidden) return;
    stateBusy = true;
    try {
      const info = await req("ui.inspect");
      appState.tool = info.tool || null;
      appState.dialog = info.dialog != null;
      appState.home = !!info.home;
      appState.tab = (info.ui && info.ui.tab) || "";
    } catch (_) {
    } finally {
      stateBusy = false;
    }
  }
  setInterval(pollState, 400);

  // Zeichenwerkzeuge, bei denen ein Pencil-Zug wie in Shapr3D gezeichnet wird: Aufsetzen setzt den
  // ersten Punkt, Abheben den zweiten. SolidCraft erwartet dafür zwei Klicks; der Zug wird übersetzt.
  const DRAW_TOOLS = /^sketch\.(line|rectangle\.|circle\.(center|two_point)|arc\.(center_point|tangent)|polygon\.|slot\.(center_to_center|overall|center_point)|ellipse|construction_line)/;
  const isDrawTool = () => !!appState.tool && DRAW_TOOLS.test(appState.tool);
  let chainEnd = null; // letzter Endpunkt einer Linienkette (Bildschirm)
  // Doppeltipp mit dem Pencil auf ein Modell: ganzen Körper auswählen (wie in Shapr3D).
  async function selectBodyAt(x, y) {
    if (!api()) return;
    try {
      const info = await req("ui.inspect");
      if (info.tool != null || info.dialog != null || (info.ui && info.ui.tab === "SKETCH")) return;
      const hit = await pickAt(x, y);
      if (!hit || !hit.body) return;
      await exec("select.set", { items: [{ type: "body", body: hit.body }] });
      note("doppeltipp pencil: körper " + hit.body);
      scheduleSelectionCheck();
    } catch (e) {
      note("körperauswahl fehler " + e);
    }
  }

  // Ein Pencil-Tipp auf eine Bemaßung öffnet sofort deren Eingabefeld (wie in Shapr3D).
  async function editTappedDimension(x, y) {
    if (!api()) return;
    await frame(); await frame(); await frame();
    try {
      const [sel, info] = await Promise.all([req("ui.selection"), req("ui.inspect")]);
      if (info.tool != null || info.dialog != null) return; // ein Werkzeug ist aktiv: Pencil zeichnet
      if (sel.dimension_editing || !sel.dimension_selected || sel.dimension_selected.length !== 1) return;
      const id = sel.dimension_selected[0];
      const d = (sel.dimensions || []).find((k) => k.id === id);
      if (!d) return;
      if (x != null && Math.hypot(d.x - x, d.y - y) > 60) return; // nicht auf die Bemaßung getippt
      note("edit dim " + id);
      await clickUI(d.x, d.y, true);
    } catch (_) {}
  }

  // =====================================================================================
  // Textfeld der App: Ziffernfeld statt Bildschirmtastatur
  // =====================================================================================
  let agent = null;
  let textMode = false; // Nutzer will die Systemtastatur
  function textAgent() {
    if (agent && agent.isConnected) return agent;
    const c = canvas();
    let el = c && c.parentNode && [...c.parentNode.children].find((n) => n.tagName === "INPUT" && n.type === "text");
    if (!el) el = document.querySelector("body > input[type=text]");
    if (el && el !== agent) {
      agent = el;
      el.setAttribute("inputmode", "none");
      el.setAttribute("autocomplete", "off");
      el.setAttribute("autocorrect", "off");
      el.setAttribute("spellcheck", "false");
      el.addEventListener("focus", onAgentFocus);
      el.addEventListener("blur", onAgentBlur);
      if (document.activeElement === el) onAgentFocus();
    }
    return agent;
  }

  // Welches Feld hat den Fokus, und ist es ein Zahlenfeld? Wird beim Fokussieren und danach
  // regelmäßig geprüft, weil die App zwischen Feldern wechselt, ohne den Fokus abzugeben.
  let firstKey = true;
  let fieldKey = "";
  let checking = false;
  let padTab = false;
  let blurredCount = 0;
  async function fieldCheck() {
    if (sketchTools && sketchTools.editing) return;
    if(keypadTools&&keypadTools.active){keypadTools.native.observe();return;}
    if(stylusStart)return;
    const el = agent;
    if (!el || checking || !api()) return;
    debug.fc = (debug.fc || 0) + 1;
    if (document.activeElement !== el) {
      debug.fcBranch = "blurred";
      // Die App gibt den Fokus beim Feldwechsel kurz an die Zeichenfläche ab: erst beim zweiten
      // Mal hintereinander ausblenden, damit das Ziffernfeld nicht flackert.
      if (++blurredCount < 2) return;
      if (fieldKey) { fieldKey = ""; textMode = false; el.setAttribute("inputmode", "none"); showPad(false); showKeyboardPill(false); }
      return;
    }
    blurredCount = 0;
    if (textMode) return;
    checking = true;
    try {
      const [sel, info] = await Promise.all([req("ui.selection"), req("ui.inspect")]);
      if (document.activeElement !== el || textMode) return;
      const dlg = typeof info.dialog === "string" ? info.dialog : "";
      const vf = /value_focus: Some\(([^)]*)\)/.exec(dlg);
      // Wertfelder beim Zeichnen (Länge, Winkel, Breite …) gehören zum aktiven Skizzenwerkzeug.
      const toolBox = !!info.tool && /^sketch\./.test(info.tool) && !/text/.test(info.tool);
      const numeric = !!(sel.dimension_editing || vf || toolBox);
      const k = sel.dimension_editing ? "dim:" + (sel.dimension_selected || []).join(",") : vf ? "dlg:" + vf[1] : toolBox ? "tool:" + info.tool : "text";
      padTab = toolBox;
      if (k !== fieldKey) { fieldKey = k; firstKey = true; }
      debug.lastField = numeric ? "number" : "text";
      debug.fcBranch = numeric ? "pad" : "pill";
      if (numeric) {
        showKeyboardPill(false);
        if (keypadTools) await keypadTools.native.begin(info,k,fieldPos); else showPad(true);
      }
      else { showPad(false); showKeyboardPill(true); }
    } catch (err) {
      debug.fcBranch = "error " + err;
    } finally {
      checking = false;
    }
  }
  function onAgentFocus() { setTimeout(fieldCheck, 40); }
  function onAgentBlur() { setTimeout(fieldCheck, 80); }
  setInterval(fieldCheck, 300);

  const isMac = /Mac|iPad|iPhone/.test(navigator.userAgent);
  function key(k, mods = {}) {
    const codes = { Backspace: 8, Tab: 9, Enter: 13, Escape: 27, a: 65, Home: 36, End: 35 };
    const init = {
      key: k, code: k.length === 1 ? "Key" + k.toUpperCase() : k, bubbles: true, cancelable: true, composed: true,
      ctrlKey: !!mods.cmd && !isMac, metaKey: !!mods.cmd && isMac,
    };
    for (const type of ["keydown", "keyup"]) {
      const ev = new KeyboardEvent(type, init);
      try {
        Object.defineProperty(ev, "keyCode", { get: () => codes[k] || 0 });
        Object.defineProperty(ev, "which", { get: () => codes[k] || 0 });
      } catch (_) {}
      (textAgent() || document).dispatchEvent(ev);
    }
  }
  function typeText(s) {
    const el = textAgent();
    if (!el) return;
    if (document.activeElement !== el) el.focus({ preventScroll: true });
    el.value += s;
    el.dispatchEvent(new InputEvent("input", { inputType: "insertText", data: s, bubbles: true }));
  }
  function padKey(k) {
    if (k === "vars" && keypadTools) { keypadTools.variables().catch(e=>note("Variable: "+e.message)); return; }
    if (sketchTools && sketchTools.editing) { sketchTools.key(k); return; }
    if (keypadTools && keypadTools.active) { keypadTools.native.key(k); return; }
    if (k === "ok") { key("Enter"); confirmDialog(); return; }
    if (k === "esc") { key("Escape"); return; }
    if (k === "back") { key("Backspace"); firstKey = false; return; }
    if (k === "abc") { openKeyboard(); return; }
    if (k === "tab") { key("Tab"); firstKey = true; return; }
    if (k === "") return;
    if (k === "neg") { key("Home"); typeText("-"); key("End"); firstKey = false; return; }
    if (firstKey) { key("a", { cmd: true }); firstKey = false; } // ersten Wert ersetzen
    typeText(k);
  }
  // ✓ übernimmt den Wert und bestätigt einen offenen Befehl (Abrunden, Fase, Extrudieren …),
  // so wie in Shapr3D ein Haken die Operation abschließt.
  async function confirmDialog() {
    if (!api()) return;
    try {
      await frame(); await frame();
      const [sel, info] = await Promise.all([req("ui.selection"), req("ui.inspect")]);
      if (sel.dimension_editing || info.dialog == null) return;
      const ok = (await req("ui.handles")).find((h) => h.name === "dialog:ok");
      if (ok) { note("confirm"); await clickUI(ok.x, ok.y); }
    } catch (_) {}
  }
  function openKeyboard() {
    const el = textAgent();
    if (!el) return;
    textMode = true;
    showPad(false);
    showKeyboardPill(false);
    el.setAttribute("inputmode", "text");
    el.blur();
    el.focus({ preventScroll: true });
  }

  // =====================================================================================
  // Oberfläche: Ziffernfeld, Tastatur-Knopf, Kontextleiste
  // =====================================================================================
  let root, pad, pill, bar;
  function buildUI() {
    if (root) return;
    const css = document.createElement("style");
    css.textContent = `
#${UI_ID}{position:fixed;inset:0;pointer-events:none;z-index:2147483000;font:500 17px -apple-system,system-ui,sans-serif;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
#${UI_ID} .sc-panel{pointer-events:auto;position:absolute;background:rgba(36,40,48,.96);border:1px solid rgba(255,255,255,.12);border-radius:16px;box-shadow:0 10px 30px rgba(0,0,0,.45);color:#e8ebf0;touch-action:none}
#${UI_ID} .sc-pad{left:16px;bottom:72px;padding:10px;display:none;grid-template-columns:repeat(5,64px);gap:8px}
#${UI_ID} .sc-pad .unit{height:40px;background:transparent;font-size:16px}
#${UI_ID} .sc-pad .tall{grid-row:span 3;height:auto}
#${UI_ID} .sc-pad.on{display:grid}
#${UI_ID} button{all:unset;box-sizing:border-box;display:flex;align-items:center;justify-content:center;height:54px;border-radius:12px;background:rgba(255,255,255,.08);color:inherit;font:inherit;cursor:pointer}
#${UI_ID} button.down{background:rgba(255,255,255,.24)}
#${UI_ID} button.op{background:rgba(255,255,255,.04);color:#9fc3ff}
#${UI_ID} button.ok{background:#2f7cf6;color:#fff;font-size:26px}
#${UI_ID} button.esc{color:#ffb4a8}
#${UI_ID} .sc-pill{top:58px;left:50%;transform:translateX(-50%);display:none;padding:6px}
#${UI_ID} .sc-pill.on{display:block}
#${UI_ID} .sc-pill button{height:44px;padding:0 18px}
#${UI_ID} .sc-bar{display:none;padding:6px;gap:6px;flex-wrap:nowrap}
#${UI_ID} .sc-bar.on{display:flex}
#${UI_ID} .sc-bar button{height:44px;padding:0 16px;white-space:nowrap;background:rgba(255,255,255,.06)}
#${UI_ID} .sc-ripple{position:absolute;width:36px;height:36px;margin:-18px 0 0 -18px;border-radius:50%;border:2px solid rgba(255,255,255,.35);animation:scr .35s ease-out forwards}
@keyframes scr{from{transform:scale(.4);opacity:1}to{transform:scale(1.4);opacity:0}}`;
    document.head.appendChild(css);
    root = document.createElement("div");
    root.id = UI_ID;

    pad = document.createElement("div");
    pad.className = "sc-panel sc-pad";
    const keys = [
      ["(", "(", "unit"], [")", ")", "unit"], ["mm", " mm", "unit"], ["cm", " cm", "unit"], ["m", " m", "unit"],
      ["7"], ["8"], ["9"], ["÷", "/", "op"], ["⌫", "back", "op"],
      ["4"], ["5"], ["6"], ["×", "*", "op"], ["✓", "ok", "ok tall"],
      ["1"], ["2"], ["3"], ["−", "-", "op"],
      ["±", "neg", "op"], ["0"], [".", "."], ["+", "+", "op"],
      ["⌨︎", "abc", "op"], ["Esc", "esc", "esc"], ["⇥", "tab", "op tabkey"], ["deg", " deg", "op"], ["x+", "vars", "op"],
    ];
    for (const [label, val, cls] of keys) {
      const b = document.createElement("button");
      b.textContent = label;
      b.dataset.k = val || label;
      if (cls) b.className = cls;
      pad.appendChild(b);
    }

    pill = document.createElement("div");
    pill.className = "sc-panel sc-pill";
    pill.innerHTML = '<button data-k="abc">⌨︎  Tastatur</button>';

    bar = document.createElement("div");
    bar.className = "sc-panel sc-bar";

    root.append(pad, pill, bar);
    document.body.appendChild(root);

    // Bedienung über Pointer-Ereignisse; pointerdown verhindert, dass das Textfeld den Fokus verliert.
    root.addEventListener("pointerdown", (e) => {
      const b = e.target.closest("button");
      e.preventDefault();
      if (b) b.classList.add("down");
    });
    root.addEventListener("pointerup", (e) => {
      const b = e.target.closest("button");
      e.preventDefault();
      root.querySelectorAll("button.down").forEach((x) => x.classList.remove("down"));
      if (!b) return;
      if (b.dataset.action && b.dataset.action.startsWith("rail:")) railAction(b.dataset.action.slice(5));
      else if (b.dataset.action) runAction(b.dataset.action);
      else if (b.dataset.k) padKey(b.dataset.k);
    });
    root.addEventListener("pointercancel", () => root.querySelectorAll("button.down").forEach((x) => x.classList.remove("down")));
    for (const t of ["touchstart", "touchend", "mousedown", "click", "dblclick"]) root.addEventListener(t, (e) => e.preventDefault(), { passive: false });
  }
  let fieldPos = null; // wo das Zahlenfeld liegt (für die Lage des Ziffernfelds)
  function showPad(on) {
    buildUI();
    const was = pad.classList.contains("on");
    pad.classList.toggle("on", on);
    if (!on || was) return;
    hideBar();
    // neben das Feld, aber nicht darüber (wie in Shapr3D)
    let p = fieldPos || lastTap || { x: innerWidth / 2, y: innerHeight / 2 };
    if (agent && !(sketchTools && sketchTools.editing)) {
      const r = agent.getBoundingClientRect();
      if (r.left > 2 || r.top > 2) p = { x: r.left, y: r.top };
    }
    const w = pad.offsetWidth, h = pad.offsetHeight;
    let x = p.x + 130, y = p.y - h / 2;
    if (x + w > innerWidth - 12) x = p.x - w - 130;
    x = Math.max(railWidth() + 12, Math.min(innerWidth - w - 12, x));
    y = Math.max(60, Math.min(innerHeight - h - 12, y));
    pad.style.left = x + "px"; pad.style.top = y + "px"; pad.style.bottom = "auto";
  }
  function showKeyboardPill(on) { buildUI(); pill.classList.toggle("on", on); }
  function ripple(x, y) {
    buildUI();
    const r = document.createElement("div");
    r.className = "sc-ripple";
    r.style.left = x + "px"; r.style.top = y + "px";
    root.appendChild(r);
    setTimeout(() => r.remove(), 400);
  }

  // ---------- Kontextleiste ----------
  let barKey = "";
  let selTimer = 0;
  function scheduleSelectionCheck() {
    clearTimeout(selTimer);
    selTimer = setTimeout(checkSelection, 180);
  }
  function hideBar() { if (bar) { bar.classList.remove("on"); barKey = ""; } }

  function actionsFor(sel, info) {
    const items = sel.selection || [];
    if (!items.length || sel.dimension_editing || info.dialog != null || info.tool != null) return [];
    const types = new Set(items.map((i) => i.type));
    const only = (t) => types.size === 1 && types.has(t);
    if (only("edge")) return [["Abrunden", "fillet"], ["Fase", "chamfer"]];
    if (only("face") && items.length === 1) return [["Extrudieren", "pushpull"], ["Skizze", "sketch"], ["Abrunden", "fillet"]];
    if (only("profile")) return [["Extrudieren", "extrude"]];
    if (only("sketch_curve") && items.length <= 2) return [["Bemaßen", "dimension"]];
    if (only("sketch_constraint") && (sel.dimension_selected || []).length === 1) return [["Wert ändern", "editdim"]];
    if (only("body")) return [["Abrunden", "fillet"], ["Fase", "chamfer"]];
    return [];
  }

  async function checkSelection() {
    if (!api() || (pad && pad.classList.contains("on"))) return;
    try {
      const [sel, info] = await Promise.all([req("ui.selection"), req("ui.inspect")]);
      if (sketchTools) await sketchTools.refresh(info, sel);
      let acts = actionsFor(sel, info);
      if (sketchTools && sketchTools.active && window.SolidCraftSketch.linePair(sketchTools.controller.snapshot.sketch, sel.selection)) {
        acts = window.SolidCraftSketch.dimensionChoices(sketchTools.controller.snapshot.sketch, sel.selection).filter((c) => c.enabled).map((c) => [c.label, "dimension:" + c.key]);
      }
      buildUI();
      if (info.home || menuMaybeOpen || !acts.length || (touchShell && touchShell.active)) { hideBar(); return; }
      note("auswahl " + (sel.selection || []).map((i) => i.type).join(","));
      const k = JSON.stringify([acts, sel.selection]);
      if (k === barKey && bar.classList.contains("on")) return;
      barKey = k;
      bar.innerHTML = "";
      for (const [label, action] of acts) {
        const b = document.createElement("button");
        b.textContent = label;
        b.dataset.action = action;
        bar.appendChild(b);
      }
      bar.classList.add("on");
      // neben die letzte Berührung, innerhalb des Fensters
      const p = lastTap || { x: innerWidth / 2, y: innerHeight / 2 };
      const w = bar.offsetWidth, h = bar.offsetHeight;
      let x = p.x - w / 2, y = p.y - h - 40;
      if (y < 60) y = p.y + 40;
      x = Math.max(12, Math.min(innerWidth - w - 12, x));
      y = Math.max(12, Math.min(innerHeight - h - 12, y));
      bar.style.left = x + "px"; bar.style.top = y + "px";
    } catch (_) {}
  }
  setInterval(() => {
    if (!document.hidden && api() && state === "idle" && !stylusStart) { checkSelection(); refreshRail(); }
  }, 900);

  async function waitDialog(tries = 30) {
    for (let i = 0; i < tries; i++) {
      await frame();
      const info = await req("ui.inspect");
      if (info.dialog != null) return info;
      await sleep(30);
    }
    return null;
  }
  async function focusField(labels) {
    for (let i = 0; i < 20; i++) {
      const hs = await req("ui.handles");
      for (const l of labels) {
        const h = hs.find((x) => x.name === "dialog:" + l);
        if (h) { await clickUI(h.x, h.y); return true; }
      }
      await sleep(50);
    }
    return false;
  }
  async function startWithValue(command, labels) {
    await req("ui.start", { command });
    if (await waitDialog()) await focusField(labels);
  }

  async function runAction(action) {
    hideBar();
    setTimeout(refreshRail, 800);
    if (!api()) return;
    note("action " + action);
    try {
      if (action === "fillet") await startWithValue("solid.fillet", ["Radius"]);
      else if (action === "chamfer") await startWithValue("solid.chamfer", ["Distance", "Distance 1"]);
      else if (action === "pushpull") await startWithValue("solid.press_pull", ["Distance"]);
      else if (action === "extrude") await startWithValue("solid.extrude", ["Distance"]);
      else if (action === "sketch") await req("ui.start", { command: "sketch.create" });
      else if (action === "dimension" || action.startsWith("dimension:")) {
        if (sketchTools) await sketchTools.dimensionSelected(action.split(":")[1]);
      } else if (action === "editdim") {
        await editTappedDimension(null, null);
      }
    } catch (e) {
      console.warn("touch-nav action:", e);
    }
  }

  // =====================================================================================
  // Werkzeugleiste links (nach dem Vorbild von Shapr3D)
  // =====================================================================================
  // Große, beschriftete Knöpfe für die Finger. Der Inhalt wechselt mit dem Modus:
  // Modellieren, Modellieren mit Auswahl, Skizzieren.
  const ICONS = {
    sketch: "M4 20l3-1L19 7l-2-2L5 17zM14 6l2 2M4 4h6M4 4v6",
    line: "M5 19L19 5M5 19h.01M19 5h.01",
    arc: "M5 19a14 14 0 0 1 14-14",
    rect: "M4 6h16v12H4z",
    circle: "M12 4a8 8 0 1 0 0 16a8 8 0 1 0 0-16zM12 12h.01",
    ellipse: "M3 12a9 5 0 1 0 18 0a9 5 0 1 0-18 0",
    slot: "M8 7h8a5 5 0 0 1 0 10H8A5 5 0 0 1 8 7z",
    polygon: "M12 3l8 6-3 10H7L4 9z",
    spline: "M4 18c4 0 4-12 8-12s4 12 8 12",
    dim: "M4 8v8M20 8v8M4 12h16M7 9l-3 3 3 3M17 9l3 3-3 3",
    trim: "M6 6a2 2 0 1 0 0 .1M6 18a2 2 0 1 0 0 .1M8 7l12 10M8 17L20 7",
    offset: "M4 18L18 4M8 20L20 8",
    construct: "M4 4h16v16H4z",
    finish: "M6 6l12 12M18 6L6 18",
    extrude: "M6 14l6-4 6 4-6 4zM12 10V3M9 6l3-3 3 3",
    revolve: "M12 3v18M17 7a6 6 0 0 1 0 10M7 7a6 6 0 0 0 0 10",
    fillet: "M4 20V10a6 6 0 0 1 6-6h10",
    chamfer: "M4 20V11l7-7h9",
    hole: "M12 5a7 3 0 1 0 0 .1M5 5v12a7 3 0 0 0 14 0V5",
    shell: "M4 8l8-4 8 4v9l-8 4-8-4zM8 10l4-2 4 2v5l-4 2-4-2z",
    move: "M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3",
    measure: "M3 15l12-12 6 6-12 12zM7 11l2 2M10 8l2 2M13 5l2 2",
    trash: "M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13",
    deselect: "M4 4h16v16H4zM9 9l6 6M15 9l-6 6",
    layers: "M12 4l9 5-9 5-9-5zM3 14l9 5 9-5",
    history: "M12 7v5l3 2M4 12a8 8 0 1 0 2.5-5.8M4 4v4h4",
    undo: "M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3",
    redo: "M15 14l5-5-5-5M20 9H10a6 6 0 0 0 0 12h3",
    fit: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5",
  };
  const icon = (n) => `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${ICONS[n] || ""}"/></svg>`;

  // [Beschriftung, Untertitel, Symbol, Aktion, Befehl für die Hervorhebung]
  function railItems(info, sel) {
    const items = (sel && sel.selection) || [];
    const types = new Set(items.map((i) => i.type));
    const top = [];
    if (info.ui && info.ui.tab === "SKETCH") {
      return top.concat([
        ["Skizzieren beenden", "", "finish", "exec:sketch.finish"],
        "-",
        ["Linie", "", "line", "tool:sketch.line"],
        ["Bogen", "3 Punkte", "arc", "tool:sketch.arc.three_point"],
        ["Rechteck", "2 Punkte", "rect", "tool:sketch.rectangle.two_point"],
        ["Rechteck", "Mitte", "rect", "tool:sketch.rectangle.center"],
        ["Kreis", "Mitte", "circle", "tool:sketch.circle.center"],
        ["Polygon", "", "polygon", "tool:sketch.polygon.inscribed"],
        ["Spline", "", "spline", "tool:sketch.spline.fit_point"],
        "-",
        ["Bemaßen", "", "dim", items.length && types.has("sketch_curve") ? "act:dimension" : "tool:sketch.dimension"],
        ["Beschneiden", "", "trim", "tool:sketch.trim"],
        ["Versatz", "", "offset", "tool:sketch.offset"],
        ["Konstruktion", "umschalten", "construct", "tool:sketch.construction"],
        ["Löschen", "", "trash", items.length ? "exec:selection.delete" : "disabled"],
      ]);
    }
    if (items.length) {
      const list = [["Alle abwählen", items.length + " ausgewählt", "deselect", "exec:select.clear"], "-"];
      if (types.has("face") && types.size === 1) list.push(["Skizze", "auf Fläche", "sketch", "tool:sketch.create"], ["Extrudieren", "Fläche versetzen", "extrude", "act:pushpull"]);
      if (types.has("profile")) list.push(["Extrudieren", "", "extrude", "act:extrude"], ["Drehen", "Revolve", "revolve", "tool:solid.revolve"]);
      if (types.has("edge") || types.has("body") || types.has("face")) list.push(["Abrunden", "", "fillet", "act:fillet"], ["Fase", "", "chamfer", "act:chamfer"]);
      if (types.has("body") || types.has("face")) list.push(["Verschieben", "Drehen", "move", "tool:solid.move"]);
      if (types.has("face")) list.push(["Schale", "", "shell", "tool:solid.shell"]);
      list.push("-", ["Löschen", "", "trash", "exec:selection.delete"]);
      return top.concat(list);
    }
    return top.concat([
      ["Skizze", "Ebene oder Fläche wählen", "sketch", "tool:sketch.create"],
      ["Extrudieren", "", "extrude", "tool:solid.extrude"],
      ["Drehen", "Revolve", "revolve", "tool:solid.revolve"],
      ["Bohrung", "", "hole", "tool:solid.hole"],
      ["Abrunden", "", "fillet", "tool:solid.fillet"],
      ["Fase", "", "chamfer", "tool:solid.chamfer"],
      ["Schale", "", "shell", "tool:solid.shell"],
      ["Verschieben", "", "move", "tool:solid.move"],
      "-",
      ["Messen", "", "measure", "tool:inspect.measure"],
    ]);
  }

  let rail = null, railKey = "", railCollapsed = false;
  try { railCollapsed = localStorage.getItem("solidcraft-ipad.rail-collapsed") === "1"; } catch (_) {}
  const railWidth = () => (rail && rail.classList.contains("on") ? rail.offsetWidth + 16 : 0);

  function buildRail() {
    if (rail) return;
    buildUI();
    const css = document.createElement("style");
    css.textContent = `
#${UI_ID} .sc-rail{--rb:54px;left:12px;top:176px;bottom:64px;display:none;flex-direction:column;gap:5px;background:none;border:none;box-shadow:none;overflow-y:auto;overflow-x:visible;padding:0 4px 4px 0;scrollbar-width:none}
#${UI_ID} .sc-rail.on{display:flex}
#${UI_ID} .sc-rail .sep{height:1px;margin:4px 8px;background:rgba(255,255,255,.18);flex:none}
#${UI_ID} .sc-rail .ri{display:flex;align-items:center;gap:8px;flex:none}
#${UI_ID} .sc-rail button.rb{width:var(--rb);height:var(--rb);flex:none;border-radius:14px;background:rgba(36,40,48,.94);border:1px solid rgba(255,255,255,.12);box-shadow:0 4px 14px rgba(0,0,0,.35)}
#${UI_ID} .sc-rail .ri.active button.rb{background:#2f7cf6;color:#fff}
#${UI_ID} .sc-rail .ri.disabled{opacity:.4}
#${UI_ID} .sc-rail .lbl{font-size:calc(var(--rb) * .3);pointer-events:none;background:rgba(36,40,48,.88);border:1px solid rgba(255,255,255,.10);border-radius:10px;padding:5px 10px;line-height:1.15;white-space:nowrap}
#${UI_ID} .sc-rail .lbl small{display:block;font-size:12px;opacity:.65;font-weight:400}
#${UI_ID} .sc-rail.collapsed .lbl{display:none}
#${UI_ID} .sc-rail .row{display:flex;gap:8px;flex:none}`;
    document.head.appendChild(css);
    rail = document.createElement("div");
    rail.className = "sc-panel sc-rail" + (railCollapsed ? " collapsed" : "");
    root.appendChild(rail);
  }

  let railBrowserOpen = false;
  // Die linke Werkzeugleiste ist vorerst aus (doppelt zur Befehlsleiste von SolidCraft);
  // mit ?rail=1 an der Adresse lässt sie sich zum Ausprobieren einschalten.
  const RAIL_ON = query.get("rail") === "1";
  function renderRail(info, sel) {
    if (!RAIL_ON || (touchShell && info.ui && info.ui.tab === "SKETCH")) { if (rail) rail.classList.remove("on"); return; }
    buildRail();
    // Auf dem Startbildschirm von SolidCraft keine eigenen Bedienelemente zeigen.
    if (info.home) {
      rail.classList.remove("on"); railKey = ""; hideBar(); showPad(false);
      return;
    }
    const bo = !!(info.ui && info.ui.showBrowser);
    if (bo !== railBrowserOpen) { railBrowserOpen = bo; railKey = ""; refreshZones(); }
    const items = railItems(info, sel);
    const active = info.tool || (typeof info.dialog === "string" ? info.dialog : "");
    const k = JSON.stringify([items, active && String(active).slice(0, 40), railCollapsed, info.ui && info.ui.showBrowser, info.ui && info.ui.showTimeline]);
    if (k === railKey) { layoutRail(items.length); return; }
    railKey = k;
    let html = "";
    for (const it of items) {
      if (it === "-") { html += '<div class="sep"></div>'; continue; }
      const [label, sub, ic, act] = it;
      const cmd = act.startsWith("tool:") ? act.slice(5) : "";
      const isActive = cmd && (info.tool === cmd);
      html += `<div class="ri${isActive ? " active" : ""}${act === "disabled" ? " disabled" : ""}"><button class="rb" data-action="rail:${act}">${icon(ic)}</button><div class="lbl">${label}${sub ? `<small>${sub}</small>` : ""}</div></div>`;
    }
    const on = (f) => (info.ui && info.ui[f] ? " style=\"background:#2f7cf6;color:#fff\"" : "");
    html += '<div class="sep"></div><div class="row">'
      + `<button class="rb" data-action="rail:toggle:showBrowser"${on("showBrowser")} title="Elemente">${icon("layers")}</button>`
      + `<button class="rb" data-action="rail:toggle:showTimeline"${on("showTimeline")} title="Verlauf">${icon("history")}</button>`
      + `<button class="rb" data-action="rail:exec:edit.undo">${icon("undo")}</button>`
      + `<button class="rb" data-action="rail:exec:edit.redo">${icon("redo")}</button>`
      + `<button class="rb" data-action="rail:collapse" title="Beschriftung">${railCollapsed ? "›" : "‹"}</button></div>`;
    rail.innerHTML = html;
    rail.classList.add("on");
    layoutRail(items.length);
  }

  // Lage und Größe der Leiste: unter der Befehlsleiste von SolidCraft, rechts neben dem Browser,
  // falls dieser offen ist, über der Zeitleiste; die Knöpfe schrumpfen, bis alles passt.
  function layoutRail(count) {
    const hs = zones.handles || [];
    const pick = (re) => hs.filter((h) => re.test(h.name));
    const ribbon = pick(/^(tab|toolbar|button|panel|ribbon):/);
    const browser = pick(/^(browser|row|eye|fold|indent):/);
    const timeline = pick(/^(history|timeline):/);
    const top = ribbon.length ? Math.max(...ribbon.map((h) => h.y)) + 26 : 176;
    const left = railBrowserOpen && browser.length ? Math.max(...browser.map((h) => h.x)) + 34 : 12;
    const bottomY = timeline.length ? Math.min(...timeline.map((h) => h.y)) - 24 : innerHeight - 12;
    rail.style.top = top + "px";
    rail.style.left = left + "px";
    rail.style.bottom = Math.max(12, innerHeight - bottomY) + "px";
    const avail = bottomY - top;
    const seps = rail.querySelectorAll(".sep").length;
    const buttons = rail.querySelectorAll(".ri").length + 1;
    const size = Math.max(44, Math.min(54, Math.floor((avail - seps * 14 - buttons * 5) / buttons)));
    rail.style.setProperty("--rb", size + "px");
  }

  async function refreshRail() {
    if (!api() || document.hidden) return;
    try {
      await refreshZones();
      const [info, sel] = await Promise.all([req("ui.inspect"), req("ui.selection")]);
      if (touchShell) await touchShell.refresh(info, sel);
      renderRail(info, sel);
    } catch (_) {}
  }

  async function railAction(act) {
    if (act === "collapse") {
      railCollapsed = !railCollapsed;
      rail.classList.toggle("collapsed", railCollapsed);
      try { localStorage.setItem("solidcraft-ipad.rail-collapsed", railCollapsed ? "1" : "0"); } catch (_) {}
      railKey = "";
      refreshRail();
      return;
    }
    if (act === "disabled") return;
    const [kind, ...rest] = act.split(":");
    const arg = rest.join(":");
    note("rail " + act);
    try {
      if (kind === "exec") await exec(arg);
      else if (kind === "tool") {
        const info = await req("ui.inspect");
        if (info.tool === arg) { key("Escape"); } // erneut tippen beendet das Werkzeug
        else await req("ui.start", { command: arg });
      } else if (kind === "act") await runAction(arg);
      else if (kind === "toggle") {
        const info = await req("ui.inspect");
        await req("ui.set", { [arg]: !(info.ui && info.ui[arg]) });
        refreshZones();
      }
    } catch (e) {
      console.warn("touch-nav rail:", e);
    }
    setTimeout(refreshRail, 120);
    setTimeout(refreshRail, 600);
  }

  // =====================================================================================
  // Ereignisse anmelden
  // =====================================================================================
  addEventListener("resize", () => { refreshZones(); setTimeout(refreshRail, 300); });
  const opts = { capture: true, passive: false };
  addEventListener("touchstart", onTouchStart, opts);
  addEventListener("touchmove", onTouchMove, opts);
  addEventListener("touchend", onTouchEnd, opts);
  addEventListener("touchcancel", onTouchEnd, opts);
  for (const t of ["pointerdown", "pointermove", "pointerup", "pointercancel"]) addEventListener(t, onPointer, opts);
  for (const t of ["mousedown", "mousemove", "mouseup", "click", "dblclick", "contextmenu"]) addEventListener(t, onMouse, opts);
  for (const t of ["gesturestart", "gesturechange", "gestureend"]) addEventListener(t, onGesture, opts);

  // Sobald die App läuft: Textfeld vorbereiten, Navigationsvorgabe korrigieren, Bereiche laden.
  const PRESET_OLD = "solidcraft-ipad.preset-applied";
  const PRESET_V2 = "solidcraft-ipad.preset-v2";
  const boot = setInterval(async () => {
    if (!api()) return;
    textAgent();
    if (!agent) return;
    clearInterval(boot);
    buildUI();
    if (window.SolidCraftSketchView) sketchTools = window.SolidCraftSketchView.mount({
      host: root, pad, request: req, execute: exec, isUI, handles: () => zones.handles || [],
      showPad, anchor: p => { fieldPos=p; }, changed: scheduleSelectionCheck,
    });
    if (window.SolidCraftKeypad) keypadTools = window.SolidCraftKeypad.mount({
      host:root,pad,request:req,execute:exec,showPad,
      focus:async()=>{const el=textAgent();if(el)el.focus({preventScroll:true});},
      settle:async()=>{await frame();await frame();},confirm:confirmDialog,
      anchor:()=>{const r=agent&&agent.getBoundingClientRect();return r?{x:r.left,y:r.top}:fieldPos;},
      direct:()=>{
        const c=sketchTools&&sketchTools.controller,e=c&&c.editor;if(!e)return null;
        const constraint=e.constraint&&c.snapshot&&c.snapshot.sketch.constraints.find(v=>v.id===e.constraint);
        return {ref:e,parameter:e.param,context:e.context,kind:e.choice&&e.choice.key==='angle'||constraint&&window.SolidCraftSketch.ANGLES.has(constraint.type)?'angle':'length',get value(){return e.value;},get first(){return e.first;},set(value){if(c.editor!==e)return;e.value=value.slice(0,256);e.first=false;e.error='';c.changed();}};
      },
      changed:()=>{if(touchShell)touchShell.refresh();scheduleSelectionCheck();},
    });
    root.addEventListener('pointerdown',e=>{if(keypadTools&&keypadTools.active&&!e.target.closest('.sc-pad')){keypadTools.cancel();e.preventDefault();e.stopImmediatePropagation();}},{capture:true});
    if (window.SolidCraftTouchShell) touchShell = window.SolidCraftTouchShell.mount({
      host: root, request: req, execute: exec, icon, handles: () => zones.handles || [],
      editing: () => !!(sketchTools && sketchTools.editing) || !!(keypadTools && keypadTools.active),
      changed: () => { if (touchShell && touchShell.active) hideBar(); if (sketchTools) sketchTools.refresh(); },
    });
    try {
      // Version 3.0 bis 3.5 hatte den Browser ausgeblendet; einmalig wieder einblenden.
      if (localStorage.getItem("solidcraft-ipad.layout-v3") === "1" && localStorage.getItem("solidcraft-ipad.layout-v4") !== "1") {
        await req("ui.set", { showBrowser: true });
      }
      localStorage.setItem("solidcraft-ipad.layout-v4", "1");
    } catch (_) {}
    refreshZones();
    refreshRail();
    try {
      // Version 1 hatte "OpenSCAD" gesetzt (Ziehen dreht). Jetzt drehen die Finger; der Pencil zieht
      // auf leerer Fläche wieder einen Auswahlrahmen auf (Standard "Fusion").
      if (localStorage.getItem(PRESET_V2) !== "1") {
        if (localStorage.getItem(PRESET_OLD) === "1") {
          const prefs = await req("ui.prefs");
          if (prefs && prefs.nav === "openscad") await req("ui.prefs", { nav: "fusion" });
        }
        localStorage.setItem(PRESET_V2, "1");
      }
    } catch (_) {}
  }, 300);
  setTimeout(() => clearInterval(boot), 180000);

  setInterval(() => {
    if (sketchTools && sketchTools.active && !document.hidden && state === "idle" && !stylusStart) sketchTools.refresh();
  }, 350);
  addEventListener("pointerdown", (e) => {
    if (((sketchTools && sketchTools.editing) || (keypadTools && keypadTools.active)) && !synthetic && e.pointerType === "mouse" && !e.target.closest(".sc-pad")) {
      if(keypadTools&&keypadTools.active)keypadTools.cancel();else sketchTools.cancel(); e.preventDefault(); e.stopImmediatePropagation();
    }
  }, { capture: true });

  // ---------- Diagnose-Anzeige: ?touchdebug=1 oder 4 Finger kurz auflegen ----------
  let hud = null;
  function toggleHud(on) {
    if (on && !hud) {
      buildUI();
      hud = document.createElement("pre");
      hud.style.cssText = "position:absolute;right:8px;bottom:8px;max-width:46vw;max-height:60vh;overflow:auto;margin:0;padding:10px;font:12px/1.35 ui-monospace,Menlo,monospace;background:rgba(0,0,0,.82);color:#9f9;border-radius:10px;pointer-events:auto;white-space:pre-wrap;z-index:2";
      root.appendChild(hud);
      const tick = () => {
        if (!hud) return;
        const vp = zones.viewport ? zones.viewport.map(Math.round).join(",") : "-";
        hud.textContent = [
          "touch-nav " + VERSION + "  api " + (api() ? "ok" : "FEHLT") + "  textfeld " + (agent ? "ok" : "-"),
          "zonen " + (zones.count || 0) + " / rects " + zones.rects.length + "  viewport " + vp + (zones.error ? "  FEHLER " + zones.error : ""),
          "zustand " + state + "  stift " + stylusDown + "  finger " + fingers.size + "  dpr " + devicePixelRatio + "  " + innerWidth + "x" + innerHeight,
          "feld " + (debug.lastField || "-") + "  fokus " + (document.activeElement ? document.activeElement.tagName : "-"),
          "fehler: " + (debug.errors.slice(-3).join(" | ") || "keine"),
          "",
          ...debug.log.slice(-16),
        ].join("\n");
        setTimeout(tick, 400);
      };
      tick();
    } else if (!on && hud) {
      hud.remove();
      hud = null;
    }
  }
  if (query.get("touchdebug") === "1") {
    const wait = setInterval(() => { if (document.body) { clearInterval(wait); toggleHud(true); } }, 200);
  }
  addEventListener("touchstart", (e) => { if (e.touches.length === 4) toggleHud(!hud); }, { capture: true, passive: true });

  // ---------- Diagnose an den eigenen Server schicken (nur bei server.py, nicht auf GitHub Pages) ----------
  let shipped = 0, shipOff = false, shipErr = 0;
  function snapshot() {
    return {
      v: VERSION, ua: navigator.userAgent, w: innerWidth, h: innerHeight, dpr: devicePixelRatio,
      tp: navigator.maxTouchPoints, api: !!api(), agent: !!agent, zones: zones.count || 0, rects: zones.rects.length,
      vp: zones.viewport, zerr: zones.error || null, state, stylus: stylusDown, field: debug.lastField || null,
    };
  }
  async function ship() {
    if (shipOff) return;
    const all = debug.allLog || [];
    if (all.length === shipped && shipErr === debug.errors.length) return;
    const lines = all.slice(shipped);
    const body = JSON.stringify({ t: new Date().toISOString(), snap: snapshot(), log: lines, errors: debug.errors.slice(shipErr) });
    shipped = all.length; shipErr = debug.errors.length;
    try {
      const r = await fetch("__log", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true });
      if (r.status === 404 || r.status === 405 || r.status === 501) shipOff = true;
    } catch (_) { shipOff = true; }
  }
  if (query.get("senddiagnostics") === "1" && /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)|\.local$/.test(location.hostname)) {
    setInterval(ship, 1500);
    setTimeout(() => { note("start " + JSON.stringify(snapshot())); }, 3000);
  } else {
    shipOff = true;
  }

  window.solidcraftTouchNav = {
    version: VERSION, debug, toggleHud,
    // Schnittstelle für Erweiterungen (pencil-sketch.js)
    internal: { hover, press, move, releaseAfterMoves, clickAt, note, pickAt, zoneAt, appState, pollState },
    extension: null, zones, refreshZones, zoneAt, fieldCheck,
    get sketch() { return sketchTools; },
    get shell() { return touchShell; },
    get keypad() { return keypadTools; },
    get padOn() { return !!(pad && pad.classList.contains("on")); },
    get state() { return state; },
  };
})();
