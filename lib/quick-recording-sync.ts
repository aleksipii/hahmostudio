import {captureFrame} from './capture-clock.ts';

/** Wall-clock tick converted to the current take frame index (rounded, capped). */
export function performanceTakeFrame(nowMs:number,startSec:number,fps:number,maxFrame:number):number{
 return Math.min(maxFrame,Math.round((nowMs/1000-startSec)*fps));
}

/** Camera channels use acquisition ms (with optional offset already applied); other channels use the live tick frame. */
export function keyframeRecordFrame(sampleMs:number|undefined,timelineFrame:number,startMs:number,fps:number,maxFrame:number):number|undefined{
 if(sampleMs===undefined)return timelineFrame<=maxFrame?timelineFrame:maxFrame;
 return captureFrame(sampleMs,startMs,fps,maxFrame);
}
