// SPDX-License-Identifier: MIT OR Apache-2.0
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

function fixture() {
  const calls = [], rendered = [], events = new Map();
  const info = { tool: null, dialog: null, ui: { tab: 'SKETCH' } };
  const selection = { selection: [] };
  let hold, fail = false;
  const api = { async request(method) {
    calls.push(method);
    if (method === 'ui.inspect') { if (hold) await hold; if (fail) throw Error('offline'); return info; }
    if (method === 'ui.selection') return selection;
    if (method === 'ui.handles') return [];
    throw Error(method);
  } };
  const document = { hidden: false, addEventListener(name, fn) { events.set(name, fn); } };
  const context = { window: { solidcraft: api, SOLIDCRAFT_IPAD_RELEASE: { version: 'test' } }, document,
    location: { search: '', hostname: 'localhost' }, URLSearchParams, navigator: { userAgent: 'iPad' },
    performance: { now: () => 1000 }, innerWidth: 1024, innerHeight: 768,
    setInterval() {}, setTimeout() {}, clearTimeout() {}, addEventListener() {}, console };
  vm.createContext(context);
  const source = fs.readFileSync(require.resolve('../touch-nav.js'), 'utf8');
  vm.runInContext(source.replace(/\}\)\(\);\s*$/, `
    globalThis.hooks = { refreshUI, fieldCheck, appState,
      gesture(value) { state = value; }, pen(value) { stylusStart = value; },
      setup(sketch, shell, render, el, keypad) {
        sketchTools = sketch; touchShell = shell;
        renderSelection = (info, sel) => render('selection', info, sel);
        renderRail = (info, sel) => render('rail', info, sel);
        agent = el; keypadTools = keypad; showKeyboardPill = () => {};
      }
    };
  })();`), context);
  const render = (name, actualInfo, actualSelection) => {
    assert.equal(actualInfo, info); assert.equal(actualSelection, selection); rendered.push(name);
  };
  const sketch = { refresh: async (i, s) => render('sketch', i, s) };
  const shell = { refresh: async (i, s) => render('shell', i, s) };
  context.hooks.setup(sketch, shell, render);
  return { calls, rendered, events, document, info, selection, hooks: context.hooks,
    hold(promise) { hold = promise; }, fail(value) { fail = value; },
    focused() {
      const el = { setAttribute() {} }; document.activeElement = el;
      info.tool = 'sketch.rectangle.two_point';
      context.hooks.setup(sketch, shell, render, el, { active: false, native: { begin: async i => {
        assert.equal(i, info); rendered.push('field');
      } } });
    }
  };
}

test('one refresh shares inspection/selection with shell, sketch, context actions and drawing field', async () => {
  const f = fixture(); f.focused(); await f.hooks.refreshUI();
  assert.deepEqual(f.calls, ['ui.inspect', 'ui.selection', 'ui.handles']);
  assert.deepEqual(f.rendered, ['shell', 'sketch', 'selection', 'rail', 'field']);
  assert.equal(f.hooks.appState.tool, 'sketch.rectangle.two_point');
  f.calls.length = 0; await f.hooks.refreshUI();
  assert.deepEqual(f.calls, ['ui.inspect', 'ui.selection']);
});

test('slow refreshes coalesce timer and action requests without a backlog', async () => {
  const f = fixture(); let release; f.hold(new Promise(resolve => { release = resolve; }));
  const first = f.hooks.refreshUI();
  for (let i = 0; i < 20; i++) assert.equal(f.hooks.refreshUI(), first);
  assert.deepEqual(f.calls, ['ui.inspect', 'ui.selection']);
  release(); await first;
  assert.equal(f.rendered.filter(name => name === 'sketch').length, 1);
});

test('hidden tabs, finger navigation and Pencil strokes do not poll the CAD bridge', async () => {
  const f = fixture(); f.document.hidden = true;
  await f.hooks.refreshUI(); await f.hooks.fieldCheck();
  f.document.hidden = false; f.hooks.gesture('orbit'); await f.hooks.refreshUI();
  f.hooks.gesture('idle'); f.hooks.pen({}); await f.hooks.refreshUI();
  assert.deepEqual(f.calls, []);
  f.hooks.pen(null); f.events.get('visibilitychange')(); await f.hooks.refreshUI();
  assert.deepEqual(f.calls, ['ui.inspect', 'ui.selection', 'ui.handles']);
});

test('a gesture beginning while inspection is pending suppresses remaining refresh work', async () => {
  const f = fixture(); let release; f.hold(new Promise(resolve => { release = resolve; }));
  const pass = f.hooks.refreshUI(); f.hooks.pen({}); release(); await pass;
  assert.deepEqual(f.calls, ['ui.inspect', 'ui.selection']); assert.deepEqual(f.rendered, []);
});

test('a failed bridge read does not wedge later refreshes', async () => {
  const f = fixture(); f.fail(true); await f.hooks.refreshUI(); assert.deepEqual(f.rendered, []);
  f.fail(false); await f.hooks.refreshUI();
  assert.deepEqual(f.rendered, ['shell', 'sketch', 'selection', 'rail']);
});
