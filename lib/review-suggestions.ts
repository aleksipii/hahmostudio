/**
 * Tarkistuksen yhden napin korjausehdotukset. Puhtaasti deterministinen: ehdotus syntyy vain tunnistetusta
 * tarkistusilmoituksesta, näyttää tarkan tekstimuutoksen ja käyttäjä vahvistaa sen. Mitään ei korjata automaattisesti
 * eikä sisältöä keksitä (ei repliikkejä, ei arvattua taustaa jos läheistä vastinetta ei ole).
 */
import {environmentLibrary} from './environment-library.ts';
import {splitEpisodes} from './episode-builder.ts';
import type {Diagnostic,Presentation} from './presentation-model.ts';

export type SuggestionAction='kokoro'|'record';
export type FixSuggestion={id:string;code:string;title:string;detail:string;line?:number;edit?:{text:string;before:string;after:string};action?:SuggestionAction};

function distance(a:string,b:string):number{
 const prev:number[]=Array.from({length:b.length+1},function(_,j){return j;});
 for(let i=1;i<=a.length;i++){let diag=prev[0];prev[0]=i;for(let j=1;j<=b.length;j++){const up=prev[j];prev[j]=Math.min(prev[j]+1,prev[j-1]+1,diag+(a[i-1]===b[j-1]?0:1));diag=up;}}
 return prev[b.length];
}
const norm=(s:string)=>s.toLocaleLowerCase('fi-FI').normalize('NFC').trim();

/** Lähin kirjaston tausta, jos nimi on riittävän lähellä (muuten ei ehdotusta). */
export function nearestEnvironment(value:string):{id:string;name:string}|undefined{
 const v=norm(value);if(v.length<3)return;
 let best:{id:string;name:string;score:number}|undefined;
 for(const env of environmentLibrary){
  const names=[env.name,...env.aliases];
  for(const n of names){
   const k=norm(n),d=distance(v,k),stem=k.length>=4&&(v.startsWith(k.slice(0,Math.max(4,k.length-2)))||k.startsWith(v.slice(0,Math.max(4,v.length-2))))?0.5:d;
   const limit=Math.max(2,Math.floor(Math.max(v.length,k.length)*0.34));
   if(Math.min(d,stem)<=limit&&(!best||Math.min(d,stem)<best.score))best={id:env.id,name:env.name,score:Math.min(d,stem)};
  }
 }
 return best&&{id:best.id,name:best.name};
}

/** Jakson alkurivi koko tekstissä (rivinumerot diagnostiikassa ovat jakson sisäisiä). */
function episodeOffset(text:string,original:string):number|undefined{
 const t=text.replace(/\r\n?/g,'\n'),o=original.replace(/\r\n?/g,'\n'),at=t.indexOf(o);
 if(at<0)return;
 return t.slice(0,at).split('\n').length-1;
}

export function fixSuggestions(model:Presentation,diagnostics:Diagnostic[],text:string,options:{canSynth:boolean}):FixSuggestion[]{
 const out:FixSuggestion[]=[],lines=text.replace(/\r\n?/g,'\n').split('\n'),offset=episodeOffset(text,model.original);
 for(const d of diagnostics){
  if(d.code==='environment-unknown'&&d.event&&offset!==undefined){
   const e=model.events.find(x=>x.id===d.event),line=e&&offset+e.sourceRef.line;
   if(!e||!line)continue;
   const near=nearestEnvironment(e.value),raw=lines[line-1]??'';
   if(!near){out.push({id:'env-'+d.event,code:d.code,line,title:`Taustaa “${e.value}” ei löydy`,detail:'Lähintä kirjaston taustaa ei löytynyt. Valitse tausta itse (esim. keittiö, olohuone, katu, studio).'});continue;}
   const at=norm(raw).indexOf(norm(e.value));
   if(at<0)continue;
   const after=raw.slice(0,at)+near.name.toLocaleLowerCase('fi-FI')+raw.slice(at+e.value.length),next=[...lines];next[line-1]=after;
   out.push({id:'env-'+d.event,code:d.code,line,title:`Vaihda tausta: ${e.value} → ${near.name}`,detail:`Rivi ${line}. Lähin kirjaston tausta on ${near.name}.`,edit:{text:next.join('\n'),before:raw,after}});
  }
  if(d.code==='too-many-characters'&&offset!==undefined&&splitEpisodes(text).length===1){
   const skipped=(d.message.match(/Ohitettu: ([^.]+)\./)?.[1]??'').split(',').map(s=>s.trim()).filter(Boolean);
   const original=model.original.replace(/\r\n?/g,'\n').split('\n');
   const index=original.findIndex(function(l){return skipped.some(function(n){return new RegExp('(^|[^\\p{L}])'+n.replace(/[.*+?^${}()|[\]\\]/gu,'\\$&')+'(?![\\p{L}])','iu').test(l);});});
   if(skipped.length&&index>0){
    const at=offset+index,next=[...lines];next.splice(at,0,'Jakso 2:');
    out.push({id:'split-characters',code:d.code,line:at+1,title:`Jaa jakso kahtia: ${skipped.join(', ')} ${skipped.length>1?'siirtyvät':'siirtyy'} jaksoon 2`,detail:`Lisää otsikon “Jakso 2:” riville ${at+1}. Tarkista, että kumpikin jakso on järkevä ja että ensimmäisessä on enintään neljä hahmoa.`,edit:{text:next.join('\n'),before:lines[at]??'',after:'Jakso 2:\n'+(lines[at]??'')}});
   }
  }
 }
 const missing=model.events.filter(e=>e.kind==='dialogue'&&!model.audioClips.some(a=>a.dialogue===e.id));
 if(missing.length){
  const own=missing.filter(e=>!options.canSynth||!/[a-z]/i.test(e.text??'')||/[äöå]/i.test(e.text??'')).length;
  out.push({id:'voices-record',code:'missing-audio',title:`Äänitä puuttuva ääni (${missing.length} ${missing.length===1?'rivi':'riviä'})`,detail:'Avaa ääninäyttelijän työpiste ensimmäiselle puuttuvalle riville. Oma ääni on aina etusijalla.',action:'record'});
  if(options.canSynth&&own<missing.length)out.push({id:'voices-kokoro',code:'missing-audio',title:`Luo englanninkieliset repliikit Kokorolla (${missing.length-own})`,detail:'Vain Mac-sovellus. Äänet merkitään synteettisiksi eikä omaa tai tuotua ääntä ylikirjoiteta.',action:'kokoro'});
 }
 return out;
}
