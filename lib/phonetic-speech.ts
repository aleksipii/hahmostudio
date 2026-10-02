import {sampleTrack,type Animation,type Keyframe} from './animation-model.ts';
export const mouthShapes=['A','B','C','D','E','F','G','H','X'] as const;
export type MouthShape=typeof mouthShapes[number];
export type MouthCue={start:number;end:number;value:MouthShape};
export type MouthMap=Partial<Record<MouthShape,string>>;
export const mouthLabels:Record<MouthShape,string>={A:'A · huulet kiinni (m, p, b)',B:'B · hampaat lähellä (i, konsonantit)',C:'C · suu puoliksi auki (e)',D:'D · suu täysin auki (a)',E:'E · pyöreä suu (o)',F:'F · huulet eteen (u, y)',G:'G · alahuuli hampaisiin (f, v)',H:'H · kieli ylös (l)',X:'X · lepo'};
export function validateCues(value:unknown):MouthCue[]{if(!Array.isArray(value)||value.length>10000)throw new Error('Äännetunnistuksen vastaus on virheellinen.');let previous=0;return value.map(c=>{if(!c||typeof c.start!=='number'||typeof c.end!=='number'||!Number.isFinite(c.start)||!Number.isFinite(c.end)||c.start<previous||c.end<c.start||c.end>60||!mouthShapes.includes(c.value))throw new Error('Äännetunnistuksen ajoitus on virheellinen.');previous=c.end;return{start:c.start,end:c.end,value:c.value};});}
export function applyMouthCues(animation:Animation,map:MouthMap,cues:MouthCue[]):Animation{
 for(const shape of mouthShapes.slice(0,6))if(!map[shape])throw new Error('Valitse kuusi perussuuta A–F.');
 const required=mouthShapes.slice(0,6).map(s=>map[s]);if(new Set(required).size!==6)throw new Error('Perussuut A–F tarvitsevat eri tasot.');
 const fallback=(shape:MouthShape)=>map[shape]??(shape==='G'?map.B:shape==='H'?map.C:map.A)!;
 const keys=new Set(Object.values(map).filter((k):k is string=>!!k));for(const key of keys)if(!animation.rig.parts.some(p=>p.key===key))throw new Error('Suun tasoa ei löydy.');
 const active:string[]=[],changes=new Set<number>([0]);let index=0;
 for(let frame=0;frame<animation.duration;frame++){const time=frame/animation.fps;while(index<cues.length&&cues[index].end<=time)index++;const cue=cues[index];active[frame]=fallback(cue&&time>=cue.start?cue.value:'X');if(frame&&active[frame]!==active[frame-1])changes.add(frame);}
 const tracks=[...keys].map(key=>{const original=animation.tracks.find(t=>t.key===key);const frames=new Set([...changes,...(original?.frames.map(f=>f.frame)??[])]);return{key,frames:[...frames].sort((a,b)=>a-b).map(frame=>({...sampleTrack(original,frame),frame,easing:'hold',opacity:active[frame]===key?1:0} as Keyframe))};});
 if(tracks.reduce((n,t)=>n+t.frames.length,0)+animation.tracks.filter(t=>!keys.has(t.key)).reduce((n,t)=>n+t.frames.length,0)>10000)throw new Error('Liikaa avainruutuja. Lyhennä animaatiota.');
 return{...animation,tracks:[...animation.tracks.filter(t=>!keys.has(t.key)),...tracks]};
}
export function encodeSpeechWav(channels:Float32Array[],sampleRate:number):Uint8Array{
 if(!channels.length||!Number.isFinite(sampleRate)||sampleRate<=0||channels[0].length/sampleRate>60)throw new Error('Äännetunnistus tukee enintään 60 sekunnin äänitiedostoa.');
 const length=Math.floor(channels[0].length*16000/sampleRate);if(!length)throw new Error('Äänitiedosto on tyhjä.');const output=new Uint8Array(44+length*2),view=new DataView(output.buffer);const text=(offset:number,s:string)=>{for(let i=0;i<s.length;i++)view.setUint8(offset+i,s.charCodeAt(i));};text(0,'RIFF');view.setUint32(4,output.length-8,true);text(8,'WAVE');text(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,16000,true);view.setUint32(28,32000,true);view.setUint16(32,2,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,length*2,true);
 for(let i=0;i<length;i++){const position=i*sampleRate/16000,a=Math.floor(position),t=position-a;let sum=0;for(const channel of channels)sum+=(channel[a]??0)*(1-t)+(channel[a+1]??channel[a]??0)*t;const sample=Math.max(-1,Math.min(1,sum/channels.length));view.setInt16(44+i*2,Math.round(sample*(sample<0?32768:32767)),true);}return output;
}
