import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {readProject,saveProject} from './project-file.ts';import {buildStudioExample,studioExampleScript} from './studio-example.ts';import {animationTransforms} from './animation-transform.ts';
const load=(name:string)=>readProject(new Blob([readFileSync(new URL('../public/library/'+name+'.hahmo',import.meta.url))]));
test('Try example builds two real owner characters, preserves source, roundtrips and has animated poses',async()=>{
 const [kille,handu]=await Promise.all([load('Pipsa'),load('Ville')]);const assets={pipsa:{doc:kille.doc,animation:kille.animation},ville:{doc:handu.doc,animation:handu.animation}};
 const built=buildStudioExample(assets,kille.scene);assert.equal(built.presentation.bindings.length,2);assert.equal(built.scene.presentationSource,studioExampleScript);assert.deepEqual(built.presentation.diagnostics.filter(d=>d.severity==='error'),[]);assert.ok(built.animation.duration>200);
 for(const speaker of ['PIPSA','VILLE']){const a=built.presentation.actorAnimations![speaker];assert.ok(a.tracks.some(t=>t.frames.some(f=>f.rotation!==0)));const pose=animationTransforms(a,30);assert.equal(pose.size,a.rig.parts.length);}
 const reopened=await readProject(await saveProject(built.doc,built.animation,undefined,built.scene));assert.equal(reopened.scene.presentations![0].bindings.length,2);assert.equal(Object.keys(reopened.doc.presentationAssets!).length,2);
 for(const pack of [kille,handu])for(const side of ['left','right']){const r=pack.doc.quick!.roles;assert.equal(pack.animation.rig.parts.find(p=>p.key===r[side+'Shin'])!.parentKey,r[side+'Thigh']);assert.equal(pack.animation.rig.parts.find(p=>p.key===r[side+'Foot'])!.parentKey,r[side+'Shin']);}
});

test('owner packs support articulated walking without missing rig diagnostics',async()=>{
 const {buildScreenplay,parseScreenplay}=await import('./screenplay.ts'),{characterBox}=await import('./stage-bounds.ts');
 for(const name of ['Pipsa','Ville']){const p=await load(name);const built=buildScreenplay(p.animation,p.doc.quick!,p.scene,parseScreenplay('[kävele oikealle 2s]'),characterBox(p.doc));assert.ok(built.animation.tracks.some(t=>t.key===p.doc.quick!.roles.leftShin&&t.frames.some(f=>f.rotation!==0)));assert.ok(built.animation.tracks.flatMap(t=>t.frames).every(k=>Number.isFinite(k.rotation)&&Number.isFinite(k.x)));}
});
