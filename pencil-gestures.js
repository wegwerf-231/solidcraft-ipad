// SPDX-License-Identifier: MIT OR Apache-2.0
// Original bounded gesture recognition. No document writes or device-specific SDK.
(function(g,f){const m=f();if(typeof module==='object'&&module.exports)module.exports=m;else g.SolidCraftPencilGestures=m;})(globalThis,function(){
  'use strict';
  const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  class Stroke {
    constructor(start,time=0){this.points=[{...start,t:time}];this.controls=[start];this.recent=[];this.lastToggle=-Infinity;this.forced=null;this.armed=true;this.dwell={at:start,t:time};this.pressureSeen=false;}
    move(p,time){
      if(!Number.isFinite(p.x)||!Number.isFinite(p.y))return null;
      const last=this.points.at(-1);if(dist(last,p)>=1){
        if(this.points.length>=4096)throw Error('Strich zu lang. Bitte absetzen.');
        this.points.push({...p,t:time});
      }
      if(Number.isFinite(p.pressure)&&p.pressure>0){
        this.pressureSeen=true;
        if(p.pressure<.35)this.armed=true;
        if(p.pressure>=.6&&this.armed){this.armed=false;this.addControl(p);}
      }
      if(dist(this.dwell.at,p)>5)this.dwell={at:p,t:time};
      else if(time-this.dwell.t>=350){this.addControl(p);this.dwell={at:p,t:time};}
      this.recent.push({...p,t:time,index:this.points.length-1});
      this.recent=this.recent.filter(q=>time-q.t<=550).slice(-90);
      if(time-this.lastToggle<750||this.recent.length<7)return null;
      const xs=this.recent.map(q=>q.x),ys=this.recent.map(q=>q.y),w=Math.max(...xs)-Math.min(...xs),h=Math.max(...ys)-Math.min(...ys);
      if(Math.max(w,h)>42||Math.max(w,h)<8)return null;
      const axis=w>=h?'x':'y';let anchor=this.recent[0][axis],sign=0,turns=0,path=0;
      for(const q of this.recent){const d=q[axis]-anchor;if(Math.abs(d)<5)continue;const next=Math.sign(d);if(sign&&next!==sign)turns++;sign=next;path+=Math.abs(d);anchor=q[axis];}
      if(turns<3||path<30||dist(this.recent[0],p)>24)return null;
      const cut=this.recent[0].index,prior=this.points.slice(0,cut+1),a=prior[0],b=prior.at(-1),len=dist(a,b);
      const bend=prior.reduce((n,q)=>Math.max(n,Math.abs((b.x-a.x)*(a.y-q.y)-(a.x-q.x)*(b.y-a.y))/Math.max(1e-9,len)),0);
      const was=this.forced||(bend>Math.max(5,.07*len)?'arc':'line');
      this.forced=was==='arc'?'line':'arc';this.lastToggle=time;
      // The recognition wiggle is a mode switch, not a sample for fitting the resulting arc.
      this.points.splice(cut+1);this.recent=[];
      return this.forced;
    }
    addControl(p){if(dist(this.controls.at(-1),p)<8)return;if(this.controls.length>=128)throw Error('Maximal 128 Spline-Punkte pro Strich.');this.controls.push(p);}
    finish(p){const points=this.controls.slice();if(dist(points.at(-1),p)>1)points.push(p);return points.map(q=>({x:q.x,y:q.y}));}
  }
  function tangentThrough(a,b,dir,near){
    const len=Math.hypot(...dir);if(len<1e-9)return null;
    const n=[-dir[1]/len,dir[0]/len],d=[b[0]-a[0],b[1]-a[1]],den=2*(d[0]*n[0]+d[1]*n[1]);
    if(Math.abs(den)<1e-8)return null;
    const k=(d[0]*d[0]+d[1]*d[1])/den,c=[a[0]+k*n[0],a[1]+k*n[1]],r=Math.abs(k);
    const u=Math.atan2(a[1]-c[1],a[0]-c[0]),v=Math.atan2(b[1]-c[1],b[0]-c[0]);
    let sweep=((v-u+Math.PI*3)%(Math.PI*2))-Math.PI;
    const q=[c[0]+r*Math.cos(u+sweep/2),c[1]+r*Math.sin(u+sweep/2)];
    const other=[c[0]+r*Math.cos(u+sweep/2+Math.PI),c[1]+r*Math.sin(u+sweep/2+Math.PI)];
    return Math.hypot(q[0]-near[0],q[1]-near[1])<=Math.hypot(other[0]-near[0],other[1]-near[1])?q:other;
  }
  function hoverCurve(text){const match=/^SketchCurve \{ sketch: (\d+), id: ("(?:\\.|[^"\\])*"),/.exec(text||'');if(!match)return null;try{return {sketch:Number(match[1]),id:JSON.parse(match[2])};}catch(_){return null;}}
  return {Stroke,tangentThrough,hoverCurve};
});
