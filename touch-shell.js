// SPDX-License-Identifier: MIT OR Apache-2.0
// Original iPad sketch shell over the unmodified SolidCraft canvas; see FORK-NOTICE.md.
(function (global, factory) {
  const module = factory();
  if (typeof exports === 'object') Object.assign(exports, module);
  else global.SolidCraftTouchShell = module;
})(globalThis, function () {
  'use strict';
  const FAMILY = [
    ['line', 'Linie', [['sketch.line', 'Linie'], ['sketch.line.midpoint', 'Mittelpunktlinie']]],
    ['arc', 'Bogen', [['sketch.arc.three_point', '3 Punkte'], ['sketch.arc.center_point', 'Mittelpunkt'], ['sketch.arc.tangent', 'Tangential']]],
    ['rect', 'Rechteck', [['sketch.rectangle.two_point', '2 Punkte'], ['sketch.rectangle.center', 'Mitte'], ['sketch.rectangle.three_point', '3 Punkte'], ['sketch.rectangle.rounded', 'Abgerundet']]],
    ['circle', 'Kreis', [['sketch.circle.center', 'Mitte'], ['sketch.circle.two_point', '2 Punkte'], ['sketch.circle.three_point', '3 Punkte'], ['sketch.circle.two_tangent', '2 Tangenten'], ['sketch.circle.three_tangent', '3 Tangenten']]],
    ['ellipse', 'Ellipse', [['sketch.ellipse', 'Ellipse']]],
    ['polygon', 'Polygon', [['sketch.polygon.inscribed', 'Einbeschrieben'], ['sketch.polygon.circumscribed', 'Umschrieben'], ['sketch.polygon.edge', 'Kante']]],
    ['slot', 'Langloch', [['sketch.slot.center_to_center', 'Mitte zu Mitte'], ['sketch.slot.overall', 'Gesamtlänge'], ['sketch.slot.center_point', 'Mittelpunkt'], ['sketch.slot.arc_three_point', 'Bogen · 3 Punkte'], ['sketch.slot.arc_center', 'Bogen · Mittelpunkt']]],
    ['spline', 'Spline', [['sketch.spline.fit_point', 'Durch Punkte'], ['sketch.spline.control_point', 'Kontrollpunkte · Grad 3'], ['sketch.spline.control_point_5', 'Kontrollpunkte · Grad 5']]],
    ['construct', 'Hilfslinie', [['sketch.construction_line', '2 Punkte'], ['sketch.construction_line.horizontal', 'Horizontal'], ['sketch.construction_line.vertical', 'Vertikal'], ['sketch.construction_line.angle', 'Winkel'], ['sketch.construction_line.parallel', 'Parallel'], ['sketch.construction_line.perpendicular', 'Senkrecht'], ['sketch.construction_line.tangent_external', 'Tangential von außen'], ['sketch.construction_line.tangent_at', 'Tangential am Punkt'], ['sketch.construction_line.tangent_two', 'Zwei Tangenten'], ['sketch.construction_line.bisector', 'Winkelhalbierende']]],
    ['trim', 'Beschneiden', [['sketch.trim', 'Beschneiden']]],
    ['offset', 'Versatz', [['sketch.offset', 'Versatz']]],
  ];
  const TOOLS = FAMILY.map(([id,label,variants]) => ({id,label,variants:variants.map(([command,label])=>({command,label}))}));
  const findTool = (command) => TOOLS.find(g=>g.variants.some(v=>v.command===command));
  const KEY = 'solidcraft-ipad.sketch-shell-v1';
  function read(storage) {
    let value; try { value=JSON.parse(storage.getItem(KEY)); } catch (_) {}
    const state={mode:value && value.mode==='advanced'?'advanced':'touch',variants:{}};
    for(const group of TOOLS) state.variants[group.id]=group.variants.some(v=>v.command===(value && value.variants && value.variants[group.id]))?value.variants[group.id]:group.variants[0].command;
    return state;
  }
  function scope(info) { return !!(info && !info.home && info.ui && info.ui.tab==='SKETCH'); }
  function chromeBounds(handles, height) {
    const hs=(handles||[]).filter(h=>/^(tab|toolbar|panel|ribbon):/.test(h.name) && Number.isFinite(h.y));
    const top=hs.length?Math.max(32, Math.min(...hs.map(h=>h.y))-24):38;
    const bottom=hs.length?Math.max(...hs.map(h=>h.y))+28:172;
    return {top, bottom:Math.min(Math.max(top+112,bottom), Math.max(top+112,height-150))};
  }
  class Controller {
    constructor(bridge, storage, changed=()=>{}) {
      this.bridge=bridge;this.storage=storage;this.changed=changed;this.state=read(storage);
      this.info=null;this.selection=[];this.owned=null;this.busy=false;this.refreshing=null;this.error='';
    }
    get visible(){return scope(this.info);}
    get touch(){return this.visible && this.state.mode==='touch' && !this.info.dialog;}
    save(){try{this.storage.setItem(KEY,JSON.stringify(this.state));}catch(_) {}}
    async refresh(info,sel){
      if(this.refreshing){await this.refreshing;return this.refresh(info,sel);}
      let done;this.refreshing=new Promise(resolve=>{done=resolve;});
      try {
        this.info=info||await this.bridge.request('ui.inspect');
        this.selection=(sel||await this.bridge.request('ui.selection')).selection||[];
        if(this.touch && !this.owned){
          this.owned={showBrowser:!!this.info.ui.showBrowser};
          if(this.owned.showBrowser) await this.bridge.request('ui.set',{showBrowser:false});
        } else if(!this.touch && this.owned){
          const old=this.owned;
          if(!!this.info.ui.showBrowser!==old.showBrowser) await this.bridge.request('ui.set',old);
          this.owned=null;
        }
      } catch(e){this.info=null;this.error=String(e.message||e);}
      finally{this.refreshing=null;done();this.changed();}
    }
    async toggle(){
      if(this.busy)return;this.state.mode=this.state.mode==='touch'?'advanced':'touch';this.save();await this.refresh();
    }
    async choose(command){
      if(this.busy)return;
      const group=findTool(command);if(!group)throw Error('Unbekanntes Werkzeug.');
      this.busy=true;this.error='';
      try{
        await this.refresh();if(!this.touch)throw Error('Zuerst eine Skizze im iPad-Modus öffnen.');
        await this.bridge.request('ui.start',{command});
        this.state.variants[group.id]=command;this.save();
      }catch(e){this.error=String(e.message||e);}
      finally{this.busy=false;await this.refresh();}
    }
    async action(action){
      if(this.busy)return;this.busy=true;this.error='';
      try{
        await this.refresh();if(!this.touch)throw Error('Zuerst eine Skizze im iPad-Modus öffnen.');
        if(action==='cancel')await this.bridge.request('ui.key',{key:'Escape'});
        else if(action==='finish')await this.bridge.execute('sketch.finish');
        else if(action==='undo')await this.bridge.execute('edit.undo');
        else if(action==='redo')await this.bridge.execute('edit.redo');
        else if(action==='delete'){
          if(!this.selection.length || !this.selection.every(v=>['sketch_point','sketch_curve','sketch_midpoint'].includes(v.type)))throw Error('Zuerst Skizzengeometrie auswählen.');
          await this.bridge.execute('selection.delete');
        }else throw Error('Unbekannte Aktion.');
      }catch(e){this.error=String(e.message||e);}
      finally{this.busy=false;await this.refresh();}
    }
  }
  function mount(options){
    const {host}=options;
    let storage;try{storage=localStorage;}catch(_){storage={getItem:()=>null,setItem(){}};}
    let menuOpen=false,signature='';
    const control=new Controller(options,storage,render);
    const style=document.createElement('style');
    style.textContent=`
#sc-ipad-ui [hidden]{display:none!important}
#sc-ipad-ui .ts-native-palette{position:fixed;right:0;width:min(46vw,260px);bottom:20px;pointer-events:auto;background:#202833}
#sc-ipad-ui .ts-deck{position:fixed;left:0;right:0;background:#202833;color:#edf3fb;pointer-events:auto;box-sizing:border-box;border-bottom:1px solid #40516a;padding:10px 12px;display:flex;flex-direction:column;justify-content:center;gap:8px;isolation:isolate}
#sc-ipad-ui .ts-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(140px,320px) minmax(0,1fr);align-items:center;gap:8px}
#sc-ipad-ui .ts-title{font:600 17px system-ui;white-space:nowrap}
#sc-ipad-ui .ts-toggle,#sc-ipad-ui .ts-pill,#sc-ipad-ui .ts-rail button,#sc-ipad-ui .ts-menu button{min-width:44px;min-height:44px;height:auto;box-sizing:border-box;font:500 16px/1.25 system-ui;cursor:pointer;color:#edf3fb;background:#2b384a;border:1px solid #51627a;border-radius:10px;padding:9px 12px;text-align:left}
#sc-ipad-ui .ts-toggle{justify-self:end;pointer-events:auto;white-space:nowrap}
#sc-ipad-ui .ts-toggle.advanced{position:fixed;left:50%;transform:translateX(-50%);z-index:2;box-shadow:0 3px 12px #0008}
#sc-ipad-ui .ts-pill{width:100%;justify-content:space-between;background:#164b85;border-color:#5e9be0}
#sc-ipad-ui .ts-hint{font:14px/1.3 system-ui;color:#bdcde0;margin:0;text-align:center}
#sc-ipad-ui .ts-rail{position:fixed;left:10px;bottom:72px;width:180px;pointer-events:auto;background:#202833f5;color:#edf3fb;border:1px solid #40516a;border-radius:14px;padding:6px;box-sizing:border-box;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;touch-action:pan-y;scrollbar-width:thin}
#sc-ipad-ui .ts-rail button{width:100%;justify-content:flex-start;gap:9px;margin:3px 0;flex-shrink:0}
#sc-ipad-ui .ts-rail svg{width:24px;height:24px;flex:none}
#sc-ipad-ui .ts-rail button[aria-pressed=true],#sc-ipad-ui .ts-menu button[aria-pressed=true]{background:#164b85;border-color:#5e9be0}
#sc-ipad-ui .ts-rail .ts-footer{border-top:1px solid #40516a;margin-top:8px;padding-top:5px}
#sc-ipad-ui .ts-rail .ts-history{display:flex;gap:6px}
#sc-ipad-ui .ts-rail button:disabled,#sc-ipad-ui .ts-menu button:disabled{opacity:.4;cursor:default}
#sc-ipad-ui .ts-menu{position:fixed;left:50%;transform:translateX(-50%);width:320px;max-width:calc(100vw - 20px);max-height:calc(100vh - 240px);max-height:calc(100dvh - 240px);overflow-y:auto;overscroll-behavior:contain;touch-action:pan-y;background:#202833;color:#edf3fb;pointer-events:auto;box-sizing:border-box;padding:8px;border:1px solid #6a809e;border-radius:12px;box-shadow:0 12px 30px #0008;z-index:3}
#sc-ipad-ui .ts-menu h2{font:600 15px system-ui;margin:8px}
#sc-ipad-ui .ts-menu button{width:100%;justify-content:flex-start;margin:3px 0}
#sc-ipad-ui .ts-error{color:#ffb7aa;font:14px system-ui;margin:0;overflow-wrap:anywhere}
#sc-ipad-ui button:focus-visible{outline:3px solid #a9d4ff;outline-offset:2px}
#sc-ipad-ui .sc-pad{z-index:5;max-height:calc(100vh - 88px);max-height:calc(100dvh - 88px);overflow-y:auto;overscroll-behavior:contain;touch-action:pan-y}
#sc-ipad-ui .sc-pad .unit{height:44px}
@media(max-width:850px){#sc-ipad-ui .ts-rail{width:148px}#sc-ipad-ui .ts-title{font-size:15px}#sc-ipad-ui .ts-row{grid-template-columns:minmax(0,1fr) minmax(140px,260px) auto}#sc-ipad-ui .ts-toggle{font-size:14px;padding:9px}#sc-ipad-ui .ts-rail button{font-size:15px;padding:9px 6px}}
@media(max-width:560px){#sc-ipad-ui .ts-title{display:none}#sc-ipad-ui .ts-row{grid-template-columns:minmax(140px,1fr) auto}#sc-ipad-ui .ts-rail{width:64px}#sc-ipad-ui .ts-rail .ts-label{display:none}#sc-ipad-ui .ts-rail button{justify-content:center;padding:9px 4px}#sc-ipad-ui .ts-history{flex-direction:column}#sc-ipad-ui .ts-hint{font-size:12px}}
`;
    document.head.appendChild(style);
    const deck=document.createElement('header');deck.className='ts-deck';deck.hidden=true;deck.setAttribute('aria-label','iPad-Skizzenbedienung');
    const rail=document.createElement('nav');rail.className='ts-rail';rail.hidden=true;rail.setAttribute('aria-label','Skizzenwerkzeuge');
    const menu=document.createElement('section');menu.className='ts-menu';menu.hidden=true;menu.setAttribute('aria-label','Werkzeugvarianten');
    const advanced=document.createElement('button');advanced.type='button';advanced.className='ts-toggle advanced';advanced.hidden=true;advanced.textContent='iPad-Ansicht';advanced.dataset.shell='toggle';
    const paletteMask=document.createElement('div');paletteMask.className='ts-native-palette';paletteMask.hidden=true;paletteMask.setAttribute('aria-hidden','true');host.prepend(paletteMask);
    host.append(deck,rail,advanced,menu);
    function button(text,action,title){const b=document.createElement('button');b.type='button';b.textContent=text;b.dataset.shell=action;if(title){b.title=title;b.setAttribute('aria-label',title);}return b;}
    function dispatch(action){
      menuOpen=false;
      if(action==='toggle')return control.toggle();
      if(action.startsWith('tool:'))return control.choose(action.slice(5));
      return control.action(action);
    }
    function render(){
      const visible=control.visible,touch=control.touch;
      host.dataset.shellMode=visible?(touch?'touch':'advanced'):'none';
      deck.hidden=!touch;rail.hidden=!touch;paletteMask.hidden=!touch;advanced.hidden=!visible||touch;
      if(!touch){menuOpen=false;}
      const bounds=chromeBounds(options.handles(),innerHeight);
      deck.style.top=bounds.top+'px';deck.style.height=(bounds.bottom-bounds.top)+'px';
      paletteMask.style.top=bounds.bottom+'px';
      rail.style.top=(bounds.bottom+10)+'px';advanced.style.top=(bounds.bottom+8)+'px';menu.style.top=(bounds.bottom+6)+'px';
      const locked=control.busy||options.editing();
      const active=findTool(control.info&&control.info.tool);
      const activeVariant=active&&active.variants.find(v=>v.command===control.info.tool);
      const key=JSON.stringify([visible,touch,control.state,activeVariant,control.info&&control.info.tool,control.selection,control.error,locked,menuOpen]);
      if(key!==signature){
        signature=key;deck.replaceChildren();rail.replaceChildren();menu.replaceChildren();
        if(touch){
          const row=document.createElement('div');row.className='ts-row';
          const title=document.createElement('span');title.className='ts-title';title.textContent='Skizze · iPad';
          const pill=button(active?active.label+(active.variants.length>1?' · '+activeVariant.label:'')+' ▾':control.info.tool?'Werkzeug aktiv ▾':'Automatisch · Pencil ▾','variants',active?active.label+' · '+activeVariant.label+' · Varianten wählen':'Werkzeug wählen');pill.className='ts-pill';pill.setAttribute('aria-expanded',String(menuOpen));pill.disabled=locked;
          const toggle=button('Erweitert','toggle','Erweiterte Befehlsleiste anzeigen');toggle.className='ts-toggle';toggle.disabled=locked;
          row.append(title,pill,toggle);
          const hint=document.createElement('p');hint.className='ts-hint';hint.textContent=control.info.tool?'Mit Pencil zeichnen · Esc beendet das Werkzeug':'Mit Pencil zeichnen oder ein Werkzeug wählen · Finger bewegen die Ansicht';
          deck.append(row,hint);
          if(control.error){const err=document.createElement('p');err.className='ts-error';err.setAttribute('role','alert');err.textContent=control.error;deck.append(err);}
          const finish=button('✓','finish','Skizze beenden');const finishLabel=document.createElement('span');finishLabel.className='ts-label';finishLabel.textContent='Skizze beenden';finish.append(finishLabel);finish.disabled=locked;rail.append(finish);
          for(const group of TOOLS){
            const b=button('','tool:'+control.state.variants[group.id],group.label);b.disabled=locked;b.setAttribute('aria-pressed',String(active===group));
            const image=document.createElement('span');image.innerHTML=options.icon(group.id);const label=document.createElement('span');label.className='ts-label';label.textContent=group.label;b.append(image,label);rail.append(b);
          }
          const footer=document.createElement('div');footer.className='ts-footer';
          if(control.info.tool){const cancel=button('Esc','cancel','Werkzeug beenden');const cancelLabel=document.createElement('span');cancelLabel.className='ts-label';cancelLabel.textContent='Werkzeug beenden';cancel.append(cancelLabel);cancel.disabled=locked;footer.append(cancel);}
          const del=button('⌫','delete','Ausgewählte Skizzengeometrie löschen');const deleteLabel=document.createElement('span');deleteLabel.className='ts-label';deleteLabel.textContent='Löschen';del.append(deleteLabel);del.disabled=locked||!control.selection.length||!control.selection.every(v=>['sketch_point','sketch_curve','sketch_midpoint'].includes(v.type));footer.append(del);
          rail.append(footer);
          if(menuOpen){
            const groups=active?[active]:TOOLS;
            for(const group of groups){const h=document.createElement('h2');h.textContent=group.label;menu.append(h);for(const v of group.variants){const b=button(v.label,'tool:'+v.command);b.disabled=locked;b.setAttribute('aria-pressed',String(control.info.tool===v.command));menu.append(b);}}
            menu.append(button('Schließen','close-menu'));
          }
        }
      }
      menu.hidden=!touch||!menuOpen;
      advanced.disabled=locked||!!(control.info&&control.info.dialog);
      options.changed();
    }
    function interact(e){
      const b=e.target.closest('button[data-shell]');if(!b||b.disabled)return;
      e.preventDefault();e.stopPropagation();
      const action=b.dataset.shell;
      if(action==='variants'){menuOpen=!menuOpen;render();return;}
      if(action==='close-menu'){menuOpen=false;render();return;}
      Promise.resolve(dispatch(action)).catch(e=>{control.error=String(e.message||e);render();});
    }
    for(const node of [deck,rail,advanced,menu,paletteMask]){
      let pressed=null;
      node.addEventListener('pointermove',e=>{if(pressed&&Math.hypot(e.clientX-pressed.x,e.clientY-pressed.y)>8)pressed.moved=true;});
      node.addEventListener('pointercancel',()=>{pressed=null;});
      node.addEventListener('pointerdown',e=>{pressed={x:e.clientX,y:e.clientY,moved:false};e.stopPropagation();if(e.pointerType!=='touch')e.preventDefault();});
      node.addEventListener('pointerup',e=>{const moved=pressed&&pressed.moved;pressed=null;if(moved){e.preventDefault();e.stopPropagation();return;}interact(e);});
      node.addEventListener('click',e=>{if(e.detail===0)interact(e);});
      for(const type of ['touchstart','touchmove','touchend'])node.addEventListener(type,e=>e.stopPropagation(),{passive:true});
    }
    // Keep the shared keypad above the shell and scrollable when Split View limits its height.
    const keypad=host.querySelector('.sc-pad');
    if(keypad){
      let start=null;
      keypad.addEventListener('pointerdown',e=>{start={x:e.clientX,y:e.clientY,moved:false};if(e.pointerType==='touch')e.stopPropagation();});
      keypad.addEventListener('pointermove',e=>{if(start&&Math.hypot(e.clientX-start.x,e.clientY-start.y)>8)start.moved=true;});
      keypad.addEventListener('pointerup',e=>{if(start&&start.moved){e.preventDefault();e.stopPropagation();}start=null;});
      keypad.addEventListener('pointercancel',()=>{start=null;});
      for(const type of ['touchstart','touchmove','touchend'])keypad.addEventListener(type,e=>e.stopPropagation(),{passive:true});
    }
    document.addEventListener('pointerdown',e=>{if(menuOpen&&!menu.contains(e.target)&&!deck.contains(e.target)){menuOpen=false;render();}},{capture:true});
    document.addEventListener('keydown',e=>{if(menuOpen&&e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();menuOpen=false;render();}},{capture:true});
    addEventListener('resize',render);
    return {controller:control,refresh:(info,sel)=>control.refresh(info,sel),
      containsPoint:(x,y)=>[deck,rail,advanced,menu,paletteMask].some(e=>{if(e.hidden)return false;const r=e.getBoundingClientRect();return x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom;}),
      get active(){return control.touch;},
    };
  }
  return {TOOLS,findTool,read,scope,chromeBounds,Controller,mount};
});
