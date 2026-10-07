import {test} from 'node:test';import assert from 'node:assert/strict';
import http from 'node:http';import {createHash} from 'node:crypto';import {mkdtemp,writeFile,readdir,rm,readFile} from 'node:fs/promises';import {existsSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {spawnSync} from 'node:child_process';
import {buildProvisionManifest} from './provision.ts';
import {ZERO_COST_POLICY} from './compute.ts';
import {goodModel,REV} from './test-fixtures.ts';
import {Blocked} from './types.ts';

test('manifest is built only for fully verifiable models',()=>{
 const sha='c'.repeat(64),m=goodModel({files:[{path:'sub/sd.safetensors',sha256:sha,comfyFolder:'checkpoints'}]});
 const man=buildProvisionManifest(m,'PRODUCTION_SAFE',ZERO_COST_POLICY);assert.deepEqual([man.repo,man.revision,man.files[0].path],['test/model',REV,'sub/sd.safetensors']);
 assert.throws(()=>buildProvisionManifest(goodModel({revision:undefined}),'PRODUCTION_SAFE',ZERO_COST_POLICY),Blocked);
 assert.throws(()=>buildProvisionManifest(goodModel({files:undefined}),'PRODUCTION_SAFE',ZERO_COST_POLICY),/checksums/i);
 assert.throws(()=>buildProvisionManifest(goodModel({files:[{path:'../x.safetensors',sha256:sha,comfyFolder:'checkpoints'}]}),'PRODUCTION_SAFE',ZERO_COST_POLICY),/Invalid file entry/);
 assert.throws(()=>buildProvisionManifest(goodModel({commercialUse:'unknown'}),'PRODUCTION_SAFE',ZERO_COST_POLICY),Blocked);
});
test('dot-segment repo ids are refused',()=>{assert.throws(()=>buildProvisionManifest(goodModel({source:'huggingface:../x'}),'PRODUCTION_SAFE',ZERO_COST_POLICY),/Invalid repository/);});
test('runtime script verifies checksums and discards mismatches (local server, no external network)',async()=>{
 const body=Buffer.from('fake weights for test'),good=createHash('sha256').update(body).digest('hex');
 const srv=http.createServer((_q,r)=>{r.end(body);});await new Promise<void>(r=>srv.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${(srv.address() as {port:number}).port}`;
 const dir=await mkdtemp(join(tmpdir(),'prov-'));
 try{
  const run=async(sha:string)=>{const mf=join(dir,'m.json');await writeFile(mf,JSON.stringify({schema:1,modelId:'x',repo:'o/r',revision:REV,files:[{path:'a/w.safetensors',sha256:sha,comfyFolder:'checkpoints'}]}));
   return new Promise<{status:number|null;out:string}>(res=>{import('node:child_process').then(({execFile})=>execFile('python3',['-I',new URL('../../cloud/runtime/provision_models.py',import.meta.url).pathname,mf,'--comfy-dir',join(dir,'comfy'),'--base-url',base,'--receipt',join(dir,'receipt.json')],(e,so,se)=>res({status:e?(e as {code:number}).code:0,out:so+se})));});};
  const ok=await run(good);assert.equal(ok.status,0,ok.out);const rc=JSON.parse(await readFile(join(dir,'receipt.json'),'utf8'));assert.deepEqual([rc.repo,rc.revision,rc.files[0].sha256],['o/r',REV,good]);await rm(join(dir,'receipt.json'));assert.deepEqual(await readdir(join(dir,'comfy','models','checkpoints')),['w.safetensors']);
  await rm(join(dir,'comfy'),{recursive:true});
  const bad=await run('d'.repeat(64));assert.notEqual(bad.status,0);assert.match(bad.out,/checksum mismatch/);assert.deepEqual(await readdir(join(dir,'comfy','models','checkpoints')),[],'mismatched file is not kept');assert.equal(existsSync(join(dir,'receipt.json')),false,'no receipt without full verification');
  void spawnSync;
 }finally{srv.close();await rm(dir,{recursive:true,force:true});}
});
