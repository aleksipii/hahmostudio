import {buildScreenplay,type Motion} from './screenplay.ts';
import {sampleTrack,type Animation} from './animation-model.ts';
import {viewAtFrame} from './character-view.ts';
import type {QuickProfile} from './quick-animation.ts';
import type {Event,Presentation} from './presentation-model.ts';
import {productionMotions} from './presentation-direction.ts';
export function compileBodyMotion(a:Animation,q:QuickProfile,p:Presentation,speaker:string):Animation{
 let next=a;const full=a.duration;
 for(const e of p.events.filter(e=>e.kind==='action'&&e.target===speaker&&productionMotions.includes(e.value as any))){
  if(e.value==='stop')continue;
  const seconds=e.duration??e.seconds??2,start=Math.round((e.at??0)*a.fps);if(seconds<.5||seconds>20)throw Error('Liikkeen kesto on 0,5–20 s.');
  const freeze=p.events.filter(c=>c.kind==='constraint'&&['still','release-still'].includes(c.value)&&[speaker,'scene'].includes(c.target)&&c.at!<=e.at!).at(-1);if(freeze?.value==='still')throw Error('Liike on ristiriidassa liikkumiskiellon kanssa (rivi '+freeze.sourceRef.line+').');
  const channels=(value:string)=>value==='nod'?['head']:value==='wave'?['arms']:['root','arms','legs'];
  const overlap=p.events.find(other=>other.id!==e.id&&other.target===speaker&&other.kind==='action'&&productionMotions.includes(other.value as any)&&other.value!=='stop'&&channels(e.value).some(c=>channels(other.value).includes(c))&&other.at!<e.at!+seconds&&other.at!+other.duration!>e.at!);if(overlap)throw Error('Kaksi vartaloliikettä osuu päällekkäin: rivit '+e.sourceRef.line+' ja '+overlap.sourceRef.line+'.');
  const small=p.direction?.noLargeGestures||p.events.some(c=>c.kind==='constraint'&&c.value==='small-gestures'&&[speaker,'scene'].includes(c.target)&&c.at!<=e.at!);
  if(small&&['jump','run-left','run-right','run-front'].includes(e.value))throw Error('Suuren liikkeen kielto on ristiriidassa hypyn tai juoksun kanssa. Muuta ohjetta tai valitse kävely/nyökkäys.');
  const view=viewAtFrame(q,next,Math.max(0,start-1)),roles=q.views?.[view]??q.roles,profile={...q,roles};
  const prefix={...next,duration:Math.max(1,start),tracks:next.tracks.map(t=>({...t,frames:t.frames.filter(k=>k.frame<Math.max(1,start))}))};
  const text='['+e.value.replace('walk','kävele').replace('run','juokse').replace('-left',' vasemmalle').replace('-right',' oikealle').replace('-front',' suoraan').replace('wave','vilkuta').replace('jump','hyppää').replace('crouch','kyykisty').replace('nod','nyökkää')+' '+seconds+'s]';
  const result=buildScreenplay(prefix,profile,{width:p.world.width,height:p.world.height,background:p.world.background,guides:false,x:0,y:0,scale:1},{text,beats:[],warnings:[],seconds});
  const factor=small?.3:p.direction?.profiles.find(v=>v.speaker===speaker)?.intensity??1;
  const motionKeys=new Set(result.animation.tracks.filter(t=>t.frames.some(k=>k.frame>=prefix.duration)).map(t=>t.key));
  next={...next,tracks:[...next.tracks.filter(t=>!motionKeys.has(t.key)),...result.animation.tracks.filter(t=>motionKeys.has(t.key)).map(t=>({...t,frames:t.frames.map(k=>{if(k.frame<prefix.duration)return k;const frame=k.frame-(start===0?1:0),base=sampleTrack(next.tracks.find(t2=>t2.key===t.key),Math.max(0,start-1));return {...k,frame,rotation:['wave','nod'].includes(e.value)?base.rotation+(k.rotation-base.rotation)*factor:k.rotation};}).filter(k=>k.frame<full)}))],duration:full};
 }
 return next;
}
