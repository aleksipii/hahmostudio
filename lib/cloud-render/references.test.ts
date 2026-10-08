// Vertailukuvan sidonta hahmon grafiikkaan (tekoäly-paneelin vaihe 6). Erillinen testidata: alice/bob-fixtuuri, ei kirjaston hahmoja.
import {test} from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {canon,harness,req} from './test-fixtures.ts';
import {mockFree,PNG_1X1} from './mock-backend.ts';
import {CharacterReferenceSystem} from './character-refs.ts';
import {validateCanonicalState,RuleViolation} from './canonical.ts';
import {createCloudRender} from './server.ts';

const OLD='a'.repeat(64),NEW='b'.repeat(64);
function withSource(hash:string|undefined){const c=canon();if(hash)c.characters.alice.sourceSha256=hash;else delete c.characters.alice.sourceSha256;return c;}
const storageRef={backend:'memory',id:'x'} as never;

test('kanoninen tila: grafiikan tiiviste on valinnainen ja validoidaan',()=>{
 assert.equal(validateCanonicalState(withSource(NEW)).characters.alice.sourceSha256,NEW);
 assert.equal(validateCanonicalState(withSource(undefined)).characters.alice.sourceSha256,undefined,'vanha tila ilman tiivistettä kelpaa');
 assert.throws(function(){validateCanonicalState(withSource('../x'));},RuleViolation);
});

test('resolve: vain samalle grafiikalle hyväksytty kuva kelpaa; vanhentunut estää pakollisen syötteen',async()=>{
 const refs=new CharacterReferenceSystem();
 await refs.register('p',{characterId:'alice',assetId:'alice_old',label:'l',mime:'image/png',storageRef,sourceSha256:OLD});
 assert.equal(refs.resolve('p',['alice'],true,{alice:OLD})[0].assetId,'alice_old');
 assert.throws(function(){refs.resolve('p',['alice'],true,{alice:NEW});},function(e:any){return e.code==='reference-stale';});
 assert.deepEqual(refs.resolve('p',['alice'],false,{alice:NEW}),[],'valinnainen vanhentunut kuva jätetään pois, ei käytetä');
 assert.equal(refs.resolve('p',['alice'],true)[0].assetId,'alice_old','ilman tunnettua tiivistettä toimii kuten ennen');
 await refs.register('p',{characterId:'alice',assetId:'alice_new',label:'l',mime:'image/png',storageRef,sourceSha256:NEW});
 assert.equal(refs.resolve('p',['alice'],true,{alice:NEW})[0].assetId,'alice_new');
 await assert.rejects(refs.register('p',{characterId:'alice',assetId:'a2',label:'l',mime:'image/png',storageRef,sourceSha256:'zz'}),function(e:any){return e.code==='reference-invalid';});
});

test('putki: hahmon grafiikan muutos hyväksynnän jälkeen estää renderöinnin syyllä reference-stale',async()=>{
 const b=mockFree(),h=await harness([b]);
 (h.refs as any).refs.clear();for(const a of await h.storage.listProjectAssets('project_001','characters'))await h.storage.deleteAsset(a);
 const ref=await h.storage.uploadAsset('project_001','references','alice.png',PNG_1X1,'image/png');
 await h.refs.register('project_001',{characterId:'alice',assetId:'alice_ref',label:'front',mime:'image/png',storageRef:ref,sourceSha256:OLD});
 async function relock(hash:string){await h.projects.put(withSource(hash));h.projects.unlock('project_001','scene_001');await h.projects.lock('project_001','scene_001','tester');}
 await relock(OLD);
 const ok=await h.service.start(req({workflowId:'character_reference'})).done;assert.equal(ok.state,'COMPLETED',JSON.stringify(ok.blocked));
 await relock(NEW);
 const calls=b.providerCalls.length,stale=await h.service.start(req({workflowId:'character_reference'})).done;
 assert.equal(stale.state,'BLOCKED');assert.equal(stale.blocked!.code,'reference-stale');assert.equal(b.providerCalls.length,calls,'taustaan ei oteta yhteyttä');
});

test('API: vertailukuva hyväksytään vain samalle grafiikalle kuin synkronoidussa tilassa',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'hs-ref-')),c=createCloudRender({HAHMOSTUDIO_STORAGE:'local-dev'},dir);
 function call(method:string,path:string,body?:unknown){const u=new URL(path,'http://x');return c.handle({method,path:u.pathname,query:u.searchParams,body,user:'owner'});}
 try{
  assert.equal((await call('PUT','/api/projects/project_001',withSource(NEW))).status,200);
  const url='/api/projects/project_001/characters/alice/reference',img={mime:'image/png',dataBase64:Buffer.from(PNG_1X1).toString('base64')};
  const stale=await call('POST',url,{...img,sourceSha256:OLD});assert.equal(stale.status,409);assert.equal((stale.body as any).code,'reference-stale');
  assert.equal((await call('POST',url,img)).status,409,'tunnetulle grafiikalle kuva ilman tiivistettä ei kelpaa');
  assert.equal((await call('POST',url,{...img,sourceSha256:'XYZ'})).status,400);
  const ok=await call('POST',url,{...img,sourceSha256:NEW});assert.equal(ok.status,200);assert.equal((ok.body as any).sourceSha256,NEW);
  assert.equal(c.refs.list('project_001','alice')[0].sourceSha256,NEW);
  assert.equal(c.refs.list('project_001','bob').length,0,'hylätyt yritykset eivät jätä jälkeä');
  assert.equal(c.refs.list('project_001','alice').length,1);
 }finally{await rm(dir,{recursive:true,force:true});}
});
