import {buildScreenplay} from './screenplay.ts';
import {neutral,putKeyframe,sampleTrack,type Animation} from './animation-model.ts';
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
  const channels=(value:string)=>value==='nod'||value.startsWith('react-nod')||value==='react-surprise'?['head']:value==='wave'||value==='react-wave'||value==='point'||value==='fist'?['arms']:value==='sit'?['root','legs']:['root','arms','legs'];
  const overlap=p.events.find(other=>other.id!==e.id&&other.target===speaker&&other.kind==='action'&&productionMotions.includes(other.value as any)&&other.value!=='stop'&&channels(e.value).some(c=>channels(other.value).includes(c))&&other.at!<e.at!+seconds&&other.at!+other.duration!>e.at!);if(overlap)throw Error('Kaksi vartaloliikettä osuu päällekkäin: rivit '+e.sourceRef.line+' ja '+overlap.sourceRef.line+'.');
  const small=p.direction?.noLargeGestures||p.events.some(c=>c.kind==='constraint'&&c.value==='small-gestures'&&[speaker,'scene'].includes(c.target)&&c.at!<=e.at!);
  if(small&&['jump','run-left','run-right','run-front'].includes(e.value))throw Error('Suuren liikkeen kielto on ristiriidassa hypyn tai juoksun kanssa. Muuta ohjetta tai valitse kävely/nyökkäys.');
  const view=viewAtFrame(q,next,Math.max(0,start-1)),roles=q.views?.[view]??q.roles,profile={...q,roles};
  if(e.value==='fist'){
   const end=Math.min(full-1,Math.round(((e.at??0)+seconds)*a.fps)),count=Math.max(2,end-start);
   for(let i=0;i<=count;i++){
    const t=i/count,frame=start+i,envelope=Math.sin(Math.PI*t)**2;
    for(const role of ['leftArm','leftForearm'] as const){const key=roles[role];if(key)next=putKeyframe(next,key,{...sampleTrack(next.tracks.find(x=>x.key===key),Math.max(0,start-1)),rotation:sampleTrack(next.tracks.find(x=>x.key===key),Math.max(0,start-1)).rotation-(role==='leftArm'?55:20)*envelope,frame,easing:'linear'});}
   }
   continue;
  }
  if(e.value==='sit'){
   const end=Math.min(full-1,Math.round(((e.at??0)+seconds)*a.fps)),count=Math.max(2,end-start);
   for(let i=0;i<=count;i++){
    const t=i/count,frame=start+i,envelope=Math.sin(Math.PI*t)**2,rootKey=roles.root;
    if(rootKey){const baseY=sampleTrack(next.tracks.find(x=>x.key===rootKey),Math.max(0,start-1)).y;next=putKeyframe(next,rootKey,{...sampleTrack(next.tracks.find(x=>x.key===rootKey),Math.max(0,start-1)),y:baseY+a.rig.source.height*.04*envelope,frame,easing:'linear'});}
    for(const side of ['left','right'] as const){for(const part of [side+'Thigh',side+'Shin'] as const){const key=roles[part];if(key)next=putKeyframe(next,key,{...sampleTrack(next.tracks.find(x=>x.key===key),Math.max(0,start-1)),rotation:sampleTrack(next.tracks.find(x=>x.key===key),Math.max(0,start-1)).rotation-(part.includes('Thigh')?45:35)*envelope,frame,easing:'linear'});}}
   }
   continue;
  }
  if(e.value==='point'){
   const end=Math.min(full-1,Math.round(((e.at??0)+seconds)*a.fps)),count=Math.max(2,end-start);
   for(let i=0;i<=count;i++){
    const t=i/count,frame=start+i,envelope=Math.sin(Math.PI*t)**2;
    const arm=roles.leftArm,fore=roles.leftForearm;
    if(arm)next=putKeyframe(next,arm,{...sampleTrack(next.tracks.find(x=>x.key===arm),Math.max(0,start-1)),rotation:sampleTrack(next.tracks.find(x=>x.key===arm),Math.max(0,start-1)).rotation-65*envelope,frame,easing:'linear'});
    if(fore)next=putKeyframe(next,fore,{...sampleTrack(next.tracks.find(x=>x.key===fore),Math.max(0,start-1)),rotation:sampleTrack(next.tracks.find(x=>x.key===fore),Math.max(0,start-1)).rotation-25*envelope,frame,easing:'linear'});
   }
   continue;
  }
  const prefix={...next,duration:Math.max(1,start),tracks:next.tracks.map(t=>({...t,frames:t.frames.filter(k=>k.frame<Math.max(1,start))}))};
  const text='['+e.value.replace(/^react-nod$/,'nyökkää').replace(/^react-wave$/,'vilkuta').replace(/^react-surprise$/,'nyökkää').replace('walk','kävele').replace('run','juokse').replace('-left',' vasemmalle').replace('-right',' oikealle').replace('-front',' suoraan').replace('wave','vilkuta').replace('jump','hyppää').replace('crouch','kyykisty').replace('nod','nyökkää')+' '+seconds+'s]';
  const result=buildScreenplay(prefix,profile,{width:p.world.width,height:p.world.height,background:p.world.background,guides:false,x:0,y:0,scale:1},{text,beats:[],warnings:[],seconds});
  const factor=small?.3:p.direction?.profiles.find(v=>v.speaker===speaker)?.intensity??1;
  const motionKeys=new Set(result.animation.tracks.filter(t=>t.frames.some(k=>k.frame>=prefix.duration)).map(t=>t.key));
  next={...next,tracks:[...next.tracks.filter(t=>!motionKeys.has(t.key)),...result.animation.tracks.filter(t=>motionKeys.has(t.key)).map(t=>({...t,frames:t.frames.map(k=>{if(k.frame<prefix.duration)return k;const frame=k.frame-(start===0?1:0),base=sampleTrack(next.tracks.find(t2=>t2.key===t.key),Math.max(0,start-1));return {...k,frame,rotation:['wave','nod'].includes(e.value)?base.rotation+(k.rotation-base.rotation)*factor:k.rotation};}).filter(k=>k.frame<full)}))],duration:full};
 }
 return next;
}
