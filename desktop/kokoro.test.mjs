import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {KokoroModelStore,KokoroService,validateSynthesisRequest,MODEL_FILES} from './kokoro.mjs';

const files=MODEL_FILES.map(f=>({...f,sha256:null}));
const fakeFetch=bodies=>async url=>{const path=Object.keys(bodies).find(p=>url.endsWith('/'+p));if(path===undefined)return {ok:false,status:404};const bytes=Buffer.from(bodies[path]);return new Response(bytes,{status:200,headers:{'content-length':String(bytes.length)}});};
const bodies=Object.fromEntries(files.map(f=>[f.path,'data:'+f.path]));
const withDir=async fn=>{const dir=await mkdtemp(join(tmpdir(),'kokoro-test-'));try{await fn(dir);}finally{await rm(dir,{recursive:true,force:true});}};

test('model is not present or downloaded until download is called; manifest records hashes and survives verify',async()=>withDir(async dir=>{
 let requests=0;const store=new KokoroModelStore(dir,{files,fetchImpl:async(...a)=>{requests++;return fakeFetch(bodies)(...a);}});
 assert.equal((await store.status()).installed,false);assert.equal(requests,0);
 const status=await store.download();assert.equal(status.installed,true);assert.equal(requests,files.length);
 const manifest=JSON.parse(await readFile(store.manifestPath,'utf8'));
 assert.equal(manifest.files[0].sha256,createHash('sha256').update(bodies['config.json']).digest('hex'));
 assert.equal((await store.status({verify:true})).installed,true);
 assert.ok(store.modelDir.startsWith(dir),'model lives in the data folder');
 await store.remove();assert.equal((await store.status()).installed,false);
}));

test('failed or cancelled download leaves no partial model',async()=>withDir(async dir=>{
 const store=new KokoroModelStore(dir,{files,fetchImpl:async url=>url.endsWith('tokenizer.json')?{ok:false,status:500}:fakeFetch(bodies)(url)});
 await assert.rejects(store.download(),/epäonnistui/);assert.equal((await store.status()).installed,false);await assert.rejects(stat(store.modelDir));
 const c=new AbortController();c.abort();await assert.rejects(new KokoroModelStore(dir,{files,fetchImpl:fakeFetch(bodies)}).download({signal:c.signal}));
}));

test('a pinned hash mismatch rejects the model and tampering is detected on verify',async()=>withDir(async dir=>{
 const pinned=files.map((f,i)=>i===0?{...f,sha256:'0'.repeat(64)}:f);
 await assert.rejects(new KokoroModelStore(dir,{files:pinned,fetchImpl:fakeFetch(bodies)}).download(),/tarkiste/);
 const store=new KokoroModelStore(dir,{files,fetchImpl:fakeFetch(bodies)});await store.download();
 const {writeFile}=await import('node:fs/promises');await writeFile(join(store.modelDir,'config.json'),'data:config.jsoX');
 const s=await store.status({verify:true});assert.equal(s.installed,false);assert.match(s.error,/tarkiste/);
}));

test('service validates requests, serializes, refuses without model and releases the engine on cancel',async()=>withDir(async dir=>{
 assert.throws(()=>validateSynthesisRequest({text:'x'.repeat(601),voice:'af_heart',speed:1}));
 assert.throws(()=>validateSynthesisRequest({text:'hi',voice:'../x',speed:1}));
 assert.throws(()=>validateSynthesisRequest({text:'hi',voice:'af_heart',speed:3}));
 let created=0,disposed=0,release,started;
 const store=new KokoroModelStore(dir,{files,fetchImpl:fakeFetch(bodies)});
 const service=new KokoroService({store,createEngine:async()=>{created++;return {dispose:async()=>{disposed++;},synthesize:(r,signal)=>new Promise((resolve,reject)=>{signal.addEventListener('abort',()=>reject(Error('abort')));release=()=>resolve({samples:new Float32Array(2400),sampleRate:24000});started();})};}});
 await assert.rejects(service.synthesize({text:'Hello',voice:'af_heart',speed:1}),/ladattu|puuttuu/);assert.equal(created,0);
 await store.download();
 const firstReady=new Promise(resolve=>{started=resolve;});
 const first=service.synthesize({text:'Hello',voice:'af_heart',speed:1});
 await firstReady;
 await assert.rejects(service.synthesize({text:'Again',voice:'af_heart',speed:1}),/kesken/);
 release();const done=await first;assert.equal(done.sampleRate,24000);assert.equal(created,1);
 const secondReady=new Promise(resolve=>{started=resolve;});
 const second=service.synthesize({text:'Cancel me',voice:'af_heart',speed:1});await secondReady;service.cancel();
 await assert.rejects(second);assert.equal(disposed,1,'cancel releases the engine');
}));
