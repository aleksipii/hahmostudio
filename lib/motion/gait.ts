import {type BezierCurve} from '../easing-model.ts';
import {sampleTrack,type Animation} from '../animation-model.ts';
import {solveTwoBone} from '../inverse-kinematics.ts';
import {smooth,writer} from './core.ts';

/* ───────────────────────── Alavartalo ja kävely (IK) ───────────────────────── */

export type Leg={thigh:string;shin:string;foot:string;hip:{x:number;y:number};knee:{x:number;y:number};ankle:{x:number;y:number};upper:number;lower:number};
export function legGeometry(a:Animation,roles:Record<string,string>,side:'left'|'right'):Leg|undefined{
 const thigh=a.rig.parts.find(p=>p.key===roles[side+'Thigh']),shin=a.rig.parts.find(p=>p.key===roles[side+'Shin']),foot=a.rig.parts.find(p=>p.key===roles[side+'Foot']);
 if(!thigh||!shin||shin.parentKey!==thigh.key)return;const ankle=shin.joints[0]??foot?.pivot;if(!ankle)return;
 return {thigh:thigh.key,shin:shin.key,foot:foot?.key??'',hip:thigh.pivot,knee:shin.pivot,ankle,upper:Math.hypot(shin.pivot.x-thigh.pivot.x,shin.pivot.y-thigh.pivot.y),lower:Math.hypot(ankle.x-shin.pivot.x,ankle.y-shin.pivot.y)};
}
/** Jalan nivelkulmat (asteina lepoasentoon nähden), kun lonkka on `hip` ja nilkka `target` (dokumenttitila). */
export function legAngles(leg:Leg,hip:{x:number;y:number},target:{x:number;y:number},bend:1|-1){
 const s=solveTwoBone(hip,target,leg.upper,leg.lower,bend),thigh=(s.firstAngle-Math.atan2(leg.knee.y-leg.hip.y,leg.knee.x-leg.hip.x))*180/Math.PI,shin=(s.secondAngle-Math.atan2(leg.ankle.y-leg.knee.y,leg.ankle.x-leg.knee.x))*180/Math.PI-thigh;
 return {thigh,shin,foot:-thigh-shin,clamped:s.clamped};
}
export type GaitKind='walk'|'run';
/** `half`: puolikas askelväli (×jalan pituus). Ensimmäinen ja viimeinen askel ovat lyhyempiä, joten matka = half·(2n−3). */
/**
 * `flight`: lentovaiheen osuus askelvälistä (kummatkaan jalat eivät kosketa maata; vain juoksussa). `rise` ja `footAir`:
 * lantion ja jalkaterien nousu lentovaiheessa (×jalan pituus). `approach`: hahmon suurennus (osuus) kohti kameraa
 * kävellessä (`front`), perspektiivin approksimaatio eikä 3D.
 */
export const gaitParams={walk:{stepsPerSecond:2,half:.3,hipLow:.93,bob:.03,lift:.11,arm:16,forearm:10,flight:0,rise:0,footAir:0,approach:.1},run:{stepsPerSecond:2.6,half:.36,hipLow:.88,bob:.035,lift:.13,arm:28,forearm:40,flight:.5,rise:.035,footAir:.07,approach:.14}} as const;
export const gaitSteps=(kind:GaitKind,seconds:number)=>Math.max(3,Math.round(seconds*gaitParams[kind].stepsPerSecond));
/** Kävelymatka (dokumenttipikseleinä) keston ja jalan pituuden mukaan: askelmäärä × askelpituus. */
export function gaitDistance(kind:GaitKind,seconds:number,legLength:number){return gaitParams[kind].half*legLength*(2*gaitSteps(kind,seconds)-3);}
/** Juuren matka 0–1: kiihdytys ja jarrutus (puolisuunnikasnopeus), jatkuva nopeus. */
export function travel(u:number,ramp=.18){const t=Math.max(0,Math.min(1,u)),r=Math.min(.45,ramp),v=1/(1-r);if(t<r)return v*t*t/(2*r);if(t>1-r){const s=1-t;return 1-v*s*s/(2*r);}return v*(t-r/2);}

export type LowerBodyPlan={direction:{x:number;y:number};distance:number;kind:GaitKind}|{drop:number[];shares:number[];curves:BezierCurve[];air?:number[]};

/**
 * Askellus ruutuihin [start, start+count): juuri liikkuu matkan `distance` suuntaan `dir` (x = vaaka, y = kohti kameraa),
 * tukijalan nilkka pysyy maailmassa paikallaan ja heilahtava jalka kulkee kaarella seuraavaan kohtaan.
 * `roots`: kaikkien kuvakulmien juuret, jotta paikka säilyy kuvakulman vaihtuessa.
 */
