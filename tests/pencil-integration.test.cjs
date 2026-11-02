// SPDX-License-Identifier: MIT OR Apache-2.0
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
function fixture() {
  const state={context:{document_id:'a',revision:1},writes:[],drift:false};
  const api={
    async request(method) {
      if(method==='ui.inspect')return {ui:{tab:'SKETCH'}};
      if(method==='ui.sketchToScreen')return [[0,0],[1,0],[0,1]];
      throw Error(method);
    },
    async execute(command,params) {
      if(command==='document.revision')return {...state.context};
      if(command==='sketch.inspect') {if(state.drift)state.context.revision++;return {points:[],curves:[]};}
      state.writes.push({command,params}); return {curves:['l1']};
    },
  };
  const context={window:{solidcraft:api},location:{search:''},URLSearchParams,performance,setInterval:()=>1,setTimeout:()=>1,clearInterval(){},console};
  vm.createContext(context);
  // Observe the actual implementation in an isolated VM; production exports stay unchanged.
  const source=fs.readFileSync(require.resolve('../pencil-sketch.js'),'utf8');
  vm.runInContext(source.replace(/\}\)\(\);\s*$/, 'globalThis.testHooks={commit,deviation};})();'),context);
  return {state,hooks:context.testHooks};
}
test('automatic sketch commit rejects a replaced document before any write',async()=>{
  const {state,hooks}=fixture();
  await assert.rejects(hooks.commit([{x:0,y:0},{x:40,y:0}],{document_id:'old',revision:1}),/geändert/);
  assert.deepEqual(state.writes,[]);
});
test('automatic sketch commit rejects a revision changed during projection',async()=>{
  const {state,hooks}=fixture();state.drift=true;
  await assert.rejects(hooks.commit([{x:0,y:0},{x:40,y:0}],{...state.context}),/geändert/);
  assert.deepEqual(state.writes,[]);
});
test('reviewed automatic drawing keeps straight-line and three-point arc dispatch',async()=>{
  for(const [points,command] of [[[{x:0,y:0},{x:20,y:0},{x:40,y:0}],'sketch.line'],[[{x:0,y:0},{x:20,y:15},{x:40,y:0}],'sketch.arc.three_point']]) {
    const {state,hooks}=fixture();await hooks.commit(points,{...state.context});
    assert.equal(state.writes.length,1);assert.equal(state.writes[0].command,command);
    if(command==='sketch.line')assert.equal(JSON.stringify(state.writes[0].params.points),'[[0,0],[40,0]]');
    else assert.equal(JSON.stringify(state.writes[0].params.through),'[20,15]');
  }
});
