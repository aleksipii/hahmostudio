/** Both capture devices use the same monotonic performance clock, in milliseconds. */
export function captureFrame(capturedMs:number,startMs:number,fps:number,maxFrame?:number):number|undefined{
 if(![capturedMs,startMs,fps].every(Number.isFinite)||fps<=0)throw Error('Virheellinen tallennuskello.');
 if(maxFrame!==undefined&&(!Number.isInteger(maxFrame)||maxFrame<0))throw Error('Virheellinen tallennusraja.');
 if(capturedMs<startMs)return undefined;
 return Math.min(maxFrame??Number.MAX_SAFE_INTEGER,Math.floor((capturedMs-startMs)*fps/1000));
}
