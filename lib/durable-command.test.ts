import test from 'node:test';
import assert from 'node:assert/strict';
import {DurableCommandGate,verifyRecoveryAck} from './studio/durable-command.ts';
import {RecoveryStore} from '../desktop/recovery.mjs';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {sha256} from './studio/hash.ts';

test('validated proposal and undo history stay unpublished until durable acknowledgment',async()=>{
 const gate=new DurableCommandGate(),trace:string[]=[],history:number[]=[];let visible=1,ack!:()=>void;
 const pending=gate.execute({validate(){trace.push('validate');return 2;},async persist(value){assert.equal(value,2);trace.push('write');await new Promise<void>(resolve=>{ack=resolve;});trace.push('ack');},publish(value){history.push(visible);visible=value;trace.push('publish');}});
 assert.equal(visible,1);assert.deepEqual(history,[]);assert.equal(gate.busy,true);
 await assert.rejects(gate.execute({validate:()=>3,persist:async()=>{},publish:()=>{visible=3;}}),/Edellinen muutos/);
 ack();await pending;assert.deepEqual(trace,['validate','write','ack','publish']);assert.equal(visible,2);assert.deepEqual(history,[1]);assert.equal(gate.busy,false);
});
test('validation or storage failure leaves state and undo stack unchanged and permits retry',async()=>{
 const gate=new DurableCommandGate(),history=[1];let visible=2,writes=0;
 await assert.rejects(gate.execute({validate(){throw Error('bad rig');},async persist(){writes++;},publish(){history.pop();visible=1;}}),/bad rig/);
 assert.equal(writes,0);
 await assert.rejects(gate.execute({validate:()=>1,async persist(){throw Error('disk full');},publish(){history.pop();visible=1;}}),/disk full/);
 assert.equal(visible,2);assert.deepEqual(history,[1]);assert.equal(gate.busy,false);
 await gate.execute({validate:()=>1,persist:async()=>{},publish(value){history.pop();visible=value;}});
 assert.equal(visible,1);assert.deepEqual(history,[]);
});
test('invalid acknowledgment never publishes the command',async()=>{
 const gate=new DurableCommandGate();let published=false;const hash='a'.repeat(64);
 await assert.rejects(gate.execute({validate:()=>1,async persist(){verifyRecoveryAck({hash:'b'.repeat(64),size:1,createdAt:new Date().toISOString()},hash,1);},publish(){published=true;}}),/kuittaus/);
 assert.equal(published,false);
 for(const ack of [null,{}, {hash,size:2,createdAt:new Date().toISOString()}, {hash,size:1,createdAt:'invalid'}])assert.throws(()=>verifyRecoveryAck(ack,hash,1));
 verifyRecoveryAck({hash,size:1,createdAt:new Date().toISOString()},hash,1);
});
test('native commit is recoverable before the renderer publishes it, including renderer crash window',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'studio-command-'));try{
  const gate=new DurableCommandGate(),bytes=new Uint8Array([4,5,6]),digest=await sha256(bytes);let visible=0;
  await assert.rejects(gate.execute({validate:()=>bytes,async persist(value){const ack=await new RecoveryStore(dir).save({name:'proposal',bytes:value});verifyRecoveryAck(ack,digest,value.length);const recovered=await new RecoveryStore(dir).latest();assert.ok(recovered);assert.deepEqual(recovered.bytes,bytes);assert.equal(visible,0);},publish(){throw Error('renderer stopped after ack');}}),/renderer stopped/);
  assert.equal(visible,0);const recovered=await new RecoveryStore(dir).latest();assert.ok(recovered);assert.deepEqual(recovered.bytes,bytes);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('blank script project and durable production edit roundtrip existing hahmo format before publication',async()=>{
 const {createRig}=await import('./rig-model.ts'),{createAnimation}=await import('./animation-model.ts'),{createScene}=await import('./scene-model.ts'),{saveProject,readProject}=await import('./project-file.ts'),{parsePresentation}=await import('./presentation-parser.ts'),{executeProductionCommand}=await import('./studio/production-command.ts'),{studioMetadata}=await import('./studio/domain.ts');
 const doc={name:'Tuotanto',width:1080,height:1920,size:0,layers:[],warnings:[]},rig=createRig(doc),animation=createAnimation(rig),scene=createScene(doc);
 const original=parsePresentation('Kohtaus: cutout-studio-v1\nLAAJA KUVA\nKILLE:\n“Hei.”'),state={model:original,voices:{}};
 const gate=new DurableCommandGate(),dir=await mkdtemp(join(tmpdir(),'studio-real-command-'));let visible=state;
 try{await gate.execute({validate(){return executeProductionCommand(state,{kind:'edit',proposal:{...original,natural:true}},{},24,studioMetadata(original).revision);},async persist(next){const blob=await saveProject(doc,animation,undefined,{...scene,presentationDraft:next.model}),bytes=new Uint8Array(await blob.arrayBuffer()),ack=await new RecoveryStore(dir).save({name:doc.name,bytes});verifyRecoveryAck(ack,await sha256(bytes),bytes.length);const restored=await new RecoveryStore(dir).latest();assert.ok(restored);const project=await readProject(new Blob([new Uint8Array(restored.bytes)]));assert.equal(project.scene.presentationDraft?.natural,true);assert.equal(project.scene.presentationDraft?.production?.studio?.commandJournal?.at(-1)?.kind,'edit');assert.equal(visible,state);},publish(next){visible=next;}});assert.equal(visible.model.natural,true);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('acknowledgment must identify the exact command, not only identical project content',()=>{const hash='a'.repeat(64),command={id:'first',kind:'editor-edit'},ack={hash,size:1,createdAt:new Date().toISOString(),command:{id:'second',kind:'editor-edit'}};assert.throws(()=>verifyRecoveryAck(ack,hash,1,command),/väärään komentoon/);verifyRecoveryAck({...ack,command},hash,1,command);});

test('an asynchronously prepared command cannot overwrite a newer character or scene state',async()=>{const {assertProjectBase}=await import('./studio/durable-command.ts');const doc={},rig={},animation={},scene={},audio={},before=[doc,rig,animation,scene,audio,0],newer=[doc,rig,animation,{...scene,scale:2},audio,1];let writes=0,published=false;const gate=new DurableCommandGate();await assert.rejects(gate.execute({validate(){assertProjectBase(before,newer);return before;},async persist(){writes++;},publish(){published=true;}}),/lähtötila/);assert.equal(writes,0);assert.equal(published,false);assertProjectBase(before,[doc,rig,animation,scene,audio,99]);});
