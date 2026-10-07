import type {ComputePolicy,ModelDefinition,ModelMode} from './types.ts';
import {Blocked} from './types.ts';

export type ModelFile=NonNullable<ModelDefinition['files']>[number]&{role?:'checkpoint'|'unet'|'clip'|'clip2'|'vae'|'clip_vision'};
const REV=/^[0-9a-f]{40}$/,SHA=/^[0-9a-f]{64}$/;
const EVIDENCE='Read from the Hugging Face model card license tag on 2026-10-07 (not legal advice; third-party components and training-data terms not reviewed).';
/**
 * Seed registry. Revisions and file hashes are deliberately NOT filled in: they could not be verified from this build
 * environment, so these models stay blocked in PRODUCTION_SAFE until an operator pins them (see applyModelPins).
 */
export const SEED_MODELS:ModelDefinition[]=[
 {id:'flux1-schnell',name:'FLUX.1 [schnell]',source:'huggingface:black-forest-labs/FLUX.1-schnell',license:'apache-2.0',commercialUse:'allowed',modelCostEur:0,capabilities:['text-to-image','illustration','stylized-2d','cartoon'],vramRequirements:{minimumGb:12,recommendedGb:24},compatibleWorkflows:['text_to_image'],defaults:{steps:4,cfg:1,sampler:'euler',scheduler:'simple'},licenseEvidenceUrl:'https://huggingface.co/black-forest-labs/FLUX.1-schnell',licenseCheckedAt:'2026-10-07',notes:EVIDENCE+' Gated repo: the cloud runtime needs an accepted Hugging Face token.'},
 {id:'wan2.2-ti2v-5b',name:'Wan2.2 TI2V 5B',source:'huggingface:Wan-AI/Wan2.2-TI2V-5B',license:'apache-2.0',commercialUse:'allowed',modelCostEur:0,capabilities:['image-to-video','text-to-video','reference-image','cartoon','stylized-2d'],vramRequirements:{minimumGb:16,recommendedGb:24},compatibleWorkflows:['image_to_video'],defaults:{width:832,height:480,frames:33,fps:24,steps:20,cfg:5},licenseEvidenceUrl:'https://huggingface.co/Wan-AI/Wan2.2-TI2V-5B',licenseCheckedAt:'2026-10-07',notes:EVIDENCE},
 {id:'wan2.2-i2v-a14b',name:'Wan2.2 I2V A14B',source:'huggingface:Wan-AI/Wan2.2-I2V-A14B',license:'apache-2.0',commercialUse:'allowed',modelCostEur:0,capabilities:['image-to-video','reference-image','cartoon','stylized-2d'],vramRequirements:{minimumGb:40,recommendedGb:80},compatibleWorkflows:['image_to_video'],licenseEvidenceUrl:'https://huggingface.co/Wan-AI/Wan2.2-I2V-A14B',licenseCheckedAt:'2026-10-07',notes:EVIDENCE+' Large; not for free-tier GPUs.'},
 {id:'sdxl-base-1.0',name:'Stable Diffusion XL base 1.0',source:'huggingface:stabilityai/stable-diffusion-xl-base-1.0',license:'openrail++',commercialUse:'restricted',modelCostEur:0,capabilities:['text-to-image','image-to-image','illustration','stylized-2d','cartoon','reference-image'],vramRequirements:{minimumGb:8,recommendedGb:12},compatibleWorkflows:['text_to_image','image_to_image','character_reference'],licenseEvidenceUrl:'https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0',licenseCheckedAt:'2026-10-07',notes:'OpenRAIL++ carries use-based restrictions; treated as restricted (blocked in PRODUCTION_SAFE) until a human reviews it.'},
 {id:'animagine-xl-4.0',name:'Animagine XL 4.0',source:'huggingface:cagliostrolab/animagine-xl-4.0',license:'openrail++',commercialUse:'restricted',modelCostEur:0,capabilities:['text-to-image','image-to-image','anime','illustration','reference-image'],vramRequirements:{minimumGb:8,recommendedGb:12},compatibleWorkflows:['text_to_image','image_to_image','character_reference'],licenseEvidenceUrl:'https://huggingface.co/cagliostrolab/animagine-xl-4.0',licenseCheckedAt:'2026-10-07',notes:'OpenRAIL++ tag; fine-tune of SDXL with training-data provenance not reviewed. Restricted until reviewed.'},
 {id:'ltx-video',name:'LTX-Video',source:'huggingface:Lightricks/LTX-Video',license:'other',commercialUse:'unknown',modelCostEur:0,capabilities:['image-to-video'],vramRequirements:{minimumGb:12},compatibleWorkflows:['image_to_video'],licenseEvidenceUrl:'https://huggingface.co/Lightricks/LTX-Video',licenseCheckedAt:'2026-10-07',notes:'Hub tag is "other" (custom license). Terms not reviewed: unknown.'},
];
export type ModelAssessment={ok:boolean;reasons:string[]};
export function assessModel(m:ModelDefinition,mode:ModelMode,policy:ComputePolicy):ModelAssessment{
 const r:string[]=[];
 if(!m.source||!m.license)r.push('Model source or license is missing.');
 if(!Number.isFinite(m.modelCostEur)||m.modelCostEur<0)r.push('Model cost is unknown.');
 else if(m.modelCostEur>policy.maxCostEur)r.push(`Model cost EUR ${m.modelCostEur} exceeds the compute policy maximum.`);
 if(m.revision!==undefined&&!REV.test(m.revision))r.push('Model revision is not an exact 40-hex commit.');
 for(const f of m.files??[])if(!SHA.test(f.sha256))r.push(`Checksum for ${f.path} is not a SHA-256.`);
 if(mode==='PRODUCTION_SAFE'){
  if(m.commercialUse!=='allowed')r.push(`Commercial use is "${m.commercialUse}"; PRODUCTION_SAFE requires "allowed".`);
  if(!m.licenseEvidenceUrl||!m.licenseCheckedAt||Number.isNaN(Date.parse(m.licenseCheckedAt)))r.push('License evidence URL or check date is missing.');
  if(!m.revision)r.push('Model revision is not pinned.');
 }
 return{ok:!r.length,reasons:r};
}
export class ModelRegistry{
 private readonly items=new Map<string,ModelDefinition>();
 constructor(models:ModelDefinition[]=SEED_MODELS){for(const m of models)this.register(m);}
 register(m:ModelDefinition){if(this.items.has(m.id))throw new Error('Duplicate model '+m.id);this.items.set(m.id,Object.freeze(structuredClone(m)) as ModelDefinition);return this;}
 get(id:string){return this.items.get(id);}
 list(){return [...this.items.values()];}
 /** Operator pins from server config. Can add a revision/hashes; can never change license or commercial-use fields. */
 applyPins(pins:Record<string,{revision:string;files?:ModelFile[]}>){
  for(const [id,pin] of Object.entries(pins)){const m=this.items.get(id);if(!m)throw new Error('Pin for unknown model '+id);if(!REV.test(pin.revision))throw new Error('Pin revision must be a 40-hex commit.');for(const f of pin.files??[])if(!SHA.test(f.sha256))throw new Error('Pin checksum must be SHA-256.');this.items.set(id,Object.freeze({...m,revision:pin.revision,files:pin.files??m.files}) as ModelDefinition);}
  return this;
 }
}
/** Chooses a model. An explicit request is never silently substituted. */
export class ModelRouter{
 readonly registry:ModelRegistry;
 constructor(registry:ModelRegistry){this.registry=registry;}
 select(a:{workflowId:string;modelId?:string;mode:ModelMode;policy:ComputePolicy}):ModelDefinition{
  if(a.modelId){
   const m=this.registry.get(a.modelId);if(!m)throw new Blocked('model-unknown',`Model "${a.modelId}" is not registered.`);
   if(!m.compatibleWorkflows.includes(a.workflowId))throw new Blocked('model-workflow',`Model "${m.id}" is not compatible with workflow "${a.workflowId}".`);
   const s=assessModel(m,a.mode,a.policy);if(!s.ok)throw new Blocked('model-license',`Model "${m.id}" rejected: ${s.reasons.join(' ')}`);return m;
  }
  const c=this.registry.list().filter(m=>m.compatibleWorkflows.includes(a.workflowId)&&assessModel(m,a.mode,a.policy).ok);
  if(!c.length)throw new Blocked('no-model',`No registered model is acceptable for workflow "${a.workflowId}" in ${a.mode} mode.`);
  return c[0];
 }
}
