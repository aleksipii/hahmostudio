import {test} from 'node:test';import assert from 'node:assert/strict';
import {harness,req,goodModel,REV,SHA} from './test-fixtures.ts';
import {MockRenderBackend,mockFree,mockPaid,mockUnknownCost} from './mock-backend.ts';
import {assessModel,ModelRegistry,SEED_MODELS} from './models.ts';
import {ZERO_COST_POLICY} from './compute.ts';
import {buildPin} from './pins.ts';
import {createCloudRender} from './server.ts';
import {smokeCheck} from './smoke.ts';
import {WorkflowRegistry} from './workflows.ts';
import {LiveVerificationLedger,modelFingerprint,type ProvisionReceipt} from './live-verification.ts';
import {InMemoryStorage,type AssetRef} from './storage.ts';
import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';

const P=ZERO_COST_POLICY;
const live=(id='live-free',over:Partial<ConstructorParameters<typeof MockRenderBackend>[0]>={})=>new MockRenderBackend({descriptor:{id,class:'free',provider:'comfyui-fake',billingProvider:'none',enabled:true},cost:0,...over});

// 1-3 model pins
test('1. unpinned revision stays BLOCKED in production-safe mode (and nothing is contacted)',async()=>{
 const b=live(),h=await harness([b],{models:[goodModel({revision:undefined})]});
 const rec=await h.service.start(req({modelId:'test-model'})).done;assert.equal(rec.blocked!.code,'model-license');assert.match(rec.blocked!.banner,/not pinned/);assert.deepEqual(b.providerCalls,[]);
 assert.equal((await h.service.start(req()).done).blocked!.code,'no-model','no silent substitution either');
 const pf=await h.service.preflight(req({modelId:'test-model'}));assert.equal(pf.status,'BLOCKED');assert.equal(pf.fingerprint,undefined);assert.equal(pf.model!.revision,undefined,'card shows the revision is NOT pinned');assert.match(pf.reasons.join(),/not pinned/);
});
test('2. revisions and checksums are never invented',async()=>{
 for(const m of SEED_MODELS){assert.equal(m.revision,undefined,m.id);assert.equal(m.files,undefined,m.id);}
 const noHash=(async()=>new Response(JSON.stringify({sha:REV,siblings:[{rfilename:'w.safetensors'}]}))) as unknown as typeof fetch;
 await assert.rejects(buildPin('o/r',[{path:'w.safetensors',comfyFolder:'checkpoints',role:'checkpoint'}],noHash),/No SHA-256/);
 const noSha=(async()=>new Response(JSON.stringify({siblings:[]}))) as unknown as typeof fetch;await assert.rejects(buildPin('o/r',[],noSha),/No exact commit/);
 assert.throws(()=>new ModelRegistry().applyPins({'flux1-schnell':{revision:'main'}}));
 assert.throws(()=>new ModelRegistry().applyPins({'flux1-schnell':{revision:REV,files:[{path:'a',sha256:'abc',comfyFolder:'vae'}]}}));
});
test('3. unknown revision OR unknown checksum is NOT production-safe',async()=>{
 assert.equal(assessModel(goodModel({files:undefined}),'PRODUCTION_SAFE',P).ok,false);
 assert.equal(assessModel(goodModel({files:[]}),'PRODUCTION_SAFE',P).ok,false);
 assert.equal(assessModel(goodModel({revision:undefined}),'PRODUCTION_SAFE',P).ok,false);
 assert.ok(assessModel(goodModel(),'PRODUCTION_SAFE',P).ok);
 const b=live(),h=await harness([b],{models:[goodModel({files:undefined})]});assert.equal((await h.service.start(req({modelId:'test-model'})).done).blocked!.code,'model-license');assert.deepEqual(b.providerCalls,[]);
});
// 4-9 cost
test('4. unknown cost stays blocked, in preflight and in render',async()=>{
 const b=mockUnknownCost(),h=await harness([b]);const pf=await h.service.preflight(req({backendId:'mock-unknown-cost'}));
 assert.equal(pf.status,'BLOCKED');assert.equal(pf.estimate!.estimatedCostEur,null);assert.match(pf.reasons.join(),/unknown/i);assert.equal(pf.fingerprint,undefined);assert.deepEqual(b.providerCalls,[]);
});
test('5-7. defaults: paid backends disabled, max EUR 0.00, paid fallback off — and env cannot loosen them',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'inv-'));try{
  const c=createCloudRender({HAHMOSTUDIO_STORAGE:'local-dev'},dir);
  assert.deepEqual([c.policy.maxCostEur,c.policy.allowPaidCompute,c.policy.allowPaidFallback,c.policy.allowUnknownCost],[0,false,false,false]);
  for(const id of ['runpod','modal']){const b=c.backends.get(id)!;assert.deepEqual([b.descriptor.class,b.descriptor.enabled],['paid',false]);}
  assert.throws(()=>createCloudRender({HAHMOSTUDIO_ALLOW_PAID_FALLBACK:'1'},dir));
  assert.equal(createCloudRender({HAHMOSTUDIO_MAX_COST_EUR:'5',HAHMOSTUDIO_STORAGE:'local-dev'},dir).policy.maxCostEur,0);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('8. preflight is provider-free; the provider is only reached after gate and firewall',async()=>{
 const f=live(),p=mockPaid(0.01,'mock-paid'),h=await harness([f,p]);
 assert.equal((await h.service.preflight(req())).status,'AUTHORIZED');assert.equal((await h.service.preflight(req({backendId:'mock-paid'}))).status,'BLOCKED');
 assert.deepEqual([f.providerCalls,p.providerCalls],[[],[]]);
 await assert.rejects(p.render({id:'x'} as never,undefined as never),/without a PaidComputeFirewall/);assert.deepEqual(p.providerCalls,[]);
});
test('9. no automatic fallback from free to paid',async()=>{
 const free=live('free-down',{available:false}),paid=mockPaid(0.01,'paid-ok'),h=await harness([free,paid]);
 const rec=await h.service.start(req()).done;assert.equal(rec.state,'BLOCKED');assert.deepEqual(paid.providerCalls,[]);
 const failing=live('free-fail',{failRender:true}),paid2=mockPaid(0.01,'paid2'),h2=await harness([failing,paid2]);assert.equal((await h2.service.start(req()).done).state,'FAILED');assert.deepEqual(paid2.providerCalls,[]);
});
// 10 smoke
test('10. smoke check is render-free',async()=>{
 const b=live(),h=await harness([b]);const r=await smokeCheck(b,h.models,new WorkflowRegistry(),P,'PRODUCTION_SAFE');
 assert.ok(r.authorized);assert.ok(r.rows.length>0);assert.ok(b.providerCalls.length>0&&b.providerCalls.every(c=>c==='validate'),b.providerCalls.join());
 const paid=mockPaid();assert.equal((await smokeCheck(paid,h.models,new WorkflowRegistry(),P,'PRODUCTION_SAFE')).authorized,false);assert.deepEqual(paid.providerCalls,[]);
});
// authorization card and server authority
test('preflight card shows every field before execution and the render must match it',async()=>{
 const b=live(),h=await harness([b],{requireFp:true});
 const pf=await h.service.preflight(req());
 assert.equal(pf.status,'AUTHORIZED');assert.deepEqual([pf.backend!.id,pf.backend!.class],['live-free','free']);assert.equal(pf.estimate!.estimatedCostEur,0);
 assert.deepEqual([pf.maxCostEur,pf.paidCompute,pf.paidFallback],[0,'DISABLED','DISABLED']);
 assert.deepEqual([pf.model!.id,pf.model!.revision,pf.model!.license,pf.model!.commercialUse,pf.model!.checksumsPinned],['test-model',REV,'apache-2.0','allowed',true]);
 assert.deepEqual([pf.workflowId,pf.workflowRevision],['text_to_image',1]);assert.match(pf.fingerprint!,/^[0-9a-f]{64}$/);
 assert.deepEqual(b.providerCalls,[]);
 const none=await h.service.start(req()).done;assert.equal(none.blocked!.code,'authorization-required');assert.deepEqual(b.providerCalls,[]);
 // what changes between preflight and render invalidates it (here: the model pin)
 h.models.applyPins({'test-model':{revision:'b'.repeat(40),files:[{path:'sd.safetensors',sha256:SHA,comfyFolder:'checkpoints'}]}});
 const stale=await h.service.start(req({authorizationFingerprint:pf.fingerprint})).done;assert.equal(stale.blocked!.code,'authorization-changed');assert.deepEqual(b.providerCalls,[]);
 const fresh=await h.service.preflight(req());assert.notEqual(fresh.fingerprint,pf.fingerprint);
 const ok=await h.service.start(req({authorizationFingerprint:fresh.fingerprint})).done;assert.equal(ok.state,'COMPLETED');
});
test('browser cannot supply policy-like fields, including through preflight',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'inv-'));try{
  const c=createCloudRender({HAHMOSTUDIO_STORAGE:'local-dev'},dir);
  for(const path of ['/api/render','/api/render/preflight']){const r=await c.handle({method:'POST',path,body:{projectId:'p',sceneId:'s',workflowId:'text_to_image',maxCostEur:5,allowPaidCompute:true},user:'u'});assert.equal(r.status,400);}
  assert.equal((await c.handle({method:'POST',path:'/api/live-verification',body:{liveVerified:true},user:'u'})).status,405);
  assert.equal((await c.handle({method:'PUT',path:'/api/live-verification/smoke',body:{},user:'u'})).status,405);
  assert.equal(c.policy.maxCostEur,0);
 }finally{await rm(dir,{recursive:true,force:true});}
});
// liveVerified
const receipt=(m:{revision?:string}):ProvisionReceipt=>({schema:1,repo:'test/model',revision:m.revision as string,files:[{path:'sd.safetensors',sha256:SHA}]});
async function liveHarness(o:{mode?:'PRODUCTION_SAFE'|'DEVELOPMENT';receipts?:ProvisionReceipt[];smoke?:boolean;backend?:MockRenderBackend;wrap?:(s:InMemoryStorage)=>InMemoryStorage;smokeAt?:Date}={}){
 let ledgerRef!:LiveVerificationLedger;const b=o.backend??live();
 const h=await harness([b],{mode:o.mode,requireFp:true,wrapStorage:o.wrap,ledger:(storage,models)=>{ledgerRef=new LiveVerificationLedger({models,policy:P,mode:o.mode??'PRODUCTION_SAFE',storage,receipts:()=>o.receipts??[receipt({revision:REV})]});return ledgerRef;}});
 if(o.smoke!==false){const rows=[{workflowId:'text_to_image',modelId:'test-model',ok:true,problems:[]}];
  const early=new LiveVerificationLedger({models:h.models,policy:P,mode:o.mode??'PRODUCTION_SAFE',storage:h.storage,receipts:()=>[],now:()=>o.smokeAt??new Date(Date.now()-60000)});await early.recordSmoke(b.descriptor.id,b.descriptor.provider,rows);
  (ledgerRef as unknown as {smoke:unknown}).smoke=(early as unknown as {smoke:unknown}).smoke;}
 const pf=await h.service.preflight(req());const rec=await h.service.start(req({authorizationFingerprint:pf.fingerprint})).done;return{h,rec,ledger:ledgerRef,b};
}
test('liveVerified is granted only when every condition holds',async()=>{
 const {rec,ledger}=await liveHarness();
 assert.equal(rec.state,'COMPLETED');assert.deepEqual(rec.liveVerification,{promoted:true,missing:[]});assert.ok(await ledger.isVerified('text_to_image','test-model'));assert.equal(await ledger.isVerified('image_to_video'),false);
 const m=(rec as unknown as {model:{revision:string}}).model;assert.equal(m.revision,REV);
});
const cases:[string,Parameters<typeof liveHarness>[0],string][]=[
 ['smoke not passed',{smoke:false},'smoke-not-passed'],
 ['smoke older than 24h',{smokeAt:new Date(Date.now()-25*3600*1000)},'smoke-not-passed'],
 ['no provisioning receipt',{receipts:[]},'checksums-not-verified'],
 ['receipt with a different checksum',{receipts:[{...receipt({revision:REV}),files:[{path:'sd.safetensors',sha256:'c'.repeat(64)}]}]},'checksums-not-verified'],
 ['receipt for a different revision',{receipts:[receipt({revision:'d'.repeat(40)})]},'checksums-not-verified'],
 ['not in production-safe mode',{mode:'DEVELOPMENT'},'license-not-validated'],
 ['mock backend',{backend:mockFree('mock-free')},'backend-not-live'],
 ['audit record not written',{wrap:(s:InMemoryStorage)=>{const o=s.uploadAsset.bind(s);s.uploadAsset=async(p,f,n,b,m)=>{if(f==='logs'||n.endsWith('.record.json'))throw new Error('disk full');return o(p,f,n,b,m);};return s;}},'audit-not-written'],
];
for(const [name,opts,missing] of cases)test('liveVerified refused: '+name,async()=>{
 const {rec,ledger}=await liveHarness(opts);assert.equal(rec.liveVerification?.promoted,false);assert.ok(rec.liveVerification!.missing.includes(missing),JSON.stringify(rec.liveVerification));assert.equal(await ledger.isVerified('text_to_image'),false);
});
test('liveVerified refused: render failed, output not uploaded, revision/checksum unknown',async()=>{
 const {rec,ledger,h}=await liveHarness();
 const failed=structuredClone(rec);failed.state='FAILED';assert.ok((await ledger.evaluate(failed,'comfyui-fake')).missing.includes('render-not-completed'));
 const nothing=structuredClone(rec);nothing.outputs=[];assert.ok((await ledger.evaluate(nothing,'comfyui-fake')).missing.includes('output-not-uploaded'));
 const ghost=structuredClone(rec);ghost.outputs=[{...rec.outputs[0],name:'never-uploaded.png'} as AssetRef];assert.ok((await ledger.evaluate(ghost,'comfyui-fake')).missing.includes('output-not-uploaded'));
 const bad=new ModelRegistry([goodModel({revision:undefined,files:undefined})]);const l2=new LiveVerificationLedger({models:bad,policy:P,mode:'PRODUCTION_SAFE',storage:h.storage,receipts:()=>[receipt({revision:REV})]});
 const miss=(await l2.evaluate(rec,'comfyui-fake')).missing;assert.ok(miss.includes('revision-not-pinned')&&miss.includes('checksums-not-verified')&&miss.includes('license-not-validated'),miss.join());
});
test('a changed pin invalidates earlier liveVerified status',async()=>{
 const {ledger,h}=await liveHarness();assert.ok(await ledger.isVerified('text_to_image'));
 h.models.applyPins({'test-model':{revision:'e'.repeat(40),files:[{path:'sd.safetensors',sha256:SHA,comfyFolder:'checkpoints'}]}});assert.equal(await ledger.isVerified('text_to_image'),false);
 assert.notEqual(await modelFingerprint(h.models.get('test-model')!),'');
});
test('weights never reach local disk or storage during any of this',async()=>{
 const {h}=await liveHarness();const names=(await h.storage.listProjectAssets('project_001')).map(a=>a.name);assert.ok(names.every(n=>!/\.(safetensors|ckpt|bin|pth|pt|gguf)$/i.test(n)));
});
