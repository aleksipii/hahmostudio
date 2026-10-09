import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,access,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {runEncoder} from './encoder.mjs';

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
