/** Äänimerkintöjen malli ja validointi (kevyt moduuli: esitysmalli voi tuoda tämän ilman syklejä). */
import {sfxIds,type SfxId} from './sound-library.ts';
export type SoundCue={id:string;kind:'sfx'|'music';sound:string;event:string;offset:number;gain:number;source:'generated'|'imported';duration?:number;line?:number;auto?:boolean};
const moods=['iloinen','jännittävä','rauhallinen','surullinen'];
/** Poistettuun tapahtumaan ankkuroitu merkintä säilyy (ei hiljaista poistoa) mutta ohitetaan miksauksessa ja näkyy tarkistuksessa. */
export function validateSoundCues(value:unknown,_eventIds?:Set<string>):SoundCue[]{
 if(!Array.isArray(value)||value.length>4000)throw Error('Äänimerkinnät ovat virheelliset.');const ids=new Set<string>();
 for(const c of value as SoundCue[]){if(!c||typeof c.id!=='string'||c.id.length>120||ids.has(c.id)||!['sfx','music'].includes(c.kind)||typeof c.sound!=='string'||c.sound.length>100||typeof c.event!=='string'||c.event.length>200||!Number.isFinite(c.offset)||Math.abs(c.offset)>1200||!Number.isFinite(c.gain)||c.gain<0||c.gain>2||!['generated','imported'].includes(c.source)||(c.duration!==undefined&&(!Number.isFinite(c.duration)||c.duration<=0||c.duration>1200))||(c.line!==undefined&&!Number.isInteger(c.line))||(c.auto!==undefined&&typeof c.auto!=='boolean'))throw Error('Äänimerkintä on virheellinen.');
  if(c.source==='generated'&&(c.kind==='sfx'?!sfxIds.includes(c.sound as SfxId):!moods.includes(c.sound)))throw Error('Tuntematon ohjelmallinen ääni: '+c.sound);if(c.source==='imported'&&!/^[-a-zA-Z0-9_.]{1,100}$/.test(c.sound))throw Error('Tuodun äänen tunniste on virheellinen.');ids.add(c.id);}
 return structuredClone(value as SoundCue[]);
}
