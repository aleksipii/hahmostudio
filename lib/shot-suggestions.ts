/**
 * Kuvakohtaiset kuvaehdotukset (tekoäly-paneelin vaihe 4). Deterministinen ja konservatiivinen: ehdotus syntyy vain
 * tunnistetusta tilanteesta, käyttää vain käsikirjoitussyntaksia, jonka tunnistin jo ymmärtää (`LÄHIKUVA NIMI`,
 * `PUOLIKUVA NIMI`, `LAAJA KUVA`, sama kuin palikkaeditorin `blockSentence`), ja näytetään tarkkana rivimuutoksena.
 * Mitään ei muuteta ilman käyttäjän vahvistusta; käyttöönotto kulkee käsikirjoituksen tavallista, kumottavaa polkua.
 * Ehdotus tarkistetaan tunnistimella ennen näyttämistä: jos lisätty rivi ei lue takaisin täsmälleen samaksi kuvaksi,
 * ehdotusta ei näytetä. Presentation pysyy auktoriteettina; ehdotus ei keksi hahmoja, repliikkejä eikä tapahtumia.
 */
import {blockSentence} from './blocks.ts';
import {recognizeScript} from './script-recognizer.ts';
import type {Event,Presentation} from './presentation-model.ts';
import type {FixSuggestion} from './review-suggestions.ts';
import {adaptPresentation,studioMetadata} from './studio/domain.ts';

/** Tunnereaktiot, joille lähikuva on vakiintunut ratkaisu. Iloa ja hämmennystä ei ehdoteta (ei tarvetta arvata). */
const EMOTION=new Set(['sad','scared','angry','worried','mildly_hurt','dead_stare']);
const EMOTION_FI:Record<string,string>={sad:'surullinen',scared:'peloissaan',angry:'vihainen',worried:'huolestunut',mildly_hurt:'loukkaantunut',dead_stare:'ilmeetön tuijotus'};
type Shot={id:string;value:string;target:string};

const split=(t:string)=>t.replace(/\r\n?/g,'\n').split('\n');
function episodeOffset(text:string,original:string):number|undefined{const t=text.replace(/\r\n?/g,'\n'),o=original.replace(/\r\n?/g,'\n'),at=t.indexOf(o);if(at<0)return;return t.slice(0,at).split('\n').length-1;}
const shotLine=(s:{value:string;target:string})=>blockSentence({kind:'kamera',lane:'kamera',value:s.value,params:{target:s.target}});
const isExplicit=(e:Event)=>e.kind==='shot'&&e.basis!=='estimate'&&!e.id.startsWith('shot-');
const samalla=(line:string|undefined)=>/^\s*samalla\b/i.test(line??'');

/** Tarkistaa, että lisätty rivi luetaan takaisin täsmälleen odotetuksi kuvaksi (blockSentence ↔ tunnistin). */
function readsBack(text:string,line:number,s:{value:string;target:string}):boolean{
 const r=recognizeScript(text,[],{discoverActors:true}).lines[line-1];
 const shot=r?.kind==='shot'?r.shot?.[0]:undefined;if(!shot)return false;
 if(s.value==='wide'||s.target==='scene')return shot.size==='wide';
 return shot.size===s.value&&(shot.target??'').toLocaleUpperCase('fi-FI')===s.target.toLocaleUpperCase('fi-FI');
}

export function shotSuggestions(model:Presentation,text:string,options:{locked?:Set<string>}={}):FixSuggestion[]{
 // Käsikirjoitus ilman yhtään omaa kuvaohjetta käyttää automaattisia arvioituja kuvia; yksikin lisätty kuvarivi
 // poistaisi ne kaikki. Siksi ehdotuksia tehdään vain, kun käyttäjä on jo kirjoittanut kuvaohjeita.
 if(!model.events.some(isExplicit))return [];
 const offset=episodeOffset(text,model.original);if(offset===undefined)return [];
 const lines=split(text),out:FixSuggestion[]=[],used=new Set<number>();
 const recognized=recognizeScript(text,[],{discoverActors:true}).lines;
 const names=new Set(model.characters.map(c=>c.toLocaleUpperCase('fi-FI')));
 let current:Shot|undefined;
 for(const e of model.events){
  if(e.kind==='shot'){current={id:e.id,value:e.value,target:e.target};continue;}
  const emotion=e.kind==='expression'&&EMOTION.has(e.value),camera=e.kind==='gaze'&&e.value==='camera';
  if(!emotion&&!camera||!current||e.locked||e.protected)continue;
  const who=e.target.toLocaleUpperCase('fi-FI');if(!names.has(who))continue;
  if(current.value==='close'&&current.target.toLocaleUpperCase('fi-FI')===who)continue;
  if(options.locked?.has(current.id))continue;
  // Lisäyskohta: tapahtuman rivi, siirrettynä puhujarivin yläpuolelle, jos tapahtuma on repliikin sisällä.
  let at=offset+e.sourceRef.line;while(at>1&&recognized[at-2]?.kind==='cue')at--;
  if(used.has(at)||samalla(lines[at-1]))continue;
  // Palautuskohta: rivin ja sen repliikkijatkon jälkeen, ellei seuraava rivi ole jo kuvaohje tai jakso lopu.
  let end=offset+e.sourceRef.line;while(['dialogue','parenthetical'].includes(recognized[end]?.kind??''))end++;
  let next=end;while(next<lines.length&&!lines[next].trim())next++;
  const nextKind=recognized[next]?.kind,restore=next<lines.length&&!['shot','transition'].includes(nextKind??'')&&lines.slice(next).some(l=>l.trim());
  if(restore&&samalla(lines[next]))continue;
  const close={value:'close',target:who},closeText=shotLine(close),back=shotLine(current);
  const edited=[...lines];if(restore)edited.splice(end,0,back);edited.splice(at-1,0,closeText);
  const newText=edited.join('\n');
  if(!readsBack(newText,at,close)||restore&&!readsBack(newText,end+2,current))continue;
  used.add(at);
  const label=e.target.charAt(0)+e.target.slice(1).toLocaleLowerCase('fi-FI');
  out.push({id:'shot-'+e.id,code:'shot-suggestion',line:at,
   title:`Kuvaehdotus: lähikuva ${label} (${emotion?EMOTION_FI[e.value]:'katse kameraan'})`,
   detail:`Rivi ${at}: lisää “${closeText}” ennen riviä${restore?` ja palauta “${back}” sen jälkeen`:''}. Nykyinen kuva on “${back}”. Ehdotus on sääntöpohjainen, ei pakollinen; Kumoa palauttaa edellisen.`,
   edit:{text:newText,before:lines[at-1]??'',after:closeText+'\n'+(lines[at-1]??'')+(restore?'\n…\n'+back:'')}});
 }
 return out;
}

/** Tuotantonäkymässä lukittujen kuvien lähdetapahtumat: niiden aikana ei ehdoteta muutosta. */
export function lockedShotEvents(model:Presentation):Set<string>{
 const studio=studioMetadata(model),out=new Set<string>();
 for(const s of adaptPresentation(model).shots)if(studio.shots[s.id]?.status==='locked'&&s.sourceEventId)out.add(s.sourceEventId);
 return out;
}
