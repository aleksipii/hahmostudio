import {test} from 'node:test';import assert from 'node:assert/strict';
import {ComputeCostGate,PaidComputeFirewall,ZERO_COST_POLICY,loadComputePolicy,assertToken,costViolations} from './compute.ts';
import {mockFree,mockPaid,mockUnknownCost,mockUnknownClass,MockRenderBackend} from './mock-backend.ts';
import {Blocked,type ComputePolicy,type RenderJob} from './types.ts';
import {BackendRegistry} from './backends.ts';

const job={id:'j1',projectId:'p',sceneId:'s',workflowId:'text_to_image',modelId:'m',prompt:'x',inputs:[],outputFormat:'png',requestedBy:'t',createdAt:'now',params:{width:64,height:64,steps:1,sampler:'euler',scheduler:'normal',cfg:1}} as RenderJob;
const gate=new ComputeCostGate(),fw=new PaidComputeFirewall();
test('default policy is zero-cost, frozen, with no paid fallback',()=>{
 assert.deepEqual({m:ZERO_COST_POLICY.mode,p:ZERO_COST_POLICY.allowPaidCompute,c:ZERO_COST_POLICY.maxCostEur,f:ZERO_COST_POLICY.allowPaidFallback,u:ZERO_COST_POLICY.allowUnknownCost},{m:'zero-cost',p:false,c:0,f:false,u:false});
 assert.throws(()=>{(ZERO_COST_POLICY as {maxCostEur:number}).maxCostEur=5;},TypeError);
 assert.equal(loadComputePolicy({}),ZERO_COST_POLICY);
 assert.equal(loadComputePolicy({HAHMOSTUDIO_MAX_COST_EUR:'5'}),ZERO_COST_POLICY,'a budget without the explicit paid switch stays zero-cost');
 assert.equal(loadComputePolicy({HAHMOSTUDIO_ALLOW_PAID_COMPUTE:'true',HAHMOSTUDIO_MAX_COST_EUR:'5'}),ZERO_COST_POLICY,'loose truthy values do not enable paid compute');
 assert.throws(()=>loadComputePolicy({HAHMOSTUDIO_ALLOW_PAID_FALLBACK:'1'}));assert.throws(()=>loadComputePolicy({HAHMOSTUDIO_ALLOW_UNKNOWN_COST:'1'}));
 assert.throws(()=>loadComputePolicy({HAHMOSTUDIO_ALLOW_PAID_COMPUTE:'yes-i-accept-charges',HAHMOSTUDIO_MAX_COST_EUR:'0'}));
});
test('free EUR 0 backend is authorized; firewall issues a token',async()=>{
 const b=mockFree(),a=await gate.authorize(job,b,ZERO_COST_POLICY);assert.ok(a.authorized,a.reasons.join());
 const t=await fw.clear(job,b,a,ZERO_COST_POLICY);assert.doesNotThrow(()=>assert(assertToken(t,'j1','mock-free')===undefined));
 assert.throws(()=>assertToken(t,'other','mock-free'),Blocked);assert.throws(()=>assertToken({...t} as never,'j1','mock-free'),Blocked,'forged token');
});
for(const [name,b,re] of [['paid backend',mockPaid(0.01),/Paid|paid/],['EUR 0.01 on a free-classified backend',new MockRenderBackend({descriptor:{id:'x',class:'free',provider:'m',billingProvider:'m',enabled:true},cost:0.01}),/exceeds|only EUR 0/],['unknown cost',mockUnknownCost(),/unknown/i],['unknown class',mockUnknownClass(),/unknown backend class/],['unknown billing provider',new MockRenderBackend({descriptor:{id:'x',class:'free',provider:'m',billingProvider:'unknown',enabled:true},cost:0}),/Billing provider/],['disabled backend',new MockRenderBackend({descriptor:{id:'x',class:'free',provider:'m',billingProvider:'none',enabled:false},cost:0}),/disabled/],['a paid backend that claims EUR 0',new MockRenderBackend({descriptor:{id:'x',class:'paid',provider:'m',billingProvider:'c',enabled:true},cost:0}),/Paid/]] as const){
 test('zero-cost blocks: '+name,async()=>{const a=await gate.authorize(job,b,ZERO_COST_POLICY);assert.equal(a.authorized,false);assert.match(a.reasons.join(' '),re);await assert.rejects(fw.clear(job,b,a,ZERO_COST_POLICY),Blocked);assert.deepEqual(b.providerCalls,[]);});
}
test('firewall re-checks independently: a forged authorization cannot clear a paid backend',async()=>{
 const b=mockPaid(0.01),forged={authorized:true,backendId:'mock-paid',estimate:{estimatedCostEur:0,confidence:'exact',billingProvider:'mock-cloud'},reasons:[],policyMode:'zero-cost',maxCostEur:0,paidFallback:'DISABLED',paidCompute:'DISABLED'} as never;
 await assert.rejects(fw.clear(job,b,forged,ZERO_COST_POLICY),Blocked);
});
test('provider methods cannot be called without a token',async()=>{const b=mockFree();await assert.rejects(b.render(job,undefined as never),/without a PaidComputeFirewall/);await assert.rejects(b.validate(job,{jobId:'j1',backendId:'mock-free',estimatedCostEur:0}),Blocked);assert.deepEqual(b.providerCalls,[]);});
test('a policy that would allow paid fallback or unknown cost is itself blocked',()=>{
 const bad={...ZERO_COST_POLICY,allowPaidFallback:true} as unknown as ComputePolicy;
 assert.ok(costViolations(mockFree().descriptor,{estimatedCostEur:0,confidence:'exact',billingProvider:'none'},bad).length);
});
test('limited paid policy still blocks unknown cost and over-budget cost',()=>{
 const p=loadComputePolicy({HAHMOSTUDIO_ALLOW_PAID_COMPUTE:'yes-i-accept-charges',HAHMOSTUDIO_MAX_COST_EUR:'1'});
 assert.deepEqual(costViolations(mockPaid().descriptor,{estimatedCostEur:0.5,confidence:'exact',billingProvider:'c'},p),[]);
 assert.ok(costViolations(mockPaid().descriptor,{estimatedCostEur:1.5,confidence:'exact',billingProvider:'c'},p).length);
 assert.ok(costViolations(mockPaid().descriptor,{estimatedCostEur:null,confidence:'unknown',billingProvider:'c'},p).length);
});
test('registry never falls back: no eligible backend means stop',()=>{
 const r=new BackendRegistry().register(mockPaid());
 assert.throws(()=>r.select(undefined,d=>d.class==='free'),/No approved zero-cost compute backend/);
});
