import {test} from 'node:test';import assert from 'node:assert/strict';
import {ComfyUIBackend} from './comfyui-backend.ts';
import {ModelRegistry} from './models.ts';
import {WorkflowRegistry} from './workflows.ts';
import {ComputeCostGate,PaidComputeFirewall,ZERO_COST_POLICY} from './compute.ts';
import {GoogleDriveStorage,driveTokenFromEnv} from './storage-gdrive.ts';
import {InMemoryStorage,PROJECT_FOLDERS} from './storage.ts';
import {LocalDevelopmentStorage} from './storage-local.ts';
import {isModelWeightName} from './weights.ts';
import {goodModel} from './test-fixtures.ts';
import {PNG_1X1} from './mock-backend.ts';
import {Blocked,type RenderJob} from './types.ts';
import {mkdtemp,readdir,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {execFileSync} from 'node:child_process';

const job={id:'j1',projectId:'p',sceneId:'s',workflowId:'text_to_image',modelId:'test-model',prompt:'a cup',negativePrompt:'bad',seed:3,inputs:[],outputFormat:'png',requestedBy:'t',createdAt:'now',params:{width:64,height:64,steps:4,sampler:'euler',scheduler:'normal',cfg:1}} as RenderJob;
const desc={id:'colab-free',class:'free' as const,provider:'comfyui',billingProvider:'none',enabled:true};
function comfy(handler:(url:URL,init?:RequestInit)=>Response|Promise<Response>,cost:number|null=0){
 const calls:string[]=[];
 const fetchImpl=(async(u:string,init?:RequestInit)=>{const url=new URL(u);calls.push(init?.method??'GET'+' '+url.pathname);calls.push(url.pathname);return handler(url,init);}) as typeof fetch;
 const b=new ComfyUIBackend({descriptor:desc,baseUrl:'https://runtime.example',declaredCostEur:cost,models:new ModelRegistry([goodModel()]),workflows:new WorkflowRegistry(),fetch:fetchImpl,pollMs:1});
 return{b,calls};
}
const json=(v:unknown)=>new Response(JSON.stringify(v),{headers:{'content-type':'application/json'}});
async function auth(b:ComfyUIBackend){const a=await new ComputeCostGate().authorize(job,b,ZERO_COST_POLICY);return new PaidComputeFirewall().clear(job,b,a,ZERO_COST_POLICY);}

test('ComfyUI backend: estimate and capabilities are offline; every runtime call needs a token',async()=>{
 const {b,calls}=comfy(()=>{throw new Error('network');});
 assert.equal((await b.estimateCost()).estimatedCostEur,0);assert.ok((await b.getCapabilities()).workflows.includes('text_to_image'));
 await assert.rejects(b.render(job,undefined as never),Blocked);await assert.rejects(b.validate(job,undefined as never),Blocked);assert.deepEqual(calls,[]);
});
test('ComfyUI backend: undeclared cost is unknown and therefore blocked',async()=>{
 const {b}=comfy(()=>json({}),null);const a=await new ComputeCostGate().authorize(job,b,ZERO_COST_POLICY);assert.equal(a.authorized,false);
});
test('ComfyUI backend: validate checks installed nodes and provisioned model files',async()=>{
 const info={CheckpointLoaderSimple:{input:{required:{ckpt_name:[['sd.safetensors']]}}},CLIPTextEncode:{},EmptyLatentImage:{},KSampler:{},VAEDecode:{},SaveImage:{}};
 const ok=comfy(()=>json(info));assert.deepEqual(await ok.b.validate(job,await auth(ok.b)),{ok:true,problems:[]});
 const missing=comfy(()=>json({...info,CheckpointLoaderSimple:{input:{required:{ckpt_name:[[]]}}}}));
 const r=await missing.b.validate(job,await auth(missing.b));assert.equal(r.ok,false);assert.match(r.problems[0],/not provisioned in the remote runtime/);
 const nonode=comfy(()=>json({}));assert.match((await nonode.b.validate(job,await auth(nonode.b))).problems.join(),/not installed/);
 const down=comfy(()=>new Response('x',{status:503}));assert.equal((await down.b.validate(job,await auth(down.b))).ok,false);
 assert.ok(ok.b.staticValidate(job).length===0);assert.match(ok.b.staticValidate({...job,seed:undefined} as never)[0],/Seed/);
});
test('ComfyUI backend: submit, poll, fetch outputs; the graph carries the exact seed and pinned file',async()=>{
 let submitted:any;
 const {b}=comfy((url,init)=>{
  if(url.pathname==='/prompt'){submitted=JSON.parse(String(init!.body));return json({prompt_id:'pid'});}
  if(url.pathname==='/history/pid')return json({pid:{outputs:{out:{images:[{filename:'o_00001_.png',subfolder:'',type:'output'}]}},status:{status_str:'success'}}});
  if(url.pathname==='/view')return new Response(PNG_1X1);throw new Error('unexpected '+url.pathname);});
 const r=await b.render(job,await auth(b));
 assert.equal(r.artifacts[0].mime,'image/png');assert.equal(submitted.prompt.ks.inputs.seed,3);assert.equal(submitted.prompt.m.inputs.ckpt_name,'sd.safetensors');assert.equal(submitted.prompt.pos.inputs.text,'a cup');
});
test('ComfyUI backend refuses weight-like or unknown outputs and oversize results',async()=>{
 for(const [file,re] of [['x.safetensors',/disallowed/],['x.exe',/Unsupported/]] as const){
  const {b}=comfy((url)=>url.pathname==='/prompt'?json({prompt_id:'p'}):url.pathname.startsWith('/history')?json({p:{outputs:{o:{images:[{filename:file}]}}}}):new Response(PNG_1X1));
  await assert.rejects(b.render(job,await auth(b)),re);
 }
});
test('weights helper and storage refuse model files',async()=>{
 for(const n of ['a.safetensors','b.CKPT','c.bin','d.pth','e.gguf'])assert.ok(isModelWeightName(n),n);assert.equal(isModelWeightName('render.png'),false);
 const s=new InMemoryStorage();await assert.rejects(s.uploadAsset('p','renders','model.safetensors',new Uint8Array(1),'application/octet-stream'),/weights/);
});
test('storage validates ids, names and folders',async()=>{
 const s=new InMemoryStorage();for(const bad of ['../x','a/b','','.'])await assert.rejects(s.uploadAsset('p','renders',bad,new Uint8Array(1),'x/y'));
 await assert.rejects(s.uploadAsset('../p','renders','a.png',new Uint8Array(1),'image/png'));await assert.rejects(s.uploadAsset('p','nope' as never,'a.png',new Uint8Array(1),'image/png'));
});
test('local development storage mirrors the Drive layout and cannot escape its root',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'hs-'));try{
  const s=new LocalDevelopmentStorage(dir);await s.createProject('proj',{a:1});
  assert.deepEqual((await readdir(join(dir,'AnimationStudio','Projects','proj'))).sort(),['project.json',...PROJECT_FOLDERS].sort());
  const ref=await s.uploadRender('proj','r.png',PNG_1X1,'image/png');assert.deepEqual(await s.downloadAsset(ref),PNG_1X1);assert.equal((await s.listProjectAssets('proj','renders')).length,1);
  await s.deleteAsset(ref);assert.equal((await s.listProjectAssets('proj','renders')).length,0);
  await assert.rejects(s.downloadAsset({backend:'local-dev',id:'../../etc/passwd',projectId:'p',folder:'',name:'x',mime:''}));
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('Google Drive storage: folder layout, multipart upload, bearer auth, no weights',async()=>{
 const log:{method:string;url:string;auth:string|null;body?:string}[]=[],folders=new Map<string,string>();let n=0;
 const f=(async(u:string,init:RequestInit={})=>{const url=new URL(u),h=new Headers(init.headers);log.push({method:init.method??'GET',url:url.pathname+url.search,auth:h.get('authorization'),body:typeof init.body==='string'?init.body:init.body?new TextDecoder().decode(init.body as Uint8Array):undefined});
  if(url.pathname==='/drive/v3/files'&&(init.method??'GET')==='GET'){const q=url.searchParams.get('q')!;const m=/name='([^']*)' and '([^']*)' in parents and mimeType/.exec(q);const key=m?m[2]+'/'+m[1]:'';return new Response(JSON.stringify({files:folders.has(key)?[{id:folders.get(key)}]:[]}));}
  if(url.pathname==='/drive/v3/files'&&init.method==='POST'){const b=JSON.parse(String(init.body));const id='f'+(++n);folders.set(b.parents[0]+'/'+b.name,id);return new Response(JSON.stringify({id}));}
  if(url.pathname.startsWith('/upload/drive/v3/files'))return new Response(JSON.stringify({id:'file1'}));
  if(url.pathname==='/drive/v3/files/file1')return new Response(PNG_1X1);
  return new Response('{}',{status:404});}) as typeof fetch;
 const d=new GoogleDriveStorage({getAccessToken:async()=>'tok',fetch:f});
 await assert.rejects(d.uploadRender("pro'j",'r.png',PNG_1X1,'image/png'),/Invalid project id/);
 const ref=await d.uploadRender('proj','r.png',PNG_1X1,'image/png');
 assert.equal(ref.id,'file1');assert.ok(log.every(l=>l.auth==='Bearer tok'));
 const up=log.find(l=>l.url.startsWith('/upload/'))!;assert.match(up.body!,/multipart|"name":"r.png"/);assert.match(up.url,/uploadType=multipart/);
 assert.ok([...folders.keys()].some(k=>k.endsWith("/AnimationStudio")||k==='root/AnimationStudio'));assert.ok([...folders.keys()].some(k=>k.endsWith('/renders')));
 assert.deepEqual(await d.downloadAsset(ref),PNG_1X1);
 await assert.rejects(d.uploadAsset('p','renders','w.safetensors',new Uint8Array(1),'x/y'),/weights/);
 await assert.rejects(driveTokenFromEnv({})(),/not configured/);
});
test('repository contains no model weight files',()=>{
 const files=execFileSync('git',['ls-files','-z'],{encoding:'utf8',cwd:new URL('../..',import.meta.url).pathname}).split('\0').filter(Boolean);
 assert.deepEqual(files.filter(f=>isModelWeightName(f)&&!f.startsWith('node_modules/')&&!/rhubarb|whisper|vision/i.test(f)&&!f.startsWith('public/')),[]);
});
