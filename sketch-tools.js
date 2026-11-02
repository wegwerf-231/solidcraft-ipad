// SPDX-License-Identifier: MIT OR Apache-2.0
// Original iPad sketch interaction layer. Uses the unchanged SolidCraft command API.
(function (global, factory) {
  const value = factory();
  if (typeof module === "object" && module.exports) module.exports = value;
  else global.SolidCraftSketch = value;
})(typeof globalThis === "object" ? globalThis : this, function () {
  "use strict";
  const MAX_ITEMS = 128;
  const DIMENSIONS = new Set(["distance", "distance_x", "distance_y", "length", "line_angle", "arc_sweep", "angle", "radius", "diameter", "point_line_distance", "line_circle_distance", "point_circle_distance", "circle_circle_distance", "slot_overall_length", "arc_length", "ellipse_major", "ellipse_minor", "linear_diameter"]);
  const ANGLES = new Set(["angle", "line_angle", "arc_sweep"]);
  const finitePoint = (p) => Array.isArray(p) && p.length >= 2 && p.slice(0, 2).every(Number.isFinite);
  const point = (p) => finitePoint(p) ? p : p && Number.isFinite(p.x) && Number.isFinite(p.y) ? [p.x, p.y] : null;
  const midpoint = (a, b) => a && b ? [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] : null;
  const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const curvePoint = (c) => c ? midpoint(point(c.start_at), point(c.end_at)) || point(c.center_at) || point(c.points_at && c.points_at[0]) : null;
  const vec = (c) => c && c.type === "line" && point(c.start_at) && point(c.end_at) ? [point(c.end_at)[0] - point(c.start_at)[0], point(c.end_at)[1] - point(c.start_at)[1]] : null;
  const isRound = (c) => c && ["circle", "arc"].includes(c.type);
  const isDimension = (c) => c && DIMENSIONS.has(c.type) && Number.isFinite(c.value);
  const sameContext = (a, b) => a && b && a.document_id === b.document_id && a.revision === b.revision;

  function selected(sketch, selection) {
    if (!sketch || !Array.isArray(selection) || !selection.length || selection.length > MAX_ITEMS) return null;
    const seen = new Set();
    const values = [];
    for (const item of selection) {
      if (!item || (item.sketch != null && item.sketch !== sketch.id) || typeof item.id !== "string" || seen.has(item.type + ":" + item.id)) return null;
      seen.add(item.type + ":" + item.id);
      let entity;
      if (item.type === "sketch_curve" && (item.sketch == null || item.sketch === sketch.id)) entity = sketch.curves.find((x) => x.id === item.id);
      else if (item.type === "sketch_point") entity = sketch.points.find((x) => x.id === item.id);
      else if (item.type === "sketch_constraint") entity = sketch.constraints.find((x) => x.id === item.id);
      if (!entity) return null;
      values.push({ item, entity });
    }
    return values;
  }

  function linePair(sketch, selection) {
    const picks = selected(sketch, selection);
    return picks && picks.length === 2 && picks.every((p) => p.item.type === "sketch_curve" && p.entity.type === "line") ? picks.map((p) => p.entity) : null;
  }
  function parallel(a, b) {
    const va = vec(a), vb = vec(b);
    return va && vb && Math.hypot(...va) > 1e-9 && Math.hypot(...vb) > 1e-9 && Math.abs(va[0] * vb[1] - va[1] * vb[0]) <= 1e-9 * Math.hypot(...va) * Math.hypot(...vb);
  }

  function dimensionChoices(sketch, selection) {
    const picks = selected(sketch, selection);
    if (!picks || !picks.every((p) => p.item.type === "sketch_curve")) return [];
    const curves = picks.map((p) => p.entity);
    if (curves.length === 1 && (curves[0].type === "line" || isRound(curves[0]))) {
      return [{ key: curves[0].type === "line" ? "length" : "diameter", label: curves[0].type === "line" ? "Länge" : "Durchmesser", enabled: true, entities: [curves[0].id] }];
    }
    const pair = linePair(sketch, selection);
    if (!pair) return [];
    const isParallel = parallel(...pair);
    return [
      { key: "distance", label: "Abstand", enabled: isParallel, reason: "Für den Linienabstand zwei parallele Linien wählen.", entities: pair.map((c) => c.id) },
      { key: "angle", label: "Winkel", enabled: !isParallel, reason: "Ein Winkelmaß braucht zwei nicht parallele Linien.", entities: pair.map((c) => c.id) },
    ];
  }

  function measureChoice(sketch, choice) {
    const curves = choice.entities.map((id) => sketch.curves.find((c) => c.id === id));
    if (curves.some((c) => !c)) throw new Error("Die Auswahl ist nicht mehr vorhanden.");
    const c = curves[0];
    if (choice.key === "length") return distance(point(c.start_at), point(c.end_at));
    if (choice.key === "diameter") return c.radius * 2;
    const a = vec(c), b = vec(curves[1]);
    if (!a || !b || Math.hypot(...a) < 1e-9 || Math.hypot(...b) < 1e-9) throw new Error("Diese Linien können nicht bemaßt werden.");
    if (choice.key === "angle") return Math.acos(Math.max(-1, Math.min(1, (a[0] * b[0] + a[1] * b[1]) / Math.hypot(...a) / Math.hypot(...b)))) * 180 / Math.PI;
    return Math.abs(a[0] * (point(curves[1].start_at)[1] - point(c.start_at)[1]) - a[1] * (point(curves[1].start_at)[0] - point(c.start_at)[0])) / Math.hypot(...a);
  }

  function constraintChoices(sketch, selection) {
    const picks = selected(sketch, selection) || [];
    const curves = picks.filter((p) => p.item.type === "sketch_curve");
    const points = picks.filter((p) => p.item.type === "sketch_point");
    const pair = picks.length === 2;
    const lines = curves.filter((p) => p.entity.type === "line");
    const rounds = curves.filter((p) => isRound(p.entity));
    const ids = picks.map((p) => p.item.id);
    const ab = { a: ids[0], b: ids[1] };
    const make = (key, label, enabled, params, command = "sketch.constraint." + key) => ({ key, label, enabled: !!enabled, params, command, reason: "Passende Skizzenelemente mit dem Pencil auswählen." });
    const choices = [
      make("parallel", "Parallel", pair && lines.length === 2, ab),
      make("perpendicular", "Senkrecht", pair && lines.length === 2, ab),
      make("tangent", "Tangential", pair && curves.length === 2 && rounds.length >= 1 && lines.length + rounds.length === 2, ab),
      make("coincident", "Zusammenfallend", pair && (points.length === 2 || points.length === 1 && curves.length === 1), ab),
      make("midpoint", "Mittelpunkt", pair && (lines.length === 2 || lines.length === 1 && points.length === 1), points.length === 1 ? { point: points[0].item.id, line: lines[0] && lines[0].item.id } : ab),
      make("equal", "Gleich", pair && (lines.length === 2 || rounds.length === 2), ab),
      make("concentric", "Konzentrisch", pair && rounds.length === 2, ab),
      make("horizontal", "Horizontal", picks.length === 1 && lines.length === 1, { line: ids[0], mode: "horizontal" }, "sketch.constraint.horizontal_vertical"),
      make("vertical", "Vertikal", picks.length === 1 && lines.length === 1, { line: ids[0], mode: "vertical" }, "sketch.constraint.horizontal_vertical"),
      make("fix", "Sperren / Lösen", picks.length > 0 && curves.length + points.length === picks.length, { entities: ids }, "sketch.constraint.fix"),
      make("construction", "Konstruktion", picks.length > 0 && curves.length === picks.length, { curves: ids }, "sketch.construction"),
    ];
    return choices;
  }

  function constraintCurveIndices(c) {
    if (["horizontal", "vertical", "length", "line_angle"].includes(c.type)) return [c.l];
    if (["parallel", "perpendicular", "collinear", "equal", "concentric", "tangent", "angle", "slot_overall_length", "circle_circle_distance"].includes(c.type)) return [c.a, c.b];
    if (["midpoint", "point_line_distance", "symmetric"].includes(c.type)) return [c.l];
    if (["radius", "diameter", "arc_length", "arc_sweep", "ellipse_major", "ellipse_minor"].includes(c.type)) return [c.c];
    if (c.type === "line_circle_distance") return [c.l, c.c];
    if (c.type === "point_circle_distance") return [c.c];
    return [];
  }
  function constraintPointIndices(c) {
    if (["fix", "midpoint", "point_line_distance", "point_circle_distance"].includes(c.type)) return [c.p];
    if (["coincident", "distance", "distance_x", "distance_y", "symmetric"].includes(c.type)) return [c.p, c.q];
    return [];
  }
  function anchors(sketch, c) {
    return [...constraintCurveIndices(c).map((i) => curvePoint(sketch.curves[i])), ...constraintPointIndices(c).map((i) => point(sketch.points[i] && sketch.points[i].at))].filter(finitePoint);
  }
  function related(sketch, c, selection) {
    const picks = selected(sketch, selection) || [];
    return picks.some(({ item }) => item.type === "sketch_constraint" ? item.id === c.id : item.type === "sketch_curve" ? constraintCurveIndices(c).some((i) => sketch.curves[i] && sketch.curves[i].id === item.id) || constraintPointIndices(c).some((i) => { const curve = sketch.curves.find((v) => v.id === item.id), p = sketch.points[i]; return curve && p && [curve.start, curve.end, curve.center].includes(p.id); }) : constraintPointIndices(c).some((i) => sketch.points[i] && sketch.points[i].id === item.id));
  }
  // Aus der Fehlermeldung „conflicts with k3, k4, k6“ das eine gebundene Maß derselben Art finden.
  function drivingDimension(sketch, message, key) {
    const m = /conflicts with ([^)]*)/.exec(message || "");
    if (!sketch || !m) return null;
    const ids = m[1].split(/[,\s]+/).filter(Boolean);
    const kinds = key === "angle" ? ["angle", "line_angle"] : key === "diameter" ? ["diameter", "radius"] : ["length", "distance", "distance_x", "distance_y", "point_line_distance"];
    const hits = sketch.constraints.filter((c) => ids.includes(c.id) && c.param && kinds.includes(c.type));
    return hits.length === 1 ? hits[0] : null;
  }
  function formatted(value, angular, units = "mm") {
    const factor = { mm: 1, cm: 10, m: 1000, in: 25.4, inch: 25.4, ft: 304.8 }[units] || 1;
    const n = angular ? value : value / factor;
    return `${Number(n.toFixed(3))} ${angular ? "deg" : units}`;
  }

  class Controller {
    constructor(bridge, changed = () => {}) {
      this.bridge = bridge; this.changed = changed; this.snapshot = null;
      this.editor = null; this.model = null; this.error = ""; this.busy = false; this.refreshing = null; this.refreshAgain = false;
      this.lastAdded = []; this.previous = null; this.units = "mm"; this.unitsContext = null;
    }
    refresh(info, selection) {
      // Overlapping UI events share one refresh and at most one fresh follow-up per
      // in-flight pass. In particular, actions must await the latest selection;
      // returning early here used the previous poll's selection instead.
      if (this.refreshing) { this.refreshAgain = true; return this.refreshing; }
      this.refreshing = Promise.resolve().then(async () => {
        do {
          this.refreshAgain = false;
          await this.refreshOnce(info, selection);
          info = undefined; selection = undefined;
        } while (this.refreshAgain);
      }).finally(() => { this.refreshing = null; });
      return this.refreshing;
    }
    async refreshOnce(info, selection) {
      try {
        info = info || await this.bridge.request("ui.inspect");
        if (info.home || !info.ui || info.ui.tab !== "SKETCH") {
          this.snapshot = null; this.model = null; this.previous = null; this.lastAdded = []; this.cancel();
          selection = selection || await this.bridge.request("ui.selection");
          const items = selection.selection || [];
          if (!info.home && !info.tool && !info.dialog && items.length === 1 && items[0].type === "edge") {
            const before = await this.bridge.execute("document.revision");
            const measured = await this.bridge.execute("inspect.measure", { items });
            const doc = await this.bridge.request("document.inspect"); this.units = doc.units || "mm";
            const p = items[0].point;
            const world = Array.isArray(p) ? p : p && [p.x, p.y, p.z];
            if (world && world.length === 3 && world.every(Number.isFinite) && measured.items && measured.items[0] && Number.isFinite(measured.items[0].length_mm)) {
              const screen = await this.bridge.request("ui.at", { world });
              const after = await this.bridge.execute("document.revision");
              if (sameContext(before, after)) this.model = { value: measured.items[0].length_mm, screen };
            }
          }
          this.changed(); return;
        }
        this.model = null;
        selection = selection || await this.bridge.request("ui.selection");
        const before = await this.bridge.execute("document.revision");
        const [sketch, options] = await Promise.all([this.bridge.execute("sketch.inspect"), this.bridge.execute("sketch.options")]);
        // Units can change while the same sketch stays open. Read them only when
        // the design changes, and include that read in the revision guard.
        const doc = sameContext(this.unitsContext, before) ? null : await this.bridge.request("document.inspect");
        const after = await this.bridge.execute("document.revision");
        if (!sameContext(before, after)) return;
        if (doc) { this.units = doc.units || "mm"; this.unitsContext = before; }
        if (!this.previous || this.previous.document_id !== before.document_id || this.previous.id !== sketch.id) {
          this.previous = { document_id: before.document_id, id: sketch.id, ids: new Set(sketch.curves.map((c) => c.id)) };
          this.lastAdded = [];
        } else {
          const added = sketch.curves.filter((c) => !this.previous.ids.has(c.id));
          if (added.length) this.lastAdded = added.slice(-16).map((c) => c.id);
          this.previous.ids = new Set(sketch.curves.map((c) => c.id));
        }
        this.snapshot = { info, selection, sketch, options: options.options || {}, context: before };
        if (this.editor && (!sameContext(this.editor.context, before) || this.editor.sketch !== sketch.id)) {
          this.cancel(); this.error = "Die Skizze wurde geändert. Maß bitte erneut auswählen.";
        }
        this.changed();
      } catch (error) { this.snapshot = null; this.model = null; this.error = "CAD-Verbindung unterbrochen. Erneut versuchen."; this.changed(); }
    }
    async guard(context, sketch) {
      const current = await this.bridge.execute("document.revision");
      const active = await this.bridge.execute("sketch.inspect");
      if (!sameContext(context, current) || active.id !== sketch) throw new Error("Die Skizze wurde geändert. Auswahl bitte wiederholen.");
    }
    begin(choice) {
      const s = this.snapshot;
      if (!s || this.busy || s.info.dialog || s.info.tool) throw new Error("Zuerst das Zeichenwerkzeug beenden.");
      const valid = dimensionChoices(s.sketch, choice.entities.map((id) => ({ type: "sketch_curve", id, sketch: s.sketch.id }))).find((c) => c.key === choice.key && c.enabled);
      if (!valid) throw new Error("Diese Auswahl kann so nicht bemaßt werden.");
      this.editor = { context: s.context, sketch: s.sketch.id, choice: valid, value: formatted(measureChoice(s.sketch, valid), valid.key === "angle", this.units), first: true, error: "" };
      this.changed();
    }
    edit(id) {
      const s = this.snapshot, c = s && s.sketch.constraints.find((x) => x.id === id);
      if (!c || !isDimension(c) || !c.param) throw new Error("Dieses Referenzmaß wird von anderen Bedingungen bestimmt.");
      if (s.info.dialog || s.info.tool) throw new Error("Zuerst das Zeichenwerkzeug beenden.");
      this.editor = { context: s.context, sketch: s.sketch.id, constraint: c.id, param: c.param, value: c.expression || formatted(ANGLES.has(c.type) ? c.value * 180 / Math.PI : c.value, ANGLES.has(c.type), this.units), first: true, error: "" };
      this.changed();
    }
    cancel() { if (this.editor) { this.editor = null; this.changed(); } }
    key(key) {
      const e = this.editor; if (!e || this.busy) return;
      if (key === "tab") return;
      if (key === "ok") return this.commit();
      if (key === "esc") return this.cancel();
      if (key === "back") { e.value = e.first ? "" : Array.from(e.value).slice(0, -1).join(""); e.first = false; }
      else if (key === "neg") { e.value = e.value.startsWith("-") ? e.value.slice(1) : "-" + e.value; e.first = false; }
      else if (typeof key === "string" && key.length < 32) { e.value = (e.first ? "" : e.value) + key; e.first = false; }
      if (e.value.length > 256) e.value = e.value.slice(0, 256);
      e.error = ""; this.changed();
    }
    async commit() {
      const e = this.editor; if (!e || this.busy) return;
      this.busy = true;
      try {
        if (!e.value.trim()) throw new Error("Bitte einen Wert eingeben.");
        await this.guard(e.context, e.sketch);
        if (e.param) await this.bridge.execute("parameters.change", { name: e.param, expression: e.value });
        else {
          try {
            await this.bridge.execute("sketch.dimension", { sketch: e.sketch, entities: e.choice.entities, type: e.choice.key, value: e.value });
          } catch (error) {
            // Das Maß ist schon durch ein anderes Maß bestimmt (z. B. die gegenüberliegende Rechteckseite):
            // dann dieses bestimmende Maß ändern, statt ein überzähliges anzulegen.
            const driving = drivingDimension(this.snapshot && this.snapshot.sketch, String(error.message || error), e.choice.key);
            if (!driving) throw error;
            await this.bridge.execute("parameters.change", { name: driving.param, expression: e.value });
            this.notice = "Bestimmendes Maß geändert";
          }
        }
        this.editor = null; this.error = "";
      } catch (error) { if (this.editor === e) e.error = String(error.message || error); }
      finally { this.busy = false; this.changed(); }
    }
    async unlock() {
      const e = this.editor; if (!e || !e.constraint || this.busy) return;
      await this.write("sketch.delete", { entities: [e.constraint] }, e.context, e.sketch);
      if (!this.error) { this.cancel(); await this.bridge.execute("select.clear"); }
    }
    async write(command, params, context = this.snapshot && this.snapshot.context, sketch = this.snapshot && this.snapshot.sketch.id) {
      if (!context || this.busy) return;
      this.busy = true; this.error = "";
      try { await this.guard(context, sketch); await this.bridge.execute(command, params); }
      catch (error) { this.error = String(error.message || error); }
      finally { this.busy = false; this.changed(); }
    }
    async apply(key) {
      await this.refresh(); const s = this.snapshot;
      if (!s || s.info.tool || s.info.dialog) return;
      const choice = constraintChoices(s.sketch, s.selection.selection).find((c) => c.key === key);
      if (!choice || !choice.enabled) return;
      return this.write(choice.command, choice.params);
    }
    async removeSelected() {
      await this.refresh(); const s = this.snapshot;
      const picks = s && selected(s.sketch, s.selection.selection);
      if (!picks || !picks.every((p) => p.item.type === "sketch_constraint")) return;
      await this.write("sketch.delete", { entities: picks.map((p) => p.item.id) });
      if (!this.error) await this.bridge.execute("select.clear");
    }
    async disconnect() {
      await this.refresh(); const s = this.snapshot;
      const picks = s && selected(s.sketch, s.selection.selection);
      if (!picks || !picks.every((p) => p.item.type === "sketch_constraint" && p.entity.type === "coincident")) return;
      return this.removeSelected();
    }
    async option(key) {
      const s = this.snapshot; if (!s || this.editor) return;
      return this.write("sketch.options", { sketch: s.sketch.id, [key]: !s.options[key] });
    }
  }

  return { Controller, drivingDimension, selected, linePair, parallel, dimensionChoices, constraintChoices, measureChoice, constraintCurveIndices, constraintPointIndices, anchors, related, formatted, isDimension, curvePoint, point, sameContext, ANGLES };
});
