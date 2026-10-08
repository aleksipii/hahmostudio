/**
 * Työpöydän pilvirenderöinnin kuljetus. Pilvidialogin HTTP-kutsut kartoitetaan pääprosessin kapeisiin
 * pilvitoimintoihin (studio:cloud-call). Renderer ei koskaan näe salaisuuksia eikä valitse reittiä itse;
 * pääprosessi validoi jokaisen toiminnon ja kysyy luvan ennen kuin dataa lähtee koneelta.
 */
import type {CloudOp,DesktopBridge} from './platform.ts';

export type CloudApiResult={status:number;body:Record<string,any>};
export class CloudSendCancelled extends Error{constructor(){super('Lähetys peruttiin. Mitään ei lähetetty.');this.name='CloudSendCancelled';}}

export function cloudOpFor(method:string,path:string,body?:unknown):{op:CloudOp;args?:Record<string,unknown>}{
 const m=method.toUpperCase(),s=path.replace(/^\/api\//,'').split('/').map(decodeURIComponent),b=(body??{}) as Record<string,unknown>;
 if(m==='GET'&&s[0]==='health'&&s.length===1)return {op:'health'};
 if(m==='GET'&&s[0]==='backends'&&s.length===1)return {op:'backends'};
 if(m==='PUT'&&s[0]==='projects'&&s.length===2)return {op:'sync',args:{canonical:body}};
 if(m==='POST'&&s[0]==='projects'&&s[2]==='scenes'&&s[4]==='lock'&&s.length===5)return {op:'lock',args:{projectId:s[1],sceneId:s[3]}};
 if(m==='POST'&&s[0]==='projects'&&s[2]==='characters'&&s[4]==='reference'&&s.length===5)return {op:'reference',args:{projectId:s[1],characterId:s[3],mime:b.mime,dataBase64:b.dataBase64,label:b.label,...(b.sourceSha256!==undefined?{sourceSha256:b.sourceSha256}:{})}};
 if(m==='POST'&&s[0]==='ai'&&s[1]==='direct'&&s.length===2)return {op:'direct',args:{projectId:b.projectId,sceneId:b.sceneId}};
 if(m==='POST'&&s[0]==='live-verification'&&s[1]==='smoke'&&s.length===2)return {op:'smoke'};
 if(s[0]==='render'){
  if(m==='POST'&&s[1]==='preflight'&&s.length===2)return {op:'preflight',args:{projectId:b.projectId,sceneId:b.sceneId,workflowId:b.workflowId}};
  if(m==='POST'&&s.length===1)return {op:'render',args:{projectId:b.projectId,sceneId:b.sceneId,workflowId:b.workflowId,authorizationFingerprint:b.authorizationFingerprint}};
  if(m==='GET'&&s.length===2)return {op:'job',args:{jobId:s[1]}};
  if(m==='GET'&&s[2]==='notebook'&&s.length===3)return {op:'notebook-save',args:{jobId:s[1]}};
  if(m==='POST'&&s[2]==='import'&&s.length===3)return {op:'import',args:{jobId:s[1]}};
  if(m==='POST'&&s[2]==='cancel'&&s.length===3)return {op:'cancel',args:{jobId:s[1]}};
 }
 throw new Error('Tätä pilvitoimintoa ei ole työpöytäsovelluksessa.');
}

export function desktopCloudApi(bridge:Pick<DesktopBridge,'cloudCall'>){
 return async function(method:string,path:string,body?:unknown):Promise<CloudApiResult>{
  const {op,args}=cloudOpFor(method,path,body);
  const r=await bridge.cloudCall(op,args);
  if(r.body?.cancelled===true)throw new CloudSendCancelled();
  return r;
 };
}
