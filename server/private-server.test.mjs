import {test} from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {createPrivateServer} from './private-server.mjs';
test('private server protects assets, owner creation, session and logout',async()=>{
 const root=await mkdtemp(join(tmpdir(),'hahmostudio-auth-'));await mkdir(join(root,'dist'));await writeFile(join(root,'dist','index.html'),'PRIVATE EDITOR');await writeFile(join(root,'dist','app.js'),'PRIVATE ASSET');
 const server=await createPrivateServer({distDir:join(root,'dist'),dataDir:join(root,'data'),setupToken:'test-bootstrap-token',speechRecognizer:async()=>[{start:0,end:.01,value:'D'}]});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
 const post=(path,data,cookie,origin=base)=>fetch(base+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(data)});
 try{
  assert.equal((await fetch(base+'/app.js',{redirect:'manual'})).status,302);
  assert.equal((await post('/api/auth/setup',{username:'owner',password:'test-password-123',setupToken:'wrong'})).status,403);
  assert.equal((await post('/api/auth/setup',{username:'owner',password:'test-password-123',setupToken:'test-bootstrap-token',speechRecognizer:async()=>[{start:0,end:.01,value:'D'}]},null,'http://evil.test')).status,403);
  const setup=await post('/api/auth/setup',{username:'owner',password:'test-password-123',setupToken:'test-bootstrap-token',speechRecognizer:async()=>[{start:0,end:.01,value:'D'}]});assert.equal(setup.status,200);const cookie=setup.headers.get('set-cookie').split(';')[0];assert.ok(cookie.startsWith(`hahmostudio_session_${server.address().port}=`));assert.match(setup.headers.get('set-cookie'),/HttpOnly/);assert.match(setup.headers.get('set-cookie'),/SameSite=Strict/);
  assert.equal((await post('/api/auth/setup',{username:'attacker',password:'test-password-123',setupToken:'test-bootstrap-token',speechRecognizer:async()=>[{start:0,end:.01,value:'D'}]})).status,409);
  assert.equal(await(await fetch(base+'/app.js',{headers:{Cookie:cookie}})).text(),'PRIVATE ASSET');
  const wav=Buffer.alloc(364);wav.write('RIFF');wav.writeUInt32LE(356,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(16000,24);wav.writeUInt32LE(32000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(320,40);
  const speech=(session,origin=base,body=wav,language='fi')=>fetch(base+'/api/speech/recognize?language='+language,{method:'POST',headers:{Origin:origin,'Content-Type':'audio/wav',...(session?{Cookie:session}:{})},body});
  assert.equal((await speech()).status,401);assert.equal((await speech(cookie,'http://evil.test')).status,403);assert.equal((await speech(cookie,base,Buffer.from('invalid'))).status,400);assert.equal((await speech(cookie,base,wav,'unknown')).status,400);assert.deepEqual(await(await speech(cookie)).json(),{mouthCues:[{start:0,end:.01,value:'D'}]});assert.equal((await speech(cookie,base,wav,'en')).status,200);
  const stored=await readFile(join(root,'data','owner.json'),'utf8');assert.ok(!stored.includes('test-password-123'));
  assert.equal((await post('/api/auth/login',{username:'owner',password:'wrong'})).status,401);
  const logged=await post('/api/auth/login',{username:'owner',password:'test-password-123'});assert.equal(logged.status,200);
  await post('/api/auth/logout',{},cookie);assert.equal((await fetch(base+'/',{headers:{Cookie:cookie},redirect:'manual'})).status,302);
  for(let i=0;i<8;i++)await post('/api/auth/login',{username:'owner',password:'wrong'});assert.equal((await post('/api/auth/login',{username:'owner',password:'wrong'})).status,429);
 }finally{await new Promise(resolve=>server.close(resolve));await rm(root,{recursive:true,force:true});}
});
test('cloud render API is private, CSRF-guarded and policy is not writable',async()=>{
 const root=await mkdtemp(join(tmpdir(),'hahmostudio-cloud-'));await mkdir(join(root,'dist'));await writeFile(join(root,'dist','index.html'),'x');
 const {createCloudRender}=await import('../lib/cloud-render/server.ts');
 const cloud=createCloudRender({HAHMOSTUDIO_STORAGE:'local-dev'},join(root,'data'));
 const server=await createPrivateServer({distDir:join(root,'dist'),dataDir:join(root,'data'),setupToken:'t0ken-for-cloud-test',cloudRender:cloud});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
 try{
  assert.equal((await fetch(base+'/api/compute/policy')).status,401,'login required');
  const setup=await fetch(base+'/api/auth/setup',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({username:'owner',password:'test-password-123',setupToken:'t0ken-for-cloud-test'})});const cookie=setup.headers.get('set-cookie').split(';')[0];
  const get=(p)=>fetch(base+p,{headers:{Cookie:cookie}});
  const policy=await(await get('/api/compute/policy')).json();assert.equal(policy.maxCostEur,0);assert.equal(policy.allowPaidCompute,false);
  const put=(p,body,origin=base)=>fetch(base+p,{method:'PUT',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
  assert.equal((await fetch(base+'/api/compute/policy',{method:'POST',headers:{Cookie:cookie,Origin:base,'Content-Type':'application/json'},body:JSON.stringify({allowPaidCompute:true})})).status,405);
  assert.equal((await put('/api/projects/p',{projectId:'p'},'http://evil.test')).status,403);
  assert.equal((await put('/api/projects/p',{projectId:'p'})).status,422);
  assert.equal((await fetch(base+'/api/render',{method:'POST',headers:{Cookie:cookie,Origin:base,'Content-Type':'application/json'},body:JSON.stringify({projectId:'p',sceneId:'s',workflowId:'w',allowPaidCompute:true})})).status,400);
  assert.equal((await(await get('/api/compute/policy')).json()).allowPaidCompute,false);
 }finally{await new Promise(r=>server.close(r));await rm(root,{recursive:true,force:true});}
});
