// SPDX-License-Identifier: MIT OR Apache-2.0
// Draft numeric input and parameter picker over SolidCraft's expression evaluator.
(function(g,f){const m=f();if(typeof module==='object'&&module.exports)module.exports=m;else g.SolidCraftKeypad=m;})(globalThis,function(){
  'use strict';
  const same=(a,b)=>a&&b&&a.document_id===b.document_id&&a.revision===b.revision;
  function typeKey(e,k){
    if(k==='back')e.value=e.first?'':Array.from(e.value).slice(0,-1).join('');
    else if(k==='neg')e.value=e.value.startsWith('-')?e.value.slice(1):'-'+e.value;
    else e.value=(e.first?'':e.value)+k;
    e.first=false;e.value=e.value.slice(0,256);e.error='';
  }
  async function validate(bridge,text,kind){
    const r=await bridge.execute('expr.evaluate',{expression:text,...(kind?{kind}:{})});
    if(!r.ok)throw Error(r.error||'Ungültiger Ausdruck.');return r;
  }
  function readWithTimeout(promise,ms=2000){
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(Error('CAD antwortet beim Öffnen des Zahlenfelds nicht. Bitte erneut antippen.')),ms);
      Promise.resolve(promise).then(value=>{clearTimeout(timer);resolve(value);},error=>{clearTimeout(timer);reject(error);});
    });
  }
  // Native dialogs focus their first number automatically; only a short tap on
  // a numeric control may open the overlay. Consumed intent cannot reopen it.
  class FieldIntent {
    constructor(){this.pending=null;}
    clear(){this.pending=null;}
    tap(x,y,handles,now=Date.now()){
      this.clear();
      const numeric=/^dialog:(?:length:|angle:|scalar:|vector:|(?:control:)?(?:Distance(?: [12XY])?|Length|Width|Height|Depth|Diameter|Radius|Angle|Draft Angle|Offset|Thickness|Scale|Count|Abstand|Länge|Breite|Höhe|Radius|Winkel)$)/i;
      const hits=(handles||[]).filter(h=>numeric.test(h.name)&&Number.isFinite(h.x)&&Number.isFinite(h.y));
      if(hits.some(h=>Math.abs(x-h.x)<=80&&Math.abs(y-h.y)<=18))this.pending={at:now};
    }
    consume(now=Date.now()){
      const p=this.pending;this.clear();return !!p&&now-p.at>=0&&now-p.at<1200;
    }
  }
  function clampPosition(p,size,v){
    const left=v.left||0,top=v.top||0;
    return {x:Math.max(left+8,Math.min(left+v.width-size.width-8,p.x)),y:Math.max(top+8,Math.min(top+v.height-size.height-8,p.y))};
  }
  function placePad(preferred,size,v,obstacles=[]){
    const candidates=[preferred];
    for(const r of obstacles)candidates.push({x:r.x0-size.width-12,y:preferred.y},{x:r.x1+12,y:preferred.y},{x:preferred.x,y:r.y0-size.height-12},{x:preferred.x,y:r.y1+12});
    const overlap=p=>obstacles.reduce((n,r)=>n+Math.max(0,Math.min(p.x+size.width,r.x1)-Math.max(p.x,r.x0))*Math.max(0,Math.min(p.y+size.height,r.y1)-Math.max(p.y,r.y0)),0);
    return candidates.map(p=>clampPosition(p,size,v)).sort((a,b)=>overlap(a)-overlap(b)||Math.hypot(a.x-preferred.x,a.y-preferred.y)-Math.hypot(b.x-preferred.x,b.y-preferred.y))[0];
  }
  function draggable(pad){
    const grip=document.createElement('div');grip.className='sc-pad-grip';grip.textContent='⠿  Ziffernfeld verschieben';grip.tabIndex=0;
    grip.setAttribute('role','button');grip.setAttribute('aria-label','Ziffernfeld verschieben');
    const style=document.createElement('style');style.textContent='#sc-ipad-ui .sc-pad-grip{grid-column:1/-1;position:sticky;top:-1px;z-index:2;min-height:44px;display:flex;align-items:center;justify-content:center;box-sizing:border-box;background:#303b4b;color:#d9e7fa;border:1px solid #71839c;border-radius:9px;font:500 14px system-ui;cursor:grab;touch-action:none;user-select:none;-webkit-user-select:none}#sc-ipad-ui .sc-pad-grip:active{cursor:grabbing}';
    document.head.append(style);pad.prepend(grip);
    let drag=null,position=null;
    const viewport=()=>{const v=window.visualViewport;return {left:v?.offsetLeft||0,top:v?.offsetTop||0,width:v?.width||innerWidth,height:v?.height||innerHeight};};
    const size=()=>{const r=pad.getBoundingClientRect();return {width:r.width,height:r.height};};
    function put(p){position=clampPosition(p,size(),viewport());for(const [key,value] of Object.entries({left:position.x+'px',top:position.y+'px',bottom:'auto'}))if(pad.style[key]!==value)pad.style[key]=value;}
    const block=e=>{e.preventDefault();e.stopImmediatePropagation();};
    grip.addEventListener('pointerdown',e=>{if(drag||e.button>0)return;block(e);const r=pad.getBoundingClientRect();drag={id:e.pointerId,x:e.clientX,y:e.clientY,start:{x:r.left,y:r.top},saved:position};try{grip.setPointerCapture(e.pointerId);}catch(_){};});
    grip.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;block(e);put({x:drag.start.x+e.clientX-drag.x,y:drag.start.y+e.clientY-drag.y});});
    function finish(e,cancel=false){if(!drag||drag.id!==e.pointerId)return;block(e);const old=drag;drag=null;if(cancel){put(old.start);position=old.saved;}try{grip.releasePointerCapture(e.pointerId);}catch(_){};}
    grip.addEventListener('pointerup',e=>finish(e));grip.addEventListener('pointercancel',e=>finish(e,true));
    grip.addEventListener('lostpointercapture',e=>{if(drag&&drag.id===e.pointerId){const old=drag;drag=null;put(old.start);position=old.saved;}});
    grip.addEventListener('keydown',e=>{const d={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(!d)return;block(e);const r=pad.getBoundingClientRect(),step=e.shiftKey?50:10;put({x:r.left+d[0]*step,y:r.top+d[1]*step});});
    for(const event of ['touchstart','touchmove','touchend','click'])grip.addEventListener(event,block,{passive:false});
    let fittedViewport='';
    function fit(force=false){
      if(!pad.classList.contains('on'))return;
      const v=viewport(),key=JSON.stringify(v);if(!force&&key===fittedViewport)return;fittedViewport=key;
      const height=Math.max(44,v.height-16)+'px';if(pad.style.maxHeight!==height)pad.style.maxHeight=height;
      const saved=position,r=pad.getBoundingClientRect();put(position||{x:r.left,y:r.top});if(!saved)position=null;
    }
    // iOS focus can emit repeated viewport events. Never write layout on scroll
    // or refit an unchanged viewport; this avoids a focus/scroll/layout feedback loop.
    const resized=()=>fit(false);addEventListener('resize',resized);window.visualViewport?.addEventListener('resize',resized);
    return {grip,viewport,restore(){fit(true);if(!position)return false;put(position);return true;}};
  }
  // Wertfelder der Zeichenwerkzeuge in der Reihenfolge, in der SolidCraft sie mit Tab durchläuft.
  function FIELDS(tool){
    tool=tool||'';
    if(/^sketch\.rectangle\./.test(tool))return ['Breite','Höhe'];
    if(/^sketch\.(line|construction_line)$/.test(tool))return ['Länge','Winkel'];
    if(/^sketch\.circle\./.test(tool))return ['Durchmesser'];
    if(/^sketch\.polygon\./.test(tool))return ['Durchmesser','Winkel'];
    if(/^sketch\.slot\./.test(tool))return ['Länge','Breite'];
    if(/^sketch\.ellipse/.test(tool))return ['Große Achse','Kleine Achse'];
    return [];
  }
  class NativeDraft {
    constructor(bridge,changed=()=>{}){this.bridge=bridge;this.changed=changed;this.editor=null;this.busy=false;this.suppressUntil=0;this.opening=null;}
    begin(info,key,anchor,manual=false){
      if(this.editor||this.busy||(!manual&&Date.now()<this.suppressUntil))return Promise.resolve();
      if(this.opening)return this.opening.promise;
      const aborted=Symbol('cancelled');let cancel;
      const cancelled=new Promise(resolve=>{cancel=()=>resolve(aborted);});
      const operation={cancel,promise:null};this.opening=operation;
      operation.promise=Promise.resolve().then(async()=>{
        if(this.opening!==operation)return;
        const context=await Promise.race([readWithTimeout(this.bridge.execute('document.revision'),this.bridge.readTimeoutMs||2000),cancelled]);
        if(context===aborted||this.opening!==operation)return;
        this.editor={context,tool:info.tool,field:key,kind:/^sketch\.(rectangle\.|circle\.|ellipse$)/.test(info.tool||'')?'length':undefined,anchor,value:'',first:true,error:'',keyboard:false};this.changed();
      }).finally(()=>{if(this.opening===operation)this.opening=null;});
      return operation.promise;
    }
    abortOpen(){if(this.opening){const operation=this.opening;this.opening=null;operation.cancel();}}
    async guard(e){
      const [context,info]=await readWithTimeout(Promise.all([this.bridge.execute('document.revision'),this.bridge.request('ui.inspect')]),this.bridge.readTimeoutMs||2000);
      if(!same(context,e.context)||info.tool!==e.tool||info.home)throw Error('Das Zeichenfeld wurde geändert. Bitte erneut antippen.');
      return info;
    }
    async observe(){
      if(!this.editor||this.busy||this.observing)return;this.observing=true;const e=this.editor;
      try{await this.guard(e);}catch(_){if(this.editor===e)this.cancel();}finally{this.observing=false;}
    }
    cancel(){this.abortOpen();this.editor=null;this.suppressUntil=Date.now()+450;this.changed();}
    key(k){const e=this.editor;if(!e||this.busy)return;if(k==='esc')return this.cancel();if(k==='ok'||k==='tab')return this.commit(k==='tab');if(k==='abc'){e.keyboard=!e.keyboard;this.changed();return;}typeKey(e,k);this.changed();}
    async commit(next=false){
      const e=this.editor;if(!e||this.busy)return;
      const fields=FIELDS(e.tool);
      if(!next&&fields.length>1&&(e.index||0)<fields.length-1&&!e.first)next=true;
      this.busy=true;
      try{
        const initial=await this.guard(e);
        if(!e.first){if(!e.value.trim())throw Error('Bitte einen Wert eingeben.');await validate(this.bridge,e.value,e.kind);}
        await this.guard(e);
        await this.bridge.focus();
        if(!e.first){await this.bridge.request('ui.key',{key:'A',cmd:true});await this.bridge.request('ui.text',{text:e.value});}
        await this.bridge.settle();
        await this.bridge.request('ui.key',{key:next?'Tab':'Enter'});await this.bridge.settle();
        const info=await this.bridge.request('ui.inspect');
        if(info.status&&info.status.error&&(!next||!initial.status?.error||info.status.text!==initial.status.text))throw Error(info.status.text);
        if(next){e.value='';e.first=true;e.error='';e.index=(e.index||0)+1;e.anchor=this.bridge.anchor();}
        else{this.editor=null;this.suppressUntil=Date.now()+450;await this.bridge.confirm();}
      }catch(error){if(this.editor===e)e.error=String(error.message||error);}
      finally{this.busy=false;this.changed();}
    }
  }
  async function definition(bridge,target,name){
    name=name.trim();if(!/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(name))throw Error('Name: Buchstaben, Ziffern und _, beginnend mit Buchstabe oder _.');
    if(!target.value.trim())throw Error('Zuerst den Wert eingeben.');
    const before=await bridge.execute('document.revision');if(!same(before,target.context))throw Error('Dokument wurde geändert. Bitte erneut öffnen.');
    const rows=await bridge.execute('parameters.list');if(rows.parameters.some(p=>p.name===name))throw Error('Dieser Name ist bereits vergeben.');
    const expression=name+' = '+target.value;
    if(expression.length>256)throw Error('Ausdruck zu lang.');
    await validate(bridge,expression,target.kind);
    const after=await bridge.execute('document.revision');if(!same(before,after))throw Error('Dokument wurde geändert.');
    return expression;
  }
  function mount(options){
    const {host,pad}=options;const native=new NativeDraft(options,render);
    const style=document.createElement('style');style.textContent=`
#sc-ipad-ui .kp-native{grid-column:1/-1;font:15px system-ui;color:#e8ebf0}
#sc-ipad-ui .kp-native .kp-hint{font:12px system-ui;color:#8e9db0}
#sc-ipad-ui .kp-native input{box-sizing:border-box;width:100%;height:40px;border:1px solid #8ba4c6;border-radius:8px;background:#161c25;color:white;font:22px system-ui;padding:6px}
#sc-ipad-ui .kp-native p{margin:4px 0;overflow-wrap:anywhere}
#sc-ipad-ui .kp-error{color:#ffb7aa;font:14px system-ui}
#sc-ipad-ui .kp-variables{grid-column:1/-1;padding:8px;background:#161c25;border:1px solid #8ba4c6;border-radius:10px;max-height:280px;max-height:min(280px,calc(100vh - 120px));max-height:min(280px,calc(100dvh - 120px));overflow-y:auto;overscroll-behavior:contain;touch-action:pan-y;font:15px system-ui}
#sc-ipad-ui .kp-variables button{width:100%;min-height:44px;height:auto;font:15px system-ui;padding:8px;box-sizing:border-box;margin:3px 0}
#sc-ipad-ui .kp-variables input{width:100%;height:44px;box-sizing:border-box;padding:6px;font:17px system-ui;user-select:text;-webkit-user-select:text}
#sc-ipad-ui .kp-variables h2{font:600 16px system-ui;margin:3px 0 8px}
`;
    document.head.append(style);
    const header=document.createElement('div');header.className='kp-native';header.hidden=true;
    const label=document.createElement('p');label.textContent='Wert am Zeichenfeld';label.className='kp-label';
    const input=document.createElement('input');input.readOnly=true;input.inputMode='none';input.maxLength=256;input.placeholder='Aktueller Wert steht am Element';input.setAttribute('aria-label','Wert für Zeichenfeld');
    const error=document.createElement('p');error.className='kp-error';error.setAttribute('role','alert');
    const hint=document.createElement('p');hint.className='kp-hint';hint.textContent='✓ übernimmt den Wert; beim letzten Feld wird die Form gesetzt. Esc verwirft.';
    header.append(label,input,error,hint);pad.prepend(header);
    const vars=document.createElement('section');vars.className='kp-variables';vars.hidden=true;vars.setAttribute('aria-label','Variablen');pad.append(vars);
    let current=null,shown=false,variableError='';
    function render(){
      const e=native.editor;header.hidden=!e;
      if(e){const fields=FIELDS(e.tool);label.textContent=fields.length?fields[Math.min(e.index||0,fields.length-1)]+(fields.length>1?' ('+(Math.min(e.index||0,fields.length-1)+1)+'/'+fields.length+')':''):'Wert am Zeichenfeld';input.value=e.value;input.readOnly=!e.keyboard;input.inputMode=e.keyboard?'text':'none';error.textContent=e.error?'Nicht übernommen: '+e.error:'';options.showPad(true);if(e.keyboard&&document.activeElement!==input){input.focus({preventScroll:true});input.select();}}
      else if(shown){if(!options.direct())options.showPad(false);vars.hidden=true;}
      shown=!!e;options.changed();
    }
    input.addEventListener('input',()=>{if(native.editor){native.editor.value=input.value.slice(0,256);native.editor.first=false;native.editor.error='';}});
    input.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Enter'||e.key==='Tab'){e.preventDefault();native.commit(e.key==='Tab');}if(e.key==='Escape'){e.preventDefault();native.cancel();}});
    function target(){
      const direct=options.direct();
      if(direct)return direct;
      const e=native.editor;if(!e)return null;
      return {ref:e,context:e.context,kind:e.kind,get value(){return e.value;},get first(){return e.first;},set(value){if(native.editor!==e)return;e.value=value.slice(0,256);e.first=false;e.error='';render();}};
    }
    function button(text,fn){const b=document.createElement('button');b.type='button';b.textContent=text;b.addEventListener('pointerup',e=>{e.preventDefault();e.stopPropagation();Promise.resolve(fn()).catch(showVariableError);});b.addEventListener('click',e=>{if(e.detail===0){e.preventDefault();e.stopPropagation();Promise.resolve(fn()).catch(showVariableError);}});return b;}
    function showVariableError(e){variableError=String(e.message||e);const out=vars.querySelector('.kp-error');if(out)out.textContent=variableError;pad.scrollTop=pad.scrollHeight;}
    async function variables(){
      current=target();if(!current)return;vars.hidden=false;vars.replaceChildren();variableError='';
      const title=document.createElement('h2');title.textContent='Variable einfügen oder benennen';vars.append(title);
      const rows=await options.execute('parameters.list');
      if(!target()||target().ref!==current.ref){vars.hidden=true;return;}
      for(const row of rows.parameters.filter(p=>!p.error&&p.unit!=='text'&&p.name!==current.parameter).slice(0,200))vars.append(button(row.name+' · '+(row.expression||row.value),()=>{
        const t=target();if(!t||t.ref!==current.ref)throw Error('Eingabe wurde geändert.');
        t.set((t.first?'':t.value)+row.name);vars.hidden=true;
      }));
      const name=document.createElement('input');name.maxLength=64;name.placeholder='Name, z. B. breite';name.setAttribute('aria-label','Variablenname');name.autocomplete='off';vars.append(name);
      const note=document.createElement('p');note.textContent='Wird erst mit ✓ angelegt. Bei einem bestehenden Maß wird dessen Parameter benannt.';vars.append(note);
      vars.append(button('Wert als Variable vormerken',async()=>{const t=target();if(!t||t.ref!==current.ref)throw Error('Eingabe wurde geändert.');const value=await definition(options,t,name.value);if(target()?.ref!==t.ref)throw Error('Eingabe wurde geändert.');t.set(value);vars.hidden=true;}));
      const out=document.createElement('p');out.className='kp-error';out.setAttribute('role','alert');vars.append(out,button('Variablen schließen',()=>{vars.hidden=true;}));requestAnimationFrame(()=>{pad.scrollTop=pad.scrollHeight;});
    }
    let variablePress=null;
    vars.addEventListener('pointerdown',e=>{variablePress={x:e.clientX,y:e.clientY,moved:false};},{capture:true});
    vars.addEventListener('pointermove',e=>{if(variablePress&&Math.hypot(e.clientX-variablePress.x,e.clientY-variablePress.y)>8)variablePress.moved=true;},{capture:true});
    vars.addEventListener('pointerup',e=>{if(variablePress&&variablePress.moved){e.preventDefault();e.stopImmediatePropagation();}variablePress=null;},{capture:true});
    vars.addEventListener('pointerdown',e=>{e.stopPropagation();if(e.target.tagName!=='INPUT'&&e.pointerType!=='touch')e.preventDefault();});
    for(const type of ['touchstart','touchmove','touchend'])vars.addEventListener(type,e=>e.stopPropagation(),{passive:true});
    return {native,variables,get active(){return !!native.editor;},get editing(){return !!native.editor;},render,cancel:()=>{vars.hidden=true;native.cancel();}};
  }
  return {readWithTimeout,FieldIntent,clampPosition,placePad,draggable,NativeDraft,FIELDS,typeKey,validate,definition,mount,same};
});