export function applyGait(a:Animation,roles:Record<string,string>,kind:GaitKind,dir:'left'|'right'|'front',start:number,count:number,roots:string[],blendIn=6,profile=false):Animation{
 const left=legGeometry(a,roles,'left'),right=legGeometry(a,roles,'right');if(!left||!right)throw Error('Askellus tarvitsee reisi-, sääri- ja jalkaterärooli sekä nilkan nivelpisteen.');
 const g=gaitParams[kind],L=(left.upper+left.lower+right.upper+right.lower)/2,before=Math.max(0,start-1),seated=Math.abs(sampleTrack(a.tracks.find(t=>t.key===roles.root),before).y)>1;
 // Askelmäärä varsinaisen kävelyajan mukaan (ennakointi/nousu ja asettuminen eivät nopeuta askeleita).
 const settle=Math.min(Math.round(a.fps*(seated?.45:.25)),Math.floor((count-2)/4)),travelFrames=Math.max(1,count-1-2*settle),n=gaitSteps(kind,(travelFrames+2*Math.min(Math.round(a.fps*.25),Math.floor((count-2)/4)))/a.fps);
 const sign=dir==='left'?-1:1;
 const extra=Object.fromEntries(roots.map((k,i)=>['__root'+i,k])),w=writer(a,{...roles,...extra});
 // Perspektiivisuurennus: juuren scale kasvaa kohti kameraa; translaatio kompensoi, jotta jalat pysyvät maassa (skaalaus pivotin ympäri).
 const pivotOf=(key:string|undefined)=>a.rig.parts.find(p=>p.key===key)?.pivot??a.rig.parts.find(p=>p.key===roles.root)?.pivot??{x:0,y:0},ankleMid={x:(left.ankle.x+right.ankle.x)/2,y:(left.ankle.y+right.ankle.y)/2};
 const compFor=(sc:number,pivot:{x:number;y:number})=>({x:-(sc-1)*(ankleMid.x-pivot.x),y:-(sc-1)*(ankleMid.y-pivot.y)});
 const rootPivot=pivotOf(roles.root),base0=w.base('root',before),s0=base0.scale||1,c0=compFor(s0,rootPivot),legs={left,right},root0={x:base0.x-c0.x,y:base0.y-c0.y};
 const grow=dir==='front'?g.approach:0,sAt=(u:number)=>s0*(1+grow*travel(u));
 const baseRot=Object.fromEntries((['left','right'] as const).flatMap(s=>['Thigh','Shin','Foot'].map(p=>[s+p,w.base(s+p,before).rotation])));
 // Istutuskohdat: h, 3h, 5h, …, viimeinen askel tuo jalat yhteen. Juuri on askelten välissä jalkojen puolivälissä.
 const h=g.half*L,lead:'left'|'right'=dir==='left'?'right':'left',other=(s:'left'|'right')=>s==='left'?'right':'left',along=dir==='front'?{x:0,y:1}:{x:sign,y:0};
 const plants=Array.from({length:n},(_,i)=>Math.min(2*i+1,2*n-3)*h),feetAfter=(i:number)=>[i>=0?plants[i]:0,i>=1?plants[i-1]:0],rootProgress=Array.from({length:n+1},(_,i)=>i===0?0:i===n?plants[n-1]:(feetAfter(i-1)[0]+feetAfter(i-1)[1])/2);
 const scale=dir==='front'?.18:1,total=plants[n-1];
 const times=rootProgress.map((d,i)=>{if(i===0)return 0;if(i===n)return 1;let lo=0,hi=1;for(let k=0;k<48;k++){const mid=(lo+hi)/2;if(travel(mid)<d/total)lo=mid;else hi=mid;}return (lo+hi)/2;});
 /** Lentovaihe: kosinipuolikas askelrajan ympärillä (0–1). Vain juoksussa. */
 const air=(u:number)=>{if(!g.flight)return 0;let v=0;for(let i=1;i<n;i++){const half=g.flight*.5*Math.min(times[i]-times[i-1],times[i+1]-times[i]);if(u>times[i]-half&&u<times[i]+half)v=Math.max(v,Math.sin(Math.PI*(u-(times[i]-half))/(2*half))**2);}return v;};
 const rootAt=(u:number,rise=1)=>({x:root0.x+along.x*total*travel(u),y:root0.y*(1-rise)+along.y*total*scale*travel(u)});
 const swings:Record<'left'|'right',{t0:number;t1:number;from:{x:number;y:number};to:{x:number;y:number}}[]>={left:[],right:[]},planted={left:{x:root0.x,y:0},right:{x:root0.x,y:0}};
 for(let i=0;i<n;i++){const s=i%2===0?lead:other(lead),to={x:root0.x+along.x*plants[i],y:along.y*plants[i]*scale};swings[s].push({t0:times[i],t1:times[i+1],from:planted[s],to});planted[s]=to;}
 const footAt=(s:'left'|'right',u:number,crouch:number)=>{let pos={x:root0.x,y:0};for(const sw of swings[s]){if(u>=sw.t1){pos=sw.to;continue;}if(u>sw.t0){const t=(u-sw.t0)/(sw.t1-sw.t0),e=smooth((t-.12)/.72);return {x:sw.from.x+(sw.to.x-sw.from.x)*e,y:sw.from.y+(sw.to.y-sw.from.y)*e-L*g.lift*Math.sin(Math.PI*t)**2*crouch,swing:t};}break;}return {...pos,swing:-1};};
 const cycle=(i:number)=>{const u=Math.max(0,Math.min(1,(i-Math.min(Math.round(a.fps*.25),Math.floor((count-2)/4)))/Math.max(1,count-1-2*Math.min(Math.round(a.fps*.25),Math.floor((count-2)/4)))));let st=0;while(st<n-1&&u>times[st+1])st++;return (st+Math.max(0,Math.min(1,(u-times[st])/Math.max(1e-9,times[st+1]-times[st]))))*Math.PI;};
 // Ennakointi: lantio laskeutuu ennen ensimmäistä askelta; asettuminen: nousee viimeisen askeleen jälkeen.
 // Istumasta tai kyykystä noustaan ennen ensimmäistä askelta (juuren y palaa lepoon nousuvaiheessa `settle`).
 // Profiilissa polvi taipuu kulkusuuntaan; etunäkymän taiteessa ulospäin (sama kuin istuessa, ei ristihäivytystä).
 const bend=(s:'left'|'right'):1|-1=>profile?(sign>0?1:-1):(s==='left'?1:-1);
 // Ristihäivytys vain, jos lähtöasento poikkeaa IK-ratkaisusta (esim. nousu istumasta); muuten IK sellaisenaan.
 const first=Object.fromEntries((['left','right'] as const).map(s=>[s,legAngles(legs[s],{x:legs[s].hip.x+root0.x,y:legs[s].hip.y+root0.y},{x:legs[s].ankle.x+root0.x,y:legs[s].ankle.y},bend(s))]));
 // Juuri esiin tuleva kuvakulma (oli piilossa) aloittaa suoraan IK-asennosta.
 const newlyVisible=w.base('root',before).opacity<.5;
 const needsBlend=!newlyVisible&&(['left','right'] as const).some(s=>Math.abs(first[s].thigh-baseRot[s+'Thigh'])>.5||Math.abs(first[s].shin-baseRot[s+'Shin'])>.5);
 for(let i=0;i<count;i++){
  const u=Math.max(0,Math.min(1,(i-settle)/travelFrames)),frame=start+i,r=rootAt(u,smooth(Math.min(1,i/Math.max(1,settle)))),blend=smooth(Math.min(1,i/Math.max(1,settle))),out=smooth(Math.min(1,(count-1-i)/Math.max(1,settle))),crouch=Math.min(blend,out);
  const hipDrop=L*((1-g.hipLow)+g.bob*Math.cos(cycle(i))**2)*crouch;
  const sc=sAt(u),flight=air(u)*crouch,comp=compFor(sc,rootPivot),R={x:r.x+comp.x,y:r.y+hipDrop-L*g.rise*flight+comp.y};
  w.set('root',frame,{x:R.x,y:R.y,scale:sc});roots.forEach((k,idx)=>{const ck=compFor(sc,pivotOf(k));w.set('__root'+idx,frame,{x:r.x+ck.x,y:r.y+hipDrop-L*g.rise*flight+ck.y,scale:sc});});
  for(const s of ['left','right'] as const){
   const leg=legs[s],foot=footAt(s,u,crouch),W={x:leg.ankle.x+foot.x,y:leg.ankle.y+foot.y-L*g.footAir*flight};
   // Jalkaterän maailmapaikka W pysyy täsmälleen, vaikka juuri skaalataan pivotin ympäri: paikallinen tavoite = pivot + (W − R − pivot) / scale.
   const angles=legAngles(leg,leg.hip,{x:rootPivot.x+(W.x-R.x-rootPivot.x)/sc,y:rootPivot.y+(W.y-R.y-rootPivot.y)/sc},bend(s));
   for(const [part,v] of [['Thigh',angles.thigh],['Shin',angles.shin],['Foot',angles.foot]] as const){const role=s+part;w.set(role,frame,{rotation:needsBlend?baseRot[role]+(v-baseRot[role])*smooth(Math.min(1,i/Math.max(1,blendIn))):v});}
  }
  // Kädet heiluvat vastavaiheessa 2 ruudun viiveellä, pää myötäilee 3 ruudun viiveellä (päällekkäinen toiminta).
  const swing=Math.sin(cycle(i-2))*crouch,armScale=dir==='front'?.4:1;
  for(const [s,m] of [['left',1],['right',-1]] as const){const base=w.base(s+'Arm',before),fore=w.base(s+'Forearm',before);w.set(s+'Arm',frame,{rotation:base.rotation+g.arm*swing*m*armScale});w.set(s+'Forearm',frame,{rotation:fore.rotation+(s==='left'?-1:1)*g.forearm*crouch*armScale});}
  const head=w.base('head',before);w.set('head',frame,{rotation:head.rotation+1.5*Math.sin(cycle(i-3))*crouch});
 }
 return w.flush();
}

/**
 * Alavartalon liike paikallaan (istuminen, kyykky, hyppy). Vaiheet annetaan polven koukistuskulmana (°) ja jalkaterän
 * irtoamiskorkeutena (×jalan pituus); lantion korkeus johdetaan geometriasta. Näin nivelkäyrät ovat sileitä myös
 * suorien jalkojen kohdalla (IK:n singulaarisuus vältetään) ja jalkaterät pysyvät maassa niin kauan kuin `air` on 0.
 */
