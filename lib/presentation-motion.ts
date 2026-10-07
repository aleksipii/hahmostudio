import {applyGait,applyGesture,applyLowerBody,gestures,lowerBodyMotions} from './motion-library.ts';
import type {CharacterView} from './character-view.ts';
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
  const count=Math.max(2,Math.min(full-start,Math.round(seconds*a.fps)));if(start>=full)continue;
  const factor=small?.3:p.direction?.profiles.find(v=>v.speaker===speaker)?.intensity??1;
  const gait=e.value.match(/^(walk|run)-(left|right|front)$/);
  // Kuvakulma: liikkeen suunta valitsee profiilin, jos hahmossa on se; muuten nykyinen kuvakulma.
  const current=viewAtFrame(q,next,Math.max(0,start-1)),wanted:CharacterView=gait?(gait[2]==='front'?'front':gait[2] as CharacterView):current,view=q.views?.[wanted]?wanted:current,roles=q.views?.[view]??q.roles;
  const roots=[...new Set(Object.values(q.views??{}).map(m=>m?.root).filter((k):k is string=>!!k&&k!==roles.root))];
  if(q.views&&view!==current)next=switchView(next,q,start,view);
  if(gait)next=applyGait(next,roles,gait[1] as 'walk'|'run',gait[2] as 'left'|'right'|'front',start,count,roots,6,view==='left'||view==='right');
  else if(lowerBodyMotions[e.value]){const m=lowerBodyMotions[e.value];next=applyLowerBody(next,roles,start,count,m.phases.map(ph=>({...ph,knee:ph.knee*Math.max(.5,factor),air:(ph.air??0)*Math.max(.5,factor),arms:(ph.arms??0)*factor})),roots);}
  else if(gestures[e.value])next=applyGesture(next,roles,e.value,start,count,factor);
  // Kävelyn jälkeen hahmo kääntyy takaisin edestä kuvattavaksi, ellei seuraava liike jatka samaan suuntaan.
  if(gait&&q.views&&view!==current&&view!=='front'&&q.views.front){const end=start+count,nextGait=p.events.find(o=>o.target===speaker&&o.kind==='action'&&o.at!==undefined&&Math.abs(o.at*a.fps-end)<2&&o.value===e.value);if(!nextGait&&end<full)next=switchView(next,q,end,'front');}
 }
 return next;
}

/** Kova kuvakulman vaihto ruudussa `frame`: edellinen ruutu lukitaan (hold), jotta kaksi kuvakulmaa ei näy yhtä aikaa. */
export function switchView(a:Animation,q:QuickProfile,frame:number,view:CharacterView):Animation{
 let next=a;for(const [name,map] of Object.entries(q.views??{})){if(!map?.root)continue;const track=next.tracks.find(t=>t.key===map.root);
  if(frame>0)next=putKeyframe(next,map.root,{...sampleTrack(track,frame-1),frame:frame-1,easing:'hold'});
  next=putKeyframe(next,map.root,{...sampleTrack(next.tracks.find(t=>t.key===map.root),frame),frame,easing:'hold',opacity:name===view?1:0});}
 return next;
}
