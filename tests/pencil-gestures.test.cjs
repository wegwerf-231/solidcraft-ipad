// SPDX-License-Identifier: MIT OR Apache-2.0
const test=require('node:test'),assert=require('node:assert/strict');
const G=require('../pencil-gestures.js');
test('pressure hysteresis creates one point per push, not one per event',()=>{
 const s=new G.Stroke({x:0,y:0},0);
 for(const [x,force] of [[10,.2],[20,.7],[25,.8],[30,.7],[35,.2],[45,.7]])s.move({x,y:0,pressure:force},x*5);
 assert.deepEqual(s.finish({x:60,y:0}),[{x:0,y:0},{x:20,y:0},{x:45,y:0},{x:60,y:0}]);
});
test('dwell provides an explicit fallback point without pressure data',()=>{
 const s=new G.Stroke({x:0,y:0},0);s.move({x:20,y:0},100);s.move({x:20,y:0},500);assert.equal(s.controls.length,2);
});
test('a compact repeated wiggle toggles arc/line while a normal drag does not',()=>{
 const s=new G.Stroke({x:0,y:0},0);let result;
 for(let i=0;i<20;i++)assert.equal(s.move({x:i*10,y:i*2},i*60),null);
 for(let i=0;i<12;i++)result=s.move({x:200+(i%2?7:-7),y:40},1500+i*70)||result;
 assert.equal(result,'arc');assert.equal(s.forced,'arc');
 let second;for(let i=0;i<12;i++)second=s.move({x:200+(i%2?7:-7),y:40},3000+i*70)||second;
 assert.equal(second,'line');
});
test('tangent arc through-point has equal radius from the tangent circle centre',()=>{
 const q=G.tangentThrough([0,0],[20,20],[1,0],[15,5]);
 assert.ok(q);assert.ok(Math.abs(Math.hypot(q[0],q[1]-20)-20)<1e-8);
 assert.equal(G.tangentThrough([0,0],[20,0],[1,0],[10,0]),null);
});
test('native hover parsing requires a complete curve record and preserves quoted IDs',()=>{
 assert.deepEqual(G.hoverCurve('SketchCurve { sketch: 7, id: "s1", straight: false, point: Vec3 }'),{sketch:7,id:'s1'});
 assert.equal(G.hoverCurve('SketchPoint { sketch: 7, id: "p1" }'),null);
});
test('SolidCraft 0.30 hover objects resolve curves only',()=>{
 assert.deepEqual(G.hoverCurve({type:'sketch_curve',sketch:1,id:'l1',straight:true,point:[30,0,0]}),{sketch:1,id:'l1'});
 assert.equal(G.hoverCurve({type:'sketch_midpoint',sketch:1,id:'l1',at:[20,0]}),null);
 assert.equal(G.hoverCurve({type:'face',body:'Body1',index:0,point:[0,0,0]}),null);
 assert.equal(G.hoverCurve({type:'sketch_curve',sketch:'1',id:'l1'}),null);
 assert.equal(G.hoverCurve(null),null);
});
test('wiggling after an already curved stroke switches back to a line',()=>{
 const s=new G.Stroke({x:0,y:0},0);for(const [i,p]of [[10,-20],[20,-25],[30,-20],[40,0]].entries())s.move({x:p[0],y:p[1]},i*100);
 let result;for(let i=0;i<12;i++)result=s.move({x:40+(i%2?8:-8),y:0},1200+i*70)||result;assert.equal(result,'line');
});
test('spline control count and raw stroke length are bounded',()=>{
 const s=new G.Stroke({x:0,y:0},0);for(let i=1;i<128;i++)s.addControl({x:i*10,y:0});assert.throws(()=>s.addControl({x:2000,y:0}),/128/);
 const line=new G.Stroke({x:0,y:0},0);for(let i=1;i<4096;i++)line.move({x:i,y:0},i);assert.throws(()=>line.move({x:5000,y:0},5000),/lang/);
});
