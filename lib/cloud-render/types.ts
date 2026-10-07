/** Shared types for the Cloud AI Render Engine. No provider-specific names belong here. */
export type Attr=string|number|boolean;
export const RENDER_STATES=['QUEUED','VALIDATING','COST_CHECK','AUTHORIZED','SUBMITTING','RENDERING','VALIDATING_OUTPUT','UPLOADING','COMPLETED','BLOCKED','FAILED','CANCELLED'] as const;
export type RenderState=typeof RENDER_STATES[number];
export type RenderInput={kind:'character_reference'|'source_image'|'asset';assetId:string;characterId?:string;storageRef?:string;mime?:string};
export type RenderParams={width:number;height:number;steps:number;sampler:string;scheduler:string;cfg:number;frames?:number;fps?:number};
export type RenderJob={id:string;projectId:string;sceneId:string;workflowId:string;modelId:string;backendId?:string;prompt:string;negativePrompt?:string;seed?:number;inputs:RenderInput[];outputFormat:string;requestedBy:string;createdAt:string;params:RenderParams};
export type BackendClass='free'|'owned'|'paid'|'unknown';
export type CostConfidence='exact'|'bounded'|'unknown';
export type CostEstimate={estimatedCostEur:number|null;confidence:CostConfidence;billingProvider:string;note?:string};
export type BackendCapabilities={workflows:string[];maxVramGb?:number;outputFormats:string[]};
export type BackendValidation={ok:boolean;problems:string[]};
export type RenderArtifact={name:string;mime:string;bytes:Uint8Array};
export type RenderResult={artifacts:RenderArtifact[];backendJobId?:string;durationMs?:number};
export type PolicyMode='zero-cost'|'paid-limited';
/** Server-side only. Never accepted from request bodies. */
export type ComputePolicy={readonly mode:PolicyMode;readonly allowPaidCompute:boolean;readonly maxCostEur:number;readonly allowPaidFallback:false;readonly allowUnknownCost:false;readonly allowedBackendClasses:readonly BackendClass[]};
export type CommercialUse='allowed'|'restricted'|'unknown'|'not-allowed';
export type ModelDefinition={id:string;name:string;source:string;revision?:string;license:string;commercialUse:CommercialUse;modelCostEur:number;capabilities:string[];vramRequirements?:{minimumGb?:number;recommendedGb?:number};compatibleWorkflows:string[];licenseEvidenceUrl?:string;licenseCheckedAt?:string;files?:{path:string;sha256:string;comfyFolder:string}[];defaults?:Partial<RenderParams>;notes?:string};
export type ModelMode='PRODUCTION_SAFE'|'DEVELOPMENT';
export class Blocked extends Error{readonly code:string;constructor(code:string,message:string){super(message);this.name='Blocked';this.code=code;}}
export const BLOCK_BANNER='RENDER BLOCKED';
