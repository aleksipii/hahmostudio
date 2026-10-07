import test from 'node:test';import assert from 'node:assert/strict';
import type {LayerNode,PsdDocument} from './psd-model.ts';
import {createRig,rigChain,validateRig} from './rig-model.ts';
import {suggestRig} from './rig-suggest.ts';

const layer=(key:string,name:string,left:number,top:number,width:number,height:number):LayerNode=>({key,psdId:Number(key.replace(/\D/g,''))||undefined,name,path:name,kind:'layer',left,top,width,height,opacity:1,visible:true,blendMode:'normal',children:[],warnings:[]});
const doc=(layers:LayerNode[]):PsdDocument=>({name:'Testi',width:1000,height:1400,size:1,layers} as PsdDocument);

test('names in Finnish and English get roles, chain and document-space pivots',()=>{
 const d=doc([layer('l1','Vartalo',400,500,200,400),layer('l2','Pää',420,300,160,200),layer('l3','Silmä vasen',450,360,30,20),layer('l4','Suu',480,430,40,20),
  layer('l5','Arm L',340,520,60,300),layer('l6','Hand L',340,820,60,60),layer('l7','Leg R',520,900,70,350),layer('l8','Foot R',520,1250,100,50)]);
 const base=createRig(d),r=suggestRig(d,base);
 const part=(k:string)=>r.rig.parts.find(p=>p.key===k)!;
 assert.deepEqual(['l1','l2','l3','l4','l5','l6','l7','l8'].map(k=>part(k).role),['body','head','eye','mouth','arm','hand','leg','foot']);
 assert.equal(part('l2').parentKey,'l1');assert.equal(part('l3').parentKey,'l2');assert.equal(part('l6').parentKey,'l5');assert.equal(part('l8').parentKey,'l7');assert.equal(part('l1').parentKey,undefined);
 assert.ok(part('l5').pivot.y<part('l5').joints[0].y,'shoulder above wrist');
 assert.ok(r.suggestions.find(s=>s.key==='l6')?.grip);
 for(const p of r.rig.parts)rigChain(r.rig,p.key);
 assert.doesNotThrow(()=>validateRig(JSON.parse(JSON.stringify(r.rig)),d),'result survives portable rig validation');
 assert.equal(base.parts[0].role,'none','input rig is not mutated');
});

test('unnamed layers are not guessed and existing assignments are preserved',()=>{
 const d=doc([layer('l1','Layer 1',0,0,100,100),layer('l2','Body',400,500,200,400),layer('l3','Head',420,300,160,200)]);
 const base=createRig(d);base.parts[2].role='accessory';base.parts[2].pivot={x:1,y:2};
 const r=suggestRig(d,base);
 assert.equal(r.rig.parts[0].role,'none');assert.deepEqual(r.unrecognized.map(u=>u.key),['l1']);
 assert.equal(r.rig.parts[2].role,'accessory');assert.deepEqual(r.rig.parts[2].pivot,{x:1,y:2});
 assert.equal(r.rig.parts[1].role,'body');
 const all=suggestRig(d,base,{onlyUnassigned:false});assert.equal(all.rig.parts[2].role,'head');
});

test('without a body part limbs stay unattached and a note explains it',()=>{
 const d=doc([layer('l1','Arm',100,100,50,200),layer('l2','Leg',200,300,50,200)]);
 const r=suggestRig(d,createRig(d));
 assert.ok(r.rig.parts.every(p=>p.parentKey===undefined));assert.ok(r.notes.some(n=>/Vartalo/.test(n)));
});
