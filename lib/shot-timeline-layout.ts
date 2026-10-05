import {seconds,type Shot} from './studio/domain.ts';

export type ShotSegment={index:number;id:string;left:number;width:number;duration:number;startTime:number};

export const SHOT_TIMELINE_GAP=4;
export const SHOT_TIMELINE_PX_PER_SECOND=48;

/** Horizontal layout: segment width scales with shot duration (not fixed px per card). */
export function shotTimelineSegments(shots:Shot[],pxPerSecond=SHOT_TIMELINE_PX_PER_SECOND,gap=SHOT_TIMELINE_GAP):{segments:ShotSegment[];trackWidth:number}{
 let left=0;
 const segments=shots.map((shot,i)=>{
  const duration=seconds(shot.duration);
  const width=Math.max(6,duration*pxPerSecond);
  const seg:ShotSegment={index:i,id:shot.id,left,width,duration,startTime:seconds(shot.at)};
  left+=width+gap;
  return seg;
 });
 return {segments,trackWidth:Math.max(left>0?left-gap:0,1)};
}

export function shotTimelinePlayhead(segments:ShotSegment[],totalSeconds:number,t:number){
 if(!segments.length||!Number.isFinite(t)||t<=0)return 0;
 if(t>=totalSeconds)return segments.at(-1)!.left+segments.at(-1)!.width;
 for(const seg of segments){
  const end=seg.startTime+seg.duration;
  if(t>=seg.startTime&&t<end)return seg.left+((t-seg.startTime)/seg.duration)*seg.width;
  if(t<seg.startTime)return seg.left;
 }
 return segments.at(-1)!.left+segments.at(-1)!.width;
}

/** Virtualize variable-width segments for horizontal scroll. */
export function visibleShotSegments(segments:ShotSegment[],scrollLeft:number,viewportWidth:number,padding=120){
 if(!segments.length||viewportWidth<=0)return [] as ShotSegment[];
 const min=scrollLeft-padding,max=scrollLeft+viewportWidth+padding;
 return segments.filter(s=>s.left+s.width>=min&&s.left<=max);
}
