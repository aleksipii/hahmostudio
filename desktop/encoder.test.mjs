import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,access,rm,writeFile,readFile,chmod} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {runEncoder,encodeFrames} from './encoder.mjs';

test('already canceled export never starts an encoder or writes its output',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'hahmo-encoder-cancel-'));
 try{
  const output=join(dir,'must-not-exist'),controller=new AbortController();controller.abort();
  const source="require('node:fs').writeFileSync(process.argv[1],'started')";
  await assert.rejects(runEncoder(process.execPath,['-e',source,output],controller.signal),e=>e.name==='AbortError');
  await assert.rejects(access(output),e=>e.code==='ENOENT');
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('successful encoder progress and failing exit status are preserved',async()=>{
 const progress=[];
 await runEncoder(process.execPath,['-e',"process.stdout.write('out_time_us=1250000\\n')"],new AbortController().signal,s=>progress.push(s));
 assert.deepEqual(progress,[1.25]);
 await assert.rejects(runEncoder(process.execPath,['-e',"process.stderr.write('encoder failed');process.exitCode=2"],new AbortController().signal),/encoder failed/);
});

test('MP4 duration covers the whole last frame of a non-integer-length export',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'hahmo-encoder-t-'));
 try{
  const log=join(dir,'args.txt'),binary=join(dir,'fake-ffmpeg');
  await writeFile(binary,`#!/bin/sh\nprintf '%s\\n' "$*" >> '${log}'\n`);await chmod(binary,0o755);
  // 5,083 s @ 30 fps: vientisopimus odottaa ceil(152,5) = 153 ruutua, joten -t on 153/30 eikä 5,083.
  await encodeFrames({binary,dir,output:join(dir,'out.mp4'),preset:{format:'mp4',fps:30,start:0,end:5.083333333333333,quality:8},audio:true,signal:new AbortController().signal});
  const pack=(await readFile(log,'utf8')).trim().split('\n').at(-1).split(' ');
  assert.equal(Number(pack[pack.indexOf('-t')+1]),153/30);
 }finally{await rm(dir,{recursive:true,force:true});}
});
