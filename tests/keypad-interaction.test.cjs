// SPDX-License-Identifier: MIT OR Apache-2.0
const test=require('node:test');
const assert=require('node:assert/strict');
const {FieldIntent,clampPosition,placePad,draggable}=require('../keypad-tools.js');

test('native focus alone never authorizes the keypad; a numeric-field tap authorizes it once',()=>{
  const intent=new FieldIntent();assert.equal(intent.consume(1000),false);
  intent.tap(500,300,[{name:'dialog:Distance',x:500,y:300}],1000);
  assert.equal(intent.consume(1100),true);assert.equal(intent.consume(1200),false);
});
test('non-numeric controls, drag handles, expired taps and cancelled intent do not open the keypad',()=>{
  const intent=new FieldIntent();
  for(const name of ['dialog:Direction','dialog:Operation','dialog:card','dialog:Profiles','gizmo:distance']){
    intent.tap(500,300,[{name,x:500,y:300}],1000);assert.equal(intent.consume(1100),false,name);
  }
  intent.tap(200,200,[{name:'dialog:Distance',x:500,y:300}],1000);assert.equal(intent.consume(1100),false);
  intent.tap(500,300,[{name:'dialog:length:Distance',x:500,y:300}],1000);assert.equal(intent.consume(2300),false);
  intent.tap(500,300,[{name:'dialog:Distance',x:500,y:300}],1000);intent.clear();assert.equal(intent.consume(1100),false);
});
test('SolidCraft 0.30 object dialogs: the tapped field is remembered without consuming the keypad intent',()=>{
  const intent=new FieldIntent();assert.equal(intent.tapped(1000),null);
  const handles=[{name:'dialog:row:Distance',x:446,y:452},{name:'dialog:Distance',x:500,y:452},{name:'dialog:card',x:446,y:471}];
  intent.tap(505,452,handles,1000);
  assert.deepEqual(intent.tapped(1100),{field:'Distance',numeric:true});
  assert.equal(intent.consume(1100),true);
  assert.deepEqual(intent.tapped(1150),{field:'Distance',numeric:true});assert.equal(intent.tapped(2300),null);
  intent.tap(500,300,[{name:'dialog:Name',x:500,y:300}],3000);
  assert.deepEqual(intent.tapped(3100),{field:'Name',numeric:false});assert.equal(intent.consume(3100),false);
  for(const name of ['dialog:card','dialog:ok','dialog:row:Distance','dialog:section:Options','dialog:clear:Profiles']){
    intent.tap(500,300,[{name,x:500,y:300}],4000);assert.equal(intent.tapped(4100),null,name);
  }
});
test('initial placement avoids the extrusion dialog and clamping keeps the grip reachable after resize',()=>{
  const size={width:372,height:500},v={width:1024,height:768};
  const p=placePad({x:550,y:180},size,v,[{x0:700,y0:100,x1:1010,y1:740}]);
  assert.ok(p.x+size.width<=700);assert.ok(p.y>=8&&p.y+size.height<=760);
  assert.deepEqual(clampPosition({x:900,y:700},size,{width:512,height:600}),{x:132,y:92});
  assert.deepEqual(clampPosition({x:-100,y:-100},size,{left:20,top:100,width:300,height:200}),{x:28,y:108});
});

function dom(t,visualViewport){
  const old={};for(const k of ['document','window','innerWidth','innerHeight','addEventListener'])old[k]=global[k];
  t.after(()=>{for(const k in old)if(old[k]===undefined)delete global[k];else global[k]=old[k];});
  const events=new Map();
  class El{
    constructor(){this.style={};this.listeners={};this.classList={contains:()=>true};}
    setAttribute(){} prepend(e){this.grip=e;}
    addEventListener(n,fn){(this.listeners[n]||=[]).push(fn);}
    setPointerCapture(id){this.capture=id;}releasePointerCapture(){this.capture=null;}
    getBoundingClientRect(){return {left:parseFloat(this.style.left)||100,top:parseFloat(this.style.top)||100,width:300,height:400};}
    fire(n,extra={}){const e={button:0,pointerId:7,clientX:120,clientY:120,preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;},...extra};for(const fn of this.listeners[n]||[])fn(e);return e;}
  }
  global.document={head:{append(){}},createElement:()=>new El()};global.window={visualViewport};global.innerWidth=1000;global.innerHeight=800;
  global.addEventListener=(n,fn)=>events.set(n,fn);
  const pad=new El(),drag=draggable(pad);return {pad,drag,grip:pad.grip,events};
}
test('dragging the top grip moves only the pad, captures the pointer and remembers the user position',t=>{
  const {pad,drag,grip}=dom(t);
  const down=grip.fire('pointerdown');assert.equal(down.stopped,true);assert.equal(grip.capture,7);
  grip.fire('pointermove',{clientX:420,clientY:220});
  assert.equal(pad.style.left,'400px');assert.equal(pad.style.top,'200px');
  grip.fire('pointerup',{clientX:420,clientY:220});assert.equal(grip.capture,null);
  pad.style.left='1px';assert.equal(drag.restore(),true);assert.equal(pad.style.left,'400px');
});
test('pointer cancellation restores the prior position and unrelated pointers cannot move the pad',t=>{
  const {pad,drag,grip}=dom(t);grip.fire('pointerdown');grip.fire('pointermove',{pointerId:9,clientX:800});assert.equal(pad.style.left,undefined);
  grip.fire('pointermove',{clientX:420});grip.fire('pointercancel');assert.equal(pad.style.left,'100px');assert.equal(drag.restore(),false);
});
test('resize and keyboard movement keep a manually placed keypad on screen',t=>{
  const {pad,grip,events}=dom(t);grip.fire('pointerdown');grip.fire('pointermove',{clientX:900,clientY:700});grip.fire('pointerup');
  global.innerWidth=512;global.innerHeight=600;events.get('resize')();assert.equal(pad.style.left,'204px');assert.equal(pad.style.top,'192px');
  const key=grip.fire('keydown',{key:'ArrowLeft',shiftKey:true});assert.equal(key.stopped,true);assert.equal(pad.style.left,'154px');
});


test('repeated iOS viewport events do not refit unchanged layout or subscribe to focus scrolling',t=>{
 const listeners=new Map(),v={width:1000,height:800,offsetLeft:0,offsetTop:0,addEventListener:(n,fn)=>listeners.set(n,fn)};
 const {pad,drag}=dom(t,v);let reads=0,writes=0;
 const rect=pad.getBoundingClientRect.bind(pad);pad.getBoundingClientRect=()=>{reads++;return rect();};
 pad.style=new Proxy(pad.style,{set:(o,k,value)=>{writes++;o[k]=value;return true;}});
 drag.restore();const oldReads=reads,oldWrites=writes;
 for(let i=0;i<100;i++)listeners.get('resize')();
 assert.equal(reads,oldReads);assert.equal(writes,oldWrites);assert.equal(listeners.has('scroll'),false);
 v.height=600;listeners.get('resize')();const resizedReads=reads,resizedWrites=writes;
 for(let i=0;i<100;i++)listeners.get('resize')();assert.equal(reads,resizedReads);assert.equal(writes,resizedWrites);
});
