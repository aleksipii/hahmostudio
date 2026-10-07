import {sampleTrack,type Animation,type Keyframe} from '../animation-model.ts';

/* ───────────────────────── Lepoelämä ───────────────────────── */

/** Deterministinen näennäissatunnaisluku hahmon nimestä (sama syöte → sama räpäytysrytmi). */
export function seeded(text:string){let h=2166136261;for(const c of text)h=Math.imul(h^c.charCodeAt(0),16777619);let s=h>>>0;return ()=>((s=(Math.imul(s,1103515245)+12345)>>>0)/4294967296);}
export type IdleOptions={speaker:string;rolesAt:(frame:number)=>Record<string,string>;quiet:(frame:number)=>boolean;blinkSeconds?:[number,number];breathSeconds?:number;breathPixels?:number};
/**
 * Lepohengitys (pää nousee ja laskee ~1 px, 3,6 s jakso) ja silmänräpäykset 2,8–4,6 s välein (3 ruutua).
 * Räpäytys ohitetaan, jos silmäluomella on jo avain lähellä (ilme, pokerinaama) tai `quiet` kieltää (liikkumiskielto).
 */
export function applyIdleLife(a:Animation,o:IdleOptions):Animation{
 const rnd=seeded(o.speaker),[minGap,maxGap]=o.blinkSeconds??[2.8,4.6],breath=o.breathSeconds??3.6,amp=o.breathPixels??.9;let next=a;
 const touched=(key:string,from:number,to:number)=>next.tracks.find(t=>t.key===key)?.frames.some(k=>k.frame>=from&&k.frame<=to&&!(k.frame===0));
 for(let t=1.2+rnd()*1.6;t*a.fps<a.duration-4;t+=minGap+rnd()*(maxGap-minGap)){
  const f=Math.round(t*a.fps);if(o.quiet(f))continue;const roles=o.rolesAt(f),keys=[roles.leftBlink,roles.rightBlink].filter((k):k is string=>!!k);
  if(!keys.length||keys.some(k=>touched(k,f-3,f+6)))continue;
  for(const key of keys){const base=sampleTrack(next.tracks.find(x=>x.key===key),f);if(base.opacity>.5)continue;next=writeKeys(next,key,[{...base,frame:f,easing:'hold',opacity:1},{...base,frame:f+3,easing:'hold',opacity:0}]);}
 }
 // Hengitys: pään y-värähtely lisätään olemassa olevan liikkeen päälle (ei korvaa sitä).
 const headKeys=new Set<string>();for(let f=0;f<a.duration;f++){const k=o.rolesAt(f).head;if(k)headKeys.add(k);}
 for(const key of headKeys){const track=next.tracks.find(t=>t.key===key),frames:Keyframe[]=[];
  for(let f=0;f<a.duration;f++){const roles=o.rolesAt(f);if(roles.head!==key)continue;const p=sampleTrack(track,f),q=o.quiet(f)?0:amp*Math.sin(2*Math.PI*f/(breath*a.fps));frames.push({...p,y:p.y+q,frame:f,easing:'linear'});}
  next=writeKeys(next,key,frames);}
 return next;
}
export function writeKeys(a:Animation,key:string,frames:Keyframe[]):Animation{if(!frames.length)return a;const set=new Set(frames.map(k=>k.frame)),old=a.tracks.find(t=>t.key===key)?.frames??[];return {...a,tracks:[...a.tracks.filter(t=>t.key!==key),{key,frames:[...old.filter(k=>!set.has(k.frame)),...frames].sort((x,y)=>x.frame-y.frame)}]};}
