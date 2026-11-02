// SPDX-License-Identifier: MIT OR Apache-2.0
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../sketch-tools.js');
const clone = (v) => JSON.parse(JSON.stringify(v));
function fixture() {
  const sketch = { id: 7, curves: [
    { id: 'l1', type: 'line', start: 'p1', end: 'p2', start_at: [0,0], end_at: [20,0] },
    { id: 'l2', type: 'line', start: 'p3', end: 'p4', start_at: [0,10], end_at: [20,10] },
    { id: 'l3', type: 'line', start: 'p5', end: 'p6', start_at: [0,0], end_at: [0,20] },
    { id: 'c1', type: 'circle', center: 'p7', center_at: [30,30], radius: 5 },
  ], points: ['p1','p2','p3','p4','p5','p6','p7'].map((id, i) => ({ id, at: [i, i] })), constraints: [] };
  const state = { sketch, options: { show_dimensions: true, show_constraints: true }, selection: [], context: { document_id: 'doc-a', revision: 1 }, writes: [], units: 'mm' };
  const bridge = {
    async request(method) {
      if (method === 'ui.inspect') return { home: false, dialog: null, tool: null, ui: { tab: 'SKETCH' } };
      if (method === 'ui.selection') return { selection: clone(state.selection), dimensions: [] };
      if (method === 'document.inspect') return { units: state.units };
      throw Error('unknown request ' + method);
    },
    async execute(command, params = {}) {
      if (command === 'document.revision') return clone(state.context);
      if (command === 'sketch.inspect') return clone(state.sketch);
      if (command === 'sketch.options' && !Object.keys(params).length) return { options: clone(state.options) };
      if (params.value === '1/0' || params.expression === '1/0') throw Error('division by zero');
      state.writes.push({ command, params: clone(params) });
      state.context.revision++;
      if (command === 'sketch.options') Object.assign(state.options, params);
      return {};
    },
  };
  return { state, bridge, control: new M.Controller(bridge) };
}
const picks = (...ids) => ids.map((id) => ({ type: 'sketch_curve', id, sketch: 7 }));

test('parallel lines offer distance; intersecting lines offer angle and keep selection order', () => {
  const { state } = fixture();
  const parallel = M.dimensionChoices(state.sketch, picks('l1','l2'));
  assert.equal(parallel.find((c) => c.key === 'distance').enabled, true);
  assert.equal(parallel.find((c) => c.key === 'angle').enabled, false);
  assert.equal(M.measureChoice(state.sketch, parallel[0]), 10);
  const angular = M.dimensionChoices(state.sketch, picks('l3','l1'));
  assert.deepEqual(angular[1].entities, ['l3','l1']);
  assert.equal(angular[1].enabled, true);
  assert.equal(M.measureChoice(state.sketch, angular[1]), 90);
});

test('single line and circle expose correct sizes and unit conversions', () => {
  const { state } = fixture();
  assert.equal(M.measureChoice(state.sketch, M.dimensionChoices(state.sketch, picks('l1'))[0]), 20);
  assert.equal(M.measureChoice(state.sketch, M.dimensionChoices(state.sketch, picks('c1'))[0]), 10);
  assert.equal(M.formatted(25.4, false, 'in'), '1 in');
  assert.equal(M.formatted(1000, false, 'm'), '1 m');
});

test('stale, duplicate, foreign and mixed selections never constrain a subset', () => {
  const { state } = fixture();
  for (const selection of [picks('l1','missing'), picks('l1','l1'), [...picks('l1'), {type:'body',id:'Body1'}], [{type:'sketch_curve',id:'l1',sketch:8}], Array.from({length:129}, (_,i)=>({type:'sketch_curve',id:'l'+i}))]) {
    assert.equal(M.constraintChoices(state.sketch, selection).some((c) => c.enabled), false);
    assert.deepEqual(M.dimensionChoices(state.sketch, selection), []);
  }
});

