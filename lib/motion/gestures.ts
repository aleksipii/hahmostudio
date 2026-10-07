import {type BezierCurve} from '../easing-model.ts';
import {type Animation} from '../animation-model.ts';
import {ease,writer} from './core.ts';

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
export const ph=(name:PhaseName,share:number,pose:Record<string,Offset>,oscillate?:Phase['oscillate']):Phase=>({name,share,curve:phaseCurves[name],pose,...(oscillate?{oscillate}:{})});

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
