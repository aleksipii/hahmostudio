/**
 * Ääniraita (vaihe E): repliikit, tehosteet ja musiikki omina väylinään.
 *
 * Äänimerkintä (`SoundCue`) ankkuroidaan esitystapahtumaan (`event` + `offset`), joten se siirtyy ajoituksen mukana.
 * Askeleet sijoitetaan animaation todellisiin maakosketuksiin, istuutuminen ja laskeutuminen liikkeen vaiheisiin.
 * Musiikki hiljenee repliikkien alle (ducking). Repliikkiäänet ovat aina käyttäjän tuomia tai äänittämiä.
 */
import {synthSfx,synthMusic,sfxIds,SOUND_RATE,type SfxId,type MusicMood} from './sound-library.ts';
import {footPoint} from './motion-quality.ts';
import type {Presentation,Event,Diagnostic} from './presentation-model.ts';
import type {PresentationAssets} from './presentation-compile.ts';
import {cleanLine} from './script-recognizer.ts';

export {validateSoundCues,type SoundCue} from './sound-cues.ts';
import type {SoundCue} from './sound-cues.ts';
export function cueTime(p:Presentation,c:SoundCue){const e=p.events.find(x=>x.id===c.event);return e?Math.max(0,(e.at??0)+c.offset):undefined;}

/* ───────────────────────── Käsikirjoituksen ääniohjeet ───────────────────────── */

const sfxWords:[RegExp,SfxId][]=[[/\b(soi|soivat|soittaa|soitti|ringtone|rings|ringing)\b/iu,'soitto'],[/\b(värisee|värisi|värinä|vibrates|buzzes|vibration)\b/iu,'varina'],[/\b(koputtaa|koputti|koputus|knocks?|knocking)\b/iu,'koputus'],[/\b(ovi|oven|ovea|door)\b/iu,'ovi'],[/\b(napauttaa|napautus|click|tap)\b/iu,'napautus'],[/\b(suhahdus|whoosh|swoosh|suhahtaa)\b/iu,'whoosh'],[/\b(askel|askelia|askeleet|footsteps?)\b/iu,'askel'],[/\b(istuutuminen|tömähdys|thud)\b/iu,'istuutuminen']];
/** “Ääni: ovi”, “Äänitehoste: koputus”, “SFX: door”, “Puhelin soi.”, “Ovi paukahtaa kiinni.” → tehoste. */
export function sfxInstruction(text:string):SfxId|undefined{
 const t=cleanLine(text),label=t.match(/^(?:Ääni|Äänitehoste|Tehoste|SFX|Sound(?: effect)?)\s*:\s*(.+)$/i);
 if(label){const body=label[1];return sfxIds.find(id=>new RegExp('^'+id+'$','i').test(body.trim()))??sfxWords.find(([re])=>re.test(body))?.[1];}
 if(/\b(puhelin|kännykkä|phone)\b/iu.test(t)){if(/\b(soi|rings|ringing)\b/iu.test(t))return 'soitto';if(/\b(värisee|vibrates|buzzes)\b/iu.test(t))return 'varina';}
 if(/\b(ovi|door)\b/iu.test(t)&&/\b(aukeaa|avautuu|sulkeutuu|paukahtaa|narahtaa|opens|closes|slams|creaks)\b/iu.test(t))return 'ovi';
 if(/\b(koputtaa|koputus|knocks?)\b/iu.test(t))return 'koputus';
 return undefined;
}

/* ───────────────────────── Automaattiset tehosteet ───────────────────────── */

/** Maakosketukset: ruudut, joissa jalkaterä laskeutuu maahan (tukivaiheen alku). */
export function footContacts(doc:Parameters<typeof footPoint>[0],a:Parameters<typeof footPoint>[1],from:number,to:number):number[]{
 const out:number[]=[];
 for(const side of ['left','right'] as const){const ys:number[]=[];for(let f=from;f<=to;f++)ys.push(footPoint(doc,a,f,side)?.y??0);const floor=Math.max(...ys);let lifted=false;
  for(let i=0;i<ys.length;i++){const h=floor-ys[i];if(h>2)lifted=true;else if(lifted&&h<.5){out.push(from+i);lifted=false;}}}
 return out.sort((x,y)=>x-y);
}
/** Tapahtumista johdetut tehosteet: askeleet, istuutuminen, laskeutuminen, napautus, puhelimen lasku, hämmästys. */
export function autoSoundCues(p:Presentation,assets:PresentationAssets,fps:number):SoundCue[]{
 const out:SoundCue[]=[];let n=0;const add=(e:Event,sound:SfxId,offset:number,gain=.8)=>out.push({id:'sfx-'+e.id+'-'+(n++),kind:'sfx',sound,event:e.id,offset:Math.max(0,offset),gain,source:'generated',auto:true});
 for(const e of p.events){if(e.kind!=='action')continue;const b=p.bindings.find(x=>x.speaker===e.target),asset=b?assets[b.asset]:undefined,a=p.actorAnimations?.[e.target];const start=Math.round((e.at??0)*fps),end=start+Math.round((e.duration??0)*fps);
  if(/^(walk|run)-/.test(e.value)&&asset&&a){for(const f of footContacts(asset.doc,a,start,Math.min(a.duration-1,end)))add(e,'askel',(f-start)/fps,e.value.startsWith('run')?.9:.65);}
  else if(e.value==='sit')add(e,'istuutuminen',(e.duration??1.8)*.6);
  else if(e.value==='jump'){add(e,'whoosh',(e.duration??1.8)*.24,.4);add(e,'askel',(e.duration??1.8)*.62,.9);}
  else if(e.value==='react-surprise')add(e,'whoosh',(e.duration??1.2)*.14,.35);
  else if(e.value==='phone_tap')add(e,'napautus',(e.duration??.8)*.8,.7);
  else if(e.value==='phone_down')add(e,'napautus',e.duration??.8,.6);
 }
 return out;
}
/** Musiikkiohjeet (`Musiikki: rauhallinen`) ankkuroidaan rivin jälkeiseen ensimmäiseen tapahtumaan; `pois` lopettaa. */
export function musicCues(p:Presentation,music:{line:number;mood?:string;file?:string;off?:boolean}[]):{cues:SoundCue[];diagnostics:Diagnostic[]}{
 const cues:SoundCue[]=[],diagnostics:Diagnostic[]=[],ordered=[...p.events].sort((a,b)=>a.sourceRef.line-b.sourceRef.line);
 for(const m of music){const anchor=ordered.find(e=>e.sourceRef.line>m.line)??ordered.at(-1);if(!anchor)continue;
  if(m.off){cues.push({id:'music-off-'+m.line,kind:'music',sound:'pois',event:anchor.id,offset:0,gain:0,source:'generated',line:m.line});continue;}
  if(m.file){const key=m.file.replace(/[^-a-zA-Z0-9_.]/g,'_').slice(0,100);cues.push({id:'music-'+m.line,kind:'music',sound:key,event:anchor.id,offset:0,gain:.55,source:'imported',line:m.line});diagnostics.push({code:'music-import',severity:'warning',message:`Rivi ${m.line}: tuo musiikkitiedosto ${m.file} (tunniste ${key}) ääniin, muuten kohta on hiljainen.`});continue;}
  if(m.mood)cues.push({id:'music-'+m.line,kind:'music',sound:m.mood,event:anchor.id,offset:0,gain:.5,source:'generated',line:m.line});}
 return {cues:cues.filter(c=>c.sound!=='pois'||cues.some(x=>x!==c)),diagnostics};
}

