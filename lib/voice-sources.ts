/**
 * Repliikkiäänten etusija ja äänityksen tarkistus (tekoäly-paneelin vaihe 5).
 * Yksi sääntö: käyttäjän ääni (oma äänitys tai tuotu tiedosto) voittaa aina synteettisen äänen. Synteettinen ääni
 * merkitään AudioClip.synthetic-kenttään eikä se koskaan korvaa käyttäjän ääntä. Pilvipuhesynteesiä ei ole.
 * Litteroinnin vertailu on pelkkä tarkistus: se ei kirjoita käsikirjoitukseen, ei luo repliikkiä eikä arvaa sanoja.
 */
import {parseSpokenText} from './kokoro.ts';
import type {AudioClip,Presentation} from './presentation-model.ts';

/** user = käyttäjän äänittämä tai tuoma (ei erotella: kumpikin on käyttäjän oma valinta ja voittaa synteettisen). */
export type VoiceSource='user'|'synthetic'|'none';
export const voiceSource=(clip?:AudioClip):VoiceSource=>!clip?'none':clip.synthetic?'synthetic':'user';

/**
 * Saako uusi ääni korvata rivin nykyisen äänen? Palauttaa esteen syyn tai undefined.
 * Synteettinen ei korvaa käyttäjän ääntä eikä lukittua riviä. Käyttäjän ääni saa korvata synteettisen ja oman aiemman
 * (lukitus tarkistetaan erikseen tuonnissa, koska lukittu rivi sallii saman äänen uudelleenkäsittelyn).
 */
export function replaceBlockedBy(previous:AudioClip|undefined,incomingSynthetic:boolean):string|undefined{
 if(!previous||!incomingSynthetic)return;
 if(!previous.synthetic)return 'Rivillä on jo oma äänityksesi tai tuomasi ääni. Synteettinen ääni ei koskaan korvaa sitä.';
 if(previous.locked)return 'Rivin suun ajoitus on lukittu. Avaa lukitus ennen synteettisen äänen vaihtamista.';
}

export type LineVoice={id:string;speaker:string;text:string;source:VoiceSource;locked:boolean};
/** Repliikkien äänitilanne käsikirjoituksen järjestyksessä. */
export function lineVoices(model:Presentation):LineVoice[]{
 const clips=new Map(model.audioClips.map(c=>[c.dialogue,c]));
 return model.events.filter(e=>e.kind==='dialogue').map(e=>{const c=clips.get(e.id);return {id:e.id,speaker:e.target,text:e.text??'',source:voiceSource(c),locked:!!c?.locked};});
}
export function voiceCounts(model:Presentation):Record<VoiceSource,number>{
 const out:Record<VoiceSource,number>={user:0,synthetic:0,none:0};for(const l of lineVoices(model))out[l.source]++;return out;
}

const MAX_WORDS=600;
/** Sanat vertailua varten: pienet kirjaimet, ei välimerkkejä, ei sulkeohjeita eikä litteroijan [MUSIIKKI]-merkintöjä. */
export function comparableWords(text:string):string[]{
 return text.normalize('NFC').replace(/\[[^\]]{0,60}\]|\([^()]{0,60}\)|\*[^*]{0,60}\*/g,' ').toLocaleLowerCase('fi-FI')
  .replace(/[^\p{L}\p{N}'’-]+/gu,' ').replace(/(^|\s)['’-]+|['’-]+(?=\s|$)/g,' ').split(/\s+/).filter(Boolean).slice(0,MAX_WORDS);
}

export type WordDiff={text:string;kind:'same'|'missing'|'extra'};
export type TranscriptCheck={words:WordDiff[];matched:number;missing:number;extra:number;expected:number;matches:boolean};
/**
 * Vertaa repliikin tekstiä (mitä piti sanoa) litteraattiin (mitä malli kuuli) sanatasolla (pisin yhteinen alijono).
 * Puuttuva = repliikissä, ei litteraatissa. Ylimääräinen = litteraatissa, ei repliikissä. Ei korjaa kumpaakaan.
 */
export function compareTranscript(line:string,heard:string):TranscriptCheck{
 const a=comparableWords(parseSpokenText(line).text),b=comparableWords(heard),n=a.length,m=b.length;
 const lcs=Array.from({length:n+1},()=>new Uint16Array(m+1));
 for(let i=n-1;i>=0;i--)for(let j=m-1;j>=0;j--)lcs[i][j]=a[i]===b[j]?lcs[i+1][j+1]+1:Math.max(lcs[i+1][j],lcs[i][j+1]);
 const words:WordDiff[]=[];let i=0,j=0;
 while(i<n||j<m){
  if(i<n&&j<m&&a[i]===b[j]){words.push({text:a[i],kind:'same'});i++;j++;}
  else if(j<m&&(i>=n||lcs[i][j+1]>=lcs[i+1][j])){words.push({text:b[j],kind:'extra'});j++;}
  else{words.push({text:a[i],kind:'missing'});i++;}
 }
 const count=(k:WordDiff['kind'])=>words.filter(w=>w.kind===k).length,missing=count('missing'),extra=count('extra');
 return {words,matched:count('same'),missing,extra,expected:n,matches:n>0&&missing===0&&extra===0};
}

export function checkSummary(c:TranscriptCheck):string{
 if(!c.expected)return 'Repliikissä ei ole puhuttavaa tekstiä vertailtavaksi.';
 if(c.matches)return `Litteraatti vastaa repliikkiä (${c.matched}/${c.expected} sanaa).`;
 return `Eroja: ${c.missing} sanaa puuttuu, ${c.extra} ylimääräistä (${c.matched}/${c.expected} sanaa täsmää).`;
}
