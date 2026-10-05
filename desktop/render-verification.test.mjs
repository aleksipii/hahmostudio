import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {validateManifest,verifyEncodedOutput,fileChecksum} from './render-verification.mjs';
import {commitExport} from './commit-export.mjs';
const binary=new URL('../.private-runtime/native/bin/ffmpeg',import.meta.url).pathname;
test('render contract rejects altered frozen bytes and incorrect frame count',()=>{
 const bytes=new Uint8Array([1,2]),preset={start:0,end:1,fps:4};
 const m={schemaVersion:1,engineVersion:'studio-contract-1',snapshotHash:createHash('sha256').update(bytes).digest('hex'),revisionId:'a'.repeat(64),preset,expectedFrames:4,assets:[],episodeIds:[]};
 assert.equal(validateManifest(m,bytes,preset).expectedFrames,4);
 assert.throws(()=>validateManifest(m,new Uint8Array([1,3]),preset),/muuttui/);
 assert.throws(()=>validateManifest({...m,expectedFrames:3},bytes,preset),/virheellinen/);
});
test('failed paired publication restores both previous video and manifest',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'kilsat-commit-'));try{
  const dest=join(dir,'movie.mp4'),output=join(dir,'new.mp4');await writeFile(dest,'old video');await writeFile(dest+'.manifest.json','old manifest');await writeFile(output,'new video');
  await assert.rejects(commitExport(output,join(dir,'missing.json'),dest,dir));
  assert.equal(await readFile(dest,'utf8'),'old video');assert.equal(await readFile(dest+'.manifest.json','utf8'),'old manifest');
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('real FFmpeg decodes all exported frames and rejects truncation, wrong counts and missing audio',async t=>{
 try{await access(binary);}catch{t.skip('Bundled native FFmpeg unavailable in this environment');return;}
 const dir=await mkdtemp(join(tmpdir(),'kilsat-qc-'));try{
  const output=join(dir,'test.mp4');const run=spawnSync(binary,['-v','error','-f','lavfi','-i','color=c=blue:s=16x16:r=4:d=1','-c:v','libopenh264','-y',output],{encoding:'utf8'});assert.equal(run.status,0,run.stderr);
  const result=await verifyEncodedOutput({binary,output,frames:4,audio:false,width:16,height:16,fps:4,signal:new AbortController().signal});assert.equal(result.decodedFrames,4);assert.equal(result.width,16);
  await assert.rejects(verifyEncodedOutput({binary,output,frames:4,audio:false,width:32,signal:new AbortController().signal}),/mitat/);
  await assert.rejects(verifyEncodedOutput({binary,output,frames:5,audio:false,signal:new AbortController().signal}),/tarkistus/);
  await assert.rejects(verifyEncodedOutput({binary,output,frames:4,audio:true,signal:new AbortController().signal}),/tarkistus/);
  assert.match(await fileChecksum(output),/^[a-f0-9]{64}$/);
  const damaged=join(dir,'damaged.mp4');await writeFile(damaged,(await readFile(output)).subarray(0,40));await assert.rejects(verifyEncodedOutput({binary,output:damaged,frames:4,audio:false,signal:new AbortController().signal}),/tarkistus/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
