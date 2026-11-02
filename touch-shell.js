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
    let menuOpen=false,signature='',menuGroup=null,menuAnchor=null;
    const control=new Controller(options,storage,render);
    const style=document.createElement('style');
    style.textContent=`
#sc-ipad-ui [hidden]{display:none!important}
#sc-ipad-ui .ts-native-palette{position:fixed;right:0;width:min(46vw,260px);bottom:20px;pointer-events:auto;background:#1f242d}
#sc-ipad-ui .ts-deck{position:fixed;left:0;right:0;background:#1f242d;color:#edf3fb;pointer-events:auto;box-sizing:border-box;padding:6px 12px;display:flex;flex-direction:column;justify-content:flex-start;align-items:center;gap:4px;isolation:isolate;z-index:1}
#sc-ipad-ui .ts-row{display:flex;align-items:center;justify-content:center;gap:6px}
#sc-ipad-ui .ts-title{display:none}
#sc-ipad-ui .ts-toggle,#sc-ipad-ui .ts-pill,#sc-ipad-ui .ts-rail button,#sc-ipad-ui .ts-menu button{min-width:32px;min-height:32px;height:auto;box-sizing:border-box;font:500 13px/1.2 system-ui;cursor:pointer;color:#edf3fb;background:#2a313c;border:1px solid #3f4a5a;border-radius:8px;padding:6px 9px;text-align:left;display:flex;align-items:center}
#sc-ipad-ui .ts-toggle{pointer-events:auto;white-space:nowrap;color:#bcd0ea}
#sc-ipad-ui .ts-toggle.advanced{position:fixed;left:50%;transform:translateX(-50%);z-index:2;box-shadow:0 3px 12px #0008}
#sc-ipad-ui .ts-pill{width:auto;max-width:300px;white-space:nowrap;gap:6px;background:#1d3f66;border-color:#3d6ea6;border-radius:16px;padding:6px 14px}
#sc-ipad-ui .ts-hint{font:12px/1.3 system-ui;color:#8e9db0;margin:0;text-align:center}
#sc-ipad-ui .ts-rail{position:fixed;left:8px;bottom:64px;width:132px;pointer-events:auto;background:#1f242df2;color:#edf3fb;border:1px solid #333c4a;border-radius:12px;padding:4px;box-sizing:border-box;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;touch-action:pan-y;scrollbar-width:none;z-index:2}
#sc-ipad-ui .ts-rail button{position:relative;width:100%;justify-content:flex-start;gap:7px;margin:2px 0;flex-shrink:0;background:transparent;border-color:transparent}
#sc-ipad-ui .ts-rail button[data-variants]::after{content:"";position:absolute;right:5px;bottom:5px;border:4px solid transparent;border-right-color:#8ea6c4;border-bottom-color:#8ea6c4}
#sc-ipad-ui .ts-rail svg{width:18px;height:18px;flex:none}
#sc-ipad-ui .ts-rail button[aria-pressed=true],#sc-ipad-ui .ts-menu button[aria-pressed=true]{background:#1d3f66;border-color:#3d6ea6}
#sc-ipad-ui .ts-rail .ts-footer{border-top:1px solid #333c4a;margin-top:4px;padding-top:3px}
#sc-ipad-ui .ts-rail .ts-history{display:flex;gap:4px}
#sc-ipad-ui .ts-rail button:disabled,#sc-ipad-ui .ts-menu button:disabled{opacity:.4;cursor:default}
#sc-ipad-ui .ts-menu{position:fixed;left:50%;transform:translateX(-50%);width:220px;max-width:calc(100vw - 20px);max-height:calc(100vh - 120px);max-height:calc(100dvh - 120px);overflow-y:auto;overscroll-behavior:contain;touch-action:pan-y;background:#1f242d;color:#edf3fb;pointer-events:auto;box-sizing:border-box;padding:4px;border:1px solid #4a5a70;border-radius:10px;box-shadow:0 10px 26px #0009;z-index:4}
#sc-ipad-ui .ts-menu.flyout{transform:none;width:190px}
#sc-ipad-ui .ts-menu h2{font:600 12px system-ui;color:#8e9db0;margin:4px 6px;text-transform:uppercase;letter-spacing:.04em}
#sc-ipad-ui .ts-menu button{width:100%;justify-content:flex-start;margin:2px 0;background:transparent;border-color:transparent}
#sc-ipad-ui .ts-error{color:#ffb7aa;font:12px system-ui;margin:0;overflow-wrap:anywhere}
#sc-ipad-ui button:focus-visible{outline:2px solid #a9d4ff;outline-offset:1px}
#sc-ipad-ui .sc-pad{z-index:5;max-height:calc(100vh - 88px);max-height:calc(100dvh - 88px);overflow-y:auto;overscroll-behavior:contain;touch-action:pan-y}
#sc-ipad-ui .sc-pad .unit{height:36px}
#sc-ipad-ui[data-shell-mode=touch] .sc-pad{grid-template-columns:repeat(5,46px);gap:6px;padding:8px}
#sc-ipad-ui[data-shell-mode=touch] .sc-pad button{height:44px;border-radius:10px}
#sc-ipad-ui[data-shell-mode=touch] .sc-pad .unit{height:32px}
@media(max-width:560px){#sc-ipad-ui .ts-rail{width:46px}#sc-ipad-ui .ts-rail .ts-label{display:none}#sc-ipad-ui .ts-rail button{justify-content:center;padding:6px 4px}#sc-ipad-ui .ts-history{flex-direction:column}#sc-ipad-ui .ts-hint{display:none}}
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
      if(!menuAnchor)menuOpen=false;
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
      rail.style.top=(bounds.top+6)+'px';advanced.style.top=(bounds.bottom+8)+'px';if(!menuAnchor)menu.style.top=(bounds.top+50)+'px';
      const locked=control.busy||options.editing();
      const active=findTool(control.info&&control.info.tool);
      const activeVariant=active&&active.variants.find(v=>v.command===control.info.tool);
      const key=JSON.stringify([visible,touch,control.state,activeVariant,control.info&&control.info.tool,control.selection,control.error,locked,menuOpen,menuGroup&&menuGroup.id,menuAnchor]);
      if(key!==signature){
        signature=key;deck.replaceChildren();rail.replaceChildren();menu.replaceChildren();
        if(touch){
          const row=document.createElement('div');row.className='ts-row';
          const title=document.createElement('span');title.className='ts-title';title.textContent='Skizze · iPad';
          const pill=button(active?active.label+(active.variants.length>1?' · '+activeVariant.label:'')+' ▾':control.info.tool?'Werkzeug aktiv ▾':'Automatisch · Pencil ▾','variants',active?active.label+' · '+activeVariant.label+' · Varianten wählen':'Werkzeug wählen');pill.className='ts-pill';pill.setAttribute('aria-expanded',String(menuOpen));pill.disabled=locked;
          const toggle=button('Erweitert','toggle','Erweiterte Befehlsleiste anzeigen');toggle.className='ts-toggle';toggle.disabled=locked;
          const undo=button('↶','undo','Rückgängig');undo.className='ts-toggle';undo.disabled=locked;
          const redo=button('↷','redo','Wiederholen');redo.className='ts-toggle';redo.disabled=locked;
          row.append(title,undo,pill,redo,toggle);
          const hint=document.createElement('p');hint.className='ts-hint';hint.textContent=control.info.tool?'Mit Pencil zeichnen · Esc beendet das Werkzeug':'Mit Pencil zeichnen oder ein Werkzeug wählen · Finger bewegen die Ansicht';
          deck.append(row,hint);
          if(control.error){const err=document.createElement('p');err.className='ts-error';err.setAttribute('role','alert');err.textContent=control.error;deck.append(err);}
          const finish=button('✓','finish','Skizze beenden');const finishLabel=document.createElement('span');finishLabel.className='ts-label';finishLabel.textContent='Skizze beenden';finish.append(finishLabel);finish.disabled=locked;rail.append(finish);
          for(const group of TOOLS){
            const b=button('','tool:'+control.state.variants[group.id],group.label);b.disabled=locked;b.setAttribute('aria-pressed',String(active===group));b.dataset.group=group.id;if(group.variants.length>1)b.dataset.variants='1';
            const image=document.createElement('span');image.innerHTML=options.icon(group.id);const label=document.createElement('span');label.className='ts-label';label.textContent=group.label;b.append(image,label);rail.append(b);
          }
          const footer=document.createElement('div');footer.className='ts-footer';
          if(control.info.tool){const cancel=button('Esc','cancel','Werkzeug beenden');const cancelLabel=document.createElement('span');cancelLabel.className='ts-label';cancelLabel.textContent='Werkzeug beenden';cancel.append(cancelLabel);cancel.disabled=locked;footer.append(cancel);}
          const del=button('⌫','delete','Ausgewählte Skizzengeometrie löschen');const deleteLabel=document.createElement('span');deleteLabel.className='ts-label';deleteLabel.textContent='Löschen';del.append(deleteLabel);del.disabled=locked||!control.selection.length||!control.selection.every(v=>['sketch_point','sketch_curve','sketch_midpoint'].includes(v.type));footer.append(del);
          rail.append(footer);
          if(menuOpen){
            const groups=menuGroup?[menuGroup]:active?[active]:TOOLS;
            for(const group of groups){const h=document.createElement('h2');h.textContent=group.label;menu.append(h);for(const v of group.variants){const b=button(v.label,'tool:'+v.command);b.disabled=locked;b.setAttribute('aria-pressed',String(control.info.tool===v.command));menu.append(b);}}
            if(!menuGroup)menu.append(button('Schließen','close-menu'));
          }
        }
      }
      menu.hidden=!touch||!menuOpen;
      menu.classList.toggle('flyout',!!menuAnchor);
      if(menuAnchor){menu.style.left=menuAnchor.x+'px';menu.style.top=Math.max(8,Math.min(innerHeight-menu.offsetHeight-8,menuAnchor.y))+'px';}
      else{menu.style.left='';}
      advanced.disabled=locked||!!(control.info&&control.info.dialog);
      options.changed();
    }
    function interact(e){
      const b=e.target.closest('button[data-shell]');if(!b||b.disabled)return;
      e.preventDefault();e.stopPropagation();
      const action=b.dataset.shell;
      if(action==='variants'){menuOpen=!menuOpen;menuGroup=null;menuAnchor=null;render();return;}
      if(action==='close-menu'){menuOpen=false;menuGroup=null;menuAnchor=null;render();return;}
      // Werkzeug mit Varianten in der linken Leiste: Werkzeug starten und die Varianten daneben aufklappen
      // (wie in Shapr3D). Eine Wahl in diesem Menü schließt es wieder.
      if(b.dataset.group&&b.dataset.variants){
        const group=TOOLS.find(g=>g.id===b.dataset.group);const r=b.getBoundingClientRect();
        menuGroup=group;menuAnchor={x:Math.round(r.right+6),y:Math.round(r.top)};menuOpen=true;
      } else if(menu.contains(b)){menuOpen=false;menuGroup=null;menuAnchor=null;}
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
    document.addEventListener('pointerdown',e=>{if(menuOpen&&!menu.contains(e.target)&&!deck.contains(e.target)&&!rail.contains(e.target)){menuOpen=false;menuGroup=null;menuAnchor=null;render();}},{capture:true});
    document.addEventListener('keydown',e=>{if(menuOpen&&e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();menuOpen=false;menuGroup=null;menuAnchor=null;render();}},{capture:true});
    addEventListener('resize',render);
    return {controller:control,refresh:(info,sel)=>control.refresh(info,sel),
      containsPoint:(x,y)=>[deck,rail,advanced,menu,paletteMask].some(e=>{if(e.hidden)return false;const r=e.getBoundingClientRect();return x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom;}),
      get active(){return control.touch;},
    };
  }
  return {TOOLS,findTool,read,scope,chromeBounds,Controller,mount};
});
