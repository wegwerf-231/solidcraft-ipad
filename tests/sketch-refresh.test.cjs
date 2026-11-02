// SPDX-License-Identifier: MIT OR Apache-2.0
const test = require('node:test');
const assert = require('node:assert/strict');
const {Controller} = require('../sketch-tools.js');
const copy = value => structuredClone(value);
function deferred() {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return {promise, resolve};
}
function fixture() {
  const state = {
    context: {document_id: 'a', revision: 1}, units: 'mm',
    sketch: {id: 7, points: [], constraints: [], curves: [
      {id: 'l1', type: 'line', start_at: [0, 0], end_at: [20, 0]},
      {id: 'l2', type: 'line', start_at: [0, 10], end_at: [20, 10]},
    ]},
    selection: [{type: 'sketch_curve', sketch: 7, id: 'l1'}],
    options: {show_dimensions: true, show_constraints: true},
    info: {home: false, ui: {tab: 'SKETCH'}, tool: null, dialog: null},
    calls: [], writes: [], holdSketch: null, afterDocumentRead: null,
  };
  const bridge = {
    async request(method) {
      state.calls.push(method);
      if (method === 'ui.inspect') return copy(state.info);
      if (method === 'ui.selection') return {selection: copy(state.selection), dimensions: []};
      if (method === 'document.inspect') {
        const doc = {units: state.units, active_sketch: state.sketch.id};
        if (state.afterDocumentRead) state.afterDocumentRead();
        return doc;
      }
      throw Error(method);
    },
    async execute(method, params) {
      state.calls.push(method);
      if (method === 'document.revision') return copy(state.context);
      if (method === 'sketch.inspect') {
        const result = copy(state.sketch);
        if (state.holdSketch) {
          const hold = state.holdSketch;
          state.holdSketch = null;
          hold.started.resolve();
          await hold.resume.promise;
        }
        return result;
      }
      if (method === 'sketch.options' && !params) return {options: copy(state.options)};
      state.writes.push({method, params});
      state.context.revision++;
      return {};
    },
  };
  return {state, control: new Controller(bridge)};
}

test('overlapping refreshes wait for one coalesced follow-up with the current selection', async () => {
  const {state, control} = fixture();
  const started = deferred(), resume = deferred();
  state.holdSketch = {started, resume};
  const pending = control.refresh();
  await started.promise;
  state.selection = [{type: 'sketch_curve', sketch: 7, id: 'l2'}];
  const callers = Array.from({length: 20}, () => control.refresh());
  let returned = false;
  callers[0].then(() => { returned = true; });
  await Promise.resolve();
  assert.equal(returned, false, 'callers must not use the previous snapshot while a refresh is pending');
  resume.resolve();
  await Promise.all([pending, ...callers]);
  assert.equal(control.snapshot.selection.selection[0].id, 'l2');
  assert.equal(state.calls.filter(x => x === 'sketch.inspect').length, 2);
  assert.equal(control.refreshing, null);
});

test('constraint actions joining a refresh validate the latest complete selection', async () => {
  const {state, control} = fixture();
  state.selection.push({type: 'sketch_curve', sketch: 7, id: 'l2'});
  await control.refresh();
  const started = deferred(), resume = deferred();
  state.holdSketch = {started, resume};
  const pending = control.refresh();
  await started.promise;
  state.selection = [{type: 'sketch_curve', sketch: 7, id: 'l1'}];
  const apply = control.apply('parallel');
  resume.resolve();
  await Promise.all([pending, apply]);
  assert.deepEqual(state.writes, [], 'a pair selected before the pending poll must not be constrained');
});

test('unit changes within an open sketch update labels without document reads on idle polls', async () => {
  const {state, control} = fixture();
  await control.refresh();
  await control.refresh();
  assert.equal(state.calls.filter(x => x === 'document.inspect').length, 1);
  state.units = 'in'; state.context.revision++;
  await control.refresh();
  assert.equal(control.units, 'in');
  assert.equal(state.calls.filter(x => x === 'document.inspect').length, 2);
  state.options.show_dimensions = false;
  await control.refresh();
  assert.equal(control.snapshot.options.show_dimensions, false);
});

test('a document change during the unit read cannot publish a mixed-context snapshot', async () => {
  const {state, control} = fixture();
  await control.refresh();
  const previous = control.snapshot;
  state.units = 'in'; state.context.revision++;
  state.afterDocumentRead = () => { state.context.document_id = 'b'; state.units = 'cm'; };
  await control.refresh();
  assert.equal(control.snapshot, previous);
  assert.equal(control.units, 'mm');
  state.afterDocumentRead = null;
  await control.refresh();
  assert.equal(control.snapshot.context.document_id, 'b');
  assert.equal(control.units, 'cm');
});

test('switching sketches without a design revision still reads the active sketch', async () => {
  const {state, control} = fixture();
  await control.refresh();
  state.sketch.id = 8;
  state.sketch.curves = [{id: 'different', type: 'line', start_at: [0, 0], end_at: [5, 0]}];
  state.selection = [];
  await control.refresh();
  assert.equal(control.snapshot.sketch.id, 8);
  assert.deepEqual(control.snapshot.sketch.curves.map(x => x.id), ['different']);
  assert.deepEqual(control.lastAdded, []);
});
