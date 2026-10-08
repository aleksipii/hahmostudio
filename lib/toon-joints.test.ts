import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readProject} from './project-file.ts';
import {buildToonAsset,toonProfiles} from './toon3d.ts';

const cast=['Pipsa','Ville','Taru','Ukko'];
const load=(name:string)=>readProject(new Blob([readFileSync(new URL('../public/library/'+name+'.hahmo',import.meta.url))]));
const chains=[['Arm','Forearm','Hand'],['Thigh','Shin','Foot']] as const;

test('every new character has exactly one toon3d profile and its skeleton matches the documented joints',()=>{
 assert.deepEqual(toonProfiles.map(p=>p.name).sort(),[...cast].sort());
 for(const profile of toonProfiles){
  const bones=buildToonAsset(profile).bones,at=(id:string)=>bones.find(b=>b.id===id)!.pivot;
  for(const [side,sign] of [['left',1],['right',-1]] as const){
   assert.deepEqual(at(side+'Arm').slice(0,2),[300+sign*96,435],profile.name);
   assert.equal(at(side+'Forearm')[1],505);assert.equal(at(side+'Hand')[1],582);
   assert.equal(at(side+'Thigh')[1],603);assert.equal(at(side+'Shin')[1],660);assert.equal(at(side+'Foot')[1],732);
  }
 }
});

test('2D art joints of the 2D packs and the front view of the -3D packs match the toon3d skeleton',async()=>{
 for(const name of cast)for(const pack of [name,name+'-3D']){
  const p=await load(pack),q=p.doc.quick!,roles=(q.views?.front??q.roles) as Record<string,string>;
  const profile=toonProfiles.find(t=>t.name===name)!,bones=buildToonAsset(profile).bones;
  for(const side of ['left','right'])for(const chain of chains)chain.forEach((seg,i)=>{
   const id=side+seg,part=p.animation.rig.parts.find(x=>x.key===roles[id]);
   assert.ok(part,`${pack} ${id} role`);
   const bone=bones.find(b=>b.id===id)!.pivot;
   assert.deepEqual([part!.pivot!.x,part!.pivot!.y],[bone[0],bone[1]],`${pack} ${id} pivot`);
   const next=chain[i+1];
   if(next){const child=bones.find(b=>b.id===side+next)!.pivot;assert.deepEqual([part!.joints![0].x,part!.joints![0].y],[child[0],child[1]],`${pack} ${id} joint`);}
  });
 }
});
