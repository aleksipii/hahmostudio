/**
 * Käsikirjoitustunnistimen korpus ja mittari (vain testit ja kehitystyökalu, ei sovelluksen ajonaikaa).
 *
 * Korpuksen muoto (tests/fixtures/script-recognizer/korpus.txt):
 *   === tapauksen nimi
 *   hahmot: Pipsa, Ville          (valinnainen: ennalta tunnetut hahmot)
 *   --- käsikirjoitus
 *   …rivit sellaisenaan…
 *   --- odotus
 *   <rivinumero> <allekirjoitus>   (jokaiselle ei-tyhjälle riville, käsin kirjattu oikea tulkinta)
 *
 * Allekirjoitus on `lineSignature`-muotoinen. Tulos luokitellaan:
 *  - oikein: allekirjoitus täsmää
 *  - tunnistamaton: tunnistin ei väittänyt mitään (rivi `unknown` eikä yhtään tunnistettua lausetta), vaikka odotus on muu
 *  - väärin: tunnistin väitti jotain, mikä ei täsmää odotukseen (myös kun odotus on `unknown`)
 */
import {readFileSync,readdirSync} from 'node:fs';
import {recognizeScript,type RecognizedLine,type Clause} from './script-recognizer.ts';
import {scriptTemplates} from './script-templates.ts';

const clauseSig=(c:Clause):string=>{
 switch(c.type){
  case'motion':return `motion:${c.value}@${c.actor}${c.seconds!==undefined?'~'+c.seconds:''}${c.estimated?'?':''}`;
  case'expression':return `expression:${c.value}@${c.actor}`;
  case'gaze':return `gaze@${c.actor}>${c.target}${c.seconds!==undefined?'~'+c.seconds:''}`;
  case'phone':return `phone:${c.value}@${c.actor}`;
  case'hold':return `hold:${c.value}@${c.actor}${c.seconds!==undefined?'~'+c.seconds:''}`;
  case'constraint':return `constraint:${c.value}@${c.actor}`;
  case'environment':return `environment:${c.value}`;
  case'title-card':return `title-card:${c.value}${c.seconds!==undefined?'~'+c.seconds:''}`;
  case'editing':return `editing:${c.value}`;
  case'unsupported':return `unsupported:${c.label}@${c.actor}`;
  case'note':return 'note';
  case'unknown':return 'unknown';
 }
};
/** Tunnistamattoman rivin tunnistamattomat lauseet eivät tuo allekirjoitukseen tietoa (rivi on jo `unknown`). */
const visibleClauses=(l:RecognizedLine)=>l.kind==='unknown'?l.clauses.filter(c=>c.type!=='unknown'):l.clauses;

/** Rivin tulkinta yhtenä vertailukelpoisena merkkijonona. */
export function lineSignature(l:RecognizedLine):string{
 const parts:string[]=[l.kind];
 if(l.speaker)parts.push('@'+l.speaker);
 if(l.extension)parts.push('('+l.extension+')');
 if(l.dialogue!==undefined)parts.push('«'+l.dialogue+'»');
 if(l.scene)parts.push('scene:'+l.scene.name+(l.scene.place?'/'+l.scene.place:'')+(l.scene.time?'/'+l.scene.time:''));
 if(l.transition)parts.push('transition:'+l.transition);
 if(l.metadata)parts.push('meta:'+l.metadata.key);
 for(const s of l.shot??[])parts.push('shot:'+[s.size,s.move,s.angle].filter(Boolean).join('+')+(s.target?'>'+s.target:''));
 for(const c of visibleClauses(l))parts.push(clauseSig(c));
 return parts.join(' ');
}

/** Tunnistiko tunnistin rivistä mitään (rakenne, puhuja tai vähintään yksi lause)? */
export function claimsSomething(l:RecognizedLine):boolean{
 if(l.kind==='empty')return false;
 if(l.kind!=='unknown')return true;
 return l.clauses.some(c=>c.type!=='unknown')||!!l.shot?.length;
}

export type CorpusCase={name:string;characters:string[];script:string;expected:Map<number,string>;line:number};
export type CorpusVerdict='oikein'|'väärin'|'tunnistamaton';
export type CorpusLineResult={case:string;line:number;text:string;expected:string;actual:string;verdict:CorpusVerdict};

