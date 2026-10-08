import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {STUDIO_APP_VERSION} from './studio/app-version.ts';
import {isHardCameraCutSource} from './presentation-camera-cut.ts';
import {characterProvenance} from './character-provenance.ts';
import {parsePresentation} from './presentation-parser.ts';
import {inspectRenderSnapshot} from './studio/render-contract.ts';
import {readProject,saveProject} from './project-file.ts';
import {unzipSync,strFromU8} from 'fflate';
import type {PsdDocument} from './psd-model.ts';
import type {QuickProfile} from './quick-animation.ts';

test('STUDIO_APP_VERSION matches package.json',()=>{
 const {version}=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));
 assert.equal(STUDIO_APP_VERSION,version);
});

test('render manifest uses the current application version',async()=>{
 const r=await readProject(new Blob([readFileSync(new URL('../public/library/Pipsa.hahmo',import.meta.url))]));
 const preset={id:'test',name:'test',format:'png' as const,width:1080,height:1920,fps:24,start:0,end:1/24,quality:8,transparent:true,audio:false,loop:0};
 const manifest=await inspectRenderSnapshot(new Uint8Array(await (await saveProject(r.doc,r.animation)).arrayBuffer()),preset);
 assert.equal(manifest.appVersion,STUDIO_APP_VERSION);
});

test('English Cut and Finnish Leikkaus preserve hard-cut source lines',()=>{
 const fi=parsePresentation('#!kilsat\nHahmo: Kille\nLeikkaus: laaja 1 s\nKamera: lähikuva Kille 2 s');
 const en=parsePresentation('#!kilsat\nCharacter: Kille\nCut: wide 1 second\nCamera: close-up Kille 2 seconds');
 assert.ok(isHardCameraCutSource(fi.events[0].sourceRef.text));
 assert.ok(isHardCameraCutSource(en.events[0].sourceRef.text));
 assert.ok(isHardCameraCutSource('Meanwhile: Cut: wide 1 second'));
 assert.equal(isHardCameraCutSource('Camera: wide 1 second'),false);
});

test('character provenance distinguishes studio library from user-derived PSD packs',()=>{
 const quick={asset:'hahmostudio-aino-human-v1'} as QuickProfile;
 const studio=characterProvenance(quick,{name:'Aino.psd',width:1,height:1,size:0,warnings:[],layers:[]} as PsdDocument);
 assert.equal(studio.license,'CC0-1.0');
 assert.equal(studio.origin,'studio-library');
 const user=characterProvenance(quick,{name:'Pipsa.psd',width:1,height:1,size:0,warnings:['Oma PSD: test'],layers:[]} as PsdDocument);
 assert.equal(user.license,'unknown');
 assert.equal(user.author,'user-provided');
});

test('library packs roundtrip with honest provenance metadata',async()=>{
 for(const name of ['Pipsa','Ville']){
  const loaded=await readProject(new Blob([readFileSync(new URL('../public/library/'+name+'.hahmo',import.meta.url))]));
  const pack=await saveProject(loaded.doc,loaded.animation);
  const provenance=JSON.parse(strFromU8(unzipSync(new Uint8Array(await pack.arrayBuffer()))['provenance.json']));
  assert.equal(provenance.license,'CC0-1.0');
  assert.equal(provenance.origin,'studio-library');
  assert.deepEqual(provenance.externalAssets,[]);
 }
});
