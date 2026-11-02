// SPDX-License-Identifier: MIT OR Apache-2.0
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Model = require('../sketch-tools.js');
const settle = () => new Promise(resolve => setImmediate(resolve));

// A minimal DOM keeps these tests focused on event ownership, projection freshness
// and the order of layout reads/writes. It does not replace browser layout tests.
function fixture() {
  const state = { calls: [], layout: [], offset: 0, gate: null, edits: 0 };
  class Element {
    constructor(tag) {
      this.tagName = tag; this.children = []; this.dataset = {}; this.listeners = {};
      this.attrs = {}; this.className = ''; this.hidden = false; this.parentNode = null;
      this.style = new Proxy({}, { set: (o, key, value) => {
        if (this.dataset.scene && ['left', 'top'].includes(key)) state.layout.push('write');
        o[key] = value; return true;
      }});
      this.classList = { toggle: () => {} };
    }
    append(...items) { for (const item of items) { this.children.push(item); item.parentNode = this; } }
    appendChild(item) { this.append(item); return item; }
    prepend(...items) { this.children.unshift(...items); for (const item of items) item.parentNode = this; }
    replaceChildren(...items) { for (const old of this.children) old.parentNode = null; this.children = []; this.append(...items); }
    remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(n => n !== this); this.parentNode = null; }
    setAttribute(key, value) { this.attrs[key] = String(value); }
    getBoundingClientRect() { return { left: 1000, top: 100, width: 100, height: 44 }; }
    get offsetWidth() { state.layout.push('read'); return 120; }
    addEventListener(type, handler) { (this.listeners[type] ||= []).push(handler); }
    dispatch(type, data = {}) {
      const event = { type, target: this, pointerType: 'touch', pointerId: 1, clientX: 10, clientY: 10, preventDefault() {}, stopPropagation() {}, ...data };
      for (const handler of this.listeners[type] || []) handler(event);
    }
    closest() { return this.dataset.sketchAction ? this : this.parentNode?.closest() || null; }
    contains(node) { return node === this || this.children.some(n => n.contains(node)); }
    focus() {} blur() {} select() {}
  }
  class Controller {
    constructor(bridge, changed) { this.changed = changed; this.snapshot = null; this.lastAdded = []; this.units = 'mm'; this.error = ''; }
    async refresh() { if (state.nextSnapshot) { this.snapshot = state.nextSnapshot; state.nextSnapshot = null; } this.changed(); }
    begin() { state.edits++; }
    cancel() { this.editor = null; }
  }
  const document = { body: { classList: { contains: () => !!state.shifted } }, head: new Element('head'), createElement: tag => new Element(tag), createElementNS: (namespaceURI, tag) => Object.assign(new Element(tag), { namespaceURI }) };
  const host = new Element('div'), pad = new Element('div'); host.append(pad);
  const context = { SolidCraftSketch: { ...Model, Controller }, document, innerWidth: 1280, innerHeight: 900, localStorage: { getItem: () => null, setItem() {} } };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(require.resolve('../sketch-tools-view.js'), 'utf8'), context);
  const view = context.SolidCraftSketchView.mount({ host, pad, handles: () => [], isUI: () => false, changed() {}, showPad() {},
    async request(method, params) {
      state.calls.push({ method, params });
      if (method === 'ui.inspect') return {};
      if (method !== 'ui.sketchToScreen') throw Error(method);
      const gate = state.gate; state.gate = null; if (gate) await gate;
      return params.points.slice(0, 1000).map(p => [p[0] + 300 + state.offset, p[1] + 300 + (state.yOffset || 0)]);
    },
  });
  const snapshot = (document_id = 'a', revision = 1, count = 1, show = false) => ({
    info: { ui: { tab: 'SKETCH' } }, context: { document_id, revision },
    sketch: { id: 7, points: [], constraints: [], curves: Array.from({ length: count }, (_, i) => ({ id: 'l' + i, type: 'line', start_at: [0, i * 60], end_at: [100, i * 60] })) },
    selection: { selection: show ? Array.from({ length: count }, (_, i) => ({ type: "sketch_curve", id: "l" + i })) : [], dimensions: [] }, options: { show_dimensions: show },
  });
  const show = s => { view.controller.snapshot = s; view.controller.changed(); };
  return { state, view, snapshot, show, panel: host.children.find(n => n.className === 'sk-panel'), labels: host.children.find(n => n.className === 'sk-labels') };
}

test('Pencil hit geometry follows the camera even when no labels are visible', async () => {
  const f = fixture(); f.show(f.snapshot()); await settle();
  assert.equal(f.view.additiveAt(350, 300), true);
  assert.equal(f.state.calls.length, 1);
  f.state.offset = 200; f.show(f.snapshot()); await settle();
  assert.equal(f.view.additiveAt(350, 300), false);
  assert.equal(f.view.additiveAt(550, 300), true);
  assert.equal(f.state.calls.length, 2);
});

