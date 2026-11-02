// SPDX-License-Identifier: MIT OR Apache-2.0
// Part of solidcraft-ipad (unofficial); see FORK-NOTICE.md.
/*
 * Volle Zeichenfläche beim Skizzieren
 * -----------------------------------
 * SolidCraft zeichnet Kopfzeile, Befehlsleiste und Modell in ein einziges Canvas und bietet keine
 * Möglichkeit, die Befehlsleiste auszublenden. In der iPad-Skizzenansicht wird das Canvas deshalb
 * um die Höhe von Kopfzeile und Befehlsleiste nach oben geschoben (und entsprechend höher gemacht):
 * Diese Bereiche liegen außerhalb des Bildschirms, das Modell nutzt die ganze Höhe.
 *
 * SolidCraft rechnet Berührungen über die Lage des Canvas selbst um. Für die Browser-Schnittstelle
 * (window.solidcraft) rechnet diese Datei alle Bildschirmkoordinaten um, damit die übrigen Skripte
 * unverändert mit Bildschirmkoordinaten arbeiten:
 *   Antworten:  ui.handles, ui.inspect.viewport, ui.sketchToScreen, ui.worldToScreen, ui.at,
 *               ui.selection.dimensions                                  y − Versatz
 *   Anfragen:   ui.pick / view.pick (pixels), ui.click, ui.move, ui.drag, ui.scroll, ui.menu   y + Versatz
 *
 * Die Verschiebung ist nur aktiv, solange die iPad-Skizzenansicht aktiv ist (Container
 * #sc-ipad-ui mit data-shell-mode="touch"). Abschalten: ?fullsketch=off
 */
