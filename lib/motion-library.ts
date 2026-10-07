/**
 * Liikekirjasto (vaihe C): ammattimaiset liikeradat leikkaushahmoille.
 *
 * - Eleet koostuvat vaiheista ennakointi → toiminta → jälkiliike → asettuminen; jokaisella vaiheella on oma
 *   Bezier-käyränsä (`easing-model.ts`). Vaiheiden rajoilla liike kääntyy, joten nopeus on niissä nolla ja jatkuva.
 * - Päällekkäinen toiminta: johtava osa alkaa ensin, muut 2–4 ruudun porrastuksella (pää, kädet, vartalo eivät
 *   ala samassa ruudussa). Kyynärpää ja ranne kulkevat kaarella, koska liike on nivelkiertoa ketjussa.
 * - Liike alkaa nykyisestä asennosta (edellisen liikkeen loppu) eikä nolla-asennosta.
 * - Kävely, juoksu, istuminen, kyykky ja hyppy ratkaistaan analyyttisellä kahden luun IK:lla: tukijalka on
 *   lukittu maailmaan (ei liukumista) etu- ja sivunäkymässä. Askelpituus suhteutetaan jalan pituuteen ja
 *   kävelymatka keston mukaan.
 * Avaimet kirjoitetaan tiheinä (yksi per ruutu), jotta käyrien muoto säilyy sellaisenaan.
 */
import {sampleBezierCurve,type BezierCurve} from './easing-model.ts';
import {sampleTrack,neutral,type Animation,type Keyframe,type Pose} from './animation-model.ts';
import {solveTwoBone} from './inverse-kinematics.ts';
import type {QuickProfile} from './quick-animation.ts';
import type {CharacterView} from './character-view.ts';

export type PhaseName='ennakointi'|'toiminta'|'jälkiliike'|'pito'|'asettuminen';
export type Offset={r?:number;x?:number;y?:number};
export type Phase={name:PhaseName;share:number;curve:BezierCurve;pose:Record<string,Offset>;oscillate?:{role:string;amplitude:number;cycles:number}};
export type Gesture={lead:'arm'|'head'|'body';phases:Phase[];hold?:boolean;lowerBody?:{drop:number;bendOut?:boolean}[]};

/** Vaihekäyrät: ennakointi hidastuu ääriasentoon, toiminta kiihtyy ja jarruttaa, jälkiliike ja asettuminen pehmeitä. */
export const phaseCurves={
 ennakointi:{cp1:{x:.42,y:0},cp2:{x:.58,y:1}},
 toiminta:{cp1:{x:.38,y:0},cp2:{x:.32,y:1}},
 jälkiliike:{cp1:{x:.33,y:0},cp2:{x:.4,y:1}},
 pito:{cp1:{x:.42,y:0},cp2:{x:.58,y:1}},
 asettuminen:{cp1:{x:.42,y:0},cp2:{x:.5,y:1}},
} satisfies Record<PhaseName,BezierCurve>;
const ph=(name:PhaseName,share:number,pose:Record<string,Offset>,oscillate?:Phase['oscillate']):Phase=>({name,share,curve:phaseCurves[name],pose,...(oscillate?{oscillate}:{})});

/**
 * Eleiden vaiheet. Kulmat asteina; käsi = hahmon vasen käsi (kuvassa oikealla), nostaminen ulospäin on negatiivinen kierto.
 * `x`/`y` ovat dokumenttipikseleitä suhteessa jalan pituuteen (×L) alavartalon liikkeissä ja pikseleitä muuten.
 */
