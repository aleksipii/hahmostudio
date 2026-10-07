import {test} from 'node:test';import assert from 'node:assert/strict';
import {harness,req,goodModel,canon} from './test-fixtures.ts';
import {MockRenderBackend,mockPaid,MP4_STUB} from './mock-backend.ts';
import {getJson} from './storage.ts';
import type {CanonicalState} from './canonical.ts';

const videoModel=()=>goodModel({id:'vid',capabilities:['image-to-video','reference-image'],compatibleWorkflows:['image_to_video'],files:[{path:'wan.safetensors',sha256:'b'.repeat(64),comfyFolder:'diffusion_models',role:'unet'} as never,{path:'t5.safetensors',sha256:'b'.repeat(64),comfyFolder:'text_encoders',role:'clip'} as never,{path:'vae.safetensors',sha256:'b'.repeat(64),comfyFolder:'vae',role:'vae'} as never]});
const vidBackend=(o:Partial<ConstructorParameters<typeof MockRenderBackend>[0]>={})=>new MockRenderBackend({descriptor:{id:'vid-free',class:'free',provider:'comfyui-fake',billingProvider:'none',enabled:true},cost:0,output:MP4_STUB,...o});
const withEvents=(n:number):CanonicalState=>{const s=canon();s.revision=2;s.scenes.scene_001.events=[{id:'e1',at:5,actor:'alice',action:'pick_up',target:'cup_01'},...Array.from({length:n-1},(_,i)=>({id:'x'+i,at:5.5+i*0.01,actor:'alice',action:'idle'}))];s.scenes.scene_001.events.sort((a,b)=>a.at-b.at);return s;};
async function setup(n:number,b=vidBackend(),opts:Parameters<typeof harness>[1]={}){const h=await harness([b],{models:[videoModel()],requireFp:true,...opts});await h.projects.put(withEvents(n));await h.projects.lock('project_001','scene_001','t');return{h,b};}
const areq=(o:Record<string,unknown>={})=>req({workflowId:'image_to_video'.replace('image_to_video','character_animation'),params:{},...o});

