import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {propLibrary} from './prop-library.ts';
import {sceneModel,sceneryFaces} from './toon-scenery.ts';
import {volume,REFERENCE_VOLUME_SIGN} from './toon-props.ts';
import {buildEpisode,catalogFromNames} from './episode-builder.ts';
import {CHARACTER_PACK_OPTIONS} from './speaker-pack-options.ts';
import {readProject} from './project-file.ts';
import {renderToonCast,toonCamera} from './toon-render.ts';
import {rotate3,type V3} from './toon3d.ts';

test('3D-lavasteet: jokaisella kirjaston lavasteella on suljettu, oikein päin oleva verkko yksikkökuution sisällä',()=>{
 for(const prop of propLibrary){
  assert.equal(prop.has3d,true,prop.id);
  const model=sceneModel(prop.id);assert.ok(model&&model.meshes.length>=1,prop.id);
  for(const m of model.meshes){
   assert.ok(m.vertices.every(v=>v.every(Number.isFinite)),m.id);
   assert.ok(m.faces.every(f=>f.every(i=>Number.isInteger(i)&&i>=0&&i<m.vertices.length)),m.id);
   assert.equal(Math.sign(volume(m.vertices,m.faces)),REFERENCE_VOLUME_SIGN,`${prop.id}/${m.id}: pintojen kiertosuunta`);
   const edges=new Map<string,number>();for(const f of m.faces)f.forEach((v,j)=>{const key=v+'>'+f[(j+1)%3];edges.set(key,(edges.get(key)??0)+1);});
   for(const [key,count] of edges){const [a,b]=key.split('>');assert.equal(count,1,`${m.id}: suuntareuna ${key} kahdesti`);assert.equal(edges.get(b+'>'+a),1,`${m.id}: reunalla ${key} ei vastareunaa (verkko ei ole suljettu)`);}
   for(const v of m.vertices){assert.ok(v[0]>=-.02&&v[0]<=1.02&&v[1]>=-.02&&v[1]<=1.02&&Math.abs(v[2])<=.6,`${prop.id}/${m.id}: ${v}`);}
  }
 }
 assert.equal(sceneModel('ei-ole-prop-v1'),undefined);
});

test('3D-lavasteet: kamera kiertää lavastetta (leveys kapenee profiilissa), aikaikkuna rajaa näkyvyyden',()=>{
 const items=[{id:'t',asset:'table-prop-v1',x:.5,y:.7,scale:.3,start:1,end:3}];
 const view=(yaw:number)=>(v:V3)=>{const q=rotate3([v[0]-540,v[1]-540,v[2]],0,yaw*Math.PI/180);return[540+q[0],540+q[1],q[2]] as V3;};
 const span=(yaw:number)=>{const f=sceneryFaces(items,2,1080,1080,view(yaw)),xs=f.flatMap(x=>x.points.map(p=>p[0]));return Math.max(...xs)-Math.min(...xs);};
 assert.ok(span(0)>250);assert.ok(span(90)<span(0)*.75,`${span(90)} vs ${span(0)}`);
 assert.equal(sceneryFaces(items,.5,1080,1080,view(0)).length,0);assert.equal(sceneryFaces(items,3,1080,1080,view(0)).length,0);
 assert.ok(sceneryFaces(items,2,1080,1080,view(0)).every(f=>f.outline.every(o=>!o)),'viivaton tyyli');
});

test('toon3d-esitys piirtää lavasteen 3D-verkkona hahmojen kanssa ja vanhat 2D-kohtaukset säilyvät',async()=>{
 const asset=await readProject(new Blob([readFileSync(new URL('../public/library/Pipsa.hahmo',import.meta.url))])),assets={'Pipsa':{doc:asset.doc,animation:asset.animation}};
 const build=()=>{const b=buildEpisode('Resurssi hahmo MIRA: Pipsa\nINT. STUDIO\nMira odottaa 2 s.\nMira odottaa 2 s.',{packs:catalogFromNames(CHARACTER_PACK_OPTIONS),assets});const p=b.presentation;p.production!.representations={MIRA:'toon3d'};return p;};
 const fills=(p:ReturnType<typeof build>,t:number)=>{let n=0;const ctx:any=new Proxy({canvas:{},globalAlpha:1,createLinearGradient:()=>({addColorStop:()=>{}})},{get:(target,key)=>String(key)==='fill'?()=>{n++;}:String(key) in target?(target as any)[String(key)]:()=>{},set:(target,key,value)=>{(target as any)[String(key)]=value;return true;}});renderToonCast(ctx,p,assets,t,1920,1080);return n;};
 const plain=build(),withBed=build();withBed.production!.props=[{id:'bed',asset:'bed-prop-v1',x:.25,y:.7,scale:.4,start:0,end:60}];
 assert.ok(fills(withBed,1)>fills(plain,1)+10,'sänky tuo 3D-kolmioita');
 assert.equal(toonCamera(withBed,1).yaw,0);
});

test('toon3d flat-hahmot ja lavasteet ovat viivattomia, legacy-profiilit säilyvät',async()=>{
 const {toonProfiles}=await import('./toon3d.ts');
 assert.ok(toonProfiles.length>=4&&toonProfiles.every(p=>p.outline>0),'legacy profile data remains unchanged');
 const asset=await readProject(new Blob([readFileSync(new URL('../public/library/Pipsa.hahmo',import.meta.url))])),assets={'Pipsa':{doc:asset.doc,animation:asset.animation}};
 const b=buildEpisode('Resurssi hahmo MIRA: Pipsa\nINT. STUDIO\nMira odottaa 2 s.',{packs:catalogFromNames(CHARACTER_PACK_OPTIONS),assets}),p=b.presentation;p.production!.representations={MIRA:'toon3d'};
 p.production!.characterProfiles={MIRA:{...toonProfiles[0],renderStyle:'flat'}};
 let inkStrokes=0,fills=0;const ctx:any=new Proxy({canvas:{},globalAlpha:1,createLinearGradient:()=>({addColorStop:()=>{}})},{get:(target,key)=>String(key)==='stroke'?()=>{if(ctx.strokeStyle==='#222a30')inkStrokes++;}:String(key)==='fill'?()=>{fills++;}:String(key) in target?(target as any)[String(key)]:()=>{},set:(target,key,value)=>{(target as any)[String(key)]=value;return true;}});
 renderToonCast(ctx,p,assets,1,1920,1080);
 assert.ok(fills>50,'hahmo piirtyi');assert.equal(inkStrokes,0,'ei mustia siluettiviivoja');
});
