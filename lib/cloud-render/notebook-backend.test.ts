import {test} from 'node:test';import assert from 'node:assert/strict';
import http from 'node:http';import {createHash} from 'node:crypto';import {mkdtemp,writeFile,readFile,rm,mkdir} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {execFile} from 'node:child_process';
import {NotebookBackend,type NotebookPackage} from './notebook-backend.ts';
import {ModelRegistry} from './models.ts';
import {WorkflowRegistry} from './workflows.ts';
import {ZERO_COST_POLICY} from './compute.ts';
import {LiveVerificationLedger} from './live-verification.ts';
import {canonicalJson} from '../studio/hash.ts';
import {goodModel,harness,req,REV} from './test-fixtures.ts';
import {PNG_1X1} from './mock-backend.ts';
import type {ModelDefinition} from './types.ts';

const WEIGHTS=Buffer.from('fake weights for notebook test'),WSHA=createHash('sha256').update(WEIGHTS).digest('hex');
const sha=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
const model=():ModelDefinition=>goodModel({files:[{path:'sd.safetensors',sha256:WSHA,comfyFolder:'checkpoints',role:'checkpoint'} as never]});
const sources=()=>Object.fromEntries(['provision_models.py','hahmo_notebook.py'].map(f=>[f,'# '+f]));

async function setup(o:{timeoutMs?:number}={}){
 const models=new ModelRegistry([model()]);
 const nb=new NotebookBackend({descriptor:{id:'kaggle-notebook',class:'free',provider:'notebook',billingProvider:'kaggle-free',enabled:true},models,workflows:new WorkflowRegistry(),mode:'PRODUCTION_SAFE',policy:ZERO_COST_POLICY,runtimeSources:sources,timeoutMs:o.timeoutMs});
 let ledger!:LiveVerificationLedger;
 const h=await harness([nb as never],{models:[model()],ledger:(storage,m)=>{ledger=new LiveVerificationLedger({models:m,policy:ZERO_COST_POLICY,mode:'PRODUCTION_SAFE',storage,receipts:()=>[]});return ledger;}});
 return{nb,h,ledger:()=>ledger};
}
async function waitPending(nb:NotebookBackend,id:string){for(let i=0;i<200&&!nb.isPending(id);i++)await new Promise(r=>setTimeout(r,5));assert.ok(nb.isPending(id),'job waits for a notebook result');}
function unpack(nb:NotebookBackend,id:string):NotebookPackage{
 const n=nb.notebookFor(id)!;assert.equal(n.fileName,`hahmo-${id}.ipynb`);
 const ipynb=JSON.parse(n.notebook),code=ipynb.cells[1].source.join('');
 assert.equal(ipynb.nbformat,4);assert.doesNotMatch(n.notebook,/trycloudflare|cloudflared|ngrok/,'no tunnel in the notebook');
 return JSON.parse(Buffer.from(JSON.parse(/^PACKAGE = (.*)$/m.exec(code)![1]),'base64').toString('utf8'));
}
const result=(pkg:NotebookPackage,over:Record<string,unknown>={})=>({schema:1,kind:'hahmostudio-notebook-result',jobId:pkg.jobId,packageHash:pkg.packageHash,
 runtime:{checkedAt:'2026-10-08T10:00:00Z',comfyCommit:'c'.repeat(40),gpu:'Tesla T4, 15360 MiB'},checks:[{workflowId:pkg.workflowId,modelId:pkg.modelId,ok:true,problems:[]}],
 receipt:{schema:1,repo:'test/model',revision:REV,files:[{path:'sd.safetensors',sha256:WSHA}]},outputs:[{name:'out_00001_.png',sha256:sha(PNG_1X1),dataBase64:Buffer.from(PNG_1X1).toString('base64')}],...over});

