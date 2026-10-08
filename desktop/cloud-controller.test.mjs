// Vaihe 3: opt-in, pilviprosessin elinkaari, lupa ennen lähetystä ja checkpoint ennen dispatchia.
// Pilviprosessi korvataan samaa viestiprotokollaa puhuvalla vale-lapsella, joka ajaa oikeaa lib/cloud-render-koodia.
import test from 'node:test';import assert from 'node:assert/strict';import {EventEmitter} from 'node:events';
import {mkdtemp,readFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {CloudController} from './cloud-controller.mjs';
import {CloudSettingsStore,cloudRoute,egressConsent,buildCloudEnv,redactBody,CLOUD_OPS} from './cloud-policy.mjs';
import {CloudSecretStore} from './cloud-secrets.mjs';
import {CloudJobJournal} from './cloud-jobs.mjs';
import {createCloudRender} from '../lib/cloud-render/server.ts';
import {canon} from '../lib/cloud-render/test-fixtures.ts';

const fakeSafe={isEncryptionAvailable:()=>true,encryptString:s=>Buffer.from('ENC1'+Buffer.from(s).toString('base64')),decryptString:b=>Buffer.from(b.toString().slice(4),'base64').toString()};
function fakeChild(log){
 const child=new EventEmitter();let cloud;child.started=[];child.calls=[];
 child.postMessage=m=>setImmediate(async()=>{
  if(m.type==='start'){child.started.push(m);cloud=createCloudRender(m.env,m.dataDir);child.emit('message',{type:'ready',storage:cloud.storage.id,policy:cloud.policy.mode});}
  else if(m.type==='call'){child.calls.push(m.route);await log?.(m.route);const out=await cloud.handle({...m.route,user:'owner'});child.emit('message',{type:'result',id:m.id,status:out.status,body:out.body});}
  else if(m.type==='stop')child.emit('exit',0);
 });
 child.kill=()=>child.emit('exit',1);return child;
}
async function setup({answers=[],log,files={}}={}){
 const dir=await mkdtemp(join(tmpdir(),'hs-cloudctl-')),secrets=new CloudSecretStore({dir,safeStorage:fakeSafe}),settings=new CloudSettingsStore({dir});
 const asked=[],children=[];
 const ctl=new CloudController({dir,secrets,settings,servicePath:'/x/cloud-service.mjs',fork:()=>{const c=fakeChild(log);children.push(c);return c;},confirm:async o=>{asked.push(o);return answers.length?answers.shift():false;},saveFile:async()=>null,openJson:async kind=>files[kind]??null});
 return {dir,ctl,asked,children,secrets,settings};
}

test('pilvi on oletuksena pois: ei prosessia, ei kutsuja, tila ilman arvoja',async()=>{
 const {ctl,children}=await setup();
 const s=await ctl.status();assert.equal(s.available,true);assert.equal(s.enabled,false);assert.equal(s.running,false);assert.equal(s.policy.maxCostEur,0);
 await assert.rejects(ctl.call('health'),/ei ole käytössä/);assert.equal(children.length,0);
});

test('opt-in vaatii natiivin vahvistuksen; hylkäys ei muuta mitään eikä käynnistä prosessia',async()=>{
 const {ctl,asked,children}=await setup({answers:[false,true]});
 assert.equal((await ctl.enable()).enabled,false);assert.match(asked[0].detail,/Äänet, PSD-tiedostot ja käsikirjoitus eivät lähde/);
 assert.equal((await ctl.enable()).enabled,true);assert.equal(children.length,0,'prosessi käynnistyy vasta ensimmäisestä kutsusta');
 const h=await ctl.call('health');assert.equal(h.status,200);assert.equal(children.length,1);
 const env=children[0].started[0].env;assert.deepEqual(Object.keys(env),['HAHMOSTUDIO_STORAGE']);assert.equal(env.HAHMOSTUDIO_STORAGE,'local-dev');
 assert.equal(h.body.policy.allowPaidCompute,false);assert.equal(h.body.policy.maxCostEur,0);
 assert.equal((await ctl.status()).running,true);assert.equal((await ctl.disable()).running,false);
});

test('ilman ilmaiseksi vahvistettua taustaa, lukittua mallia ja vertailukuvaa renderöinti on estetty oikealla syyllä',async()=>{
 const {ctl}=await setup({answers:[true]});await ctl.enable();
 const c=canon();assert.equal((await ctl.call('sync',{canonical:c})).status,200);
 assert.equal((await ctl.call('lock',{projectId:c.projectId,sceneId:'scene_001'})).status,200);
 const d=await ctl.call('direct',{projectId:c.projectId,sceneId:'scene_001'});assert.equal(d.body.director,'rule-based');
 const p=await ctl.call('preflight',{projectId:c.projectId,sceneId:'scene_001',workflowId:'text_to_image'});
 assert.equal(p.status,200);assert.equal(p.body.status,'BLOCKED');assert.ok(!p.body.fingerprint);assert.ok(p.body.reasons.length>0);
 const v=await ctl.call('preflight',{projectId:c.projectId,sceneId:'scene_001',workflowId:'image_to_video'});
 assert.equal(v.body.status,'BLOCKED');
 for(const x of [p,v])assert.match(x.body.reasons.join(' '),/No registered model is acceptable/);
});

test('renderöinti: lupa kysytään ennen lähetystä, hylkäys ei lähetä eikä kirjaa mitään',async()=>{
 const {ctl,asked,children,dir}=await setup({answers:[true,false]});await ctl.enable();
 const r=await ctl.call('render',{projectId:'project_001',sceneId:'scene_001',workflowId:'text_to_image',authorizationFingerprint:'a'.repeat(64)});
 assert.deepEqual(r.body,{cancelled:true});assert.match(asked[1].message,/Lähetetäänkö lukittu kohtaus/);assert.match(asked[1].detail,/Kustannus €0,00/);
 assert.ok(!children[0].calls.some(x=>x.path==='/api/render'),'render-reittiä ei kutsuttu');
 assert.deepEqual(await new CloudJobJournal({dir}).list(),[]);
});

test('checkpoint kirjoitetaan levylle ennen dispatchia; uudelleenkäynnistyksen jälkeen työ on interrupted',async()=>{
 let seen;const log=async route=>{if(route.path==='/api/render')seen=JSON.parse(await readFile(join(dir,'cloud-render-jobs.json'),'utf8')).records;};
 const s=await setup({answers:[true,true],log});var dir=s.dir;await s.ctl.enable();
 await s.ctl.call('sync',{canonical:canon()});
 const r=await s.ctl.call('render',{projectId:'project_001',sceneId:'scene_001',workflowId:'text_to_image',authorizationFingerprint:'a'.repeat(64)});
 assert.equal(seen.length,1);assert.equal(seen[0].state,'dispatching');assert.equal(seen[0].sceneId,'scene_001');
 assert.equal(r.status,202);assert.equal((await s.ctl.status()).jobs[0].jobId,r.body.jobId);
 let job;for(let i=0;i<100;i++){job=await s.ctl.call('job',{jobId:r.body.jobId});if(['COMPLETED','BLOCKED','FAILED','CANCELLED'].includes(job.body.state))break;await new Promise(x=>setTimeout(x,10));}
 assert.equal(job.body.state,'BLOCKED','väärennetty valtuutus ei kelpaa');assert.equal((await s.ctl.status()).jobs[0].state,'BLOCKED');
 // Keskeneräinen kirjaus (esim. kaatuminen dispatchin jälkeen) muuttuu uudessa käynnistyksessä interruptediksi, ei lähetetä uudelleen.
 const j=new CloudJobJournal({dir});const id=await j.begin({projectId:'project_001',sceneId:'scene_002',workflowId:'text_to_image'});await j.update(id,{state:'RENDERING',jobId:'job_1'});
 const after=await new CloudJobJournal({dir}).list();assert.equal(after.find(x=>x.id===id).state,'interrupted');
 assert.equal(s.children.length,1);
});

test('pilviprosessin päättyminen keskeyttää kesken olevat työt',async()=>{
 const {ctl,children,dir}=await setup({answers:[true]});await ctl.enable();await ctl.call('health');
 await ctl.journal.begin({projectId:'p',sceneId:'s',workflowId:'w'});children[0].kill();await new Promise(r=>setTimeout(r,20));
 assert.equal((await ctl.status()).running,false);assert.equal((await new CloudJobJournal({dir}).list())[0].state,'interrupted');
});

test('ilmaisuuden vahvistus on käyttäjän natiivi ilmoitus ja käynnistää prosessin uusilla asetuksilla',async()=>{
 const {ctl,children,asked}=await setup({answers:[true,false,true]});await ctl.enable();await ctl.call('health');
 assert.equal((await ctl.declareFree('notebook',true)).settings.notebookClassifiedFree,false);
 assert.equal((await ctl.declareFree('notebook',true)).settings.notebookClassifiedFree,true);assert.match(asked[2].detail,/Maksullista laskentaa ei sallita/);
 await ctl.call('health');assert.equal(children.length,2);assert.equal(children[1].started[0].env.HAHMOSTUDIO_NOTEBOOK_CLASSIFIED_FREE,'yes');
 const b=await ctl.call('backends');assert.deepEqual(b.body.backends.filter(x=>x.enabled).map(x=>[x.id,x.class]),[['kaggle-notebook','free']]);
 await assert.rejects(ctl.declareFree('runpod',true),/Tuntematon ajoympäristö/);
});

test('reitit: renderer ei voi valita reittiä, taustaa, parametreja eikä politiikkaa',()=>{
 assert.throws(()=>cloudRoute('../compute/policy'),/Tuntematon pilvitoiminto/);assert.throws(()=>cloudRoute('estimate'),/Tuntematon/);
 for(const extra of [{maxCostEur:5},{useAI:true},{backendId:'runpod'},{params:{steps:100}},{modelId:'x'}])
  assert.throws(()=>cloudRoute('preflight',{projectId:'p',sceneId:'s',workflowId:'w',...extra}),/tuntematon kenttä/);
 assert.throws(()=>cloudRoute('lock',{projectId:'..',sceneId:'s'}),/virheellinen tunniste/);assert.throws(()=>cloudRoute('job',{jobId:'a/b'}),/virheellinen tunniste/);
 assert.throws(()=>cloudRoute('render',{projectId:'p',sceneId:'s',workflowId:'w'}),/valtuutus puuttuu/);
 assert.throws(()=>cloudRoute('sync',{canonical:{projectId:'p',pad:'x'.repeat(2*1024*1024)}}),/liian suuri/);
 assert.deepEqual(cloudRoute('direct',{projectId:'p',sceneId:'s'}),{method:'POST',path:'/api/ai/direct',body:{projectId:'p',sceneId:'s'}});
 const img={projectId:'p',characterId:'alice',mime:'image/png',dataBase64:'iVBORw=='};
 assert.equal(cloudRoute('reference',{...img,sourceSha256:'b'.repeat(64)}).body.sourceSha256,'b'.repeat(64));assert.equal(cloudRoute('reference',img).body.sourceSha256,undefined);
 assert.throws(()=>cloudRoute('reference',{...img,sourceSha256:'../x'}),/tiiviste on virheellinen/);
 assert.equal(CLOUD_OPS.length,13);
});

test('lähtevän datan lupa: paikallinen tallennus ei kysy synkronoinnista, Drive ja renderöinti kysyvät aina',()=>{
 const sync=cloudRoute('sync',{canonical:canon()});
 assert.equal(egressConsent('sync',sync,{storage:'local-dev'}),null);assert.match(egressConsent('sync',sync,{storage:'google-drive'}).detail,/Ei ääniä/);
 const render=cloudRoute('render',{projectId:'p',sceneId:'s',workflowId:'w',authorizationFingerprint:'b'.repeat(64)});
 assert.match(egressConsent('render',render,{storage:'local-dev',backends:[{id:'kaggle-notebook',enabled:true}]}).detail,/kaggle-notebook.*tälle koneelle.*€0,00/);
 assert.equal(egressConsent('health',cloudRoute('health'),{storage:'google-drive'}),null);
});

test('ympäristö rakennetaan sallitulista: Drive vain kokonaisena, ei maksullisen laskennan avaimia',()=>{
 const env=buildCloudEnv({HAHMOSTUDIO_COLAB_COMFYUI_URL:'https://a.example',GOOGLE_OAUTH_CLIENT_ID:'x.apps.googleusercontent.com',HAHMOSTUDIO_ALLOW_PAID_COMPUTE:'yes-i-accept-charges'},{colabClassifiedFree:true});
 assert.deepEqual({...env},{HAHMOSTUDIO_COLAB_COMFYUI_URL:'https://a.example',HAHMOSTUDIO_COLAB_CLASSIFIED_FREE:'yes',HAHMOSTUDIO_STORAGE:'local-dev'});
 assert.ok(Object.isFrozen(env));
 assert.deepEqual(redactBody({error:'yhteys https://abc.example/x epäonnistui',token:'tunnus-1234567890'},{B:'tunnus-1234567890'}),{error:'yhteys https://*** epäonnistui',token:'***'});
});

test('mallien lukitus tuodaan tiedostosta; sen jälkeen video estyy puuttuvan vertailukuvan vuoksi',async()=>{
 const {ModelRegistry}=await import('../lib/cloud-render/models.ts');
 const pins=Object.fromEntries(new ModelRegistry().list().map(m=>[m.id,{revision:'c'.repeat(40),files:(m.files?.length?m.files:[{path:'model.safetensors',comfyFolder:'checkpoints',role:'checkpoint'}]).map(f=>({...f,sha256:'d'.repeat(64)}))}]));
 const text=JSON.stringify(pins);
 const {ctl}=await setup({answers:[true,true],files:{pins:{size:text.length,read:async()=>text}}});await ctl.enable();await ctl.declareFree('notebook',true);
 await assert.rejects(new CloudController({...ctl.d,openJson:async()=>({size:5,read:async()=>'{"x":{"revision":"main"}}'})}).importPins(),/40-merkkinen revisio/);
 assert.equal((await ctl.importPins()).modelPins,true);
 const c=canon();await ctl.call('sync',{canonical:c});await ctl.call('lock',{projectId:c.projectId,sceneId:'scene_001'});
 const v=await ctl.call('preflight',{projectId:c.projectId,sceneId:'scene_001',workflowId:'image_to_video'});
 assert.equal(v.body.status,'BLOCKED');assert.deepEqual(v.body.reasons,['Workflow "image_to_video" needs an approved reference image as source.']);
 assert.equal((await ctl.clearPins()).modelPins,false);
});
