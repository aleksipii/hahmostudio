import type {BackendCapabilities,BackendClass,BackendValidation,CostEstimate,RenderJob,RenderResult} from './types.ts';
import {Blocked} from './types.ts';
import type {ExecutionToken} from './compute.ts';

/** Static classification: the exact execution path is classified explicitly, never inferred from a free tier. */
export type BackendDescriptor={id:string;class:BackendClass;provider:string;billingProvider:string;enabled:boolean};
export interface RenderBackend{
 readonly descriptor:BackendDescriptor;
 /** Static; never contacts the provider. */
 getCapabilities():Promise<BackendCapabilities>;
 /** Static/declarative; never contacts the provider. */
 estimateCost(job:RenderJob):Promise<CostEstimate>;
 /** Optional, offline: problems that can be found without contacting the provider (e.g. workflow cannot be built). */
 staticValidate?(job:RenderJob):string[];
 /** Contacts the runtime: requires an execution token. */
 validate(job:RenderJob,auth:ExecutionToken):Promise<BackendValidation>;
 /** `inputs` maps RenderInput.assetId to bytes already fetched from storage. */
 render(job:RenderJob,auth:ExecutionToken,inputs?:ReadonlyMap<string,Uint8Array>):Promise<RenderResult>;
 cancel(jobId:string,auth?:ExecutionToken):Promise<void>;
}
export class BackendRegistry{
 private readonly items=new Map<string,RenderBackend>();
 register(b:RenderBackend){if(this.items.has(b.descriptor.id))throw new Error('Duplicate backend '+b.descriptor.id);this.items.set(b.descriptor.id,b);return this;}
 get(id:string){return this.items.get(id);}
 list(){return [...this.items.values()];}
 /**
  * Selection is static and deterministic: first registered backend whose classification passes policy.
  * There is intentionally no retry/fallback loop; a failure after authorization ends the job.
  */
 select(preferred:string|undefined,eligible:(d:BackendDescriptor)=>boolean):RenderBackend{
  if(preferred){const b=this.items.get(preferred);if(!b)throw new Blocked('backend-unknown',`Backend "${preferred}" is not registered.`);return b;}
  const b=this.list().find(x=>eligible(x.descriptor));
  if(!b)throw new Blocked('no-backend','No approved zero-cost compute backend is available.');
  return b;
 }
}
/** Placeholder for providers that are classified but not implemented/enabled (e.g. paid GPU clouds). Every provider path throws. */
export class DisabledBackend implements RenderBackend{
 readonly descriptor:BackendDescriptor;
 constructor(descriptor:BackendDescriptor){this.descriptor={...descriptor,enabled:false};}
 async getCapabilities():Promise<BackendCapabilities>{return{workflows:[],outputFormats:[]};}
 async estimateCost():Promise<CostEstimate>{return{estimatedCostEur:null,confidence:'unknown',billingProvider:this.descriptor.billingProvider};}
 async validate():Promise<BackendValidation>{throw new Blocked('backend-disabled',`Backend "${this.descriptor.id}" is disabled.`);}
 async render():Promise<RenderResult>{throw new Blocked('backend-disabled',`Backend "${this.descriptor.id}" is disabled.`);}
 async cancel(){}
}
