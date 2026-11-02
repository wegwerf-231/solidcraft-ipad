// SPDX-License-Identifier: MIT OR Apache-2.0
const test=require('node:test');
const assert=require('node:assert/strict');
const M=require('../touch-shell.js');
function fixture(saved=null){
  const state={info:{home:false,dialog:null,tool:null,ui:{tab:'SKETCH',showBrowser:true}},selection:[],calls:[],saved};
  const storage={getItem:()=>state.saved,setItem:(_,v)=>{state.saved=v;}};
  const bridge={
    async request(method,params){
      if(method==='ui.inspect')return structuredClone(state.info);
      if(method==='ui.selection')return {selection:structuredClone(state.selection)};
      state.calls.push({method,params});
      if(method==='ui.set')Object.assign(state.info.ui,params);
      if(method==='ui.start')state.info.tool=params.command;
      if(method==='ui.key')state.info.tool=null;
    },
    async execute(command,params){state.calls.push({command,params});if(command==='sketch.finish')state.info.ui.tab='MODEL';},
  };
  return {state,storage,bridge,control:new M.Controller(bridge,storage)};
}
test('preferences default safely and cannot inject an arbitrary command',async()=>{
  for(const saved of [null,'broken','null','{"mode":"wrong","variants":{"rect":"file.new"}}']){
    const {control,state}=fixture(saved);assert.equal(control.state.mode,'touch');
    assert.equal(control.state.variants.rect,'sketch.rectangle.two_point');
    await assert.rejects(control.choose('file.new'),/Unbekannt/);assert.deepEqual(state.calls,[]);
  }
});
test('switching layouts restores the original browser and performs no geometry command',async()=>{
  const {control,state,storage}=fixture();await control.refresh();
  assert.equal(control.touch,true);assert.equal(state.info.ui.showBrowser,false);
  await control.toggle();assert.equal(control.touch,false);assert.equal(state.info.ui.showBrowser,true);
  assert.equal(new M.Controller({},storage).state.mode,'advanced');
  await control.toggle();assert.equal(state.info.ui.showBrowser,false);
  assert.equal(state.calls.some(c=>c.command),false);
});
test('home, native dialogs and leaving sketch expose the original UI and restore panels',async()=>{
  for(const change of [s=>s.info.home=true,s=>s.info.dialog='native-dialog',s=>s.info.ui.tab='MODEL']){
    const {control,state}=fixture();await control.refresh();change(state);await control.refresh();
    assert.equal(control.touch,false);assert.equal(state.info.ui.showBrowser,true);
    assert.equal(control.state.mode,'touch');
  }
});
test('variants dispatch one native tool and are remembered per family',async()=>{
  const {control,state,storage}=fixture();await control.choose('sketch.rectangle.center');
  assert.equal(state.info.tool,'sketch.rectangle.center');
  assert.deepEqual(state.calls.filter(c=>c.method==='ui.start'),[{method:'ui.start',params:{command:'sketch.rectangle.center'}}]);
  assert.equal(new M.Controller({},storage).state.variants.rect,'sketch.rectangle.center');
  assert.equal(M.findTool('sketch.arc.tangent').id,'arc');
});
test('a stale tool tap after leaving sketch never starts a tool in another workspace',async()=>{
  const {control,state}=fixture();await control.refresh();state.info.ui.tab='MODEL';
  await control.choose('sketch.line');assert.match(control.error,/Skizze/);
  assert.equal(state.calls.some(c=>c.method==='ui.start'),false);
});
test('delete requires a complete sketch geometry selection; constraints use the right rail',async()=>{
  const {control,state}=fixture();
  for(const selection of [[],[{type:'sketch_constraint',id:'k1'}],[{type:'sketch_curve',id:'l1'},{type:'body',name:'Body1'}]]){
    state.selection=selection;await control.action('delete');assert.equal(state.calls.some(c=>c.command==='selection.delete'),false);
  }
  state.selection=[{type:'sketch_curve',id:'l1'}];await control.action('delete');
  assert.equal(state.calls.filter(c=>c.command==='selection.delete').length,1);
});
test('unknown actions do not execute commands; leaving sketch restores panel state',async()=>{
  const {control,state}=fixture();await control.action('file.new');assert.match(control.error,/Unbekannt/);
  assert.equal(state.calls.some(c=>c.command),false);
  await control.action('finish');assert.equal(control.visible,false);assert.equal(state.info.ui.showBrowser,true);
});
test('chrome bounds reject malformed handles and keep a readable deck in split view',()=>{
  const b=M.chromeBounds([{name:'tab:sketch',y:60},{name:'toolbar:line',y:110},{name:'panel:create',y:140},{name:'toolbar:bad',y:NaN},{name:'other',y:1000}],700);
  assert.ok(b.top>=32);assert.ok(b.bottom>=168&&b.bottom<300);
  assert.ok(b.bottom-b.top>=112);
});

test('an action waits for an in-flight refresh and then rechecks the current workspace',async()=>{
  const {control,state,bridge}=fixture();
  const request=bridge.request;let release;
  const gate=new Promise(resolve=>{release=resolve;});let first=true;
  bridge.request=async(method,params)=>{if(method==='ui.selection'&&first){first=false;await gate;}return request(method,params);};
  const refresh=control.refresh();await new Promise(resolve=>setImmediate(resolve));
  state.info.ui.tab='MODEL';const action=control.choose('sketch.line');release();
  await Promise.all([refresh,action]);
  assert.equal(state.calls.some(c=>c.method==='ui.start'),false);
  assert.match(control.error,/Skizze/);
});