(() => {
  "use strict";
  const query = new URLSearchParams(location.search);
  const DISABLED = query.get("fullsketch") === "off";
  const DEFAULT_SHIFT = 160; // Kopfzeile 34 + Befehlsleiste, falls sich nichts messen lässt
  let shift = 0; // aktueller Versatz in CSS-Pixeln
  let raw = null;

  const dpr = () => window.devicePixelRatio || 1;
  const up = (y) => (Number.isFinite(y) ? y - shift : y);
  const pairUp = (p) => (Array.isArray(p) && p.length >= 2 ? [p[0], up(p[1]), ...p.slice(2)] : p);

  function outgoing(method, result) {
    if (!shift || result == null) return result;
    try {
      if (method === "ui.handles" && Array.isArray(result)) return result.map((h) => (h && Number.isFinite(h.y) ? { ...h, y: up(h.y) } : h));
      if ((method === "ui.sketchToScreen" || method === "ui.worldToScreen") && Array.isArray(result)) return result.map(pairUp);
      if (method === "ui.at") return Array.isArray(result) ? pairUp(result) : result && Number.isFinite(result.y) ? { ...result, y: up(result.y) } : result;
      if (method === "ui.inspect" && Array.isArray(result.viewport)) return { ...result, viewport: [result.viewport[0], up(result.viewport[1]), ...result.viewport.slice(2)] };
      if (method === "ui.selection" && Array.isArray(result.dimensions)) return { ...result, dimensions: result.dimensions.map((d) => (d && Number.isFinite(d.y) ? { ...d, y: up(d.y) } : d)) };
    } catch (_) {}
    return result;
  }

  function incoming(method, params) {
    if (!shift || !params || typeof params !== "object") return params;
    const p = { ...params };
    if ((method === "ui.pick" || method === "view.pick") && Array.isArray(p.pixels) && (p.frame == null || p.frame === "window")) {
      p.pixels = p.pixels.map((q) => (Array.isArray(q) ? [q[0], q[1] + shift * dpr()] : q));
    }
    if (["ui.click", "ui.move", "ui.scroll", "ui.menu"].includes(method) && Number.isFinite(p.y)) p.y += shift;
    if (method === "ui.drag") {
      if (Number.isFinite(p.y0)) p.y0 += shift;
      if (Number.isFinite(p.y1)) p.y1 += shift;
      if (Array.isArray(p.via)) p.via = p.via.map((q) => (Array.isArray(q) ? [q[0], q[1] + shift] : q));
    }
    return p;
  }

  function wrap(api) {
    if (!api || typeof api !== "object" || api.__shifted) return api;
    const w = Object.create(api);
    w.__shifted = true;
    w.request = async (method, params) => outgoing(method, await api.request(method, incoming(method, params)));
    w.execute = async (command, params) => {
      const p = command === "view.pick" ? incoming("view.pick", params) : params;
      return api.execute(command, p);
    };
    return w;
  }

  // window.solidcraft wird von der App per Reflect.set angelegt: abfangen und umhüllen.
  let wrapped = null;
  try {
    Object.defineProperty(window, "solidcraft", {
      configurable: true,
      enumerable: true,
      get: () => wrapped,
      set: (v) => { raw = v; wrapped = DISABLED ? v : wrap(v); },
    });
  } catch (_) { /* Eigenschaft nicht umdefinierbar: ohne Verschiebung weiter */ }

  // ---------- Verschiebung ein- und ausschalten ----------
  const css = document.createElement("style");
  css.textContent = `
body.sc-shift #solidcraft_canvas{top:calc(-1 * var(--sc-shift, 0px));bottom:auto;height:calc(100% + var(--sc-shift, 0px))}
body.sc-shift #sc-ipad-ui .ts-deck{top:6px!important;height:auto!important;background:transparent!important;border:0!important;padding:0!important;pointer-events:none}
body.sc-shift #sc-ipad-ui .ts-deck .ts-row,body.sc-shift #sc-ipad-ui .ts-deck .ts-error{pointer-events:auto}
body.sc-shift #sc-ipad-ui .ts-deck .ts-hint{display:none}
body.sc-shift #sc-ipad-ui .ts-rail{top:8px!important}
body.sc-shift #sc-ipad-ui .sk-panel{top:8px!important}
body.sc-shift #sc-ipad-ui .ts-native-palette{top:0!important}
body.sc-shift #sc-ipad-ui .ts-menu:not(.flyout){top:48px!important}`;
  document.head.appendChild(css);

  async function measure() {
    try {
      const hs = await raw.request("ui.handles", {});
      const bar = (hs || []).filter((h) => /^(tab|toolbar|button|panel|ribbon):/.test(h.name) && Number.isFinite(h.y));
      if (!bar.length) return DEFAULT_SHIFT;
      // Abschnittsbeschriftungen liegen in der untersten Zeile der Befehlsleiste; die Karte endet knapp darunter.
      return Math.round(Math.min(240, Math.max(80, Math.max(...bar.map((h) => h.y)) + 15)));
    } catch (_) {
      return DEFAULT_SHIFT;
    }
  }

  // Die Zustandszeile des Ansichtsfensters („Sketch1 — 1 degree of freedom“) läge sonst halb unter der
  // Werkzeugleiste. Während der Verschiebung ausblenden, danach den vorherigen Wert wiederherstellen.
  let savedSummary = null;
  async function summary(off) {
    try {
      if (off) {
        const prefs = await raw.request("ui.prefs", {});
        if (prefs && prefs.viewport_status_summary) { savedSummary = true; await raw.request("ui.prefs", { viewport_status_summary: false }); }
      } else if (savedSummary) {
        savedSummary = null; await raw.request("ui.prefs", { viewport_status_summary: true });
      }
    } catch (_) {}
  }

  let busy = false;
  async function tick() {
    if (DISABLED || busy || !raw) return;
    const host = document.getElementById("sc-ipad-ui");
    const want = !!host && host.dataset.shellMode === "touch";
    if (want === !!shift) return;
    busy = true;
    try {
      if (want) {
        const s = await measure();
        shift = s;
        document.body.style.setProperty("--sc-shift", s + "px");
        document.body.classList.add("sc-shift");
        await summary(true);
      } else {
        shift = 0;
        document.body.classList.remove("sc-shift");
        document.body.style.removeProperty("--sc-shift");
        await summary(false);
      }
    } finally {
      busy = false;
    }
  }
  setInterval(tick, 250);

  window.solidcraftCanvasShift = { get shift() { return shift; }, get raw() { return raw; } };
})();
