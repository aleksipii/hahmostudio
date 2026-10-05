import test from 'node:test';
import assert from 'node:assert/strict';
import {createScene} from './scene-model.ts';
import {createRig} from './rig-model.ts';
import {createAnimation} from './animation-model.ts';
import {readProject,saveProject} from './project-file.ts';
import {parsePresentation} from './presentation-parser.ts';
import {compilePresentation} from './presentation-compile.ts';
import {functions} from './presentation-model.ts';
import {initProduction} from './production-model.ts';
import {studioMetadata} from './studio/domain.ts';
import {studioExampleScript,buildStudioExample} from './studio-example.ts';
import {readFileSync} from 'node:fs';

const motionScript=`#!kilsat
Hahmo: Kille
Hahmo: Handu
Kohtaus: Studio
Tausta: studio 0.5 s
Kamera: laaja 0.5 s
Kille vilkuttaa 2 s
Samalla: Handu nyökkää 2 s
Odota 1 s`;

test('first script-source save seeds Tuotanto project and keeps presentationSource on roundtrip',async()=>{
 const scene=createScene({width:1080,height:1920},1080,1920);
 const doc={name:'Tuotanto',width:scene.width,height:scene.height,size:0,layers:[],warnings:[] as string[]};
 const animation=createAnimation(createRig(doc));
 const blob=await saveProject(doc,animation,undefined,{...scene,studioProjectId:'proj-script-1',presentationSource:motionScript});
 const loaded=await readProject(blob);
 assert.equal(loaded.doc.name,'Tuotanto');
 assert.equal(loaded.scene.presentationSource,motionScript);
 assert.equal(loaded.scene.studioProjectId,'proj-script-1');
});

test('presentation draft, cast assets and rawScript survive project roundtrip before commit',async()=>{
 const [kille,handu]=await Promise.all(['Kille-Oma','Handu-Oma'].map(async name=>{
  const p=await readProject(new Blob([readFileSync(new URL('../public/library/'+name+'.hahmo',import.meta.url))]));
  return {doc:p.doc,animation:p.animation};
 }));
 const assets={kille,handu};
 const scene=createScene({width:1080,height:1920},1080,1920);
 let p=parsePresentation(motionScript);
 p.bindings=p.characters.map((speaker,i)=>({speaker,asset:i?'handu':'kille',voice:'Oma',side:i?'right':'left',functions:Object.fromEntries(functions.map(f=>[f,f==='show_phone'?'none':'supported']))}));
 p=compilePresentation(p,assets,24);
 const draft={...p,production:{...(p.production??initProduction(p)),studio:{...studioMetadata(p),rawScript:motionScript}}};
 const doc={...kille.doc,presentationAssets:assets};
 const blob=await saveProject(doc,kille.animation,undefined,{...scene,presentationSource:motionScript,presentationDraft:draft});
 const loaded=await readProject(blob);
 assert.equal(loaded.scene.presentationSource,motionScript);
 assert.equal(loaded.scene.presentationDraft!.production!.studio!.rawScript,motionScript);
 assert.equal(loaded.scene.presentationDraft!.bindings.length,2);
 assert.deepEqual(Object.keys(loaded.doc.presentationAssets??{}).sort(),['handu','kille']);
});

test('studio example script matches committed presentationSource after build',async()=>{
 const kille=await readProject(new Blob([readFileSync(new URL('../public/library/Kille-Oma.hahmo',import.meta.url))]));
 const handu=await readProject(new Blob([readFileSync(new URL('../public/library/Handu-Oma.hahmo',import.meta.url))]));
 const built=buildStudioExample({kille:{doc:kille.doc,animation:kille.animation},handu:{doc:handu.doc,animation:handu.animation}},createScene({width:1080,height:1920}));
 assert.equal(built.scene.presentationSource,studioExampleScript);
 const blob=await saveProject(built.doc,built.animation,undefined,built.scene);
 const loaded=await readProject(blob);
 assert.equal(loaded.scene.presentationSource,studioExampleScript);
 assert.ok((loaded.scene.presentations?.length??0)>0);
});
