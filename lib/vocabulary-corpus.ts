/**
 * Sanastokorpus: mitattu kattavuus säännöpohjaiselle tunnistimelle. Jokainen rivi kertoo odotetun tuloksen; “-” tarkoittaa,
 * että lausetta EI saa tulkita (tunnistin ei arvaa). Korpus on tarkoitettu kasvamaan oman käsikirjoituksen löydöillä.
 */
import {buildEpisode,catalogFromNames,type EpisodeLibrary} from './episode-builder.ts';
import {CHARACTER_PACK_OPTIONS} from './speaker-pack-options.ts';

export type CorpusCase={sentence:string;expected:string};
export type CorpusResult={sentence:string;expected:string;actual:string;ok:boolean};
const packs=catalogFromNames(CHARACTER_PACK_OPTIONS);

export function parseCorpus(text:string):CorpusCase[]{
 return text.split(/\r?\n/).filter(l=>l.trim()&&!l.startsWith('#')).map(l=>{const i=l.lastIndexOf(' => ');if(i<0)throw Error('Korpusrivi ilman “ => ”: '+l);return {sentence:l.slice(0,i).trim(),expected:l.slice(i+4).trim()};});
}
/** Lauseen tulkinta tapahtumina: kind:value ('-' jos mitään animoitavaa ei tunnistettu). */
export function interpret(sentence:string,assets:EpisodeLibrary['assets']):string{
 const b=buildEpisode(`Resurssi hahmo MIRA: Pipsa\nResurssi hahmo NIKO: Ville\nINT. STUDIO\nNiko odottaa 0,5 s.\n${sentence}`,{packs,assets});
 const events=b.presentation.events.filter(e=>['action','expression','gaze','prop'].includes(e.kind)&&e.target==='MIRA'&&e.value!=='stop'&&e.value!=='pause');
 return events.length?events.map(e=>`${e.kind}:${e.value}`).join(' + '):'-';
}
export function evaluateCorpus(cases:CorpusCase[],assets:EpisodeLibrary['assets']):{results:CorpusResult[];recognized:number;unsupportedKept:number;total:number}{
 const results=cases.map(c=>{const actual=interpret(c.sentence,assets);return {...c,actual,ok:actual===c.expected};});
 const mappable=results.filter(r=>r.expected!=='-'),unsupported=results.filter(r=>r.expected==='-');
 return {results,recognized:mappable.filter(r=>r.ok).length,unsupportedKept:unsupported.filter(r=>r.ok).length,total:results.length};
}
