// SPDX-License-Identifier: MIT OR Apache-2.0
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
function fixture(search = '', density = 2) {
  const state = { calls: [], bar: 105 /* Unterkante 105 + 55 = Versatz 160 */, summary: true, events: [], hold: null };
  const host = { dataset: { shellMode: 'touch' } }, classes = new Set(), styles = new Map(), listeners = new Map();
  const document = { hidden: false, head: { appendChild() {} }, createElement: () => ({}),
    getElementById: () => host,
    body: { classList: { add: c => classes.add(c), remove: c => classes.delete(c) },
      style: { setProperty: (k,v) => styles.set(k,v), removeProperty: k => styles.delete(k) } } };
  let tick;
  const context = { window: { devicePixelRatio: density }, document, location: { search }, URLSearchParams,
    setInterval: fn => { tick = fn; }, addEventListener: (n,fn) => listeners.set(n,fn),
    requestAnimationFrame: fn => fn(), dispatchEvent: event => state.events.push(event.type),
    CustomEvent: class { constructor(type) { this.type = type; } } };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(require.resolve('../canvas-shift.js'), 'utf8'), context);
  context.window.solidcraft = {
    async request(method, params = {}) {
      state.calls.push({ method, params });
      if (method === 'ui.handles') { if (state.hold) await state.hold; return [{ name: 'ribbon:section', x: 10, y: state.bar }]; }
      if (method === 'ui.prefs') { if ('viewport_status_summary' in params) state.summary = params.viewport_status_summary; return { viewport_status_summary: state.summary }; }
      if (method === 'ui.sketchToScreen' || method === 'ui.worldToScreen') return [[50, 200]];
      if (method === 'ui.inspect') return { viewport: [0, 180, 800, 600] };
      if (method === 'ui.selection') return { dimensions: [{ id: 'd1', x: 50, y: 200 }] };
      if (method === 'ui.at') return [50, 200];
      return {};
    },
    async execute(method, params) { state.calls.push({ method, params }); return {}; }
  };
  return { state, document, host, classes, styles, tick: () => tick(), resize: () => listeners.get('resize')(),
    api: context.window.solidcraft, shift: context.window.solidcraftCanvasShift };
}
const plain = value => JSON.parse(JSON.stringify(value));

test('screen projections and labels compensate the canvas shift without modifying world coordinates', async () => {
  const f = fixture(); await f.tick(); assert.equal(f.shift.shift, 160);
  for (const command of ['ui.sketchToScreen', 'ui.worldToScreen']) assert.deepEqual(plain(await f.api.request(command)), [[50,40]]);
  assert.deepEqual(plain(await f.api.request('ui.at')), [50,40]);
  assert.deepEqual(plain((await f.api.request('ui.inspect')).viewport), [0,20,800,600]);
  assert.equal((await f.api.request('ui.selection')).dimensions[0].y, 40);
  assert.equal((await f.api.request('ui.handles'))[0].y, -55);
  const points = [[1,2],[3,4]]; await f.api.execute('sketch.line', { points });
  assert.deepEqual(f.state.calls.at(-1).params.points, points);
});

test('CSS input, physical-pixel picking and viewport-local picking use their respective coordinate spaces', async () => {
  for (const density of [1,2,3]) {
    const f = fixture('', density); await f.tick();
    for (const method of ['ui.click','ui.move','ui.scroll','ui.menu']) {
      const params = { x:10, y:20 }; await f.api.request(method, params);
      assert.equal(f.state.calls.at(-1).params.y, 180); assert.equal(params.y, 20);
    }
    await f.api.request('ui.drag', { x0:1,y0:20,x1:2,y1:40,via:[[2,30]] });
    assert.equal(f.state.calls.at(-1).params.y1, 200);
    assert.deepEqual(plain(f.state.calls.at(-1).params.via), [[2,190]]);
    for (const method of ['ui.pick','view.pick']) {
      await (method === 'view.pick' ? f.api.execute : f.api.request)(method, { pixels:[[20,40]] });
      assert.deepEqual(plain(f.state.calls.at(-1).params.pixels), [[20,40+160*density]]);
      await f.api.request(method, { pixels:[[20,40]], frame:'viewport' });
      assert.deepEqual(plain(f.state.calls.at(-1).params.pixels), [[20,40]]);
    }
  }
});

test('advanced mode restores the viewport and previous status preference; returning restores full sketch mode', async () => {
  const f = fixture(); await f.tick(); assert.equal(f.state.summary, false);
  f.host.dataset.shellMode = 'advanced'; await f.tick();
  assert.equal(f.shift.shift, 0); assert.equal(f.classes.has('sc-shift'), false); assert.equal(f.styles.size, 0);
  assert.equal(f.state.summary, true); assert.deepEqual(plain(await f.api.request('ui.at')), [50,200]);
  f.host.dataset.shellMode = 'touch'; await f.tick(); assert.equal(f.shift.shift, 160);
  assert.equal(f.state.events.length, 3);
});

test('resize remeasures the ribbon once and idle/hidden ticks perform no CAD requests', async () => {
  const f = fixture(); await f.tick(); const count=f.state.calls.length;
  await f.tick(); assert.equal(f.state.calls.length,count);
  f.state.bar=160; f.resize(); await f.tick(); assert.equal(f.shift.shift,215);
  assert.equal(f.state.calls.filter(c => c.method==='ui.prefs' && c.params.viewport_status_summary===false).length,1);
  f.document.hidden=true; f.resize(); const before=f.state.calls.length; await f.tick(); assert.equal(f.state.calls.length,before);
});

test('leaving touch mode while ribbon measurement is pending cannot activate a stale shift', async () => {
  const f=fixture(); let release; f.state.hold=new Promise(resolve => { release=resolve; });
  const pending=f.tick(); f.host.dataset.shellMode='advanced'; release(); await pending;
  assert.equal(f.shift.shift,0); assert.equal(f.classes.size,0); assert.equal(f.state.summary,true);
});

test('fullsketch opt-out keeps coordinates and preferences untouched', async () => {
  const f=fixture('?fullsketch=off'); await f.tick(); assert.equal(f.state.calls.length,0);
  assert.deepEqual(plain(await f.api.request('ui.at')), [50,200]);
  assert.equal(f.state.summary,true); assert.equal(f.shift.shift,0);
});
