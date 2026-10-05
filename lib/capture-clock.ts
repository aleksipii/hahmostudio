/** Both capture devices use the same monotonic performance clock, in milliseconds. */
export function captureFrame(capturedMs:number,startMs:number,fps:number):number|undefined{
 if(![capturedMs,startMs,fps].every(Number.isFinite)||fps<=0)throw Error('Virheellinen tallennuskello.');
 if(capturedMs<startMs)return undefined;
 return Math.floor((capturedMs-startMs)*fps/1000);
}
