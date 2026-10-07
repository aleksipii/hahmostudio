import {test} from 'node:test';import assert from 'node:assert/strict';
import {smokeCheck} from './smoke.ts';
import {ComfyUIBackend} from './comfyui-backend.ts';
import {ModelRegistry} from './models.ts';
import {WorkflowRegistry} from './workflows.ts';
import {ZERO_COST_POLICY} from './compute.ts';
import {mockPaid} from './mock-backend.ts';
import {goodModel} from './test-fixtures.ts';

const info={CheckpointLoaderSimple:{input:{required:{ckpt_name:[['sd.safetensors']]}}},CLIPTextEncode:{},EmptyLatentImage:{},KSampler:{},VAEDecode:{},SaveImage:{},LoadImage:{},VAEEncode:{}};
const mk=(cost:number|null)=>{const models=new ModelRegistry([goodModel()]),workflows=new WorkflowRegistry(),calls:string[]=[];
 const f=(async(u:string)=>{calls.push(new URL(u).pathname);return new Response(JSON.stringify(info));}) as typeof fetch;
 return{models,workflows,calls,b:new ComfyUIBackend({descriptor:{id:'c',class:'free',provider:'comfyui',billingProvider:'none',enabled:true},baseUrl:'https://r.example',declaredCostEur:cost,models,workflows,fetch:f})};};
test('smoke check validates each workflow/model pair without submitting a render',async()=>{
 const {b,models,workflows,calls}=mk(0),r=await smokeCheck(b,models,workflows,ZERO_COST_POLICY,'PRODUCTION_SAFE');
 assert.ok(r.authorized);assert.deepEqual(r.rows.map(x=>[x.workflowId,x.ok]),[['text_to_image',true],['character_reference',true]]);assert.ok(!calls.includes('/prompt'));
});
test('smoke check is blocked before any request when cost is unknown or backend is paid',async()=>{
 const {b,models,workflows,calls}=mk(null);assert.equal((await smokeCheck(b,models,workflows,ZERO_COST_POLICY,'PRODUCTION_SAFE')).authorized,false);assert.deepEqual(calls,[]);
 const p=mockPaid();assert.equal((await smokeCheck(p,models,workflows,ZERO_COST_POLICY,'PRODUCTION_SAFE')).authorized,false);assert.deepEqual(p.providerCalls,[]);
});
