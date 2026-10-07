import {Blocked} from './types.ts';
import {PROJECT_FOLDERS,checkNames,checkUpload,type AssetRef,type ProjectFolder,type StorageBackend} from './storage.ts';

type F=typeof fetch;
const API='https://www.googleapis.com/drive/v3',UPLOAD='https://www.googleapis.com/upload/drive/v3';
const q=(s:string)=>s.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
export type DriveConfig={getAccessToken:()=>Promise<string>;fetch?:F;rootName?:string};
/** OAuth refresh-token flow. Secrets come from server environment only, never from the client. */
export function driveTokenFromEnv(env:Record<string,string|undefined>,fetchImpl:F=fetch):()=>Promise<string>{
 const{GOOGLE_OAUTH_CLIENT_ID:id,GOOGLE_OAUTH_CLIENT_SECRET:secret,GOOGLE_OAUTH_REFRESH_TOKEN:refresh}=env;
 if(!id||!secret||!refresh)return async()=>{throw new Blocked('drive-unconfigured','Google Drive credentials are not configured.');};
 let cached:{token:string;until:number}|undefined;
 return async()=>{if(cached&&cached.until>Date.now()+60000)return cached.token;
  const r=await fetchImpl('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:id,client_secret:secret,refresh_token:refresh,grant_type:'refresh_token'})});
  if(!r.ok)throw new Blocked('drive-auth','Google Drive authorization failed.');const j=await r.json() as {access_token:string;expires_in:number};cached={token:j.access_token,until:Date.now()+j.expires_in*1000};return j.access_token;};
}
/** Layout: AnimationStudio/Projects/<projectId>/{project.json,characters,scenes,...}. Scope drive.file is sufficient. */
export class GoogleDriveStorage implements StorageBackend{
 readonly id='google-drive';private f:F;private folders=new Map<string,Promise<string>>();
 private cfg:DriveConfig;
 constructor(cfg:DriveConfig){this.cfg=cfg;this.f=cfg.fetch??fetch;}
 private async call(url:string,init:RequestInit={}){const r=await this.f(url,{...init,headers:{...(init.headers as Record<string,string>|undefined),Authorization:'Bearer '+await this.cfg.getAccessToken()}});if(!r.ok)throw new Blocked('drive-http',`Google Drive request failed (${r.status}).`);return r;}
 private folder(name:string,parent:string,key:string){
  let p=this.folders.get(key);
  if(!p){p=(async()=>{
   const found=await(await this.call(`${API}/files?${new URLSearchParams({q:`name='${q(name)}' and '${q(parent)}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,fields:'files(id)',spaces:'drive'})}`)).json() as {files:{id:string}[]};
   if(found.files[0])return found.files[0].id;
   return(await(await this.call(`${API}/files?fields=id`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,mimeType:'application/vnd.google-apps.folder',parents:[parent]})})).json() as {id:string}).id;
  })();this.folders.set(key,p);p.catch(()=>this.folders.delete(key));}
  return p;
 }
 private async projectDir(projectId:string,folder:string){
  checkNames(projectId);
  const root=await this.folder(this.cfg.rootName??'AnimationStudio','root','root'),projects=await this.folder('Projects',root,'projects'),project=await this.folder(projectId,projects,'p:'+projectId);
  return folder?this.folder(folder,project,`p:${projectId}/${folder}`):project;
 }
 private async upsert(projectId:string,folder:ProjectFolder|'',name:string,bytes:Uint8Array,mime:string):Promise<AssetRef>{
  const parent=await this.projectDir(projectId,folder);
  const found=await(await this.call(`${API}/files?${new URLSearchParams({q:`name='${q(name)}' and '${q(parent)}' in parents and trashed=false`,fields:'files(id)'})}`)).json() as {files:{id:string}[]};
  const boundary='hahmo'+Math.random().toString(36).slice(2),enc=new TextEncoder();
  const meta=JSON.stringify(found.files[0]?{name}:{name,parents:[parent]});
  const head=enc.encode(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: ${mime}\r\n\r\n`),tail=enc.encode(`\r\n--${boundary}--`);
  const body=new Uint8Array(head.length+bytes.length+tail.length);body.set(head);body.set(bytes,head.length);body.set(tail,head.length+bytes.length);
  const url=found.files[0]?`${UPLOAD}/files/${encodeURIComponent(found.files[0].id)}?uploadType=multipart&fields=id,size`:`${UPLOAD}/files?uploadType=multipart&fields=id,size`;
  const r=await(await this.call(url,{method:found.files[0]?'PATCH':'POST',headers:{'Content-Type':`multipart/related; boundary=${boundary}`},body})).json() as {id:string;size?:string};
  return{backend:this.id,id:r.id,projectId,folder,name,mime,size:bytes.length};
 }
 async createProject(projectId:string,project:unknown){await this.projectDir(projectId,'');for(const f of PROJECT_FOLDERS)await this.projectDir(projectId,f);return this.upsert(projectId,'','project.json',new TextEncoder().encode(JSON.stringify(project,null,1)),'application/json');}
 async uploadAsset(projectId:string,folder:ProjectFolder,name:string,bytes:Uint8Array,mime:string){checkUpload(projectId,folder,name,bytes);return this.upsert(projectId,folder,name,bytes,mime);}
 async downloadAsset(ref:AssetRef){if(ref.backend!==this.id)throw new Blocked('storage-backend','Asset belongs to another storage backend.');return new Uint8Array(await(await this.call(`${API}/files/${encodeURIComponent(ref.id)}?alt=media`)).arrayBuffer());}
 async uploadRender(projectId:string,name:string,bytes:Uint8Array,mime:string){return this.uploadAsset(projectId,'renders',name,bytes,mime);}
 async listProjectAssets(projectId:string,folder?:ProjectFolder){
  const out:AssetRef[]=[];for(const f of folder?[folder]:PROJECT_FOLDERS){const parent=await this.projectDir(projectId,f);
   const r=await(await this.call(`${API}/files?${new URLSearchParams({q:`'${q(parent)}' in parents and trashed=false`,fields:'files(id,name,mimeType,size)',pageSize:'1000'})}`)).json() as {files:{id:string;name:string;mimeType:string;size?:string}[]};
   for(const x of r.files)out.push({backend:this.id,id:x.id,projectId,folder:f,name:x.name,mime:x.mimeType,size:x.size?Number(x.size):undefined});}
  return out;
 }
 async deleteAsset(ref:AssetRef){if(ref.backend!==this.id)return;await this.call(`${API}/files/${encodeURIComponent(ref.id)}`,{method:'DELETE'});}
}
