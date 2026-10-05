/** Convert the shared document playhead to a scene's local time without editing it. */
export function sceneFrame(frame:number,start=0){return Math.max(0,Math.round(frame)-start);}
export function documentFrame(frame:number,start=0){return Math.max(0,Math.round(frame))+start;}