test('character_animation: one provider-checked clip per approved event, ordered manifest, no server-side join',async()=>{
 const {h,b}=await setup(3);
 const pf=await h.service.preflight(areq());
 assert.equal(pf.status,'AUTHORIZED',JSON.stringify(pf.reasons));assert.equal(pf.clips!.length,3);assert.deepEqual(pf.clips!.map(c=>c.at),[...pf.clips!.map(c=>c.at)].sort((x,y)=>x-y));
 assert.equal(pf.estimate!.estimatedCostEur,0);assert.equal(pf.workflowId,'character_animation');assert.deepEqual([pf.paidCompute,pf.paidFallback],['DISABLED','DISABLED']);assert.deepEqual(b.providerCalls,[],'preflight is provider-free');
 const rec=await h.service.start(areq({authorizationFingerprint:pf.fingerprint})).done;
 assert.equal(rec.state,'COMPLETED',JSON.stringify([rec.errors,rec.blocked]));
 assert.equal(rec.children!.length,3);assert.ok(rec.children!.every(c=>c.state==='COMPLETED'));assert.equal(rec.outputs.length,3);assert.deepEqual(b.providerCalls,['validate','render','validate','render','validate','render']);
 const man=await getJson<any>(h.storage,rec.sequence!);assert.equal(man.composedOf,'image_to_video');assert.equal(man.clips.length,3);assert.ok(man.clips.every((c:any)=>c.files.length===1&&c.files[0].file.endsWith('.mp4')));
 const kids=rec.children!.map(c=>h.service.get(c.jobId)!);assert.ok(kids.every(k=>k.workflow!.id==='image_to_video'&&k.cost!.authorized&&k.job.prompt.length>0));
 assert.ok(kids[0].job.prompt.includes('pick up cup')&&!kids[0].job.prompt.includes('idle'),'each clip prompt covers only its own event');
});
test('character_animation: blocked by cost gate means no clip contacts a provider',async()=>{
 const paid=mockPaid(0.01,'mock-paid'),{h}=await setup(2,paid as never,{});
 const pf=await h.service.preflight(areq({backendId:'mock-paid'}));assert.equal(pf.status,'BLOCKED');assert.equal(pf.fingerprint,undefined);
 const rec=await h.service.start(areq({backendId:'mock-paid',authorizationFingerprint:'0'.repeat(64)})).done;assert.equal(rec.state,'BLOCKED');assert.deepEqual(paid.providerCalls,[]);assert.equal(rec.providerContacted,false);
});
test('character_animation: fingerprint is required and bound to the whole clip plan',async()=>{
 const {h,b}=await setup(2);
 assert.equal((await h.service.start(areq()).done).blocked!.code,'authorization-required');
 const pf=await h.service.preflight(areq());assert.equal((await h.service.start(areq({authorizationFingerprint:'1'.repeat(64)})).done).blocked!.code,'authorization-changed');
 await h.projects.put({...withEvents(3),revision:3});await h.projects.lock('project_001','scene_001','t');
 assert.equal((await h.service.start(areq({authorizationFingerprint:pf.fingerprint})).done).blocked!.code,'authorization-changed','scene changed after the card was shown');
 assert.deepEqual(b.providerCalls,[]);
});
test('character_animation: needs a lock, events, and stays within the clip limit',async()=>{
 const {h,b}=await setup(2);h.projects.unlock('project_001','scene_001');assert.equal((await h.service.preflight(areq())).status,'BLOCKED');assert.equal((await h.service.start(areq({authorizationFingerprint:'1'.repeat(64)})).done).blocked!.code,'lock-missing');
 const big=await setup(13);const pf=await big.h.service.preflight(areq());assert.equal(pf.status,'BLOCKED');assert.match(pf.reasons[0],/limited to 12 clips/);assert.deepEqual(big.b.providerCalls,[]);
 const none=await setup(1);const s=none.h.projects.get('project_001')!;s.scenes.scene_001.events=[];s.revision=5;await none.h.projects.put(s);await none.h.projects.lock('project_001','scene_001','t');assert.match((await none.h.service.preflight(areq())).reasons[0],/no approved events/);
 void b;
});
test('character_animation: a failing clip ends the run; no later clip and no other backend is tried',async()=>{
 const bad=vidBackend({failRender:true}),spare=vidBackend({descriptor:{id:'spare',class:'free',provider:'comfyui-fake',billingProvider:'none',enabled:true}});
 const h=await harness([bad,spare],{models:[videoModel()],requireFp:true});await h.projects.put(withEvents(3));await h.projects.lock('project_001','scene_001','t');
 const pf=await h.service.preflight(areq());const rec=await h.service.start(areq({authorizationFingerprint:pf.fingerprint})).done;
 assert.equal(rec.state,'FAILED');assert.equal(rec.children!.length,1);assert.equal(bad.providerCalls.filter(c=>c==='render').length,1);assert.deepEqual(spare.providerCalls,[]);assert.equal(rec.sequence,undefined);
});
test('character_animation: actor without an approved reference blocks before any provider call',async()=>{
 const {h,b}=await setup(2);(h.refs as any).refs.clear();for(const a of await h.storage.listProjectAssets('project_001','characters'))await h.storage.deleteAsset(a);
 const pf=await h.service.preflight(areq());assert.equal(pf.status,'BLOCKED');assert.match(pf.reasons.join(),/no approved reference/);assert.deepEqual(b.providerCalls,[]);
});
test('character_animation: only one animation run at a time, and cancel stops between clips',async()=>{
 const {h}=await setup(3);const pf=await h.service.preflight(areq());
 const run=h.service.start(areq({authorizationFingerprint:pf.fingerprint}));assert.throws(()=>h.service.start(areq({authorizationFingerprint:pf.fingerprint})),/already in progress/);
 assert.equal(await h.service.cancel(run.jobId),true);const rec=await run.done;assert.ok(['CANCELLED','COMPLETED'].includes(rec.state));
});
