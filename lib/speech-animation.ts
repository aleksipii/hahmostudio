import {neutral,type Animation,type Keyframe} from './animation-model.ts';
export function speechFrames(samples:Float32Array,sampleRate:number,fps:number,duration:number):boolean[]{
 if(sampleRate<=0||fps<1||duration<2)throw new Error('Puheen analyysin asetukset ovat virheelliset.');
 const rms=Array.from({length:duration},(_,frame)=>{const start=Math.floor(frame/fps*sampleRate),end=Math.min(samples.length,Math.floor((frame+1)/fps*sampleRate));if(start>=end)return 0;let sum=0;for(let i=start;i<end;i++)sum+=samples[i]*samples[i];return Math.sqrt(sum/(end-start));});
 const peak=Math.max(...rms),threshold=Math.max(.008,peak*.16);return rms.map(v=>v>threshold);
}
export function applySpeech(animation:Animation,closed:string,open:string,activity:boolean[]):Animation{
 if(closed===open||![closed,open].every(key=>animation.rig.parts.some(p=>p.key===key)))throw new Error('Valitse kaksi eri suutasoa.');
 const track=(key:string,inverse:boolean)=>{const frames:Keyframe[]=[];let previous:boolean|undefined;for(let i=0;i<animation.duration;i++){const visible=inverse?!activity[i]:!!activity[i];if(visible!==previous||i===animation.duration-1){frames.push({...neutral,opacity:visible?1:0,frame:i,easing:'hold'});previous=visible;}}return {key,frames};};
 return {...animation,tracks:[...animation.tracks.filter(t=>t.key!==closed&&t.key!==open),track(closed,true),track(open,false)]};
}
