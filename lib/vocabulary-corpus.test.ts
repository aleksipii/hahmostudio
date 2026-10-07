import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {readProject} from './project-file.ts';
import {parseCorpus,evaluateCorpus,type CorpusResult} from './vocabulary-corpus.ts';
import type {EpisodeLibrary} from './episode-builder.ts';

const corpus=parseCorpus(readFileSync(new URL('../tests/fixtures/vocabulary-corpus.txt',import.meta.url),'utf8'));
async function assets(){const out:EpisodeLibrary['assets']={};for(const n of ['Pipsa','Ville']){const r=await readProject(new Blob([readFileSync(new URL(`../public/library/${n}.hahmo`,import.meta.url))]));out[n]={doc:r.doc,animation:r.animation};}return out;}

test('sanastokorpus: kaikki tuetut ilmaukset tulkitaan odotetusti ja tuntemattomia ei arvata',async()=>{
 const r=evaluateCorpus(corpus,await assets()),bad=(rows:CorpusResult[])=>rows.filter(x=>!x.ok).map(x=>`${x.sentence} => ${x.expected} (sai ${x.actual})`);
 assert.ok(corpus.length>=120,'korpus on riittävän laaja');
 assert.deepEqual(bad(r.results),[]);
 const mappable=r.results.filter(x=>x.expected!=='-').length;assert.equal(r.recognized,mappable);
 assert.ok(r.results.filter(x=>x.expected==='-').length>=10&&r.unsupportedKept===r.results.filter(x=>x.expected==='-').length,'tunnistamaton pysyy tunnistamattomana');
});
test('korpuksen jäsennys vaatii erottimen',()=>{assert.throws(()=>parseCorpus('virheellinen rivi'),/ => /);assert.deepEqual(parseCorpus('# kommentti\n\nMira nyökkää. => action:nod'),[{sentence:'Mira nyökkää.',expected:'action:nod'}]);});
