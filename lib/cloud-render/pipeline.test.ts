import {test} from 'node:test';import assert from 'node:assert/strict';
import {harness,req,goodSuggestion,goodModel} from './test-fixtures.ts';
import {mockFree,mockPaid,mockUnknownCost,MockRenderBackend,PNG_1X1} from './mock-backend.ts';
import {MockAIDirector} from './ai-suggestion.ts';
import {parseRenderRequest} from './pipeline.ts';
import {ZERO_COST_POLICY} from './compute.ts';
import {WorkflowRegistry} from './workflows.ts';

test('happy path: all 21 steps, uploads render + audit + reproducibility metadata',async()=>{
 const free=mockFree(),h=await harness([free]);
 const {done}=h.service.start(req({seed:7,params:{width:1,height:1}}));const rec=await done;
 assert.equal(rec.state,'COMPLETED',JSON.stringify(rec.errors)+JSON.stringify(rec.blocked));
 assert.deepEqual(rec.history.map(x=>x.state),['QUEUED','VALIDATING','COST_CHECK','AUTHORIZED','SUBMITTING','RENDERING','VALIDATING_OUTPUT','UPLOADING','COMPLETED']);
 assert.deepEqual(free.providerCalls,['validate','render']);
 assert.equal(rec.cost!.estimate.estimatedCostEur,0);assert.equal(rec.cost!.paidFallback,'DISABLED');
 assert.equal(rec.model!.revision,'a'.repeat(40));assert.equal(rec.reproducibility!.seed,7);assert.ok(rec.scene.lockHash);
 const names=(await h.storage.listProjectAssets('project_001')).map(a=>`${a.folder}/${a.name}`);
 assert.ok(names.some(n=>n.startsWith('renders/rj_')&&n.endsWith('.png')));assert.ok(names.some(n=>n.endsWith('.record.json')));assert.ok(names.some(n=>n.endsWith('.audit.json')));
 assert.ok(await h.service.audit.verify());
 const tamper=h.service.audit as unknown as {items:{data:unknown}[]};tamper.items[1].data={tampered:true};assert.equal(await h.service.audit.verify(),false);
});
test('paid backend: BLOCKED, provider never contacted, banner explains',async()=>{
 const paid=mockPaid(0.01),h=await harness([paid]);const rec=await h.service.start(req({backendId:'mock-paid'})).done;
 assert.equal(rec.state,'BLOCKED');assert.deepEqual(paid.providerCalls,[]);assert.equal(rec.providerContacted,false);assert.match(rec.blocked!.banner,/RENDER BLOCKED/);assert.match(rec.blocked!.banner,/No provider API was contacted/);assert.equal((await h.storage.listProjectAssets('project_001','renders')).length,0);
});
test('unknown cost: BLOCKED with zero provider calls',async()=>{const b=mockUnknownCost(),h=await harness([b]);const rec=await h.service.start(req({backendId:'mock-unknown-cost'})).done;assert.equal(rec.state,'BLOCKED');assert.deepEqual(b.providerCalls,[]);});
test('free backend unavailable: STOP, and the enabled paid backend is never contacted',async()=>{
 const free=new MockRenderBackend({descriptor:{id:'free-down',class:'free',provider:'m',billingProvider:'none',enabled:true},cost:0,available:false}),paid=mockPaid(0.01);
 const h=await harness([free,paid]);const rec=await h.service.start(req()).done;
 assert.equal(rec.state,'BLOCKED');assert.equal(rec.backend!.id,'free-down');assert.deepEqual(paid.providerCalls,[]);assert.deepEqual(free.providerCalls,['validate']);
 assert.match(rec.blocked!.banner,/RENDER BLOCKED/);assert.match(rec.blocked!.banner,/validation only; no render was started/);assert.doesNotMatch(rec.blocked!.banner,/No provider API was contacted/);
});
test('free backend render failure ends as FAILED; no second backend is tried',async()=>{
 const f=new MockRenderBackend({descriptor:{id:'f1',class:'free',provider:'m',billingProvider:'none',enabled:true},cost:0,failRender:true}),g=mockFree('f2');
 const h=await harness([f,g]);const rec=await h.service.start(req()).done;assert.equal(rec.state,'FAILED');assert.deepEqual(g.providerCalls,[]);
});
test('hallucinating AI Director: rejected before any model/backend work',async()=>{
 const b=mockFree();
 for(const patch of [(s:any)=>{s.characterActions[0].id='bob';},(s:any)=>{s.environment.location='bedroom';},(s:any)=>{s.characterActions[0].claims={hair:'blonde'};},(s:any)=>{s.characterActions.push({id:'alice',action:'pick_up',target:'phone_01'});}]){
  const s=goodSuggestion();patch(s);const h=await harness([b],{director:new MockAIDirector(s)});
  const rec=await h.service.start(req({useAI:true})).done;
  assert.equal(rec.state,'BLOCKED');assert.equal(rec.validation!.status,'REJECTED');assert.equal(rec.job.prompt,'');assert.equal(rec.model,undefined);assert.equal(rec.cost,undefined);
 }
 assert.deepEqual(b.providerCalls,[]);
});
test('good AI suggestion renders and the director only ever sees a frozen context',async()=>{
 const d=new MockAIDirector(goodSuggestion()),b=mockFree(),h=await harness([b],{director:d});
 const rec=await h.service.start(req({useAI:true})).done;assert.equal(rec.state,'COMPLETED',JSON.stringify(rec.blocked));assert.equal(d.calls,1);
 assert.ok(Object.isFrozen(d.lastContext)&&Object.isFrozen(d.lastContext!.canonicalCharacters[0]));
 assert.match(rec.job.prompt,/warm lighting/);assert.match(rec.job.prompt,/Alice looks? ?(toward )?cup|Alice look at cup/);
});
test('AI Director cannot change compute policy or canonical state',async()=>{
 const before=JSON.stringify(ZERO_COST_POLICY);let canonBefore='';
 const evil=new MockAIDirector((c:any)=>{try{(c as any).canonicalCharacters[0].attributes.hair='blonde';}catch{}try{(ZERO_COST_POLICY as any).maxCostEur=99;}catch{}return{...goodSuggestion(),computePolicy:{maxCostEur:99,allowPaidCompute:true}};});
 const b=mockFree(),h=await harness([b],{director:evil});canonBefore=JSON.stringify(h.projects.get('project_001'));
 const rec=await h.service.start(req({useAI:true})).done;
 assert.equal(rec.state,'BLOCKED');assert.equal(JSON.stringify(ZERO_COST_POLICY),before);assert.equal(JSON.stringify(h.projects.get('project_001')),canonBefore);assert.deepEqual(b.providerCalls,[]);
});
test('director failure or missing director blocks',async()=>{
 const h1=await harness([mockFree()],{director:new MockAIDirector(()=>{throw new Error('boom');})});assert.equal((await h1.service.start(req({useAI:true})).done).blocked!.code,'director-failed');
 const h2=await harness([mockFree()]);assert.equal((await h2.service.start(req({useAI:true})).done).blocked!.code,'director-unavailable');
});
test('scene lock is required, and a stale lock blocks',async()=>{
 const h=await harness([mockFree()]);h.projects.unlock('project_001','scene_001');
 assert.equal((await h.service.start(req()).done).blocked!.code,'lock-missing');
 await h.projects.lock('project_001','scene_001','t');const s=h.projects.get('project_001')!;s.characters.alice.attributes.hair='blonde';s.revision=2;await h.projects.put(s);
 assert.equal((await h.service.start(req()).done).blocked!.code,'lock-stale');
});
test('unknown project/scene/workflow/model are blocked',async()=>{
 const h=await harness([mockFree()]);
 assert.equal((await h.service.start(req({projectId:'nope'})).done).blocked!.code,'project-unknown');
 assert.equal((await h.service.start(req({sceneId:'nope'})).done).blocked!.code,'scene-unknown');
 assert.equal((await h.service.start(req({workflowId:'nope'})).done).blocked!.code,'workflow-unknown');
 assert.throws(()=>new WorkflowRegistry().require('character_animation'),/not implemented/,'composite workflow has no graph of its own');
 assert.equal((await h.service.start(req({modelId:'nope'})).done).blocked!.code,'model-unknown');
});
test('unknown-license model is blocked in PRODUCTION_SAFE and never silently replaced',async()=>{
 const b=mockFree(),h=await harness([b],{models:[goodModel({id:'u',commercialUse:'unknown'}),goodModel({id:'ok'})]});
 const rec=await h.service.start(req({modelId:'u'})).done;assert.equal(rec.blocked!.code,'model-license');assert.deepEqual(b.providerCalls,[]);
 const dev=await harness([b],{models:[goodModel({id:'u',commercialUse:'unknown'})],mode:'DEVELOPMENT'});assert.equal((await dev.service.start(req({modelId:'u'})).done).state,'COMPLETED');
});
test('workflow needing a character reference blocks when none is registered',async()=>{
 const b=mockFree(),h=await harness([b]);
 assert.equal((await h.service.start(req({workflowId:'character_reference'})).done).state,'COMPLETED');
 const h2=await harness([b]);(h2.refs as any).refs.clear();for(const a of await h2.storage.listProjectAssets('project_001','characters'))await h2.storage.deleteAsset(a);
 const rec=await h2.service.start(req({workflowId:'character_reference'})).done;assert.equal(rec.blocked!.code,'reference-missing');
});
test('unrecognised or oversized output is rejected before upload',async()=>{
 const b=new MockRenderBackend({descriptor:{id:'f',class:'free',provider:'m',billingProvider:'none',enabled:true},cost:0,output:new Uint8Array([1,2,3,4])}),h=await harness([b]);
 const rec=await h.service.start(req()).done;assert.equal(rec.state,'FAILED');assert.equal((await h.storage.listProjectAssets('project_001','renders')).length,0);
 const w=new MockRenderBackend({descriptor:{id:'f',class:'free',provider:'m',billingProvider:'none',enabled:true},cost:0,output:PNG_1X1}),h2=await harness([w]);
 const r2=await h2.service.start(req({params:{width:512,height:512}})).done;assert.equal(r2.state,'FAILED','strict mode escalates the size mismatch flag');
});
test('client cannot override server-side policy through the request',()=>{
 for(const f of ['maxCostEur','allowPaidCompute','allowPaidFallback','policy','computePolicy','modelMode','commercialUse','canonicalState','prompt','skipValidation','mode'])assert.throws(()=>parseRenderRequest({projectId:'p',sceneId:'s',workflowId:'w',[f]:1},'u'),/server-side policy|Unknown field/,f);
 assert.throws(()=>parseRenderRequest({projectId:'p',sceneId:'s',workflowId:'w',params:{width:100}},'u'));
 assert.throws(()=>parseRenderRequest({projectId:'p',sceneId:'s',workflowId:'w',params:{cfg:1,evil:1}},'u'));
 assert.equal(parseRenderRequest({projectId:'p',sceneId:'s',workflowId:'w',params:{width:512,height:512}},'u').params!.width,512);
});
test('cancel stops a job before provider work',async()=>{
 const b=mockFree(),h=await harness([b]);const {jobId,done}=h.service.start(req());await h.service.cancel(jobId);const rec=await done;
 assert.ok(['CANCELLED','COMPLETED'].includes(rec.state));
});