/* ───────────────────────── Miksaus ───────────────────────── */

export type DuckOptions={level:number;attack:number;release:number};
export const defaultDuck:DuckOptions={level:.3,attack:.15,release:.4};
/** Musiikin vahvistuskerroin ajan funktiona: 1 tauoilla, `level` repliikkien aikana, pehmeät reunat. */
export function duckEnvelope(ranges:[number,number][],length:number,rate=SOUND_RATE,o:DuckOptions=defaultDuck):Float32Array{
 const g=new Float32Array(length).fill(1);
 for(const [s,e] of ranges){const a=Math.round((s-o.attack)*rate),b=Math.round(s*rate),c=Math.round(e*rate),d=Math.round((e+o.release)*rate);
  for(let i=Math.max(0,a);i<Math.min(length,d);i++){const k=i<b?(i-a)/Math.max(1,b-a):i<c?1:1-(i-c)/Math.max(1,d-c),smooth=k*k*(3-2*k),v=1-(1-o.level)*smooth;if(v<g[i])g[i]=v;}}
 return g;
}
export type SoundtrackStems={mix:Float32Array;dialogue:Float32Array;sfx:Float32Array;music:Float32Array;duck:Float32Array};
/**
 * Miksaa repliikit (valmis PCM), tehosteet ja musiikin. `offset`: jakson alku sekunteina koko kohtauksen aikajanalla.
 * `imported`: tuodut musiikkitiedostot purettuna mono-PCM:ksi (48 kHz). Pehmeä rajoitin estää säröytymisen.
 */
export function renderSoundtrack(p:Presentation,dialogue:Float32Array,offset=0,imported:Record<string,Float32Array>={},rate=SOUND_RATE):SoundtrackStems{
 const length=dialogue.length,sfx=new Float32Array(length),music=new Float32Array(length),cues=p.soundCues??[];const at=(s:number)=>Math.round((offset+s)*rate);
 let variant=0;for(const c of cues.filter(c=>c.kind==='sfx')){const t=cueTime(p,c);if(t===undefined)continue;const pcm=c.source==='generated'?synthSfx(c.sound as SfxId,variant++,rate):imported[c.sound];if(!pcm)continue;const i0=at(t);for(let i=0;i<pcm.length&&i0+i<length;i++)if(i0+i>=0)sfx[i0+i]+=pcm[i]*c.gain;}
 const music_=cues.filter(c=>c.kind==='music').map(c=>({c,t:cueTime(p,c)})).filter((x):x is {c:SoundCue;t:number}=>x.t!==undefined).sort((a,b)=>a.t-b.t);
 music_.forEach(({c,t},k)=>{if(c.sound==='pois')return;const end=k+1<music_.length?music_[k+1].t:p.seconds,seconds=c.duration??Math.max(.1,end-t);const pcm=c.source==='generated'?synthMusic(c.sound as MusicMood,seconds,k+1,rate):imported[c.sound];if(!pcm||!pcm.length)return;const i0=at(t),count=Math.round(seconds*rate);for(let i=0;i<count&&i0+i<length;i++)if(i0+i>=0)music[i0+i]+=pcm[i%pcm.length]*c.gain;});
 const ranges:[number,number][]=p.events.filter(e=>e.kind==='dialogue').map(e=>[offset+(e.at??0),offset+(e.at??0)+(e.duration??0)]);
 const duck=duckEnvelope(ranges,length,rate),mix=new Float32Array(length);
 for(let i=0;i<length;i++){const v=dialogue[i]+sfx[i]*.8+music[i]*duck[i];mix[i]=Math.abs(v)<.9?v:Math.sign(v)*(.9+.1*Math.tanh((Math.abs(v)-.9)/.1));}
 return {mix,dialogue,sfx,music,duck};
}