test('line/circle permits tangent but rejects parallel; point/line permits midpoint', () => {
  const { state } = fixture();
  const cs = M.constraintChoices(state.sketch, picks('l1','c1'));
  assert.equal(cs.find((c)=>c.key==='tangent').enabled, true);
  assert.equal(cs.find((c)=>c.key==='parallel').enabled, false);
  const mid = M.constraintChoices(state.sketch, [...picks('l1'),{type:'sketch_point',id:'p3'}]).find((c)=>c.key==='midpoint');
  assert.deepEqual(mid.params,{point:'p3',line:'l1'});
});

test('opening, typing and outside/cancel do not create geometry, parameters or undo steps', async () => {
  const { state, control } = fixture();
  state.selection = picks('l1');
  await control.refresh();
  const before = clone(state.sketch);
  control.begin(M.dimensionChoices(state.sketch, state.selection)[0]);
  control.key('3'); control.key('0');
  assert.equal(control.editor.value,'30');
  assert.deepEqual(state.writes,[]);
  control.cancel();
  assert.equal(control.editor,null);
  assert.deepEqual(state.sketch,before);
  assert.deepEqual(state.writes,[]);
});

test('confirm forwards one complete expression to the existing dimension command', async () => {
  const { state, control } = fixture(); state.selection = picks('l1','l3');
  await control.refresh();
  control.begin(M.dimensionChoices(state.sketch,state.selection)[1]);
  control.key('4'); control.key('5'); control.key(' deg');
  await control.commit();
  assert.deepEqual(state.writes,[{command:'sketch.dimension',params:{sketch:7,entities:['l1','l3'],type:'angle',value:'45 deg'}}]);
  assert.equal(control.editor,null);
});

test('invalid numeric input remains editable and does not write', async () => {
  const { state, control } = fixture(); await control.refresh();
  control.begin(M.dimensionChoices(state.sketch,picks('l1'))[0]);
  control.key('1/0'); await control.commit();
  assert.match(control.editor.error,/division by zero/);
  assert.deepEqual(state.writes,[]);
  control.key('back'); assert.equal(control.editor.value,'1/');
});

test('document replacement and a changed sketch reject stale confirmation', async () => {
  for (const changed of ['document', 'revision', 'sketch']) {
    const { state, control } = fixture(); await control.refresh();
    control.begin(M.dimensionChoices(state.sketch,picks('l1'))[0]);
    if(changed==='document') state.context.document_id='doc-b';
    if(changed==='revision') state.context.revision++;
    if(changed==='sketch') state.sketch.id=9;
    await control.commit();
    assert.deepEqual(state.writes,[]);
    assert.match(control.editor.error,/geändert/);
  }
});

test('editing changes the bound parameter, unlocking deletes only its dimension constraint', async () => {
  const { state, control } = fixture();
  state.sketch.constraints.push({id:'k1',type:'length',l:0,value:20,param:'d1',expression:'width / 2'});
  await control.refresh(); control.edit('k1');
  assert.equal(control.editor.value,'width / 2');
  control.key('30 mm'); await control.commit();
  assert.deepEqual(state.writes[0],{command:'parameters.change',params:{name:'d1',expression:'30 mm'}});
  await control.refresh(); control.edit('k1'); await control.unlock();
  assert.deepEqual(state.writes[1],{command:'sketch.delete',params:{entities:['k1']}});
});

test('read-only reference dimensions cannot overwrite a derived value', async () => {
  const { state, control } = fixture(); state.sketch.constraints.push({id:'k1',type:'length',l:0,value:20});
  await control.refresh(); assert.throws(()=>control.edit('k1'),/Referenzmaß/);
  assert.deepEqual(state.writes,[]);
});

test('constraint apply refreshes the whole selection; deletion never includes curves', async () => {
  const { state, control } = fixture(); state.selection=picks('l1','l2');
  await control.refresh(); await control.apply('parallel');
  assert.deepEqual(state.writes[0],{command:'sketch.constraint.parallel',params:{a:'l1',b:'l2'}});
  state.sketch.constraints.push({id:'k1',type:'parallel',a:0,b:1});
  state.selection=[{type:'sketch_constraint',id:'k1'},...picks('l1')];
  await control.removeSelected(); assert.equal(state.writes.length,1);
  state.selection=[{type:'sketch_constraint',id:'k1'}];
  await control.removeSelected();
  assert.deepEqual(state.writes[1],{command:'sketch.delete',params:{entities:['k1']}});
});

