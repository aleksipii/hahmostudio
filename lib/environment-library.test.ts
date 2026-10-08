import test from 'node:test';
import assert from 'node:assert/strict';
import {environmentLibrary,environmentShapes} from './environment-library.ts';

test('environment library ids, names and aliases are unique and well formed',()=>{
 const ids=environmentLibrary.map(e=>e.id),names=environmentLibrary.map(e=>e.name),aliases=environmentLibrary.flatMap(e=>e.aliases.map(a=>a.toLocaleLowerCase('fi')));
 assert.equal(new Set(ids).size,ids.length);assert.equal(new Set(names).size,names.length);assert.equal(new Set(aliases).size,aliases.length,'alias resolves to one environment only');
 for(const e of environmentLibrary){
  assert.match(e.id,/^[a-z-]+-scene-v1$/);
  assert.ok(['studio','sisätila','ulkoilma'].includes(e.category),e.id);
  assert.ok(e.aliases.length>=1&&e.aliases.every(a=>a.trim()===a&&a.length>0),e.id);
  assert.equal(e.representation,'2d');
  assert.ok(e.placement.xMin<e.placement.xMax&&e.placement.xMin>=0&&e.placement.xMax<=1&&e.placement.y>0&&e.placement.y<1,e.id);
 }
});

test('every environment draws its own shapes inside the normalized frame and unknown ids return undefined',()=>{
 const seen=new Set<string>();
 for(const e of environmentLibrary){
  const shapes=environmentShapes(e.id);
  assert.ok(shapes&&shapes.length>0,e.id);
  for(const s of shapes!){
   assert.match(s.fill,/^#[0-9a-f]{6}$/i,e.id);
   const nums=[...(s.rect??[]),...(s.ellipse??[]),...(s.points??[]).flat()];
   assert.ok(nums.length>0,e.id);
   for(const n of nums)assert.ok(Number.isFinite(n)&&n>=-0.2&&n<=1.2,`${e.id} coordinate ${n}`);
   if(s.rect){assert.equal(s.rect.length,4);assert.ok(s.rect[2]>0&&s.rect[3]>0,`${e.id} rect size`);}
   if(s.ellipse){assert.equal(s.ellipse.length,4);assert.ok(s.ellipse[2]>0&&s.ellipse[3]>0,`${e.id} ellipse radius`);}
   if(s.points)assert.ok(s.points.length>=3&&s.points.every(p=>p.length===2),`${e.id} polygon`);
  }
  const key=JSON.stringify(shapes);assert.ok(!seen.has(key),`${e.id} is not a copy of another environment`);seen.add(key);
 }
 assert.equal(environmentShapes('missing-scene-v1'),undefined);
 assert.equal(environmentShapes(''),undefined);
 assert.equal(environmentShapes('office'),undefined,'id needs the -scene-v1 suffix');
});

test('environmentShapes is deterministic',()=>{
 for(const e of environmentLibrary)assert.deepEqual(environmentShapes(e.id),environmentShapes(e.id));
});
