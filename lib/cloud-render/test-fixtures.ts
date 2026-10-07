import type {CanonicalState} from './canonical.ts';
import {DEFAULT_ACTIONS} from './canonical.ts';
import type {ModelDefinition} from './types.ts';
import {BackendRegistry} from './backends.ts';
import {ModelRegistry,ModelRouter} from './models.ts';
import {WorkflowRegistry} from './workflows.ts';
import {ProjectStore,RenderService,type ServiceDeps} from './pipeline.ts';
import {InMemoryStorage} from './storage.ts';
import {CharacterReferenceSystem} from './character-refs.ts';
import {ZERO_COST_POLICY} from './compute.ts';
import type {MockRenderBackend} from './mock-backend.ts';
import {PNG_1X1} from './mock-backend.ts';

export const canon=():CanonicalState=>({
 schemaVersion:1,projectId:'project_001',revision:1,
 characters:{alice:{id:'alice',name:'Alice',attributes:{age:24,hair:'black',outfit:'red_jacket'},location:'kitchen',holding:[]},carol:{id:'carol',name:'Carol',attributes:{hair:'brown'},location:'bedroom',holding:[]}},
 locations:{kitchen:{id:'kitchen',name:'Kitchen',attributes:{style:'modern'}},bedroom:{id:'bedroom',name:'Bedroom',attributes:{}}},
 props:{cup_01:{id:'cup_01',type:'cup',attributes:{color:'white'},location:'kitchen',heldBy:null}},
 scenes:{
  scene_001:{id:'scene_001',locationId:'kitchen',characterIds:['alice'],propIds:['cup_01'],start:0,end:10,events:[{id:'e1',at:5,actor:'alice',action:'pick_up',target:'cup_01'}],approvedTransitions:[]},
  scene_002:{id:'scene_002',locationId:'bedroom',characterIds:['alice','carol'],propIds:['cup_01'],start:10,end:20,events:[{id:'e2',at:10.5,actor:'alice',action:'move_to',target:'bedroom'}],approvedTransitions:[]},
 },
 timeline:{currentTime:12.03,duration:60},allowedActions:DEFAULT_ACTIONS,forbiddenActions:['fly'],visualStyle:{allowed:['anime','cartoon','illustration'],constraints:[]},
});
export const goodSuggestion=():any=>({sceneId:'scene_001',camera:{shot:'medium',movement:'slow_pan_left'},characterActions:[{id:'alice',action:'look_at',target:'cup_01',at:2,claims:{hair:'black',outfit:'red_jacket'},claimedLocation:'kitchen'}],environment:{location:'kitchen'},lighting:{style:'warm'},visualStyle:{style:'anime'},promptFragments:['subtle hand movement','soft glow']});
export const REV='a'.repeat(40),SHA='b'.repeat(64);
export const goodModel=(over:Partial<ModelDefinition>={}):ModelDefinition=>({id:'test-model',name:'Test',source:'huggingface:test/model',revision:REV,license:'apache-2.0',commercialUse:'allowed',modelCostEur:0,capabilities:['text-to-image','reference-image'],compatibleWorkflows:['text_to_image','character_reference'],licenseEvidenceUrl:'https://example.org/license',licenseCheckedAt:'2026-10-07',files:[{path:'sd.safetensors',sha256:SHA,comfyFolder:'checkpoints',role:'checkpoint'} as never],...over});
export async function harness(backends:MockRenderBackend[],o:{models?:ModelDefinition[];requireLock?:boolean;director?:ServiceDeps['director'];mode?:ServiceDeps['modelMode']}={}){
 const storage=new InMemoryStorage(),projects=new ProjectStore(storage),reg=new BackendRegistry();for(const b of backends)reg.register(b);
 const refs=new CharacterReferenceSystem(storage);
 const service=new RenderService({projects,storage,backends:reg,router:new ModelRouter(new ModelRegistry(o.models??[goodModel()])),workflows:new WorkflowRegistry(),policy:ZERO_COST_POLICY,modelMode:o.mode??'PRODUCTION_SAFE',director:o.director,refs,requireSceneLock:o.requireLock??true});
 await projects.put(canon());await projects.lock('project_001','scene_001','tester');
 const ref=await storage.uploadAsset('project_001','references','alice.png',PNG_1X1,'image/png');
 await refs.register('project_001',{characterId:'alice',assetId:'alice_ref',label:'front',mime:'image/png',storageRef:ref});
 return{storage,projects,service,refs};
}
export const req=(o:Record<string,unknown>={})=>({projectId:'project_001',sceneId:'scene_001',workflowId:'text_to_image',requestedBy:'tester',params:{width:1,height:1},...o}) as never;
