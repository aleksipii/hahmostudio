import test from 'node:test';import assert from 'node:assert/strict';
import {characterSources,libraryReader,referenceProposal,REFERENCE_READY_PACKS} from './character-sources.ts';
import {sha256} from './studio/hash.ts';
import type {Presentation} from './presentation-model.ts';

// Erillinen testidata: kuvitteellinen paketti "Testihahmo", ei kirjaston hahmoja.
const CAST='c'.repeat(64);
const p={characters:['MIRA','NIKO','EERO','OUTO'],bindings:[{speaker:'MIRA',asset:'Testihahmo'},{speaker:'NIKO',asset:'cast-sha256-'+CAST},{speaker:'EERO',asset:'Puuttuva'},{speaker:'OUTO',asset:'../salaisuus'},{speaker:'EI-ROOLISSA',asset:'Testihahmo'}]} as unknown as Presentation;
const bytes=new TextEncoder().encode('testihahmon paketti v1');

test('grafiikan tiivisteet: tuotu hahmo tunnisteesta, kirjastopaketti tavuista, tuntematon jää pois',async()=>{
 const asked:string[]=[];
 const s=await characterSources(p,async pack=>{asked.push(pack);return pack==='Testihahmo'?bytes:undefined;});
 assert.deepEqual(s,{MIRA:await sha256(bytes),NIKO:CAST});
 assert.deepEqual(asked,['Testihahmo','Puuttuva'],'polkua ../ ei lueta, sama paketti luetaan kerran');
 const changed=await characterSources(p,async pack=>pack==='Testihahmo'?new TextEncoder().encode('testihahmon paketti v2'):undefined);
 assert.notEqual(changed.MIRA,s.MIRA,'grafiikan muutos muuttaa tiivisteen');
});

test('ehdotus vain valmiiksi hyväksytyille paketeille; oletuslista on tyhjä',async()=>{
 const s=await characterSources(p,async pack=>pack==='Testihahmo'?bytes:undefined);
 assert.deepEqual(REFERENCE_READY_PACKS,[]);
 assert.equal(referenceProposal(p,'MIRA',s),undefined,'ei ehdotusta ennen hyväksyntää');
 assert.deepEqual(referenceProposal(p,'MIRA',s,['Testihahmo']),{speaker:'MIRA',pack:'Testihahmo',image:'library/Testihahmo.png',sourceSha256:s.MIRA});
 assert.equal(referenceProposal(p,'NIKO',s,['Testihahmo','cast-sha256-'+CAST]),undefined,'tuodulle hahmolle ei ole kirjaston kuvaa');
 assert.equal(referenceProposal(p,'EERO',s,['Puuttuva']),undefined,'ilman tiivistettä ei ehdoteta');
});

test('kirjastolukija käyttää BASE_URL:ia ja palauttaa undefined puuttuvalle',async()=>{
 const urls:string[]=[];
 const read=libraryReader('/repo/',(async(url:string)=>{urls.push(url);return url.endsWith('Testihahmo.hahmo')?new Response(bytes):new Response('',{status:404});}) as typeof fetch);
 assert.deepEqual(await read('Testihahmo'),bytes);assert.equal(await read('Puuttuva'),undefined);
 assert.deepEqual(urls,['/repo/library/Testihahmo.hahmo','/repo/library/Puuttuva.hahmo']);
});
