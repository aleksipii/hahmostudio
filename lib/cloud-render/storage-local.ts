import {mkdir,readFile,writeFile,readdir,rm,stat,rename} from 'node:fs/promises';
import {resolve,join,sep} from 'node:path';
import {randomUUID} from 'node:crypto';
import {Blocked} from './types.ts';
import {PROJECT_FOLDERS,checkNames,checkUpload,type AssetRef,type ProjectFolder,type StorageBackend} from './storage.ts';

/** Local development storage with the same AnimationStudio/Projects layout as Drive. Not for production use. */
export class LocalDevelopmentStorage implements StorageBackend{
 readonly id='local-dev';private root:string;
 constructor(root:string){this.root=resolve(root);}
 private dir(projectId:string,folder:string){const d=resolve(this.root,'AnimationStudio','Projects',projectId,folder);if(!d.startsWith(this.root+sep))throw new Blocked('storage-name','Path escape.');return d;}
 private id_(projectId:string,folder:string,name:string){return `${projectId}/${folder}/${name}`;}
 private async write(projectId:string,folder:ProjectFolder|'',name:string,bytes:Uint8Array,mime:string):Promise<AssetRef>{
  const d=this.dir(projectId,folder);await mkdir(d,{recursive:true,mode:0o700});const target=join(d,name),tmp=join(d,'.'+randomUUID()+'.tmp');
  await writeFile(tmp,bytes,{mode:0o600});await rename(tmp,target);
  return{backend:this.id,id:this.id_(projectId,folder,name),projectId,folder,name,mime,size:bytes.length};
 }
 async createProject(projectId:string,project:unknown){checkNames(projectId);for(const f of PROJECT_FOLDERS)await mkdir(this.dir(projectId,f),{recursive:true,mode:0o700});return this.write(projectId,'','project.json',new TextEncoder().encode(JSON.stringify(project,null,1)),'application/json');}
 async uploadAsset(projectId:string,folder:ProjectFolder,name:string,bytes:Uint8Array,mime:string){checkUpload(projectId,folder,name,bytes);return this.write(projectId,folder,name,bytes,mime);}
 async downloadAsset(ref:AssetRef){const [p,f,n,...rest]=ref.id.split('/');if(rest.length||!p||n===undefined)throw new Blocked('storage-name','Bad asset id.');checkNames(p,n);try{return new Uint8Array(await readFile(join(this.dir(p,f),n)));}catch{throw new Blocked('storage-missing','Asset not found.');}}
 async uploadRender(projectId:string,name:string,bytes:Uint8Array,mime:string){return this.uploadAsset(projectId,'renders',name,bytes,mime);}
 async listProjectAssets(projectId:string,folder?:ProjectFolder){checkNames(projectId);const out:AssetRef[]=[];for(const f of folder?[folder]:PROJECT_FOLDERS){let names:string[]=[];try{names=await readdir(this.dir(projectId,f));}catch{continue;}for(const n of names)if(!n.startsWith('.')){const s=await stat(join(this.dir(projectId,f),n));out.push({backend:this.id,id:this.id_(projectId,f,n),projectId,folder:f,name:n,mime:'application/octet-stream',size:s.size});}}return out;}
 async deleteAsset(ref:AssetRef){const [p,f,n]=ref.id.split('/');if(!p||!f||!n)return;checkNames(p,n);await rm(join(this.dir(p,f),n),{force:true});}
}