test('visibility toggles use sketch options and survive a controller refresh', async () => {
  const { state, control } = fixture(); await control.refresh();
  await control.option('show_dimensions'); await control.refresh();
  assert.equal(control.snapshot.options.show_dimensions,false);
  assert.deepEqual(state.writes[0],{command:'sketch.options',params:{sketch:7,show_dimensions:false}});
});

test('constraint anchors are valid for curve and point relations, including a locked line endpoint', () => {
  const { state }=fixture();
  assert.deepEqual(M.anchors(state.sketch,{type:'parallel',a:0,b:1}),[[10,0],[10,10]]);
  assert.equal(M.related(state.sketch,{type:'fix',p:0},picks('l1')),true);
  assert.deepEqual(M.anchors(state.sketch,{type:'parallel',a:100,b:101}),[]);
});

test('double confirmation is serialized and expression input is bounded', async () => {
  const {state,control}=fixture(); await control.refresh();
  control.begin(M.dimensionChoices(state.sketch,picks('l1'))[0]);
  for(let i=0;i<30;i++) control.key('1234567890');
  assert.equal(control.editor.value.length,256);
  await Promise.all([control.commit(),control.commit()]);
  assert.equal(state.writes.length,1);
});

test('disconnect deletes only explicitly selected coincident constraints', async () => {
  const {state,control}=fixture();
  state.sketch.constraints=[{id:'k1',type:'coincident',p:0,q:1},{id:'k2',type:'parallel',a:0,b:1}];
  state.selection=[{type:'sketch_constraint',id:'k2'}];
  await control.disconnect(); assert.deepEqual(state.writes,[]);
  state.selection=[{type:'sketch_constraint',id:'k1'}];
  await control.disconnect();
  assert.deepEqual(state.writes[0],{command:'sketch.delete',params:{entities:['k1']}});
  assert.equal(state.writes[1].command,'select.clear');
});

test('selected model edge displays a read-only measurement in document units', async () => {
  const {state,bridge,control}=fixture(); state.units='in';
  const request=bridge.request, execute=bridge.execute;
  bridge.request=async(method,params)=>method==='ui.at'?[300,400]:request(method,params);
  bridge.execute=async(command,params)=>command==='inspect.measure'?{items:[{type:'edge',length_mm:25.4}]}:execute(command,params);
  await control.refresh({home:false,ui:{tab:'MODEL'}},{selection:[{type:'edge',point:[0,0,0]}]});
  assert.deepEqual(control.model,{value:25.4,screen:[300,400]});
  assert.equal(control.units,'in'); assert.deepEqual(state.writes,[]);
  await control.refresh({home:false,ui:{tab:'MODEL'}},{selection:[]});
  assert.equal(control.model,null);
});

test('temporary API failure retains an uncommitted expression and remains write-free', async () => {
  const {state,bridge,control}=fixture(); await control.refresh();
  control.begin(M.dimensionChoices(state.sketch,picks('l1'))[0]); control.key('width + 2 mm');
  const request=bridge.request; bridge.request=async()=>{throw Error('unavailable');};
  await control.refresh(); assert.equal(control.editor.value,'width + 2 mm');
  assert.deepEqual(state.writes,[]);
  bridge.request=request; await control.refresh(); assert.equal(control.editor.value,'width + 2 mm');
});
test('an over-constraint conflict resolves to the one driving dimension of the same kind',()=>{
 const sketch={constraints:[{id:'k3',type:'parallel'},{id:'k4',type:'horizontal'},{id:'k6',type:'length',param:'d1',value:32}]};
 assert.equal(M.drivingDimension(sketch,'that would over-constrain the sketch (conflicts with k3, k4, k6)','length').id,'k6');
 assert.equal(M.drivingDimension(sketch,'that would over-constrain the sketch (conflicts with k3, k4, k6)','angle'),null);
 assert.equal(M.drivingDimension(sketch,'some other error','length'),null);
});
