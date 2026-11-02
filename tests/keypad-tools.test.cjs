// SPDX-License-Identifier: MIT OR Apache-2.0
const test=require('node:test'),assert=require('node:assert/strict');
const K=require('../keypad-tools.js');
function fixture(){
 const s={context:{document_id:'doc',revision:1},info:{home:false,tool:'sketch.rectangle.two_point'},calls:[],parameters:[]};
 const bridge={async execute(c,p){if(c==='document.revision')return {...s.context};if(c==='expr.evaluate')return p.expression.includes('/0')?{ok:false,error:'division by zero'}:{ok:true,value:30};if(c==='parameters.list')return {parameters:s.parameters};throw Error(c);},async request(m,p){if(m==='ui.inspect')return {...s.info};s.calls.push({m,p});},async focus(){},async settle(){},async confirm(){s.calls.push({confirm:true});},anchor:()=>({x:400,y:300})};
 return {s,bridge,draft:new K.NativeDraft(bridge)};
}
test('native keypad buffers input and cancels without sending text or keys',async()=>{
 const {s,draft}=fixture();await draft.begin(s.info,'tool',{});draft.key('3');draft.key('0');assert.equal(draft.editor.value,'30');draft.cancel();assert.deepEqual(s.calls,[]);
});
test('invalid drawing value stays editable and never reaches native input',async()=>{
 const {s,draft}=fixture();await draft.begin(s.info,'tool',{});draft.key('1/0');await draft.commit();assert.match(draft.editor.error,/division/);assert.deepEqual(s.calls,[]);
});
test('Tab validates and locks one field without placing the rectangle',async()=>{
 const {s,draft}=fixture();await draft.begin(s.info,'tool',{});draft.key('30 mm');await draft.commit(true);
 assert.deepEqual(s.calls.map(c=>c.m),['ui.key','ui.text','ui.key']);assert.equal(s.calls.at(-1).p.key,'Tab');assert.equal(draft.editor.value,'');
 draft.key('16 mm');await draft.commit();assert.equal(s.calls.findLast(c=>c.m==='ui.key').p.key,'Enter');assert.equal(draft.editor,null);
});
test('document revision or tool changes invalidate a buffered native edit',async()=>{
 for(const change of [s=>s.context.revision++,s=>s.context.document_id='other',s=>s.info.tool='sketch.circle.center']){
  const {s,draft}=fixture();await draft.begin(s.info,'tool',{});draft.key('30');change(s);await draft.commit();assert.match(draft.editor.error,/geändert/);assert.deepEqual(s.calls,[]);
 }
});
test('variable definition is staged using readonly APIs and rejects duplicate names',async()=>{
 const {s,bridge}=fixture();const target={context:{...s.context},value:'30 mm',kind:'length'};
 assert.equal(await K.definition(bridge,target,'breite'),'breite = 30 mm');assert.deepEqual(s.calls,[]);
 s.parameters=[{name:'breite'}];await assert.rejects(K.definition(bridge,target,'breite'),/vergeben/);
 await assert.rejects(K.definition(bridge,target,'bad name'),/Name/);
});
test('expression bounds, first replace, backspace and sign are deterministic',()=>{
 const e={value:'20 mm',first:true,error:''};K.typeKey(e,'3');assert.equal(e.value,'3');K.typeKey(e,'neg');assert.equal(e.value,'-3');K.typeKey(e,'back');assert.equal(e.value,'-');K.typeKey(e,'1'.repeat(500));assert.equal(e.value.length,256);
});
test('changing document closes the stale native draft without any native key event',async()=>{
 const {s,draft}=fixture();await draft.begin(s.info,'tool',{});draft.key('30');s.context.document_id='new';await draft.observe();assert.equal(draft.editor,null);assert.deepEqual(s.calls,[]);
});
test('a refusal by the native field keeps the expression and does not confirm the dialog',async()=>{
 const {s,draft,bridge}=fixture(),request=bridge.request;
 bridge.request=async(m,p)=>{if(m==='ui.key'&&p.key==='Enter')s.info.status={error:true,text:'Incompatible units'};return request(m,p);};
 await draft.begin(s.info,'tool',{});draft.editor.index=1;draft.key('30 deg');await draft.commit();assert.equal(draft.editor.value,'30 deg');assert.match(draft.editor.error,/units/);assert.equal(s.calls.some(c=>c.confirm),false);
});
test('duplicate confirmation sends the expression to the native field exactly once',async()=>{
 const {s,draft}=fixture();await draft.begin(s.info,'tool',{});draft.key('30');await Promise.all([draft.commit(),draft.commit()]);assert.equal(s.calls.filter(c=>c.m==='ui.text').length,1);
});
test('rectangle drawing values reject angular units before any native key event',async()=>{
 const {s,draft,bridge}=fixture(),execute=bridge.execute;
 bridge.execute=async(c,p)=>c==='expr.evaluate'&&p.kind==='length'&&p.expression.endsWith('deg')?{ok:false,error:'Expected a length'}:execute(c,p);
 await draft.begin(s.info,'tool',{});draft.key('30 deg');await draft.commit();assert.match(draft.editor.error,/length/);assert.deepEqual(s.calls,[]);
});
test('confirm on the first rectangle field moves to the height field instead of placing a flat rectangle',async()=>{
 const {s,draft}=fixture();await draft.begin(s.info,'tool',{});draft.key('20');await draft.commit();
 assert.equal(s.calls.findLast(c=>c.m==='ui.key').p.key,'Tab');assert.ok(draft.editor);assert.equal(draft.editor.index,1);
 draft.key('16');await draft.commit();assert.equal(s.calls.findLast(c=>c.m==='ui.key').p.key,'Enter');assert.equal(draft.editor,null);
});
test('field names follow the drawing tool',()=>{
 assert.deepEqual(K.FIELDS('sketch.rectangle.center'),['Breite','Höhe']);assert.deepEqual(K.FIELDS('sketch.circle.center'),['Durchmesser']);assert.deepEqual(K.FIELDS('sketch.spline.fit_point'),[]);
});

