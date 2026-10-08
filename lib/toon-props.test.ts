import test from 'node:test';import assert from 'node:assert/strict';
import {toonHeldPropIds,toonHeldPropMeshes,REFERENCE_VOLUME_SIGN} from './toon-props.ts';
import {heldPropIds} from './held-props.ts';

const signedVolume=(m:{vertices:{position:number[]}[];faces:number[][]})=>m.faces.reduce((s,[a,b,c])=>{const p=m.vertices[a].position,q=m.vertices[b].position,r=m.vertices[c].position;return s+(p[0]*(q[1]*r[2]-q[2]*r[1])-p[1]*(q[0]*r[2]-q[2]*r[0])+p[2]*(q[0]*r[1]-q[1]*r[0]));},0)/6;

test('3D-esineet: jokaiselle kirjaston esineelle puhelinta lukuun ottamatta on verkko; verkot ovat suljettuja ja oikein päin',()=>{
 assert.deepEqual([...toonHeldPropIds].sort(),heldPropIds.filter(i=>i!=='phone-v1').sort());
 for(const id of toonHeldPropIds)for(const hand of ['leftHand','rightHand'] as const)for(const outward of [1,-1] as const){
  const meshes=toonHeldPropMeshes(id,[300,420,0],hand,outward)!;assert.ok(meshes.length>=2,id);
  for(const m of meshes){
   assert.ok(m.vertices.every(v=>v.position.every(Number.isFinite)&&v.weights.length===1&&v.weights[0].bone===hand),m.id);
   assert.ok(m.faces.every(f=>f.every(i=>Number.isInteger(i)&&i>=0&&i<m.vertices.length)),m.id);
   assert.equal(Math.sign(signedVolume(m)),REFERENCE_VOLUME_SIGN,`${m.id}: pintojen kiertosuunta`);assert.ok(Math.abs(signedVolume(m))>1,m.id);
  }
  const ys=meshes.flatMap(m=>m.vertices.map(v=>v.position[1]));assert.ok(Math.min(...ys)>420-170&&Math.max(...ys)<420+90,`${id}: esine pysyy käden lähellä`);
 }
 assert.equal(toonHeldPropMeshes('phone-v1',[0,0,0],'rightHand',1),undefined);
});

import {readFileSync} from 'node:fs';
import {buildEpisode,catalogFromNames} from './episode-builder.ts';
import {CHARACTER_PACK_OPTIONS} from './speaker-pack-options.ts';
import {readProject} from './project-file.ts';
import {renderToonCast} from './toon-render.ts';

test('toon3d-renderöinti piirtää kirjaston esineen kädessä ja vapautettuna; ilman esinettä kolmioita on vähemmän',async()=>{
 const asset=await readProject(new Blob([readFileSync(new URL('../public/library/Pipsa.hahmo',import.meta.url))])),assets={'Pipsa':{doc:asset.doc,animation:asset.animation}};
 const build=(body:string)=>{const b=buildEpisode(`Resurssi hahmo MIRA: Pipsa\nINT. STUDIO\n${body}`,{packs:catalogFromNames(CHARACTER_PACK_OPTIONS),assets});const p=b.presentation;assert.deepEqual(b.diagnostics.filter(d=>d.severity==='error').map(d=>d.message),[]);p.production!.representations={MIRA:'toon3d'};return p;};
 const fills=(p:ReturnType<typeof build>,t:number)=>{let n=0;const ctx:any=new Proxy({canvas:{},globalAlpha:1,createLinearGradient:()=>({addColorStop:()=>{}})},{get:(target,key)=>String(key)==='fill'?()=>{n++;}:String(key) in target?(target as any)[String(key)]:()=>{},set:(target,key,value)=>{(target as any)[String(key)]=value;return true;}});renderToonCast(ctx,p,assets,t,1920,1080);return n;};
 const empty=build('Mira odottaa 2 s.\nMira odottaa 2 s.\nMira odottaa 2 s.'),mug=build('Mira pitää kahvikuppia.\nMira odottaa 2 s.\nMira laskee kahvikupin pöydälle.\nMira odottaa 2 s.');
 assert.ok(mug.events.some(e=>e.kind==='prop'&&/^hold:mug/.test(e.value)),'kuppi tunnistettu');
 const held=fills(mug,1),without=fills(empty,1);assert.ok(held>without+20,`kuppi kädessä: ${held} vs ${without}`);
 const drop=mug.events.find(e=>e.kind==='prop'&&/^drop:/.test(e.value));assert.ok(drop,'lasku tunnistettu');
 assert.ok(fills(mug,(drop!.at??0)+1)>fills(empty,(drop!.at??0)+1)+20,'vapautettu esine jää näkyviin');
});
