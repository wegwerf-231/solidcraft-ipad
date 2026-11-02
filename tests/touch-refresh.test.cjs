// SPDX-License-Identifier: MIT OR Apache-2.0
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

function fixture() {
  const calls = [], rendered = [], events = new Map(), microtasks=[], frames=[], mouseEvents=[];
  const canvas={width:2048,height:1536,getBoundingClientRect:()=>({width:1024,height:768}),dispatchEvent:e=>mouseEvents.push(e)};
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
  const document = { getElementById:()=>canvas, hidden: false, addEventListener(name, fn) { events.set(name, fn); } };
  const context = { window: { devicePixelRatio:2, solidcraft: api, SolidCraftKeypad: require('../keypad-tools.js'), SOLIDCRAFT_IPAD_RELEASE: { version: 'test' } }, document,
    location: { search: '', hostname: 'localhost' }, URLSearchParams, navigator: { userAgent: 'iPad' },
    performance: { now: () => 1000 }, requestAnimationFrame: fn=>{frames.push(fn);return frames.length;}, cancelAnimationFrame:id=>{frames[id-1]=null;}, queueMicrotask:fn=>microtasks.push(fn), MouseEvent:class {constructor(type,init){Object.assign(this,{type},init);}}, innerWidth: 1024, innerHeight: 768,
    setInterval() {}, setTimeout() {}, clearTimeout() {}, addEventListener() {}, console };
  vm.createContext(context);
  const source = fs.readFileSync(require.resolve('../touch-nav.js'), 'utf8');
  vm.runInContext(source.replace(/\}\)\(\);\s*$/, `
    globalThis.hooks = { refreshUI, fieldCheck, appState, numericIntent, move, releaseAfterMoves, displayInfo, onPointer,
      gesture(value) { state = value; }, pen(value) { stylusStart = value; },
      setup(sketch, shell, render, el, keypad) {
        sketchTools = sketch; touchShell = shell;
        renderSelection = (info, sel) => render('selection', info, sel);
        renderRail = (info, sel) => render('rail', info, sel);
        agent = el; keypadTools = keypad; showKeyboardPill = () => {}; showPad = () => {};
      }
    };
  })();`), context);
  const render = (name, actualInfo, actualSelection) => {
    assert.equal(actualInfo, info); assert.equal(actualSelection, selection); rendered.push(name);
  };
  canvas.closest=()=>null;
  const sketch = { refresh: async (i, s) => render('sketch', i, s) };
  const shell = { refresh: async (i, s) => render('shell', i, s) };
  context.hooks.setup(sketch, shell, render);
  return { calls, rendered, events, document, info, selection, canvas, mouseEvents, microtasks, frames, flushMicrotasks(){while(microtasks.length)microtasks.shift()();}, flushFrame(){const pending=frames.splice(0);for(const fn of pending)if(fn)fn();}, hooks: context.hooks,
    hold(promise) { hold = promise; }, fail(value) { fail = value; },
    focused(dialog = null) {
      const el = { setAttribute() {} }; document.activeElement = el;
      info.tool = dialog ? 'solid.extrude' : 'sketch.rectangle.two_point'; info.dialog = dialog;
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


test('extrusion autofocus stays closed until the numeric field is explicitly tapped',async()=>{
 const f=fixture();f.focused('Extrude { value_focus: Some(123) }');
 await f.hooks.refreshUI();assert.equal(f.rendered.includes('field'),false);
 f.hooks.numericIntent.tap(500,300,[{name:'dialog:Distance',x:500,y:300}]);
 await f.hooks.refreshUI();assert.equal(f.rendered.filter(x=>x==='field').length,1);
 await f.hooks.refreshUI();assert.equal(f.rendered.filter(x=>x==='field').length,1,'autofocus must not reopen a dismissed keypad');
});


test('extrusion movement reaches native input before RAF, coalesces bursts and preserves the lifted endpoint',()=>{
 const f=fixture();f.hooks.appState.dialog=true;f.hooks.pen({pressed:true});
 for(let i=0;i<100;i++)f.hooks.move(i,200);
 assert.equal(f.microtasks.length,1);assert.equal(f.frames.length,0);f.flushMicrotasks();
 assert.equal(f.mouseEvents.length,1);assert.equal(f.mouseEvents[0].clientX,99);
 f.hooks.move(100,201);f.hooks.releaseAfterMoves(105,202);f.flushMicrotasks();
 assert.equal(f.mouseEvents.length,2);assert.equal(f.mouseEvents[1].clientX,105);
 f.flushFrame();assert.equal(f.mouseEvents.at(-1).type,'pointerup');assert.equal(f.mouseEvents.at(-1).clientX,105);
});

test('native mouse drag pauses background CAD reads and releases even over an overlay',async()=>{
 const f=fixture();f.hooks.onPointer({type:'pointerdown',pointerType:'mouse',clientX:1,clientY:1,target:f.canvas});
 await f.hooks.refreshUI();assert.deepEqual(f.calls,[]);
 f.hooks.onPointer({type:'pointerup',pointerType:'mouse',clientX:1,clientY:1,target:{closest:()=>({})}});
 await f.hooks.refreshUI();assert.equal(f.calls.includes('ui.inspect'),true);
});

test('display diagnostics distinguish Retina resolution from a stretched lower-resolution canvas',()=>{
 const f=fixture();assert.equal(f.hooks.displayInfo().nativeResolution,true);
 f.canvas.width=1024;f.canvas.height=768;assert.equal(f.hooks.displayInfo().nativeResolution,false);
 assert.equal(f.hooks.displayInfo().dpr,2);
});