export function parseRecognizerCorpus(text:string):CorpusCase[]{
 const rows=text.replace(/\r\n?/g,'\n').split('\n');
 const cases:CorpusCase[]=[];
 let cur:CorpusCase|undefined,mode:'head'|'script'|'expect'='head',script:string[]=[];
 const close=()=>{if(!cur)return;cur.script=script.join('\n');cases.push(cur);cur=undefined;script=[];};
 rows.forEach((row,i)=>{
  if(row.startsWith('=== ')){close();cur={name:row.slice(4).trim(),characters:[],script:'',expected:new Map(),line:i+1};mode='head';return;}
  if(!cur)return;
  if(row==='--- käsikirjoitus'){mode='script';return;}
  if(row==='--- odotus'){mode='expect';return;}
  if(mode==='head'){const m=row.match(/^hahmot:\s*(.*)$/);if(m)cur.characters=m[1].split(',').map(s=>s.trim()).filter(Boolean);return;}
  if(mode==='script'){script.push(row);return;}
  if(!row.trim()||row.startsWith('#'))return;
  const m=row.match(/^(\d+)\s+(.+)$/);if(!m)throw Error(`Korpus rivi ${i+1}: odotusrivi ilman rivinumeroa: ${row}`);
  cur.expected.set(+m[1],m[2].trim());
 });
 close();
 // Käsikirjoitusosion viimeinen tyhjä rivi ennen "--- odotus" kuuluu muotoon, ei käsikirjoitukseen.
 for(const c of cases)c.script=c.script.replace(/\n+$/,'');
 return cases;
}

export function evaluateRecognizerCorpus(cases:CorpusCase[]):{results:CorpusLineResult[];counts:Record<CorpusVerdict,number>;missingExpectations:string[]}{
 const results:CorpusLineResult[]=[],missing:string[]=[];
 for(const c of cases){
  const r=recognizeScript(c.script,c.characters,{discoverActors:true});
  for(const l of r.lines){
   if(l.kind==='empty'){if(c.expected.has(l.line))missing.push(`${c.name}: rivi ${l.line} on tyhjä mutta sillä on odotus`);continue;}
   const expected=c.expected.get(l.line);
   if(expected===undefined){missing.push(`${c.name}: rivi ${l.line} ilman odotusta: ${l.text}`);continue;}
   const actual=lineSignature(l);
   const verdict:CorpusVerdict=actual===expected?'oikein':claimsSomething(l)?'väärin':'tunnistamaton';
   results.push({case:c.name,line:l.line,text:l.raw,expected,actual,verdict});
  }
 }
 const counts={oikein:0,väärin:0,tunnistamaton:0} as Record<CorpusVerdict,number>;
 for(const r of results)counts[r.verdict]++;
 return {results,counts,missingExpectations:missing};
}

/** Projektin omat käsikirjoitukset sellaisinaan (taaksepäin yhteensopivuuden vertailu). */
export function existingScripts():{name:string;text:string}[]{
 const root=new URL('../',import.meta.url);
 const read=(dir:string,filter:RegExp)=>readdirSync(new URL(dir,root)).filter(f=>filter.test(f)).sort().map(f=>({name:dir+f,text:readFileSync(new URL(dir+f,root),'utf8')}));
 return [
  ...read('public/library/',/\.md$/),
  ...read('lib/test-fixtures/',/\.md$/),
  ...read('tests/fixtures/scripts/',/\.(md|fountain)$/),
  ...read('tests/fixtures/',/^long-.*\.md$/),
  ...scriptTemplates.map(t=>({name:'template:'+t.id,text:t.source})),
 ];
}
/** Jokaisen olemassa olevan käsikirjoituksen jokaisen rivin allekirjoitus. */
export function snapshotExistingScripts():Record<string,string[]>{
 const out:Record<string,string[]>={};
 for(const s of existingScripts()){const r=recognizeScript(s.text,[],{discoverActors:true});out[s.name]=r.lines.map(l=>l.line+' '+lineSignature(l));}
 return out;
}