test('notebook backend: packages the exact graph, inputs and pinned manifest; nothing is contacted',async()=>{
 const {nb,h}=await setup();const run=h.service.start(req({workflowId:'character_reference'}));
 await waitPending(nb,run.jobId);const pkg=unpack(nb,run.jobId);
 const {packageHash,...body}=pkg;assert.equal(packageHash,createHash('sha256').update(canonicalJson(body)).digest('hex'));
 assert.deepEqual([pkg.manifest.repo,pkg.manifest.revision,pkg.manifest.files[0].sha256],['test/model',REV,WSHA]);
 const load=Object.values(pkg.graph).find(n=>n.class_type==='LoadImage')!;const name=String(load.inputs.image);
 assert.match(name,new RegExp(`^${run.jobId}-img\\.png$`));assert.deepEqual(Buffer.from(pkg.inputs[name],'base64'),Buffer.from(PNG_1X1));
 assert.equal(h.service.get(run.jobId)!.state,'RENDERING');
 await h.service.cancel(run.jobId);assert.equal((await run.done).state,'CANCELLED');assert.equal(nb.notebookFor(run.jobId),undefined);
});

test('notebook import refuses anything that does not match this job, its package, the pin and the checksums',async()=>{
 const {nb,h}=await setup();const run=h.service.start(req());await waitPending(nb,run.jobId);const pkg=unpack(nb,run.jobId);
 const bad:[Record<string,unknown>,RegExp][]=[
  [{kind:'x'},/not a Hahmostudio/],[{jobId:'rj_other'},/different job/],[{packageHash:'0'.repeat(64)},/different package/],
  [{receipt:{schema:1,repo:'test/model',revision:'d'.repeat(40),files:[{path:'sd.safetensors',sha256:WSHA}]}},/receipt/],
  [{receipt:{schema:1,repo:'test/model',revision:REV,files:[{path:'sd.safetensors',sha256:'e'.repeat(64)}]}},/receipt/],
  [{checks:[{workflowId:'text_to_image',modelId:'test-model',ok:false,problems:['missing node']}]},/runtime check/],
  [{outputs:[]},/no valid outputs/],
  [{outputs:[{name:'x.png',sha256:'0'.repeat(64),dataBase64:Buffer.from(PNG_1X1).toString('base64')}]},/checksum/],
  [{outputs:[{name:'model.safetensors',sha256:sha(PNG_1X1),dataBase64:Buffer.from(PNG_1X1).toString('base64')}]},/disallowed type/],
  [{outputs:[{name:'../x.png',sha256:sha(PNG_1X1),dataBase64:Buffer.from(PNG_1X1).toString('base64')}]},/malformed/],
 ];
 for(const [over,re] of bad)await assert.rejects(nb.importResult(run.jobId,result(pkg,over)),re);
 await assert.rejects(nb.importResult(run.jobId,'nope'),/not a JSON object/);
 assert.ok(nb.isPending(run.jobId),'a rejected import leaves the job waiting');
 await assert.rejects(nb.importResult('rj_unknown',result(pkg)),/not waiting/);
 await nb.cancel(run.jobId);await run.done;
});

test('valid import completes the render through the normal path; live verification is marked runtime-reported',async()=>{
 const {nb,h,ledger}=await setup();const run=h.service.start(req());await waitPending(nb,run.jobId);const pkg=unpack(nb,run.jobId);
 assert.deepEqual(await nb.importResult(run.jobId,result(pkg)),{accepted:true,outputs:1});
 const rec=await run.done;assert.equal(rec.state,'COMPLETED',rec.errors.join(' '));
 assert.equal(rec.runtimeEvidence?.source,'runtime-reported');assert.equal(rec.runtimeEvidence?.gpu,'Tesla T4, 15360 MiB');
 assert.ok((await h.storage.listProjectAssets('project_001','renders')).some(a=>a.name.endsWith('out_00001_.png')));
 assert.deepEqual(rec.liveVerification,{promoted:true,missing:[],source:'runtime-reported'});assert.ok(await ledger().isVerified('text_to_image','test-model'));
 await assert.rejects(nb.importResult(run.jobId,result(pkg)),/not waiting/,'a result cannot be imported twice');
});