test('concurrent keypad openings share one read and create only one editor',async()=>{
 const {s,bridge}=fixture();let release,reads=0,changes=0;
 bridge.execute=()=>{reads++;return new Promise(resolve=>{release=resolve;});};
 const draft=new K.NativeDraft(bridge,()=>changes++),first=draft.begin(s.info,'tool',{});
 await Promise.resolve();const second=draft.begin(s.info,'tool',{});assert.equal(first,second);assert.equal(reads,1);
 release({...s.context});await first;assert.equal(changes,1);assert.ok(draft.editor);assert.equal(draft.opening,null);
});

test('a stalled opening times out, releases its lock and ignores a late reply',async()=>{
 const {s,bridge}=fixture();bridge.readTimeoutMs=10;let release;
 bridge.execute=()=>new Promise(resolve=>{release=resolve;});const draft=new K.NativeDraft(bridge);
 await assert.rejects(draft.begin(s.info,'tool',{}),/CAD antwortet/);assert.equal(draft.opening,null);assert.equal(draft.editor,null);
 release({...s.context});await Promise.resolve();assert.equal(draft.editor,null);
 bridge.execute=async()=>({...s.context});await draft.begin(s.info,'tool',{},true);assert.ok(draft.editor);
});

test('cancelling an in-flight open resolves it without resurrecting an editor',async()=>{
 const {s,bridge}=fixture();bridge.readTimeoutMs=10;let release;
 bridge.execute=()=>new Promise(resolve=>{release=resolve;});const draft=new K.NativeDraft(bridge);
 const pending=draft.begin(s.info,'tool',{});await Promise.resolve();draft.cancel();await pending;
 release({...s.context});await Promise.resolve();assert.equal(draft.editor,null);assert.equal(draft.opening,null);assert.deepEqual(s.calls,[]);
});
