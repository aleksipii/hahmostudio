import type {BackendCapabilities,BackendValidation,CostEstimate,RenderJob,RenderResult} from './types.ts';
import type {BackendDescriptor,RenderBackend} from './backends.ts';
import {assertToken,type ExecutionToken} from './compute.ts';

export type MockOptions={descriptor:BackendDescriptor;cost:number|null;confidence?:CostEstimate['confidence'];available?:boolean;output?:Uint8Array;failRender?:boolean;workflows?:string[]};
export const PNG_1X1=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='),c=>c.charCodeAt(0));
/** Development backend that simulates free/paid/unknown classes and records every provider-touching call. */
export class MockRenderBackend implements RenderBackend{
 readonly descriptor:BackendDescriptor;readonly providerCalls:string[]=[];private o:MockOptions;
 constructor(o:MockOptions){this.descriptor=o.descriptor;this.o=o;}
 async getCapabilities():Promise<BackendCapabilities>{return{workflows:this.o.workflows??['text_to_image','image_to_image','character_reference','character_animation','image_to_video'],outputFormats:['png','mp4']};}
 async estimateCost():Promise<CostEstimate>{return{estimatedCostEur:this.o.cost,confidence:this.o.confidence??(this.o.cost===null?'unknown':'exact'),billingProvider:this.descriptor.billingProvider};}
 async validate(job:RenderJob,auth:ExecutionToken):Promise<BackendValidation>{assertToken(auth,job.id,this.descriptor.id);this.providerCalls.push('validate');return this.o.available===false?{ok:false,problems:['Backend is unavailable.']}:{ok:true,problems:[]};}
 async render(job:RenderJob,auth:ExecutionToken,_inputs?:ReadonlyMap<string,Uint8Array>):Promise<RenderResult>{assertToken(auth,job.id,this.descriptor.id);this.providerCalls.push('render');if(this.o.failRender)throw new Error('Mock render failure.');return{artifacts:[{name:`${job.id}.png`,mime:'image/png',bytes:this.o.output??PNG_1X1}],backendJobId:'mock-'+job.id};}
 async cancel(jobId:string){this.providerCalls.push('cancel:'+jobId);}
}
export const mockFree=(id='mock-free')=>new MockRenderBackend({descriptor:{id,class:'free',provider:'mock',billingProvider:'none',enabled:true},cost:0});
export const mockPaid=(cost=0.01,id='mock-paid')=>new MockRenderBackend({descriptor:{id,class:'paid',provider:'mock',billingProvider:'mock-cloud',enabled:true},cost});
export const mockUnknownCost=(id='mock-unknown-cost')=>new MockRenderBackend({descriptor:{id,class:'free',provider:'mock',billingProvider:'mock-cloud',enabled:true},cost:null,confidence:'unknown'});
export const mockUnknownClass=(id='mock-unknown-class')=>new MockRenderBackend({descriptor:{id,class:'unknown',provider:'mock',billingProvider:'mock-cloud',enabled:true},cost:0});
