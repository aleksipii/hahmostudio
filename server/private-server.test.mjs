import {test} from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {createPrivateServer} from './private-server.mjs';
test('private server protects assets, owner creation, session and logout',async()=>{
 const root=await mkdtemp(join(tmpdir(),'hahmostudio-auth-'));await mkdir(join(root,'dist'));await writeFile(join(root,'dist','index.html'),'PRIVATE EDITOR');await writeFile(join(root,'dist','app.js'),'PRIVATE ASSET');
 const server=await createPrivateServer({distDir:join(root,'dist'),dataDir:join(root,'data'),setupToken:'test-bootstrap-token'});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
 const post=(path,data,cookie,origin=base)=>fetch(base+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(data)});
 try{
  assert.equal((await fetch(base+'/app.js',{redirect:'manual'})).status,302);
  assert.equal((await post('/api/auth/setup',{username:'owner',password:'test-password-123',setupToken:'wrong'})).status,403);
  assert.equal((await post('/api/auth/setup',{username:'owner',password:'test-password-123',setupToken:'test-bootstrap-token'},null,'http://evil.test')).status,403);
  const setup=await post('/api/auth/setup',{username:'owner',password:'test-password-123',setupToken:'test-bootstrap-token'});assert.equal(setup.status,200);const cookie=setup.headers.get('set-cookie').split(';')[0];assert.ok(cookie.startsWith(`hahmostudio_session_${server.address().port}=`));assert.match(setup.headers.get('set-cookie'),/HttpOnly/);assert.match(setup.headers.get('set-cookie'),/SameSite=Strict/);
  assert.equal((await post('/api/auth/setup',{username:'attacker',password:'test-password-123',setupToken:'test-bootstrap-token'})).status,409);
  assert.equal(await(await fetch(base+'/app.js',{headers:{Cookie:cookie}})).text(),'PRIVATE ASSET');
  const stored=await readFile(join(root,'data','owner.json'),'utf8');assert.ok(!stored.includes('test-password-123'));
  assert.equal((await post('/api/auth/login',{username:'owner',password:'wrong'})).status,401);
  const logged=await post('/api/auth/login',{username:'owner',password:'test-password-123'});assert.equal(logged.status,200);
  await post('/api/auth/logout',{},cookie);assert.equal((await fetch(base+'/',{headers:{Cookie:cookie},redirect:'manual'})).status,302);
  for(let i=0;i<8;i++)await post('/api/auth/login',{username:'owner',password:'wrong'});assert.equal((await post('/api/auth/login',{username:'owner',password:'wrong'})).status,429);
 }finally{await new Promise(resolve=>server.close(resolve));await rm(root,{recursive:true,force:true});}
});
