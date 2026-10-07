import {Blocked} from './types.ts';
import {isModelWeightName} from './weights.ts';

export const PROJECT_FOLDERS=['characters','scenes','props','references','workflows','renders','metadata','logs'] as const;
export type ProjectFolder=typeof PROJECT_FOLDERS[number];
export type AssetRef={backend:string;id:string;projectId:string;folder:ProjectFolder|'';name:string;mime:string;size?:number};
export interface StorageBackend{
 readonly id:string;
 createProject(projectId:string,project:unknown):Promise<AssetRef>;
 uploadAsset(projectId:string,folder:ProjectFolder,name:string,bytes:Uint8Array,mime:string):Promise<AssetRef>;
 downloadAsset(ref:AssetRef):Promise<Uint8Array>;
 uploadRender(projectId:string,name:string,bytes:Uint8Array,mime:string):Promise<AssetRef>;
 listProjectAssets(projectId:string,folder?:ProjectFolder):Promise<AssetRef[]>;
 deleteAsset(ref:AssetRef):Promise<void>;
}
export const PROJECT_ID=/^[A-Za-z0-9_.-]{1,80}$/;
export function checkNames(projectId:string,name?:string){
 if(!PROJECT_ID.test(projectId)||projectId==='.'||projectId==='..')throw new Blocked('storage-name','Invalid project id.');
 if(name!==undefined&&(!/^[^/\\\0]{1,200}$/.test(name)||name==='.'||name==='..'))throw new Blocked('storage-name','Invalid asset name.');
}
/** Applied by every backend before any byte is written. */
export function checkUpload(projectId:string,folder:string,name:string,bytes:Uint8Array){
 checkNames(projectId,name);
 if(!(PROJECT_FOLDERS as readonly string[]).includes(folder))throw new Blocked('storage-folder','Unknown project folder.');
 if(isModelWeightName(name))throw new Blocked('storage-weights','Model weights are never stored in project storage.');
 if(bytes.length>256*1024*1024)throw new Blocked('storage-size','Asset is too large.');
}
export async function putJson(s:StorageBackend,projectId:string,folder:ProjectFolder,name:string,value:unknown){return s.uploadAsset(projectId,folder,name,new TextEncoder().encode(JSON.stringify(value,null,1)),'application/json');}
export async function getJson<T=unknown>(s:StorageBackend,ref:AssetRef):Promise<T>{return JSON.parse(new TextDecoder().decode(await s.downloadAsset(ref)));}

/** Volatile storage for tests and previews. */
export class InMemoryStorage implements StorageBackend{
 readonly id='memory';private files=new Map<string,{ref:AssetRef;bytes:Uint8Array}>();private n=0;
 private key(p:string,f:string,n:string){return `${p}/${f}/${n}`;}
 async createProject(projectId:string,project:unknown){checkNames(projectId);return this.put(projectId,'' as never,'project.json',new TextEncoder().encode(JSON.stringify(project)),'application/json');}
 private put(projectId:string,folder:ProjectFolder|'',name:string,bytes:Uint8Array,mime:string){const k=this.key(projectId,folder,name),old=this.files.get(k),ref:AssetRef={backend:this.id,id:old?.ref.id??'mem-'+(++this.n),projectId,folder,name,mime,size:bytes.length};this.files.set(k,{ref,bytes:new Uint8Array(bytes)});return ref;}
 async uploadAsset(projectId:string,folder:ProjectFolder,name:string,bytes:Uint8Array,mime:string){checkUpload(projectId,folder,name,bytes);return this.put(projectId,folder,name,bytes,mime);}
 async downloadAsset(ref:AssetRef){const f=[...this.files.values()].find(x=>x.ref.id===ref.id);if(!f)throw new Blocked('storage-missing','Asset not found.');return new Uint8Array(f.bytes);}
 async uploadRender(projectId:string,name:string,bytes:Uint8Array,mime:string){return this.uploadAsset(projectId,'renders',name,bytes,mime);}
 async listProjectAssets(projectId:string,folder?:ProjectFolder){checkNames(projectId);return [...this.files.values()].map(f=>f.ref).filter(r=>r.projectId===projectId&&(!folder||r.folder===folder));}
 async deleteAsset(ref:AssetRef){const k=[...this.files.entries()].find(([,v])=>v.ref.id===ref.id)?.[0];if(k)this.files.delete(k);}
}
