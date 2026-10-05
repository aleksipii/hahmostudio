import type {Presentation} from './presentation-model.ts';
import {seconds,type Shot} from './studio/domain.ts';

export type ShotAudioRail={shotId:string;levels:number[];hasDialogue:boolean};

/** Dialogue clip and mouth-key timing per shot without decoding audio blobs. */
export function shotDialogueRail(p:Presentation,shot:Shot,bins=12):ShotAudioRail{
 const t0=seconds(shot.at),t1=t0+seconds(shot.duration),span=Math.max(t1-t0,.001);
 const levels=Array.from({length:bins},()=>0);
 let hasDialogue=false;
 for(const clip of p.audioClips){
  const ev=p.events.find(e=>e.id===clip.dialogue);
  if(!ev||ev.kind!=='dialogue')continue;
  const start=(ev.at??0)+clip.start,end=(ev.at??0)+(clip.end??clip.duration);
  if(end<=t0||start>=t1)continue;
  hasDialogue=true;
  const mid=(Math.max(start,t0)+Math.min(end,t1))/2;
  levels[Math.min(bins-1,Math.floor((mid-t0)/span*bins))]=1;
  for(const m of clip.mouth)if(m.shape!=='rest'){
   const mt=(ev.at??0)+m.time;
   if(mt>=t0&&mt<t1)levels[Math.min(bins-1,Math.floor((mt-t0)/span*bins))]=Math.max(levels[Math.min(bins-1,Math.floor((mt-t0)/span*bins))],.65);
  }
 }
 return {shotId:shot.id,levels,hasDialogue};
}
