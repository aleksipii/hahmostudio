import test from 'node:test';
import assert from 'node:assert/strict';
import {buildToonAsset,deformVertex,skinPoint,toonProfiles,type Mesh3D,type V3} from './toon3d.ts';
import {neutral} from './animation-model.ts';

function section(mesh:Mesh3D,y:number):V3[]{
 const levels=[...new Set(mesh.vertices.map(v=>v.position[1]))];
 const lower=[...levels].reverse().find(v=>v<=y)!,upper=levels.find(v=>v>=y)!;
 const a=mesh.vertices.filter(v=>v.position[1]===lower),b=mesh.vertices.filter(v=>v.position[1]===upper);
 const t=upper===lower?0:(y-lower)/(upper-lower);
 return a.map((v,i)=>v.position.map((n,j)=>n+(b[i].position[j]-n)*t) as V3);
}

test('flat jacket encloses every waistband cross-section in their overlap: no intersecting hem triangles',()=>{
 for(const profile of toonProfiles){
  const asset=buildToonAsset({...profile,renderStyle:'flat'});
  const jacket=asset.meshes.find(m=>m.id==='jacket')!,waist=asset.meshes.find(m=>m.id==='trouser-waist')!;
  for(let y=572;y<=591;y+=.5){
   const outer=section(jacket,y);
   for(const point of section(waist,y))for(let i=0;i<outer.length;i++){
    const a=outer[i],b=outer[(i+1)%outer.length];
    const cross=(b[0]-a[0])*(point[2]-a[2])-(b[2]-a[2])*(point[0]-a[0]);
    assert.ok(cross>0,`${profile.name} waistband escapes jacket at y=${y}`);
   }
  }
 }
});

test('legacy and cel mesh geometry remains identical and retains its historical hem',()=>{
 for(const profile of toonProfiles){
  const legacy=buildToonAsset(profile),cel=buildToonAsset({...profile,renderStyle:'cel'});
  assert.deepEqual(cel.meshes,legacy.meshes);
  const hem=legacy.meshes.find(m=>m.id==='jacket')!.vertices.filter(v=>v.position[1]===591);
  assert.equal(Math.max(...hem.map(v=>v.position[0])),361);
  assert.ok(Math.max(...hem.map(v=>v.position[2]))<32);
 }
});

test('front and profile extreme limb poses keep finite normalized skinning and exact hand grip attachment',()=>{
 for(const profile of toonProfiles)for(const axis of ['z','x'])for(const angle of [-120,-90,90,120]){
  const asset=buildToonAsset({...profile,renderStyle:'flat'});
  const poses=Object.fromEntries(asset.bones.filter(b=>b.id!=='root').map(b=>[b.id,{...neutral,rotation:angle,axis}]));
  for(const mesh of asset.meshes)for(const vertex of mesh.vertices){
   assert.ok(Math.abs(vertex.weights.reduce((sum,w)=>sum+w.weight,0)-1)<1e-10);
   assert.ok(deformVertex(vertex,asset.bones,poses).every(Number.isFinite));
  }
  for(const side of ['left','right'] as const){
   const grip=asset.grips[side],bone=side+'Hand';
   assert.deepEqual(deformVertex({position:grip,weights:[{bone,weight:1}]},asset.bones,poses),skinPoint(grip,bone,asset.bones,poses));
  }
 }
});
