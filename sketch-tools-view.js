// SPDX-License-Identifier: MIT OR Apache-2.0
// Original touch-sized dimensions and constraint controls; no CAD engine changes.
(function (global) {
  "use strict";
  const M = global.SolidCraftSketch;
  function mount(options) {
    const { host, pad } = options;
    const control = new M.Controller({ request: options.request, execute: options.execute }, render);
    const style = document.createElement("style");
    style.textContent = `
#sc-ipad-ui [hidden]{display:none!important}
#sc-ipad-ui .sk-panel{position:fixed;right:6px;top:172px;bottom:20px;width:248px;display:grid;grid-template-columns:1fr 1fr;align-content:start;column-gap:3px;max-width:calc(100vw - 20px);overflow:auto;pointer-events:auto;background:#1f242df2;color:#e8ebf0;border:1px solid #333c4a;border-radius:12px;padding:4px;box-sizing:border-box;overscroll-behavior:contain;touch-action:pan-y;z-index:2;scrollbar-width:none}
#sc-ipad-ui .sk-panel.closed{width:auto;bottom:auto;padding:3px;display:block}
#sc-ipad-ui .sk-panel>h2,#sc-ipad-ui .sk-panel>.sk-status,#sc-ipad-ui .sk-panel>button[data-sketch-action=toggle-panel],#sc-ipad-ui .sk-panel>button[data-sketch-action^=option]{grid-column:1/-1}
#sc-ipad-ui .sk-panel button{min-height:30px;height:auto;padding:5px 8px;width:100%;box-sizing:border-box;text-align:left;display:flex;align-items:center;justify-content:flex-start;font:500 13px/1.2 system-ui,sans-serif;margin:1px 0;background:transparent;border:1px solid transparent;border-radius:7px;color:#e8ebf0}
#sc-ipad-ui .sk-panel button:not(:disabled):active{background:#2a313c}
#sc-ipad-ui .sk-panel button:disabled{opacity:.42;cursor:default}
#sc-ipad-ui .sk-panel button[aria-pressed=true]{background:#1d3f66;border-color:#3d6ea6}
#sc-ipad-ui .sk-panel h2{font:600 11px system-ui;margin:8px 6px 3px;color:#8e9db0;text-transform:uppercase;letter-spacing:.04em}
#sc-ipad-ui .sk-status{font:12px/1.3 system-ui;color:#ffb7aa;white-space:pre-wrap;margin:6px 3px;overflow-wrap:anywhere}
#sc-ipad-ui .sk-labels{position:fixed;inset:0;pointer-events:none;color:#e8ebf0}
#sc-ipad-ui .sk-labels button{position:absolute;pointer-events:auto;min-height:24px;height:24px;min-width:24px;max-width:180px;padding:2px 7px;background:#252d39f0;border:1px solid #6d819c;border-radius:6px;font:500 12px/1.1 system-ui;color:#e8ebf0;box-sizing:border-box;white-space:nowrap;box-shadow:0 1px 4px #0007}
#sc-ipad-ui .sk-labels .sk-glyph{width:22px;min-width:22px;height:22px;min-height:22px;padding:0;font-size:11px;font-weight:700;border-color:#6d819c;justify-content:center;text-align:center;border-radius:5px}
#sc-ipad-ui .sk-labels .sk-pair{background:#1d3f66;border-color:#5e9be0}
#sc-ipad-ui .sk-labels button[aria-pressed=true]{background:#2465b5;border:2px solid #a9d4ff}
#sc-ipad-ui .sk-labels small{font:10px system-ui;color:#afc4dd;margin-left:6px}
#sc-ipad-ui .sk-labels svg{position:absolute;inset:0;overflow:visible;width:100%;height:100%;pointer-events:none}
#sc-ipad-ui .sk-direct{grid-column:1/-1;display:none;max-width:100%;font:15px system-ui;color:#e8ebf0}
#sc-ipad-ui .sk-direct.on{display:block}
#sc-ipad-ui .sk-direct input{box-sizing:border-box;width:100%;height:48px;font:22px system-ui;padding:6px;border:1px solid #8ba4c6;border-radius:8px;background:#161c25;color:white;user-select:text;-webkit-user-select:text}
#sc-ipad-ui .sk-direct button{width:100%;height:44px;font:14px system-ui;padding:4px}
#sc-ipad-ui .sk-direct p{margin:4px 0;overflow-wrap:anywhere}
@media(max-width:500px){#sc-ipad-ui .sc-pad{grid-template-columns:repeat(5,minmax(44px,1fr));max-width:calc(100vw - 20px);box-sizing:border-box;gap:4px;padding:6px}#sc-ipad-ui .sc-pad button{min-width:44px}}
`;
    document.head.appendChild(style);
    const panel = document.createElement("section"); panel.className = "sk-panel"; panel.hidden = true; panel.setAttribute("aria-label", "Bedingungen und Maße");
    const labels = document.createElement("div"); labels.className = "sk-labels";
    const direct = document.createElement("div"); direct.className = "sk-direct";
    const heading = document.createElement("p");
    const input = document.createElement("input"); input.type = "text"; input.inputMode = "none"; input.readOnly = true; input.maxLength = 256; input.setAttribute("aria-label", "Maßwert");
    const binding = button("", "unlock");
    const error = document.createElement("p"); error.className = "sk-status"; error.setAttribute("role", "alert");
    const hint = document.createElement("p"); hint.textContent = "✓ bindet das Maß. Außerhalb tippen oder Esc verwirft die Eingabe.";
    direct.append(heading, input, binding, error, hint); pad.prepend(direct); host.append(labels, panel);
    let open = innerWidth >= 900, panelKey = "", labelKey = "", directShown = false, keyboard = false, projected = [];
    let projectionBusy = false;
    try { const saved = localStorage.getItem("solidcraft-ipad.constraints-open-v1"); if (saved !== null) open = saved === "1"; } catch (_) {}
    const buttons = new Map();
    const glyphNames = { parallel: ["∥", "Parallel"], perpendicular: ["⊥", "Senkrecht"], horizontal: ["H", "Horizontal"], vertical: ["V", "Vertikal"], tangent: ["T", "Tangential"], coincident: ["●", "Zusammenfallend"], midpoint: ["M", "Mittelpunkt"], equal: ["=", "Gleich"], concentric: ["◎", "Konzentrisch"], fix: ["F", "Gesperrt"], collinear: ["K", "Kollinear"], symmetric: ["S", "Symmetrisch"] };

    function button(text, action) { const b = document.createElement("button"); b.type = "button"; b.textContent = text; b.dataset.sketchAction = action; return b; }
    function section(text) { const h = document.createElement("h2"); h.textContent = text; panel.appendChild(h); }
    async function run(fn) {
      try { await fn(); }
      catch (e) { control.error = "Aktion nicht möglich: " + String(e.message || e); render(); }
      await control.refresh();
      options.changed();
    }
    // Oberkante für Etiketten: bei verschobener Zeichenfläche (canvas-shift.js) gehört der obere Rand dem Modell.
    const topLimit = () => document.body.classList.contains("sc-shift") ? 8 : 150;
    function positionedButton(record, position, occupied, maxX) {
      if (!M.point(position) || position[0] < 0 || position[1] < topLimit() || position[0] > innerWidth || position[1] > innerHeight - 50) return;
      const b = button(record.text, record.action); b.dataset.scene = "1";
      if (record.kind === "glyph") b.className = "sk-glyph";
      if (record.kind === "pair") { b.className = "sk-pair"; delete b.dataset.scene; } // ein Bedienknopf, auch per Finger
      b.title = record.title; b.setAttribute("aria-label", record.title); b.setAttribute("aria-pressed", String(!!record.selected));
      b.dataset.record = String(buttons.size); buttons.set(b.dataset.record, record);
      labels.appendChild(b);
      const width = Math.max(record.kind === "glyph" ? 22 : 24, b.offsetWidth || 80), height = record.kind === "glyph" ? 22 : 24;
      let x = Math.max(6, Math.min(maxX - width, position[0] - width / 2));
      let y = Math.max(topLimit() + 10, Math.min(innerHeight - 105, position[1] - height / 2));
      for (let tries = 0; tries < 8 && occupied.some((r) => x < r.x + r.w + 3 && x + width + 3 > r.x && y < r.y + r.h + 3 && y + height + 3 > r.y); tries++) y -= height + 4;
      if (y < topLimit() + 5 || options.isUI(x + width / 2, y + height / 2)) { b.remove(); return; }
      b.style.left = x + "px"; b.style.top = y + "px";
      occupied.push({ x, y, w: width, h: height });
    }
    function render() {
      const s = control.snapshot;
      renderEditor();
      panel.hidden = !s || !!s.info.home || host.dataset.shellMode === "advanced";
      labels.hidden = !s || !!s.info.dialog || !!control.editor;
      if (!s) {
        labels.replaceChildren(); labelKey = "";
        if (control.model && M.point(control.model.screen)) {
          labels.hidden = false;
          const out = document.createElement("output");
          out.textContent = M.formatted(control.model.value, false, control.units) + " · gemessen";
          out.setAttribute("aria-label", "Gemessene Kantenlänge, nicht gebunden");
          out.style.cssText = `position:absolute;left:${Math.max(8,Math.min(innerWidth-180,control.model.screen[0]))}px;top:${Math.max(topLimit()+10,control.model.screen[1]-50)}px;background:#242830;color:#e8ebf0;padding:10px;border:1px solid #8094af;border-radius:8px;font:15px system-ui`;
          labels.appendChild(out);
        }
        return;
      }
      const choices = M.constraintChoices(s.sketch, s.selection.selection);
      const dimensions = M.dimensionChoices(s.sketch, s.selection.selection);
      const selectedConstraints = (M.selected(s.sketch, s.selection.selection) || []).map((p) => p.item).filter((x) => x.type === "sketch_constraint");
      const key = JSON.stringify([open, choices, dimensions, s.options, selectedConstraints, control.busy, control.error, !!s.info.tool, !!s.info.dialog, !!control.editor]);
      if (key !== panelKey) {
        panelKey = key; panel.replaceChildren(); panel.classList.toggle("closed", !open);
        const toggle = button(open ? "Bedingungen ▾" : "Bedingungen ▸", "toggle-panel"); toggle.setAttribute("aria-expanded", String(open)); panel.appendChild(toggle);
        if (open) {
          section("Bemaßen");
          for (const d of dimensions) { const b = button(d.label, "dimension:" + d.key); b.disabled = !d.enabled || control.busy || !!s.info.tool || !!s.info.dialog || !!control.editor; b.title = d.enabled ? d.label + " am Element eingeben" : d.reason; panel.appendChild(b); }
          const all = button("Alle Maße anzeigen", "option:show_dimensions"); all.setAttribute("aria-pressed", String(!!s.options.show_dimensions)); all.disabled = !!control.editor || control.busy; panel.appendChild(all);
          section("Beziehungen");
          for (const c of choices) { const b = button(c.label, "constraint:" + c.key); b.disabled = !c.enabled || control.busy || !!s.info.tool || !!s.info.dialog || !!control.editor; b.title = b.disabled ? c.reason : c.label + " setzen"; panel.appendChild(b); }
          const visible = button(s.options.show_constraints ? "Symbole: immer" : "Symbole: Auswahl", "option:show_constraints"); visible.setAttribute("aria-pressed", String(!!s.options.show_constraints)); visible.disabled = !!control.editor || control.busy; panel.appendChild(visible);
          const disconnect = button("Trennen", "disconnect"); disconnect.disabled = !selectedConstraints.length || selectedConstraints.length !== (s.selection.selection || []).length || !selectedConstraints.every((item) => s.sketch.constraints.some((c) => c.id === item.id && c.type === "coincident")) || control.busy || !!control.editor; disconnect.title = "Zusammenfallend-Symbol auswählen, dann die Verbindung trennen."; panel.appendChild(disconnect);
          const remove = button("Bedingung löschen", "delete-constraint"); remove.disabled = !selectedConstraints.length || selectedConstraints.length !== (s.selection.selection || []).length || control.busy || !!control.editor; panel.appendChild(remove);
          const status = document.createElement("p"); status.className = "sk-status"; status.setAttribute("role", "status"); status.textContent = control.error; panel.appendChild(status);
        }
      }
      const ribbon = (options.handles() || []).filter((h) => /^(tab|toolbar|button|panel|ribbon):/.test(h.name));
      const deckTop = ribbon.length ? Math.max(32, Math.min(...ribbon.map((h) => h.y)) - 24) : 38;
      panel.style.top = (host.dataset.shellMode === "touch" ? deckTop + 6 : Math.max(160, ...ribbon.map((h) => h.y + 28))) + "px";
      // Symbols and free measurements are projected by SolidCraft, never by a second camera implementation.
      project(s);
    }

    async function project(s) {
      if (projectionBusy || labels.hidden) return;
      projectionBusy = true;
      try {
        const records = [];
        const chosen = s.selection.selection || [];
        for (const c of s.sketch.constraints.slice(0, 200)) {
          if (M.isDimension(c)) {
            if (!s.options.show_dimensions && !M.related(s.sketch, c, chosen)) continue;
            const a = M.anchors(s.sketch, c); if (!a.length) continue;
            const native = (s.selection.dimensions || []).find((d) => d.id === c.id || d.id === c.param);
            const value = M.ANGLES.has(c.type) ? c.value * 180 / Math.PI : c.value;
            records.push({ kind: "dimension", action: "edit", id: c.id, at: a[0], screen: native && [native.x, native.y], text: `${c.param ? "🔒 " : ""}${c.type === "radius" ? "R " : c.type === "diameter" ? "Ø " : ""}${M.formatted(value, M.ANGLES.has(c.type), control.units)} · ${c.param ? "fest" : "Referenz"}`, title: c.param ? "Festes Maß ändern" : "Referenzmaß: durch andere Bedingungen bestimmt" });
          } else if (glyphNames[c.type] && (s.options.show_constraints || M.related(s.sketch, c, chosen))) {
            const a = M.anchors(s.sketch, c); if (!a.length) continue;
            records.push({ kind: "glyph", action: "select-constraint", id: c.id, at: a[0], text: glyphNames[c.type][0], title: glyphNames[c.type][1] + " auswählen", selected: chosen.some((x) => x.type === "sketch_constraint" && x.id === c.id) });
          }
        }
        const selectedIds = chosen.filter((x) => x.type === "sketch_curve").map((x) => x.id);
        for (const c of s.sketch.curves.filter((x) => s.options.show_dimensions || selectedIds.includes(x.id) || control.lastAdded.includes(x.id)).slice(0, 200)) {
          const idx = s.sketch.curves.indexOf(c);
          if (s.sketch.constraints.some((k) => M.isDimension(k) && ["length", "radius", "diameter", "arc_length"].includes(k.type) && M.constraintCurveIndices(k).includes(idx))) continue;
          const choices = M.dimensionChoices(s.sketch, [{ type: "sketch_curve", id: c.id, sketch: s.sketch.id }]);
          const d = choices[0], at = M.curvePoint(c); if (!d || !at) continue;
          const determined = !!c.fully_constrained || !!c.fixed;
          records.push({ kind: "free", action: "free", choice: d, at, ends: c.type === "line" ? [M.point(c.start_at), M.point(c.end_at)] : c.center_at ? [[M.point(c.center_at)[0]-c.radius,M.point(c.center_at)[1]], [M.point(c.center_at)[0]+c.radius,M.point(c.center_at)[1]]] : null, text: `${d.key === "diameter" ? "Ø " : "↔ "}${M.formatted(M.measureChoice(s.sketch, d), false, control.units)} · ${determined ? "bestimmt" : "frei"}`, title: determined ? "Bereits bestimmte Geometrie" : d.label + " festlegen", determined });
        }
        // Zwei Linien gewählt: Winkel- bzw. Abstandsmaß direkt an der Geometrie anbieten (wie in Shapr3D).
        const pairChoices = M.dimensionChoices(s.sketch, chosen).filter((d) => d.entities.length === 2 && d.enabled);
        for (const d of pairChoices) {
          const [a, b] = d.entities.map((id) => s.sketch.curves.find((c) => c.id === id));
          const pa = M.point(a.start_at), pb = M.point(a.end_at), qa = M.point(b.start_at), qb = M.point(b.end_at);
          let at = null;
          if (d.key === "angle") {
            const r = [pb[0] - pa[0], pb[1] - pa[1]], q = [qb[0] - qa[0], qb[1] - qa[1]], den = r[0] * q[1] - r[1] * q[0];
            if (Math.abs(den) > 1e-9) {
              const t = ((qa[0] - pa[0]) * q[1] - (qa[1] - pa[1]) * q[0]) / den;
              const x = [pa[0] + t * r[0], pa[1] + t * r[1]];
              const ma = M.curvePoint(a), mb = M.curvePoint(b);
              // Etikett zwischen Schnittpunkt und den Linienmitten, damit es nicht auf dem Schnittpunkt klebt
              at = [(2 * x[0] + ma[0] + mb[0]) / 4, (2 * x[1] + ma[1] + mb[1]) / 4];
            }
          }
          if (!at) { const ma = M.curvePoint(a), mb = M.curvePoint(b); at = [(ma[0] + mb[0]) / 2, (ma[1] + mb[1]) / 2]; }
          const value = M.measureChoice(s.sketch, d);
          records.unshift({ kind: "pair", action: "dimension:" + d.key, at, text: (d.key === "angle" ? "∠ " : "↔ ") + M.formatted(value, d.key === "angle", control.units) + " festlegen", title: d.label + " zwischen den zwei Linien festlegen" });
        }
        const inputs = records.map((r) => r.at);
        for (const r of records) if (r.ends) { r.endIndex = inputs.length; inputs.push(...r.ends); }
        const points = await options.request("ui.sketchToScreen", { points: inputs });
        if (control.snapshot !== s || control.editor) return;
        const sig = JSON.stringify([records, points, innerWidth, innerHeight, open]);
        if (sig === labelKey) return;
        labelKey = sig; labels.replaceChildren(); buttons.clear(); projected = [];
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"); labels.appendChild(svg);
        const line = (a,b) => {
          const node = document.createElementNS(svg.namespaceURI, "line");
          for(const [key,value] of Object.entries({x1:a[0],y1:a[1],x2:b[0],y2:b[1],stroke:"#abc7e8","stroke-width":1.4})) node.setAttribute(key,value);
          svg.appendChild(node);
        };
        const dimensionLine = (a,b) => {
          if(!M.point(a)||!M.point(b))return null;
          const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);if(len<1)return null;
          const sign=dx<0?-1:1,n=[sign*dy/len*30,-sign*dx/len*30],u=[dx/len,dy/len],v=[-u[1],u[0]];
          const p=[a[0]+n[0],a[1]+n[1]],q=[b[0]+n[0],b[1]+n[1]];
          line(a,p);line(b,q);line(p,q);
          for(const [tip,s] of [[p,1],[q,-1]])for(const side of [-1,1])line(tip,[tip[0]+u[0]*s*7+v[0]*side*3,tip[1]+u[1]*s*7+v[1]*side*3]);
          return [(p[0]+q[0])/2,(p[1]+q[1])/2];
        };
        const occupied = [], maxX = open && !panel.hidden ? Math.min(innerWidth - 6, panel.getBoundingClientRect().left - 6) : innerWidth - 6;
        records.forEach((record, i) => {
          const pos = record.screen || points[i];
          if (!M.point(pos)) return;
          const dim = record.ends && dimensionLine(points[record.endIndex], points[record.endIndex+1]);
          const shifted = dim || (record.screen ? pos : [pos[0], pos[1] - (record.kind === "glyph" ? 14 : 22)]);
          positionedButton(record, shifted, occupied, maxX);
        });
        // Hit-tested centreline projections are used only for additive Pencil selection.
        const lines = s.sketch.curves.filter((c) => c.type === "line").slice(0, 256);
        const ends = await options.request("ui.sketchToScreen", { points: lines.flatMap((c) => [M.point(c.start_at), M.point(c.end_at)]) });
        if (control.snapshot === s) projected = lines.map((c, i) => ({ c, a: ends[i * 2], b: ends[i * 2 + 1] }));
      } catch (_) { /* A view or document switched while projecting: next refresh recovers. */ }
      finally { projectionBusy = false; }
    }

    function renderEditor() {
      const e = control.editor;
      direct.classList.toggle("on", !!e);
      if (!e) {
        if (directShown) options.showPad(false);
        directShown = false; keyboard = false; return;
      }
      if (!directShown) {
        directShown = true; keyboard = false; input.readOnly = true; input.inputMode = "none";
        options.showPad(true); input.focus({ preventScroll: true });
      }
      heading.textContent = e.param ? "Festes Maß ändern" : "Maß festlegen";
      if (input.value !== e.value) input.value = e.value;
      error.textContent = e.error ? "Nicht übernommen: " + e.error : "";
      binding.hidden = !e.constraint; binding.disabled = control.busy; binding.textContent = "🔓 Maßbindung lösen";
    }
    function keyboardToggle() {
      keyboard = !keyboard; input.readOnly = !keyboard; input.inputMode = keyboard ? "text" : "none";
      if (!keyboard) input.blur(); else { input.focus({ preventScroll: true }); input.select(); }
    }
    input.addEventListener("input", () => { if (control.editor && keyboard) { control.editor.value = input.value.slice(0, 256); control.editor.first = false; control.editor.error = ""; } });
    input.addEventListener("keydown", (event) => {
      if (!control.editor) return;
      event.stopPropagation();
      if (event.key === "Enter") { event.preventDefault(); run(() => control.commit()); }
      else if (event.key === "Escape") { event.preventDefault(); control.cancel(); }
      else if (!keyboard) { event.preventDefault(); if (event.key === "Backspace") control.key("back"); else if (/^[0-9.+*/() -]$/.test(event.key)) control.key(event.key); }
    });
    async function stopTool() {
      for (let i = 0; i < 3; i++) { const info = await options.request("ui.inspect"); if (!info.tool) break; await options.request("ui.key", { key: "Escape" }); await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))); }
      await control.refresh();
    }
    async function act(b) {
      const action = b.dataset.sketchAction;
      if (action === "toggle-panel") { open = !open; try { localStorage.setItem("solidcraft-ipad.constraints-open-v1", open ? "1" : "0"); } catch (_) {} render(); }
      else if (action.startsWith("constraint:")) await run(() => control.apply(action.slice(11)));
      else if (action.startsWith("dimension:")) await run(() => dimensionSelected(action.slice(10)));
      else if (action.startsWith("option:")) await run(() => control.option(action.slice(7)));
      else if (action === "disconnect") await run(() => control.disconnect());
      else if (action === "delete-constraint") await run(() => control.removeSelected());
      else if (action === "unlock") await run(() => control.unlock());
      else {
        const record = buttons.get(b.dataset.record); if (!record) return;
        const r=b.getBoundingClientRect();if(options.anchor)options.anchor({x:r.left+r.width/2,y:r.top+r.height/2});
        if (action === "select-constraint") await run(async () => { await stopTool(); await control.write("select.set", { items: [{ type: "sketch_constraint", id: record.id }] }); });
        else if (action === "free") await run(async () => { await stopTool(); control.begin(record.choice); });
        else if (action === "edit") await run(async () => { await stopTool(); control.edit(record.id); });
      }
    }
    function interaction(event) {
      const b = event.target.closest("button[data-sketch-action]"); if (!b || b.disabled || control.busy) return;
      event.preventDefault(); event.stopPropagation();
      if (b.dataset.scene && event.pointerType === "touch") return; // Fingers never select geometry or its glyphs.
      act(b).catch((e) => { control.error = String(e.message || e); render(); });
    }
    for (const node of [panel, labels, direct]) {
      node.addEventListener("pointerdown", (e) => { if (node === panel && e.pointerType === "touch") e.stopPropagation(); else if (e.target !== input) e.preventDefault(); });
      node.addEventListener("pointerup", interaction);
      node.addEventListener("click", (e) => { if (e.detail === 0) interaction(e); });
    }
    // Let native finger scrolling reach the right rail; the outer keypad host normally cancels touch defaults.
    for (const type of ["touchstart", "touchmove", "touchend"]) panel.addEventListener(type, (e) => e.stopPropagation(), { passive: true });
    host.addEventListener("pointerdown", (e) => {
      if (control.editor && !pad.contains(e.target)) { control.cancel(); e.preventDefault(); e.stopImmediatePropagation(); }
    }, { capture: true });
    async function dimensionSelected(key) {
      await control.refresh(); const s = control.snapshot; if (!s) return;
      const choices = M.dimensionChoices(s.sketch, s.selection.selection);
      const c = choices.find((c) => c.key === key) || choices.find((c) => c.enabled);
      if (!c || !c.enabled) throw new Error(c ? c.reason : "Eine Linie oder zwei passende Linien auswählen.");
      const indices = c.entities.map((id) => s.sketch.curves.findIndex((curve) => curve.id === id));
      const existing = s.sketch.constraints.find((k) => k.type === c.key && M.constraintCurveIndices(k).length === indices.length && indices.every((i) => M.constraintCurveIndices(k).includes(i)));
      if (existing) control.edit(existing.id); else control.begin(c);
    }
    function additiveAt(x, y) {
      const s = control.snapshot; if (!s || s.info.tool || s.info.dialog || control.editor || options.isUI(x, y)) return false;
      return projected.some(({ a, b }) => {
        if (!M.point(a) || !M.point(b)) return false;
        const vx = b[0] - a[0], vy = b[1] - a[1], n = vx * vx + vy * vy;
        const t = n ? Math.max(0, Math.min(1, ((x - a[0]) * vx + (y - a[1]) * vy) / n)) : 0;
        return Math.hypot(x - a[0] - t * vx, y - a[1] - t * vy) < 12;
      });
    }
    return {
      controller: control, refresh: (info, sel) => control.refresh(info, sel), dimensionSelected,
      get editing() { return !!control.editor; }, get active() { return !!control.snapshot; },
      key: (key) => key === "abc" ? keyboardToggle() : run(() => control.key(key)),
      cancel: () => control.cancel(), additiveAt,
    };
  }
  global.SolidCraftSketchView = { mount };
})(globalThis);
