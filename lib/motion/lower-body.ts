import {type Animation} from '../animation-model.ts';
import {ease,writer} from './core.ts';
import {type PhaseName,phaseCurves} from './gestures.ts';
import {type Leg,legGeometry,legAngles} from './gait.ts';

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
  // Lantion lasku pystysuunnassa: lepoasennon pystyetäisyys − koukistetun jalan pystyetäisyys (keskiarvo jaloista).
  const vertical=(leg:Leg,d:number)=>Math.sqrt(Math.max(0,d*d-(leg.ankle.x-leg.hip.x)**2)),drop=((vertical(left,restDist(left))-vertical(left,distFor(left,knee)))+(vertical(right,restDist(right))-vertical(right,distFor(right,knee))))/2,y=ground+drop-air;
  w.set('root',frame,{x:root0.x,y});roots.forEach((_,k)=>w.set('__root'+k,frame,{x:root0.x,y}));
  for(const s of ['left','right'] as const){const leg=legs[s],hip={x:leg.hip.x+root0.x,y:leg.hip.y+y},target={x:leg.ankle.x+root0.x,y:leg.ankle.y+ground-air};
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
