import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readPsd,initializeCanvas} from 'ag-psd';
import {readProject,saveProject} from './project-file.ts';
import {parseScreenplay,buildScreenplay} from './screenplay.ts';
import {sampleTrack} from './animation-model.ts';
import {selectCharacterView} from './character-view.ts';
import {CHARACTER_PACK_OPTIONS} from './speaker-pack-options.ts';

initializeCanvas(()=>{throw Error('Canvas unused');},(width,height)=>({width,height,data:new Uint8ClampedArray(width*height*4)}) as unknown as ImageData);
const cast=['Pipsa','Ville','Taru','Ukko'];
const file=(name:string)=>readFileSync(new URL('../public/library/'+name,import.meta.url));
const load=(name:string)=>readProject(new Blob([file(name+'.hahmo')]));
const required=['root','head','leftArm','leftForearm','leftHand','rightArm','rightForearm','rightHand','leftThigh','leftShin','leftFoot','rightThigh','rightShin','rightFoot','leftEye','rightEye','leftPupil','rightPupil','leftBrow','rightBrow','leftBlink','rightBlink','mouthNeutral','mouthOpen','mouthRound','mouthSmile','mouthSad'] as const;

test('every new cutout character opens as a 2D pack with all controller roles, valid attachments and its source PSD',async()=>{
 for(const name of cast){
  const p=await load(name),q=p.doc.quick!,parts=p.animation.rig.parts,keys=new Set(parts.map(x=>x.key));
  assert.equal(q.asset,`hahmostudio-${name.toLowerCase()}-cutout-2d-v1`);assert.equal(q.views,undefined);
  for(const role of required)assert.ok(keys.has((q.roles as Record<string,string>)[role]),`${name} ${role}`);
  for(const part of parts){if(!part.parentKey)continue;assert.ok(keys.has(part.parentKey),`${name} ${part.path}`);let at:string|undefined=part.parentKey,steps=0;while(at&&steps++<40)at=parts.find(x=>x.key===at)?.parentKey;assert.ok(steps<40,'acyclic');}
  assert.equal(parts.find(x=>x.key===q.roles.leftHand)?.parentKey,q.roles.leftForearm);assert.equal(parts.find(x=>x.key===q.roles.head)?.parentKey,q.roles.root);
  const psd=readPsd(file(name+'.psd'),{skipLayerImageData:true,skipCompositeImageData:true,skipThumbnail:true,useRawData:true});assert.equal(psd.width,600);assert.equal(psd.height,900);assert.deepEqual(psd.children!.map(g=>g.name),['Vartalo','Pää','Suut']);
  for(const role of ['leftBlink','rightBlink','mouthOpen','mouthRound','mouthSmile','mouthSad'])assert.equal(sampleTrack(p.animation.tracks.find(t=>t.key===(q.roles as Record<string,string>)[role]),0).opacity,0,`${name} ${role} hidden at rest`);
 }
});

test('3D packs carry three independently drawn views that the camera/view selector can switch between',async()=>{
 for(const name of cast){
  const p=await load(name+'-3D'),q=p.doc.quick!;
  assert.equal(q.asset,`hahmostudio-${name.toLowerCase()}-cutout-3d-v1`);assert.deepEqual(Object.keys(q.views!),['front','right','left']);
  for(const view of ['front','right','left'] as const)for(const role of required)assert.ok(p.animation.rig.parts.some(x=>x.key===(q.views![view] as Record<string,string>)[role]),`${name} ${view} ${role}`);
  const roots=Object.values(q.views!).map(v=>sampleTrack(p.animation.tracks.find(t=>t.key===v!.root),0).opacity);assert.deepEqual(roots,[1,0,0]);
  const right=selectCharacterView(p.animation,q,'right',0);assert.equal(sampleTrack(right.animation.tracks.find(t=>t.key===q.views!.right!.root),0).opacity,1);assert.equal(right.profile.roles.root,q.views!.right!.root);
  const psd=readPsd(file(name+'-3D.psd'),{skipLayerImageData:true,skipCompositeImageData:true,skipThumbnail:true,useRawData:true});assert.deepEqual(psd.children!.map(g=>g.name),['Edestä','Oikea profiili','Vasen profiili']);
  const leftHand=p.animation.rig.parts.find(x=>x.key===q.views!.left!.leftHand)!,rightHand=p.animation.rig.parts.find(x=>x.key===q.views!.right!.leftHand)!;assert.equal(leftHand.pivot.x,600-rightHand.pivot.x,'left profile mirrors the drawn right profile');
 }
});

test('screenplay motions build on the new rigs and the whole project roundtrips',async()=>{
 const p=await load('Taru-3D'),q=p.doc.quick!;
 const out=buildScreenplay(p.animation,q,p.scene,parseScreenplay('[kävele oikealle 2s]\n[vilkuta 2s]\n[nyökkää 1s]\n[hyppää 1s]'));
 assert.ok(out.animation.duration>p.animation.duration);assert.equal(sampleTrack(out.animation.tracks.find(t=>t.key===q.views!.right!.root),out.start+10).opacity,1);
 const flat=await load('Ville'),wave=buildScreenplay(flat.animation,flat.doc.quick!,flat.scene,parseScreenplay('[vilkuta 2s]'));
 assert.ok(wave.animation.tracks.some(t=>t.key===flat.doc.quick!.roles.leftArm&&t.frames.length>2));
 const restored=await readProject(await saveProject(p.doc,out.animation,undefined,out.scene));assert.deepEqual(restored.animation,out.animation);assert.deepEqual(restored.doc.quick,q);
});

test('new characters are listed in the library and offered as script cast packs; provenance is original CC0 art',async()=>{
 for(const name of cast){
  const library=readFileSync(new URL('./character-catalog.ts',import.meta.url),'utf8');assert.ok(library.includes(`{name:'${name}',`),name);assert.ok(library.includes(`{name:'${name}-3D',`),name+'-3D');
  assert.ok((CHARACTER_PACK_OPTIONS as readonly string[]).includes(name+'-3D'));
  const zip=await import('fflate');const files=zip.unzipSync(new Uint8Array(file(name+'-3D.hahmo')));const prov=JSON.parse(new TextDecoder().decode(files['provenance.json']));
  assert.equal(prov.license,'CC0-1.0');assert.deepEqual(prov.externalAssets,[]);assert.match(prov.graphics,/not derived from any TV series/);
 }
});