test('document changes invalidate cached Pencil hit targets before new projection resolves', async () => {
  const f = fixture(); f.show(f.snapshot()); await settle();
  let release; f.state.gate = new Promise(resolve => { release = resolve; });
  f.state.offset = 200; f.show(f.snapshot('b'));
  assert.equal(f.view.additiveAt(350, 300), false);
  release(); await settle();
  assert.equal(f.view.additiveAt(550, 300), true);
  f.show(null); assert.equal(f.view.additiveAt(550, 300), false);
});

test('a superseded projection is discarded and the latest snapshot is projected', async () => {
  const f = fixture(); let release;
  f.state.gate = new Promise(resolve => { release = resolve; });
  f.show(f.snapshot('old')); f.show(f.snapshot('new', 1, 0));
  release(); await settle();
  assert.equal(f.view.additiveAt(350, 300), false);
  assert.equal(f.labels.children.filter(n => n.dataset.scene).length, 0);
});

test('labels and Pencil hits use one projection; label widths are batched before placement writes', async () => {
  const f = fixture(); f.show(f.snapshot('a', 1, 3, true)); await settle();
  assert.equal(f.state.calls.length, 1);
  assert.equal(f.labels.children.filter(n => n.dataset.scene).length, 3);
  assert.equal(f.state.layout.filter(x => x === 'read').length, 3);
  assert.ok(f.state.layout.lastIndexOf('read') < f.state.layout.indexOf('write'));
});

test('scrolling or cancelling on the conditions rail never triggers the release button', async () => {
  const f = fixture(); f.show(f.snapshot()); await settle();
  const target = f.panel.children[0];
  for (const event of ['pointermove', 'scroll', 'pointercancel']) {
    f.panel.dispatch('pointerdown', { target });
    f.panel.dispatch(event, { target, clientY: 80 });
    f.panel.dispatch('pointerup', { target });
    assert.equal(f.panel.children[0].attrs['aria-expanded'], 'true', event);
  }
  f.panel.dispatch('pointerdown', { target }); f.panel.dispatch('pointerup', { target });
  assert.equal(f.panel.children[0].attrs['aria-expanded'], 'false');
  f.panel.dispatch('click', { target: f.panel.children[0], detail: 0 });
  assert.equal(f.panel.children[0].attrs['aria-expanded'], 'true');
});

test('scene labels reject finger taps but accept a Pencil tap', async () => {
  const f = fixture(); f.show(f.snapshot('a', 1, 1, true)); await settle();
  const target = f.labels.children.find(n => n.dataset.scene);
  f.labels.dispatch('pointerdown', { target }); f.labels.dispatch('pointerup', { target });
  await settle(); assert.equal(f.state.edits, 0);
  f.labels.dispatch('pointerdown', { target, pointerType: 'pen' });
  f.labels.dispatch('pointerup', { target, pointerType: 'pen' });
  await settle(); assert.equal(f.state.edits, 1);
});


test('a document switch while opening a label never edits a same-named curve in the new document', async () => {
  const f = fixture(); f.show(f.snapshot('a', 1, 1, true)); await settle();
  const target = f.labels.children.find(n => n.dataset.scene);
  f.state.nextSnapshot = f.snapshot('b', 1, 1, true);
  f.labels.dispatch('pointerdown', { target, pointerType: 'pen' });
  f.labels.dispatch('pointerup', { target, pointerType: 'pen' });
  await settle();
  assert.equal(f.state.edits, 0);
  assert.match(f.view.controller.error, /geändert/);
});


test('large sketches respect the native 1000-point cap without losing final Pencil targets', async () => {
  const f = fixture(), s = f.snapshot('a', 1, 256, true);
  s.sketch.curves.forEach((c, i) => { c.start_at = [0, i === 255 ? 80 : 0]; c.end_at = [100, i === 255 ? 80 : 0]; });
  f.show(s); await settle();
  assert.equal(f.state.calls.length, 2);
  assert.ok(f.state.calls.every(c => c.params.points.length <= 1000));
  assert.equal(f.view.additiveAt(350, 380), true);
});


test('full sketch mode permits labels near the top edge and mode changes invalidate label layout', async () => {
  const f = fixture(); f.state.yOffset=-250;
  f.show(f.snapshot('a',1,1,true)); await settle();
  assert.equal(f.labels.children.filter(n => n.dataset.scene).length,0);
  f.state.shifted=true; f.show(f.snapshot('a',1,1,true)); await settle();
  assert.equal(f.labels.children.filter(n => n.dataset.scene).length,1);
});

test('free dimensions prefer explicit selection and suppress duplicate newly drawn parallel sides', async () => {
  const f=fixture(), s=f.snapshot('a',1,3);
  f.view.controller.lastAdded=['l0','l1','l2'];
  f.show(s); await settle();
  assert.equal(f.labels.children.filter(n => n.dataset.scene).length,1);
  s.selection.selection=[{type:'sketch_curve',id:'l2'}];
  f.show({...s}); await settle();
  const records=f.labels.children.filter(n => n.dataset.scene);
  assert.equal(records.length,1);
  assert.ok(parseFloat(records[0].style.top)>350,'only the selected third line should retain its free label');
});
