import {test} from 'node:test';import assert from 'node:assert/strict';
import {assessModel,ModelRegistry,ModelRouter,SEED_MODELS} from './models.ts';
import {ZERO_COST_POLICY} from './compute.ts';
import {goodModel,REV,SHA} from './test-fixtures.ts';
import {Blocked} from './types.ts';

const P=ZERO_COST_POLICY;
test('Apache-2.0 with confirming metadata is allowed in PRODUCTION_SAFE',()=>assert.ok(assessModel(goodModel(),'PRODUCTION_SAFE',P).ok));
for(const c of ['restricted','unknown','not-allowed'] as const)test('commercialUse='+c+' is blocked in PRODUCTION_SAFE',()=>{assert.equal(assessModel(goodModel({commercialUse:c}),'PRODUCTION_SAFE',P).ok,false);assert.ok(assessModel(goodModel({commercialUse:c}),'DEVELOPMENT',P).ok);});
test('an "apache-2.0" label without allowed metadata or evidence is not trusted',()=>{
 assert.equal(assessModel(goodModel({commercialUse:'unknown'}),'PRODUCTION_SAFE',P).ok,false);
 assert.equal(assessModel(goodModel({licenseEvidenceUrl:undefined}),'PRODUCTION_SAFE',P).ok,false);
 assert.equal(assessModel(goodModel({licenseCheckedAt:undefined}),'PRODUCTION_SAFE',P).ok,false);
});
test('unpinned or malformed revisions and checksums block',()=>{
 assert.match(assessModel(goodModel({revision:undefined}),'PRODUCTION_SAFE',P).reasons.join(),/not pinned/);
 assert.equal(assessModel(goodModel({revision:'main'}),'PRODUCTION_SAFE',P).ok,false);
 assert.equal(assessModel(goodModel({files:[{path:'a.safetensors',sha256:'xyz',comfyFolder:'checkpoints'}]}),'PRODUCTION_SAFE',P).ok,false);
});
test('model cost is separate from compute cost but still bounded by policy',()=>assert.equal(assessModel(goodModel({modelCostEur:1}),'PRODUCTION_SAFE',P).ok,false));
test('router never substitutes a model silently',()=>{
 const r=new ModelRouter(new ModelRegistry([goodModel({id:'bad',commercialUse:'unknown'}),goodModel({id:'good'})]));
 assert.throws(()=>r.select({workflowId:'text_to_image',modelId:'bad',mode:'PRODUCTION_SAFE',policy:P}),Blocked);
 assert.equal(r.select({workflowId:'text_to_image',mode:'PRODUCTION_SAFE',policy:P}).id,'good');
 assert.throws(()=>r.select({workflowId:'image_to_video',mode:'PRODUCTION_SAFE',policy:P}),/No registered model/);
});
test('shipped registry is honest: nothing is production-safe until an operator pins revisions',()=>{
 const reg=new ModelRegistry();for(const m of SEED_MODELS)assert.equal(assessModel(m,'PRODUCTION_SAFE',P).ok,false,m.id);
 assert.equal(reg.get('ltx-video')!.commercialUse,'unknown');assert.equal(reg.get('sdxl-base-1.0')!.commercialUse,'restricted');
 reg.applyPins({'wan2.2-ti2v-5b':{revision:REV,files:[{path:'x/wan.safetensors',sha256:SHA,comfyFolder:'diffusion_models'}]}});
 assert.ok(assessModel(reg.get('wan2.2-ti2v-5b')!,'PRODUCTION_SAFE',P).ok);
 assert.throws(()=>reg.applyPins({'ltx-video':{revision:'main'}}));
 reg.applyPins({'ltx-video':{revision:REV}});assert.equal(assessModel(reg.get('ltx-video')!,'PRODUCTION_SAFE',P).ok,false,'a pin cannot change license status');
});
test('registry entries are immutable',()=>{const m=new ModelRegistry().get('flux1-schnell')!;assert.throws(()=>{(m as {commercialUse:string}).commercialUse='allowed';},TypeError);});
