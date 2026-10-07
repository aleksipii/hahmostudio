/**
 * Tunnistimen sanaston aukot: lukee käsikirjoitustiedostoja (.md/.txt), ajaa säännöpohjaisen tunnistimen ja listaa
 * tunnistamatta jäävät rivit yleisyysjärjestyksessä (nimet → NIMI, luvut → N). Käyttö:
 *   node --experimental-strip-types scripts/vocabulary-gaps.ts [tiedosto-tai-kansio ...] [--json]
 * Ilman argumentteja luetaan kirjaston esimerkit ja aloituspohjat. Tunnistin ei arvaa: raportti kertoo vain, mitä
 * sääntöjä kannattaa lisätä seuraavaksi omien käsikirjoitusten perusteella.
 */
import {readFileSync,readdirSync,statSync} from 'node:fs';
import {join} from 'node:path';
import {buildEpisode,splitEpisodes,catalogFromNames} from '../lib/episode-builder.ts';
import {CHARACTER_PACK_OPTIONS} from '../lib/speaker-pack-options.ts';
import {episodeTemplates} from '../lib/episode-templates.ts';

const packs=catalogFromNames(CHARACTER_PACK_OPTIONS);
/** Rakentajan oma tunnistus (sama kuin käyttäjän näkemä “Ei tunnistettu” -huomio): hahmopaketteja ei tarvita. */
export function collectGaps(sources:{name:string;text:string}[]){
 const counts=new Map<string,{sentence:string;count:number;files:Set<string>;example:string}>();let lines=0,gaps=0;
 for(const s of sources)for(const part of splitEpisodes(s.text)){
  lines+=part.text.split('\n').filter(l=>l.trim()).length;
  const built=buildEpisode(part.text,{packs,assets:{}},{firstLine:part.firstLine});
  for(const d of built.diagnostics){
   if(d.code!=='unrecognized-line'&&d.code!=='note-line')continue;
   const quoted=d.message.match(/“([^”]*)”\s*$/)?.[1]??d.message;gaps++;
   const key=quoted.replace(/\b\p{Lu}[\p{L}-]*\b/gu,'NIMI').replace(/\d+(?:[.,]\d+)?/g,'N').replace(/\s+/g,' ').trim().toLocaleLowerCase('fi-FI');
   const e=counts.get(key)??{sentence:key,count:0,files:new Set<string>(),example:quoted};e.count++;e.files.add(s.name);counts.set(key,e);
  }
 }
 return {lines,gaps,ranked:[...counts.values()].sort((a,b)=>b.count-a.count||a.sentence.localeCompare(b.sentence,'fi')).map(e=>({sentence:e.sentence,count:e.count,files:e.files.size,example:e.example}))};
}
function walk(path:string):string[]{const st=statSync(path);return st.isDirectory()?readdirSync(path).flatMap(n=>walk(join(path,n))):/\.(md|txt)$/i.test(path)?[path]:[];}
if(process.argv[1]?.endsWith('vocabulary-gaps.ts')){
 const args=process.argv.slice(2).filter(a=>!a.startsWith('--')),sources=args.length?args.flatMap(walk).map(f=>({name:f,text:readFileSync(f,'utf8')})):[...walk('public/library').map(f=>({name:f,text:readFileSync(f,'utf8')})),...episodeTemplates.map(t=>({name:'pohja:'+t.id,text:t.source}))];
 const report=collectGaps(sources);
 if(process.argv.includes('--json'))console.log(JSON.stringify(report,null,2));
 else{console.log(`${report.lines} riviä, ${report.gaps} tunnistamatonta (${(100*report.gaps/Math.max(1,report.lines)).toFixed(1)} %)`);for(const e of report.ranked.slice(0,40))console.log(String(e.count).padStart(3),e.sentence.slice(0,110),'  ←',e.example.slice(0,60));}
}
