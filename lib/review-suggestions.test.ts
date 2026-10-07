import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {readProject} from './project-file.ts';
import {buildEpisode,splitEpisodes,catalogFromNames,packsNeeded,type EpisodeLibrary} from './episode-builder.ts';
import {CHARACTER_PACK_OPTIONS} from './speaker-pack-options.ts';
import {fixSuggestions,nearestEnvironment} from './review-suggestions.ts';

const packs=catalogFromNames(CHARACTER_PACK_OPTIONS),cache:Record<string,EpisodeLibrary['assets'][string]>={};
async function library(text:string):Promise<EpisodeLibrary>{const assets:EpisodeLibrary['assets']={};for(const n of packsNeeded(text,packs)){if(!cache[n]){const r=await readProject(new Blob([readFileSync(new URL('../public/library/'+n+'.hahmo',import.meta.url))]));cache[n]={doc:r.doc,animation:r.animation} as never;}assets[n]=cache[n];}return {packs,assets};}
const build=async(t:string)=>{const l=await library(t);return buildEpisode(t,l,{fps:24,width:1080,height:1920});};

test('nearestEnvironment suggests only close library matches',()=>{
 assert.equal(nearestEnvironment('keittio')?.name,'Keittiö');
 assert.equal(nearestEnvironment('toimistoo')?.name,'Toimisto');
 assert.equal(nearestEnvironment('avaruusasema'),undefined);
});

test('far-off background gets no guessed replacement',async()=>{
 const text='Tausta: kuutamoranta\nMIRA:\n“Hei.”';const b=await build(text);
 const s=fixSuggestions(b.presentation,b.diagnostics,text,{canSynth:false}).filter(x=>x.code==='environment-unknown');
 assert.ok(s.every(x=>!x.edit));
});

test('unknown background gets an exact, confirmable line replacement',async()=>{
 const text='Tausta: keittioo\n\nMIRA:\n“Hei.”\n';
 const b=await build(text);
 const s=fixSuggestions(b.presentation,b.diagnostics,text,{canSynth:false}).find(x=>x.code==='environment-unknown');
 assert.ok(b.diagnostics.some(d=>d.code==='environment-unknown'));
 assert.ok(s?.edit);assert.match(s.edit.after,/keittiö/i);
 const rebuilt=await build(s.edit.text);
 assert.ok(!rebuilt.diagnostics.some(d=>d.code==='environment-unknown'));
 assert.equal(s.edit.text.split('\n').length,text.split('\n').length);
});

test('missing audio offers record and gated Kokoro actions without editing text',async()=>{
 const text='MIRA:\n“Hello there.”\n\nNIKO:\n“Moi!”\n';
 const b=await build(text);
 const s=fixSuggestions(b.presentation,b.diagnostics,text,{canSynth:true});
 assert.ok(s.some(x=>x.action==='record'&&!x.edit));
 assert.ok(s.some(x=>x.action==='kokoro'));
 assert.ok(!fixSuggestions(b.presentation,b.diagnostics,text,{canSynth:false}).some(x=>x.action==='kokoro'));
});

test('five speakers: split suggestion inserts an episode heading and yields two episodes',async()=>{
 const text='MIRA:\n“Hei.”\n\nNIKO:\n“Moi.”\n\nSALLA:\n“Terve.”\n\nRONI:\n“Hei vaan.”\n\nKILLE:\n“Moro.”\n';
 const b=await build(text);
 assert.ok(b.diagnostics.some(d=>d.code==='too-many-characters'));
 const s=fixSuggestions(b.presentation,b.diagnostics,text,{canSynth:false}).find(x=>x.code==='too-many-characters');
 assert.ok(s?.edit,'split suggestion expected');
 assert.equal(splitEpisodes(s!.edit!.text).length,2);
 assert.equal(s!.edit!.text.replace('Jakso 2:\n',''),text);
});
