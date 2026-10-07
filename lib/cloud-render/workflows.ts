import type {ModelDefinition,RenderJob} from './types.ts';
import {Blocked} from './types.ts';
import type {ModelFile} from './models.ts';

export type ComfyGraph=Record<string,{class_type:string;inputs:Record<string,unknown>}>;
export type WorkflowDefinition={id:string;revision:number;title:string;kind:'image'|'video';requiredCapability:string;requiresCharacterReference:boolean;requiresSourceImage:boolean;implemented:boolean;/** True only after a run against a live ComfyUI was recorded. */liveVerified:boolean;buildGraph?:(job:RenderJob,model:ModelDefinition)=>ComfyGraph;/** Orchestrated by RenderService as several single-job runs; has no graph of its own. */composite?:boolean};
const file=(m:ModelDefinition,role:ModelFile['role'])=>{const f=(m.files as ModelFile[]|undefined)?.find(x=>x.role===role);return f?f.path.split('/').pop() as string:undefined;};
const need=(m:ModelDefinition,role:ModelFile['role'])=>{const f=file(m,role);if(!f)throw new Blocked('model-files',`Model "${m.id}" has no pinned "${role}" file; the workflow cannot be built.`);return f;};
const seedOf=(j:RenderJob)=>{if(j.seed===undefined)throw new Blocked('seed-missing','Seed must be fixed before submission for reproducibility.');return j.seed;};
function loaders(m:ModelDefinition,g:ComfyGraph,clipType:string){
 if(file(m,'checkpoint')){g.m={class_type:'CheckpointLoaderSimple',inputs:{ckpt_name:need(m,'checkpoint')}};return{model:['m',0],clip:['m',1],vae:['m',2]} as const;}
 g.m={class_type:'UNETLoader',inputs:{unet_name:need(m,'unet'),weight_dtype:'default'}};
 g.c=file(m,'clip2')?{class_type:'DualCLIPLoader',inputs:{clip_name1:need(m,'clip'),clip_name2:need(m,'clip2'),type:clipType}}:{class_type:'CLIPLoader',inputs:{clip_name:need(m,'clip'),type:clipType}};
 g.v={class_type:'VAELoader',inputs:{vae_name:need(m,'vae')}};
 return{model:['m',0],clip:['c',0],vae:['v',0]} as const;
}
function imageGraph(j:RenderJob,m:ModelDefinition,withInput:boolean,denoise:number):ComfyGraph{
 const g:ComfyGraph={},l=loaders(m,g,'flux');
 g.pos={class_type:'CLIPTextEncode',inputs:{text:j.prompt,clip:l.clip}};
 g.neg={class_type:'CLIPTextEncode',inputs:{text:j.negativePrompt??'',clip:l.clip}};
 if(withInput){const src=j.inputs.find(i=>i.kind==='character_reference'||i.kind==='source_image');if(!src)throw new Blocked('input-missing','Workflow requires an input image.');g.img={class_type:'LoadImage',inputs:{image:src.assetId}};g.lat={class_type:'VAEEncode',inputs:{pixels:['img',0],vae:l.vae}};}
 else g.lat={class_type:'EmptyLatentImage',inputs:{width:j.params.width,height:j.params.height,batch_size:1}};
 g.ks={class_type:'KSampler',inputs:{model:l.model,seed:seedOf(j),steps:j.params.steps,cfg:j.params.cfg,sampler_name:j.params.sampler,scheduler:j.params.scheduler,positive:['pos',0],negative:['neg',0],latent_image:['lat',0],denoise}};
 g.dec={class_type:'VAEDecode',inputs:{samples:['ks',0],vae:l.vae}};
 g.out={class_type:'SaveImage',inputs:{images:['dec',0],filename_prefix:'hahmostudio/'+j.id}};
 return g;
}
function videoGraph(j:RenderJob,m:ModelDefinition):ComfyGraph{
 const g:ComfyGraph={},l=loaders(m,g,'wan'),src=j.inputs.find(i=>i.kind==='source_image'||i.kind==='character_reference');
 if(!src)throw new Blocked('input-missing','image_to_video requires a source image.');
 g.pos={class_type:'CLIPTextEncode',inputs:{text:j.prompt,clip:l.clip}};
 g.neg={class_type:'CLIPTextEncode',inputs:{text:j.negativePrompt??'',clip:l.clip}};
 g.img={class_type:'LoadImage',inputs:{image:src.assetId}};
 g.lat={class_type:'Wan22ImageToVideoLatent',inputs:{vae:l.vae,width:j.params.width,height:j.params.height,length:j.params.frames??49,batch_size:1,start_image:['img',0]}};
 g.ks={class_type:'KSampler',inputs:{model:l.model,seed:seedOf(j),steps:j.params.steps,cfg:j.params.cfg,sampler_name:j.params.sampler,scheduler:j.params.scheduler,positive:['pos',0],negative:['neg',0],latent_image:['lat',0],denoise:1}};
 g.dec={class_type:'VAEDecode',inputs:{samples:['ks',0],vae:l.vae}};
 g.vid={class_type:'CreateVideo',inputs:{images:['dec',0],fps:j.params.fps??24}};
 g.out={class_type:'SaveVideo',inputs:{video:['vid',0],filename_prefix:'hahmostudio/'+j.id,format:'mp4',codec:'h264'}};
 return g;
}
export const SEED_WORKFLOWS:WorkflowDefinition[]=[
 {id:'text_to_image',revision:1,title:'Text to image',kind:'image',requiredCapability:'text-to-image',requiresCharacterReference:false,requiresSourceImage:false,implemented:true,liveVerified:false,buildGraph:(j,m)=>imageGraph(j,m,false,1)},
 {id:'image_to_image',revision:1,title:'Image to image',kind:'image',requiredCapability:'image-to-image',requiresCharacterReference:false,requiresSourceImage:true,implemented:true,liveVerified:false,buildGraph:(j,m)=>imageGraph(j,m,true,0.65)},
 {id:'character_reference',revision:1,title:'Reference-conditioned image (img2img; no identity adapter)',kind:'image',requiredCapability:'reference-image',requiresCharacterReference:true,requiresSourceImage:false,implemented:true,liveVerified:false,buildGraph:(j,m)=>imageGraph(j,m,true,0.55)},
 {id:'image_to_video',revision:1,title:'Image to video',kind:'video',requiredCapability:'image-to-video',requiresCharacterReference:false,requiresSourceImage:true,implemented:true,liveVerified:false,buildGraph:videoGraph},
 {id:'character_animation',revision:1,title:'Character animation (ordered image_to_video clips per approved event)',kind:'video',requiredCapability:'image-to-video',requiresCharacterReference:true,requiresSourceImage:true,implemented:true,liveVerified:false,composite:true},
];
export class WorkflowRegistry{
 private readonly items=new Map<string,WorkflowDefinition>();
 constructor(w:WorkflowDefinition[]=SEED_WORKFLOWS){for(const x of w)this.items.set(x.id,x);}
 get(id:string){return this.items.get(id);}
 list(){return [...this.items.values()];}
 require(id:string){const w=this.items.get(id);if(!w)throw new Blocked('workflow-unknown',`Workflow "${id}" is not registered.`);if(!w.implemented||!w.buildGraph)throw new Blocked('workflow-not-implemented',`Workflow "${id}" is not implemented.`);return w;}
}