test('notebook backend: server-side smoke evidence is ignored, and without runtime evidence nothing is promoted',async()=>{
 const {h,ledger}=await setup();
 assert.equal(await ledger().recordSmoke('kaggle-notebook','notebook',[{workflowId:'text_to_image',modelId:'test-model',ok:true,problems:[]}]),0);
 const rec={job:{...(req() as object),id:'rj_x',backendId:'kaggle-notebook',modelId:'test-model',createdAt:new Date().toISOString()},state:'COMPLETED',outputs:[],model:{revision:REV}} as never;
 const r=await ledger().evaluate(rec,'notebook');assert.ok(r.missing.includes('smoke-not-passed')&&r.missing.includes('checksums-not-verified'));void h;
});

test('notebook render times out when no result is imported',async()=>{
 const {nb,h}=await setup({timeoutMs:30});const run=h.service.start(req());const rec=await run.done;
 assert.equal(rec.state,'FAILED');assert.match(rec.errors.join(' '),/not imported in time/);assert.equal(nb.isPending(run.jobId),false);
});

test('runtime notebook script: provisions, checks, runs the graph on a local fake ComfyUI and writes an importable result',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'nb-')),comfy=join(dir,'comfy'),out=join(dir,'out');
 const {nb,h}=await setup();const run=h.service.start(req({workflowId:'character_reference'}));await waitPending(nb,run.jobId);const pkg=unpack(nb,run.jobId);
 let submitted:any;
 const hf=http.createServer((q,r)=>{if(q.url===`/test/model/resolve/${REV}/sd.safetensors`)r.end(WEIGHTS);else{r.statusCode=404;r.end();}});
 const cu=http.createServer(async(q,r)=>{
  const json=(v:unknown)=>{r.setHeader('content-type','application/json');r.end(JSON.stringify(v));};
  if(q.url==='/object_info')return json(Object.fromEntries(Object.values(pkg.graph).map(n=>[n.class_type,n.class_type==='CheckpointLoaderSimple'?{input:{required:{ckpt_name:[['sd.safetensors']]}}}:{}])));
  if(q.url==='/prompt'){let b='';for await(const c of q)b+=c;submitted=JSON.parse(b);await mkdir(join(comfy,'output','hahmostudio'),{recursive:true});await writeFile(join(comfy,'output','hahmostudio','out_00001_.png'),PNG_1X1);return json({prompt_id:'p1',node_errors:{}});}
  if(q.url==='/history/p1')return json({p1:{status:{status_str:'success'},outputs:{out:{images:[{filename:'out_00001_.png',subfolder:'hahmostudio',type:'output'}],animated:[false]}}}});
  r.statusCode=404;r.end();});
 for(const s of [hf,cu])await new Promise<void>(x=>s.listen(0,'127.0.0.1',x));
 const port=(s:http.Server)=>(s.address() as {port:number}).port;
 try{
  await writeFile(join(dir,'pkg.json'),JSON.stringify(pkg));
  const src=new URL('../../cloud/runtime/',import.meta.url).pathname;
  const py=`import sys,json;sys.dont_write_bytecode=True;sys.path.insert(0,${JSON.stringify(src)});import hahmo_notebook as h;h.run(json.load(open(${JSON.stringify(join(dir,'pkg.json'))})),comfy_dir=${JSON.stringify(comfy)},comfy_url="http://127.0.0.1:${port(cu)}",hf_base_url="http://127.0.0.1:${port(hf)}",out_dir=${JSON.stringify(out)},skip_env_checks=True)`;
  const res=await new Promise<{code:number;out:string}>(x=>execFile('python3',['-I','-c',py],(e,so,se)=>x({code:e?(e as {code:number}).code??1:0,out:so+se})));
  assert.equal(res.code,0,res.out);assert.match(res.out,/VALMIS/);
  assert.equal(submitted.client_id,run.jobId);assert.ok(await readFile(join(comfy,'input',`${run.jobId}-img.png`)),'input image written into ComfyUI');
  const file=JSON.parse(await readFile(join(out,`hahmo-${run.jobId}-tulos.json`),'utf8'));
  assert.deepEqual(await nb.importResult(run.jobId,file),{accepted:true,outputs:1});
  const rec=await run.done;assert.equal(rec.state,'COMPLETED',rec.errors.join(' '));assert.equal(rec.liveVerification?.promoted,true);
 }finally{await h.service.cancel(run.jobId);hf.close();cu.close();await rm(dir,{recursive:true,force:true});}
});