export const gestures:Record<string,Gesture>={
 wave:{lead:'arm',phases:[
  ph('ennakointi',.12,{leftArm:{r:10},leftForearm:{r:6},head:{r:-1.5}}),
  ph('toiminta',.26,{leftArm:{r:-145},leftForearm:{r:-25},leftHand:{r:-8},head:{r:2}}),
  ph('pito',.32,{leftArm:{r:-145},leftForearm:{r:-25},leftHand:{r:-8},head:{r:2}},{role:'leftForearm',amplitude:18,cycles:2}),
  ph('jälkiliike',.18,{leftArm:{r:8},leftForearm:{r:5},head:{r:-1}}),
  ph('asettuminen',.12,{})]},
 point:{lead:'arm',phases:[
  ph('ennakointi',.14,{leftArm:{r:12},leftForearm:{r:10},head:{r:-1}}),
  ph('toiminta',.22,{leftArm:{r:-84},leftForearm:{r:-6},leftHand:{r:-4},head:{r:3}}),
  ph('jälkiliike',.1,{leftArm:{r:-78},leftForearm:{r:-10},leftHand:{r:-6},head:{r:3}}),
  ph('pito',.27,{leftArm:{r:-80},leftForearm:{r:-8},leftHand:{r:-5},head:{r:3}}),
  ph('asettuminen',.27,{})]},
 fist:{lead:'arm',phases:[
  ph('ennakointi',.18,{leftArm:{r:14},leftForearm:{r:12}}),
  ph('toiminta',.24,{leftArm:{r:-58},leftForearm:{r:-28},head:{r:2}}),
  ph('pito',.3,{leftArm:{r:-55},leftForearm:{r:-22},head:{r:2}},{role:'leftArm',amplitude:4,cycles:2}),
  ph('jälkiliike',.14,{leftArm:{r:6},leftForearm:{r:4}}),
  ph('asettuminen',.14,{})]},
 nod:{lead:'head',phases:[
  ph('ennakointi',.2,{head:{y:-4,r:0}}),
  ph('toiminta',.25,{head:{y:9}}),
  ph('jälkiliike',.25,{head:{y:-2}}),
  ph('asettuminen',.3,{})]},
 'react-surprise':{lead:'head',phases:[
  ph('ennakointi',.14,{head:{y:3},leftArm:{r:4},rightArm:{r:-4}}),
  ph('toiminta',.22,{head:{y:-9},leftArm:{r:-32},rightArm:{r:32},leftForearm:{r:-14},rightForearm:{r:14},root:{y:-6}}),
  ph('pito',.24,{head:{y:-8},leftArm:{r:-30},rightArm:{r:30},leftForearm:{r:-12},rightForearm:{r:12},root:{y:-5}}),
  ph('jälkiliike',.16,{head:{y:2},leftArm:{r:4},rightArm:{r:-4},root:{y:1}}),
  ph('asettuminen',.24,{})]},
};
gestures['react-nod']=gestures.nod;gestures['react-wave']=gestures.wave;

/** Päällekkäinen toiminta: viive ruutuina johtavan osan mukaan (2–4 ruudun porrastus). */
export const overlapDelays:Record<Gesture['lead'],Record<string,number>>={
 arm:{leftArm:0,rightArm:0,leftForearm:2,rightForearm:2,leftHand:4,rightHand:4,head:3,root:4},
 head:{head:0,root:2,leftArm:3,rightArm:3,leftForearm:4,rightForearm:4,leftHand:5,rightHand:5},
 body:{root:0,leftThigh:0,rightThigh:0,leftShin:0,rightShin:0,leftFoot:0,rightFoot:0,head:3,leftArm:2,rightArm:2,leftForearm:4,rightForearm:4,leftHand:5,rightHand:5},
};

const ease=(c:BezierCurve,t:number)=>sampleBezierCurve(c,Math.max(0,Math.min(1,t)));
const smooth=(t:number)=>{const u=Math.max(0,Math.min(1,t));return u*u*u*(u*(u*6-15)+10);};

/** Eleen poikkeama roolille hetkellä u ∈ [0,1] (ennen porrastusta). */
export function gestureOffset(g:Gesture,role:string,u:number):Required<Offset>{
 let start=0,prev:Offset={};const out={r:0,x:0,y:0};
 for(const phase of g.phases){const end=start+phase.share;
  if(u<=end||phase===g.phases.at(-1)){const t=phase.share>0?(u-start)/phase.share:1,k=ease(phase.curve,t),to=phase.pose[role]??{};
   for(const c of ['r','x','y'] as const)out[c]=(prev[c]??0)+((to[c]??0)-(prev[c]??0))*k;
   if(phase.oscillate?.role===role){const w=Math.sin(Math.PI*Math.max(0,Math.min(1,t)));out.r+=phase.oscillate.amplitude*Math.sin(2*Math.PI*phase.oscillate.cycles*Math.max(0,Math.min(1,t)))*w*w;}
   return out;}
  prev=phase.pose[role]??{};start=end;
 }
 return out;
}

/* ───────────────────────── Tiheät avaimet ───────────────────────── */

