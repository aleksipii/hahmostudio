import {test} from 'node:test';import assert from 'node:assert/strict';
import {createCloudRender} from './server.ts';
import {canon,goodSuggestion} from './test-fixtures.ts';
import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';

async function setup(env:Record<string,string>={}){
 const dir=await mkdtemp(join(tmpdir(),'hs-api-')),c=createCloudRender({HAHMOSTUDIO_STORAGE:'local-dev',...env},dir);
 const call=(method:string,path:string,body?:unknown)=>{const u=new URL(path,'http://x');return c.handle({method,path:u.pathname,query:u.searchParams,body,user:'owner'});};
 return{c,call,done:()=>rm(dir,{recursive:true,force:true})};
}
test('defaults: zero-cost policy, PRODUCTION_SAFE, no backend usable, policy is read-only',async()=>{
 const {call,done}=await setup();try{
  const h=await call('GET','/api/health');assert.equal((h.body as any).policy.maxCostEur,0);assert.equal((h.body as any).modelMode,'PRODUCTION_SAFE');
  const p=(await call('GET','/api/compute/policy')).body as any;assert.deepEqual({a:p.allowPaidCompute,b:p.allowPaidFallback,c:p.allowUnknownCost,d:p.maxCostEur},{a:false,b:false,c:false,d:0});
  for(const m of ['PUT','POST','PATCH','DELETE'])assert.equal((await call(m,'/api/compute/policy',{maxCostEur:5,allowPaidCompute:true})).status,405);
  assert.equal((await call('POST','/api/models/flux1-schnell',{commercialUse:'allowed'})).status,405);
  const b=(await call('GET','/api/backends')).body as any;
  assert.deepEqual(b.backends.map((x:any)=>[x.id,x.class,x.enabled,x.eligibleUnderPolicy]),[['colab-free','free',false,false],['runpod','paid',false,false],['modal','paid',false,false]]);
  const m=(await call('GET','/api/models')).body as any;assert.ok(m.models.length>=5&&m.models.every((x:any)=>!x.assessment.ok),'nothing production-safe until pinned');
  assert.equal((await call('GET','/api/models/nope')).status,404);
  const e=(await call('GET','/api/compute/estimate?backendId=runpod')).body as any;assert.equal(e.authorized,false);
 }finally{await done();}
});
test('env cannot enable paid fallback, and loose values keep zero-cost',async()=>{
 await assert.rejects(setup({HAHMOSTUDIO_ALLOW_PAID_FALLBACK:'1'}));
 const {call,done}=await setup({HAHMOSTUDIO_ALLOW_PAID_COMPUTE:'1',HAHMOSTUDIO_MAX_COST_EUR:'9'});try{assert.equal(((await call('GET','/api/compute/policy')).body as any).allowPaidCompute,false);}finally{await done();}
});
test('colab backend stays disabled unless the operator classifies the path as free over HTTPS',async()=>{
 for(const env of [{HAHMOSTUDIO_COLAB_COMFYUI_URL:'https://x.example'} as Record<string,string>,{HAHMOSTUDIO_COLAB_COMFYUI_URL:'http://x.example',HAHMOSTUDIO_COLAB_CLASSIFIED_FREE:'yes'}]){
  const {call,done}=await setup(env);try{assert.equal(((await call('GET','/api/backends')).body as any).backends[0].enabled,false);}finally{await done();}
 }
 const {call,done}=await setup({HAHMOSTUDIO_COLAB_COMFYUI_URL:'https://x.example',HAHMOSTUDIO_COLAB_CLASSIFIED_FREE:'yes'});try{const b=((await call('GET','/api/backends')).body as any).backends[0];assert.deepEqual([b.enabled,b.eligibleUnderPolicy],[true,true]);}finally{await done();}
});
test('project, lock, direct, validate and render endpoints enforce the pipeline',async()=>{
 const {call,done}=await setup();try{
  assert.equal((await call('PUT','/api/projects/project_001',{...canon(),characters:{}})).status,422);
  assert.equal((await call('PUT','/api/projects/other',canon())).status,400);
  assert.equal((await call('PUT','/api/projects/project_001',canon())).status,200);
  assert.equal(((await call('GET','/api/projects/project_001/scenes')).body as any).scenes[0].locked,false);
  const d=(await call('POST','/api/ai/direct',{projectId:'project_001',sceneId:'scene_001'})).body as any;assert.equal(d.status,'APPROVED');assert.ok(d.checks.every((c:any)=>c.ok));
  assert.equal((await call('POST','/api/ai/direct',{projectId:'project_001',sceneId:'scene_001',useAI:true})).status,400);
  const bad={...goodSuggestion(),characterActions:[{id:'bob',action:'speak'}]};
  const v=(await call('POST','/api/ai/validate',{projectId:'project_001',sceneId:'scene_001',suggestion:bad})).body as any;assert.equal(v.status,'REJECTED');assert.match(v.issues[0].message,/Unknown character "bob"/);
  assert.equal(((await call('POST','/api/ai/validate',{projectId:'project_001',sceneId:'scene_001',suggestion:goodSuggestion()})).body as any).status,'APPROVED');
  // override attempts
  const o=await call('POST','/api/render',{projectId:'project_001',sceneId:'scene_001',workflowId:'text_to_image',maxCostEur:10});assert.equal(o.status,400);assert.equal((o.body as any).code,'client-policy-override');
  // not locked → blocked job; no usable backend either way
  const r=await call('POST','/api/render',{projectId:'project_001',sceneId:'scene_001',workflowId:'text_to_image'});assert.equal(r.status,202);
  const id=(r.body as any).jobId;await new Promise(x=>setTimeout(x,50));const job=(await call('GET','/api/render/'+id)).body as any;assert.equal(job.state,'BLOCKED');assert.equal(job.blocked.code,'lock-missing');assert.equal(job.providerContacted,false);
  assert.equal((await call('POST','/api/projects/project_001/scenes/scene_001/lock')).status,200);
  const r2=await call('POST','/api/render',{projectId:'project_001',sceneId:'scene_001',workflowId:'text_to_image'});await new Promise(x=>setTimeout(x,80));
  const j2=(await call('GET','/api/render/'+(r2.body as any).jobId)).body as any;assert.equal(j2.state,'BLOCKED');assert.match(j2.blocked.banner,/RENDER BLOCKED/);assert.equal(j2.providerContacted,false);
  assert.equal((await call('GET','/api/render/nope')).status,404);
 }finally{await done();}
});
