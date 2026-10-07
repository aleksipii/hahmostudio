import type {RenderJob} from './types.ts';
import type {RenderBackend} from './backends.ts';
import {ComputeCostGate,PaidComputeFirewall} from './compute.ts';
import type {ComputePolicy} from './types.ts';
import type {ModelRegistry} from './models.ts';
import {assessModel} from './models.ts';
import type {ModelMode} from './types.ts';
import type {WorkflowRegistry} from './workflows.ts';

export type SmokeRow={workflowId:string;modelId:string;ok:boolean;problems:string[]};
/**
 * Operator check against a real runtime: for each implemented workflow and each acceptable model, confirm the nodes and pinned model
 * files exist. Goes through the normal cost gate and firewall; never submits a render.
 */
export async function smokeCheck(backend:RenderBackend,models:ModelRegistry,workflows:WorkflowRegistry,policy:ComputePolicy,mode:ModelMode):Promise<{authorized:boolean;reasons:string[];rows:SmokeRow[]}>{
 const rows:SmokeRow[]=[],base=(w:string,m:string):RenderJob=>({id:'smoke_'+w+'_'+m.replace(/[^A-Za-z0-9]/g,'_'),projectId:'smoke',sceneId:'smoke',workflowId:w,modelId:m,backendId:backend.descriptor.id,prompt:'smoke',negativePrompt:'',seed:1,inputs:[{kind:'source_image',assetId:'smoke.png'},{kind:'character_reference',assetId:'smoke.png'}],outputFormat:'png',requestedBy:'smoke',createdAt:new Date().toISOString(),params:{width:512,height:512,steps:1,sampler:'euler',scheduler:'normal',cfg:1,frames:9,fps:8,...models.get(m)?.defaults}});
 const gate=new ComputeCostGate(),fw=new PaidComputeFirewall(),probe=base('text_to_image','-'),auth=await gate.authorize(probe,backend,policy);
 if(!auth.authorized)return{authorized:false,reasons:auth.reasons,rows};
 for(const w of workflows.list().filter(x=>x.implemented))for(const m of models.list().filter(x=>x.compatibleWorkflows.includes(w.id))){
  if(!assessModel(m,mode,policy).ok){rows.push({workflowId:w.id,modelId:m.id,ok:false,problems:['Model not acceptable in '+mode+': '+assessModel(m,mode,policy).reasons.join(' ')]});continue;}
  const job=base(w.id,m.id),a=await gate.authorize(job,backend,policy);
  try{const token=await fw.clear(job,backend,a,policy),sp=backend.staticValidate?.(job)??[];const v=sp.length?{ok:false,problems:sp}:await backend.validate(job,token);rows.push({workflowId:w.id,modelId:m.id,ok:v.ok,problems:v.problems});}
  catch(e){rows.push({workflowId:w.id,modelId:m.id,ok:false,problems:[(e as Error).message]});}
 }
 return{authorized:true,reasons:[],rows};
}
