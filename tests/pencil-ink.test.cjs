// SPDX-License-Identifier: MIT OR Apache-2.0
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const gestures = require('../pencil-gestures.js');

function fixture() {
  const frames = new Map(), pointsWrites = [], writes = [];
  let frameId = 0, now = 0;
  const node = () => ({
    style: {}, isConnected: true, attributes: {},
    setAttribute(name, value) { this.attributes[name] = value; if (name === 'points') pointsWrites.push(value); },
    append() {}, appendChild() {}, remove() { this.isConnected = false; },
  });
  const context = { document_id: 'a', revision: 1 };
  const api = {
    async request(method) {
      if (method === 'ui.inspect') return { ui: { tab: 'SKETCH' } };
      if (method === 'ui.sketchToScreen') return [[0, 0], [1, 0], [0, 1]];
      throw Error(method);
    },
    async execute(command, params) {
      if (command === 'document.revision') return { ...context };
      if (command === 'sketch.inspect') return { points: [], curves: [] };
      writes.push({ command, params }); return { curves: ['l1'] };
    },
  };
  const sandbox = {
    window: { solidcraft: api, SolidCraftPencilGestures: gestures },
    document: { createElement: node, createElementNS: node, body: node() },
    location: { search: '' }, URLSearchParams, console,
    performance: { now: () => ++now },
    requestAnimationFrame(fn) { frames.set(++frameId, fn); return frameId; },
    cancelAnimationFrame(id) { frames.delete(id); },
    setInterval: () => 1, setTimeout: () => 1, clearInterval() {}, clearTimeout() {},
  };
  vm.createContext(sandbox);
  const source = fs.readFileSync(require.resolve('../pencil-sketch.js'), 'utf8');
  vm.runInContext(source.replace(/\}\)\(\);\s*$/, `
    nav={appState:{},zoneAt:()=>null,pollState(){}};
    globalThis.testHooks={inkStart,inkDraw,inkFade,ext};})();`), sandbox);
  const hooks = sandbox.testHooks;
  return {
    ...hooks, frames, pointsWrites, writes, context,
    flush() { const queue = [...frames.values()]; frames.clear(); queue.forEach(fn => fn()); },
    stroke() { return { mode: 'draw', pts: [{ x: 0, y: 0 }], ink: hooks.inkStart(), info: Promise.resolve({ context: { ...context } }), gesture: new gestures.Stroke({ x: 0, y: 0 }, 0) }; },
  };
}
const settle = () => new Promise(resolve => setImmediate(resolve));

test('a burst of Pencil events paints once per frame and retains every fitting sample', () => {
  const f = fixture(), s = f.stroke();
  for (let i = 1; i <= 100; i++) f.ext.move(s, { clientX: i * 2, clientY: 0, force: .2 });
  assert.equal(s.pts.length, 101);
  assert.equal(s.gesture.points.length, 101);
  assert.equal(f.frames.size, 1);
  assert.equal(f.pointsWrites.length, 0);
  f.flush();
  assert.equal(f.pointsWrites.length, 1);
  assert.equal(f.pointsWrites[0].split(' ').length, 101);
  assert.ok(f.pointsWrites[0].endsWith('200.0,0.0'));
  for (let i = 0; i < 50; i++) f.ext.move(s, { clientX: 200, clientY: 0, force: .2 });
  assert.equal(f.frames.size, 0, 'stationary dwell samples must not redraw the ink');
});

test('ink formats only appended coordinates and resets its cache after a wiggle replaces the path', () => {
  const f = fixture(), ink = f.inkStart();
  let formatted = 0;
  const x = value => ({ toFixed: digits => { formatted++; return value.toFixed(digits); } });
  const points = Array.from({ length: 100 }, (_, i) => ({ x: x(i), y: 0 }));
  f.inkDraw(ink, points); f.flush();
  assert.equal(formatted, 100);
  points.push({ x: x(100), y: 0 });
  f.inkDraw(ink, points); f.flush();
  assert.equal(formatted, 101, 'already rendered coordinates are not formatted again');
  f.inkDraw(ink, [{ x: 0, y: 0 }, { x: 10, y: 20 }]); f.flush();
  assert.equal(f.pointsWrites.at(-1), '0.0,0.0 10.0,20.0');
});

test('cancelled strokes discard pending paint and ignore later movement without CAD writes', async () => {
  const f = fixture(), s = f.stroke();
  f.ext.move(s, { clientX: 40, clientY: 0 });
  f.ext.end(s, { x: 45, y: 0 }, true);
  f.ext.move(s, { clientX: 60, clientY: 0 });
  f.flush(); await settle();
  assert.equal(f.frames.size, 0);
  assert.equal(f.pointsWrites.length, 0);
  assert.equal(s.pts.length, 2);
  assert.deepEqual(f.writes, []);
});

test('quick lift flushes the terminal point before conversion and leaves no queued redraw', async () => {
  const f = fixture(), s = f.stroke();
  f.ext.move(s, { clientX: 30, clientY: 0 });
  f.ext.end(s, { x: 45, y: 0 }, false);
  assert.equal(f.frames.size, 0);
  assert.equal(f.pointsWrites.length, 1);
  assert.ok(f.pointsWrites[0].endsWith('45.0,0.0'));
  await settle();
  assert.equal(f.writes.length, 1);
  assert.equal(f.writes[0].command, 'sketch.line');
  assert.equal(JSON.stringify(f.writes[0].params.points), '[[0,0],[45,0]]');
  f.flush();
  assert.equal(f.pointsWrites.length, 1);
});

test('a stroke shorter than the drawing threshold cancels its pending paint', async () => {
  const f = fixture(), s = f.stroke();
  f.ext.move(s, { clientX: 5, clientY: 0 });
  f.ext.end(s, { x: 8, y: 0 }, false);
  f.flush(); await settle();
  assert.equal(f.pointsWrites.length, 0);
  assert.deepEqual(f.writes, []);
});

test('cancelling before hover prefetch resolves cannot resurrect a stroke', async () => {
  const f = fixture();
  let resolve;
  const s = { x: 0, y: 0, info: new Promise(done => { resolve = done; }) };
  assert.equal(f.ext.claim(s), true);
  f.ext.move(s, { clientX: 40, clientY: 0 });
  f.ext.end(s, { x: 45, y: 0 }, true);
  resolve({ context: { ...f.context }, tab: 'SKETCH' });
  await settle(); f.flush();
  assert.equal(s.mode, 'off');
  assert.equal(f.pointsWrites.length, 0);
  assert.deepEqual(f.writes, []);
});

test('stationary samples at the stroke capacity still allow dwell without growing the path', () => {
  const s = new gestures.Stroke({ x: 0, y: 0 }, 0);
  for (let i = 1; i < 4096; i++) s.move({ x: i, y: 0 }, i);
  assert.doesNotThrow(() => s.move({ x: 4095, y: 0 }, 4500));
  assert.equal(s.points.length, 4096);
  assert.throws(() => s.move({ x: 4096, y: 0 }, 4600), /lang/);
});
