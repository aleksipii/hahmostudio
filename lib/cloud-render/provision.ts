import {Blocked,type ComputePolicy,type ModelDefinition,type ModelMode} from './types.ts';
import {assessModel} from './models.ts';

export type ProvisionManifest={schema:1;modelId:string;repo:string;revision:string;files:{path:string;sha256:string;comfyFolder:string}[]};
export const COMFY_FOLDERS=['checkpoints','diffusion_models','text_encoders','clip','vae','loras','clip_vision'] as const;
/**
 * The manifest consumed INSIDE the cloud runtime by cloud/runtime/provision_models.py. It is data only: the local machine never
 * downloads weights. Refuses anything that could not be fully verified (exact revision + SHA-256 for every file).
 */
export function buildProvisionManifest(m:ModelDefinition,mode:ModelMode,policy:ComputePolicy):ProvisionManifest{
 const a=assessModel(m,mode,policy);if(!a.ok)throw new Blocked('model-license',a.reasons.join(' '));
 if(!m.revision||!m.files?.length)throw new Blocked('model-files',`Model "${m.id}" needs a pinned revision and file checksums to be provisioned.`);
 if(!m.source.startsWith('huggingface:'))throw new Blocked('model-source',`Unsupported model source "${m.source}".`);
 const repo=m.source.slice('huggingface:'.length);if(!/^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(repo))throw new Blocked('model-source','Invalid repository id.');
 for(const f of m.files){if(!(COMFY_FOLDERS as readonly string[]).includes(f.comfyFolder)||f.path.split('/').includes('..')||f.path.startsWith('/'))throw new Blocked('model-files',`Invalid file entry "${f.path}".`);}
 return{schema:1,modelId:m.id,repo,revision:m.revision,files:m.files.map(f=>({path:f.path,sha256:f.sha256,comfyFolder:f.comfyFolder}))};
}