type Writer={set(role:string,frame:number,pose:Partial<Pose>):void;flush():Animation;base(role:string,frame:number):Pose};
function writer(a:Animation,roles:Record<string,string>):Writer{
 const pending=new Map<string,Map<number,Keyframe>>();
 return {
  base:(role,frame)=>{const key=roles[role];return key?sampleTrack(a.tracks.find(t=>t.key===key),frame):{...neutral};},
  set(role,frame,pose){const key=roles[role];if(!key||frame<0||frame>=a.duration)return;let m=pending.get(key);if(!m)pending.set(key,m=new Map());const prev=m.get(frame)??{...sampleTrack(a.tracks.find(t=>t.key===key),frame),frame,easing:'linear' as const};m.set(frame,{...prev,...pose,frame,easing:'linear'});},
  flush(){if(!pending.size)return a;return {...a,tracks:[...a.tracks.filter(t=>!pending.has(t.key)),...[...pending].map(([key,frames])=>{const old=a.tracks.find(t=>t.key===key)?.frames??[];return {key,frames:[...old.filter(k=>!frames.has(k.frame)),...frames.values()].sort((x,y)=>x.frame-y.frame)};})]};},
 };
}

/* ───────────────────────── Eleet ───────────────────────── */

/** Kirjoittaa eleen ruutuihin [start, start+count). `intensity` skaalaa kulmat (0–1). */
export function applyGesture(a:Animation,roles:Record<string,string>,motion:string,start:number,count:number,intensity=1):Animation{
 const g=gestures[motion];if(!g)throw Error('Tuntematon ele: '+motion);
 const w=writer(a,roles),delays=overlapDelays[g.lead],used=new Set(g.phases.flatMap(p=>[...Object.keys(p.pose),...(p.oscillate?[p.oscillate.role]:[])]));
 const span=Math.max(2,count-1-Math.max(0,...[...used].map(r=>delays[r]??0)));
 for(const role of used){if(!roles[role])continue;const delay=delays[role]??0,base=w.base(role,Math.max(0,start-1));
  for(let i=0;i<count;i++){const u=Math.max(0,Math.min(1,(i-delay)/span)),o=gestureOffset(g,role,u);w.set(role,start+i,{rotation:base.rotation+o.r*intensity,x:base.x+o.x*intensity,y:base.y+o.y*intensity});}
 }
 return w.flush();
}

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
export const gaitParams={walk:{stepsPerSecond:2,half:.3,hipLow:.93,bob:.03,lift:.11,arm:16,forearm:10},run:{stepsPerSecond:2.6,half:.36,hipLow:.88,bob:.035,lift:.13,arm:28,forearm:40}} as const;
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
export function applyGait(a:Animation,roles:Record<string,string>,kind:GaitKind,dir:'left'|'right'|'front',start:number,count:number,roots:string[],blendIn=6):Animation{
 const left=legGeometry(a,roles,'left'),right=legGeometry(a,roles,'right');if(!left||!right)throw Error('Askellus tarvitsee reisi-, sääri- ja jalkaterärooli sekä nilkan nivelpisteen.');
 const g=gaitParams[kind],L=(left.upper+left.lower+right.upper+right.lower)/2,before=Math.max(0,start-1),seated=Math.abs(sampleTrack(a.tracks.find(t=>t.key===roles.root),before).y)>1;
 // Askelmäärä varsinaisen kävelyajan mukaan (ennakointi/nousu ja asettuminen eivät nopeuta askeleita).
 const settle=Math.min(Math.round(a.fps*(seated?.45:.25)),Math.floor((count-2)/4)),travelFrames=Math.max(1,count-1-2*settle),n=gaitSteps(kind,(travelFrames+2*Math.min(Math.round(a.fps*.25),Math.floor((count-2)/4)))/a.fps);
 const sign=dir==='left'?-1:1;
 const extra=Object.fromEntries(roots.map((k,i)=>['__root'+i,k])),w=writer(a,{...roles,...extra});
 const root0=w.base('root',before),legs={left,right};
 const baseRot=Object.fromEntries((['left','right'] as const).flatMap(s=>['Thigh','Shin','Foot'].map(p=>[s+p,w.base(s+p,before).rotation])));
 // Istutuskohdat: h, 3h, 5h, …, viimeinen askel tuo jalat yhteen. Juuri on askelten välissä jalkojen puolivälissä.
 const h=g.half*L,lead:'left'|'right'=dir==='left'?'right':'left',other=(s:'left'|'right')=>s==='left'?'right':'left',along=dir==='front'?{x:0,y:1}:{x:sign,y:0};
 const plants=Array.from({length:n},(_,i)=>Math.min(2*i+1,2*n-3)*h),feetAfter=(i:number)=>[i>=0?plants[i]:0,i>=1?plants[i-1]:0],rootProgress=Array.from({length:n+1},(_,i)=>i===0?0:i===n?plants[n-1]:(feetAfter(i-1)[0]+feetAfter(i-1)[1])/2);
 const scale=dir==='front'?.18:1,total=plants[n-1];
 const times=rootProgress.map((d,i)=>{if(i===0)return 0;if(i===n)return 1;let lo=0,hi=1;for(let k=0;k<48;k++){const mid=(lo+hi)/2;if(travel(mid)<d/total)lo=mid;else hi=mid;}return (lo+hi)/2;});
 const rootAt=(u:number,rise=1)=>({x:root0.x+along.x*total*travel(u),y:root0.y*(1-rise)+along.y*total*scale*travel(u)});
 const swings:Record<'left'|'right',{t0:number;t1:number;from:{x:number;y:number};to:{x:number;y:number}}[]>={left:[],right:[]},planted={left:{x:root0.x,y:0},right:{x:root0.x,y:0}};
 for(let i=0;i<n;i++){const s=i%2===0?lead:other(lead),to={x:root0.x+along.x*plants[i],y:along.y*plants[i]*scale};swings[s].push({t0:times[i],t1:times[i+1],from:planted[s],to});planted[s]=to;}
 const footAt=(s:'left'|'right',u:number,crouch:number)=>{let pos={x:root0.x,y:0};for(const sw of swings[s]){if(u>=sw.t1){pos=sw.to;continue;}if(u>sw.t0){const t=(u-sw.t0)/(sw.t1-sw.t0),e=smooth((t-.12)/.72);return {x:sw.from.x+(sw.to.x-sw.from.x)*e,y:sw.from.y+(sw.to.y-sw.from.y)*e-L*g.lift*Math.sin(Math.PI*t)**2*crouch,swing:t};}break;}return {...pos,swing:-1};};
 const cycle=(i:number)=>{const u=Math.max(0,Math.min(1,(i-Math.min(Math.round(a.fps*.25),Math.floor((count-2)/4)))/Math.max(1,count-1-2*Math.min(Math.round(a.fps*.25),Math.floor((count-2)/4)))));let st=0;while(st<n-1&&u>times[st+1])st++;return (st+Math.max(0,Math.min(1,(u-times[st])/Math.max(1e-9,times[st+1]-times[st]))))*Math.PI;};
 // Ennakointi: lantio laskeutuu ennen ensimmäistä askelta; asettuminen: nousee viimeisen askeleen jälkeen.
 // Istumasta tai kyykystä noustaan ennen ensimmäistä askelta (juuren y palaa lepoon nousuvaiheessa `settle`).
 const bend=(s:'left'|'right'):1|-1=>dir==='front'?(s==='left'?1:-1):(sign>0?1:-1);
 // Ristihäivytys vain, jos lähtöasento poikkeaa IK-ratkaisusta (esim. nousu istumasta); muuten IK sellaisenaan.
 const first=Object.fromEntries((['left','right'] as const).map(s=>[s,legAngles(legs[s],{x:legs[s].hip.x+root0.x,y:legs[s].hip.y+root0.y},{x:legs[s].ankle.x+root0.x,y:legs[s].ankle.y},bend(s))]));
 // Juuri esiin tuleva kuvakulma (oli piilossa) aloittaa suoraan IK-asennosta.
 const newlyVisible=w.base('root',before).opacity<.5;
 const needsBlend=!newlyVisible&&(['left','right'] as const).some(s=>Math.abs(first[s].thigh-baseRot[s+'Thigh'])>.5||Math.abs(first[s].shin-baseRot[s+'Shin'])>.5);
 for(let i=0;i<count;i++){
  const u=Math.max(0,Math.min(1,(i-settle)/travelFrames)),frame=start+i,r=rootAt(u,smooth(Math.min(1,i/Math.max(1,settle)))),blend=smooth(Math.min(1,i/Math.max(1,settle))),out=smooth(Math.min(1,(count-1-i)/Math.max(1,settle))),crouch=Math.min(blend,out);
  const hipDrop=L*((1-g.hipLow)+g.bob*Math.cos(cycle(i))**2)*crouch;
  w.set('root',frame,{x:r.x,y:r.y+hipDrop});roots.forEach((_,k)=>w.set('__root'+k,frame,{x:r.x,y:r.y+hipDrop}));
  for(const s of ['left','right'] as const){
   const leg=legs[s],foot=footAt(s,u,crouch),angles=legAngles(leg,{x:leg.hip.x+r.x,y:leg.hip.y+r.y+hipDrop},{x:leg.ankle.x+foot.x,y:leg.ankle.y+foot.y},bend(s));
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
export type LowerPhase={name:PhaseName;share:number;knee:number;air?:number;arms?:number};
export function applyLowerBody(a:Animation,roles:Record<string,string>,start:number,count:number,phases:LowerPhase[],roots:string[]):Animation{
 const left=legGeometry(a,roles,'left'),right=legGeometry(a,roles,'right');if(!left||!right)throw Error('Liike tarvitsee reisi-, sääri- ja jalkaterärooli sekä nilkan nivelpisteen.');
 const L=(left.upper+left.lower+right.upper+right.lower)/2,extra=Object.fromEntries(roots.map((k,i)=>['__root'+i,k])),w=writer(a,{...roles,...extra}),before=Math.max(0,start-1),root0=w.base('root',before),legs={left,right};
 // Lähtöasennon polvikulma (esim. istumasta) säilyy liikkeen alussa: ensimmäinen vaihe alkaa siitä.
 const kneeOf=(leg:Leg,rotShin:number)=>rotShin*(leg===left?1:-1);
 const startKnee=Math.max(0,(kneeOf(left,w.base('leftShin',before).rotation)+kneeOf(right,w.base('rightShin',before).rotation))/2);
 const value=(u:number,pick:(p:LowerPhase)=>number,initial:number)=>{let s=0,prev=initial;for(const p of phases){const e=s+p.share;if(u<=e||p===phases.at(-1)){const k=ease(phaseCurves[p.name],p.share?(u-s)/p.share:1);return prev+(pick(p)-prev)*k;}prev=pick(p);s=e;}return prev;};
 const restDist=(leg:Leg)=>Math.hypot(leg.ankle.x-leg.hip.x,leg.ankle.y-leg.hip.y),distFor=(leg:Leg,knee:number)=>Math.sqrt(leg.upper**2+leg.lower**2+2*leg.upper*leg.lower*Math.cos(knee*Math.PI/180));
 const ground=root0.y;// jalkaterien taso pysyy, juuren y kuvaa lantion laskua lepoon nähden
 for(let i=0;i<count;i++){
  const u=count>1?i/(count-1):1,frame=start+i,knee=value(u,p=>p.knee,startKnee),air=value(u,p=>p.air??0,0)*L;
  // Lantion lasku: lepoetäisyys − koukistettu etäisyys (sama molemmille jaloille keskiarvona).
  const drop=((restDist(left)-distFor(left,knee))+(restDist(right)-distFor(right,knee)))/2,y=ground+drop-air;
  w.set('root',frame,{x:root0.x,y});roots.forEach((_,k)=>w.set('__root'+k,frame,{x:root0.x,y}));
  for(const s of ['left','right'] as const){const leg=legs[s],hip={x:leg.hip.x+root0.x,y:leg.hip.y+y},d=distFor(leg,knee),dx=leg.ankle.x-leg.hip.x,target={x:leg.ankle.x+root0.x,y:hip.y+Math.sqrt(Math.max(0,d*d-dx*dx))};
   const angles=legAngles(leg,hip,target,s==='left'?1:-1);w.set(s+'Thigh',frame,{rotation:angles.thigh});w.set(s+'Shin',frame,{rotation:angles.shin});w.set(s+'Foot',frame,{rotation:angles.foot});}
  const ua=Math.max(0,Math.min(1,count>1?(i-2)/(count-1):1)),arms=value(ua,p=>p.arms??0,0);
  for(const [s,m] of [['left',-1],['right',1]] as const){const base=w.base(s+'Arm',before);w.set(s+'Arm',frame,{rotation:base.rotation+m*arms});}
 }
 return w.flush();
}

/** Alavartalon liikkeet vaiheittain: polven koukistus (°), irtoaminen (×L) ja käsien kohotus (°). */
export const lowerBodyMotions:Record<string,{hold:boolean;phases:LowerPhase[]}>={
 sit:{hold:true,phases:[{name:'ennakointi',share:.16,knee:6,arms:3},{name:'toiminta',share:.44,knee:92,arms:14},{name:'jälkiliike',share:.18,knee:86,arms:10},{name:'asettuminen',share:.22,knee:88,arms:8}]},
 crouch:{hold:false,phases:[{name:'ennakointi',share:.14,knee:5},{name:'toiminta',share:.26,knee:95,arms:18},{name:'pito',share:.22,knee:95,arms:18},{name:'jälkiliike',share:.18,knee:8,arms:-2},{name:'asettuminen',share:.2,knee:0}]},
 jump:{hold:false,phases:[{name:'ennakointi',share:.22,knee:62,arms:-14},{name:'toiminta',share:.12,knee:28,arms:40},{name:'toiminta',share:.14,knee:22,air:.32,arms:55},{name:'jälkiliike',share:.14,knee:26,air:0,arms:20},{name:'jälkiliike',share:.14,knee:58,arms:-6},{name:'asettuminen',share:.24,knee:0,arms:0}]},
};
/** Liikkeiden luontevat oletuskestot (s), kun käsikirjoitus ei anna kestoa. */
export const defaultMotionSeconds:Record<string,number>={wave:2,'react-wave':1.6,point:1.8,fist:1.6,nod:1,'react-nod':1,'react-surprise':1.2,sit:1.8,crouch:2,jump:1.8};

/* ───────────────────────── Lepoelämä ───────────────────────── */

/** Deterministinen näennäissatunnaisluku hahmon nimestä (sama syöte → sama räpäytysrytmi). */
function seeded(text:string){let h=2166136261;for(const c of text)h=Math.imul(h^c.charCodeAt(0),16777619);let s=h>>>0;return ()=>((s=(Math.imul(s,1103515245)+12345)>>>0)/4294967296);}
export type IdleOptions={speaker:string;rolesAt:(frame:number)=>Record<string,string>;quiet:(frame:number)=>boolean;blinkSeconds?:[number,number];breathSeconds?:number;breathPixels?:number};
/**
 * Lepohengitys (pää nousee ja laskee ~1 px, 3,6 s jakso) ja silmänräpäykset 2,8–4,6 s välein (3 ruutua).
 * Räpäytys ohitetaan, jos silmäluomella on jo avain lähellä (ilme, pokerinaama) tai `quiet` kieltää (liikkumiskielto).
 */
export function applyIdleLife(a:Animation,o:IdleOptions):Animation{
 const rnd=seeded(o.speaker),[minGap,maxGap]=o.blinkSeconds??[2.8,4.6],breath=o.breathSeconds??3.6,amp=o.breathPixels??.9;let next=a;
 const touched=(key:string,from:number,to:number)=>next.tracks.find(t=>t.key===key)?.frames.some(k=>k.frame>=from&&k.frame<=to&&!(k.frame===0));
 for(let t=1.2+rnd()*1.6;t*a.fps<a.duration-4;t+=minGap+rnd()*(maxGap-minGap)){
  const f=Math.round(t*a.fps);if(o.quiet(f))continue;const roles=o.rolesAt(f),keys=[roles.leftBlink,roles.rightBlink].filter((k):k is string=>!!k);
  if(!keys.length||keys.some(k=>touched(k,f-3,f+6)))continue;
  for(const key of keys){const base=sampleTrack(next.tracks.find(x=>x.key===key),f);if(base.opacity>.5)continue;next=writeKeys(next,key,[{...base,frame:f,easing:'hold',opacity:1},{...base,frame:f+3,easing:'hold',opacity:0}]);}
 }
 // Hengitys: pään y-värähtely lisätään olemassa olevan liikkeen päälle (ei korvaa sitä).
 const headKeys=new Set<string>();for(let f=0;f<a.duration;f++){const k=o.rolesAt(f).head;if(k)headKeys.add(k);}
 for(const key of headKeys){const track=next.tracks.find(t=>t.key===key),frames:Keyframe[]=[];
  for(let f=0;f<a.duration;f++){const roles=o.rolesAt(f);if(roles.head!==key)continue;const p=sampleTrack(track,f),q=o.quiet(f)?0:amp*Math.sin(2*Math.PI*f/(breath*a.fps));frames.push({...p,y:p.y+q,frame:f,easing:'linear'});}
  next=writeKeys(next,key,frames);}
 return next;
}
function writeKeys(a:Animation,key:string,frames:Keyframe[]):Animation{if(!frames.length)return a;const set=new Set(frames.map(k=>k.frame)),old=a.tracks.find(t=>t.key===key)?.frames??[];return {...a,tracks:[...a.tracks.filter(t=>t.key!==key),{key,frames:[...old.filter(k=>!set.has(k.frame)),...frames].sort((x,y)=>x.frame-y.frame)}]};}
