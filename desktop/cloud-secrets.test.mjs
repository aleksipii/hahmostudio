// Vaihe 2: pilviasetusten salaus, peittäminen ja IPC-pinta. Ei laitteita, ei verkkoa.
import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,stat} from 'node:fs/promises';import {readFileSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {execFileSync} from 'node:child_process';
import {CloudSecretStore,parseSecretFile,redact,secretKey} from './cloud-secrets.mjs';
import {DESKTOP_COMPUTE_POLICY,CLOUD_RENDER_AVAILABLE,cloudStatus,guarded,clearTarget} from './cloud-policy.mjs';

// Tunnistettava testisalaisuus: ei saa esiintyä missään muualla kuin tässä testissä.
const MARK='HSLEAKMARK'+'0123456789abcdef';
const URL_SECRET=`https://${MARK.toLowerCase()}.trycloudflare.com/`;
const fakeSafe=(available=true)=>({isEncryptionAvailable:()=>available,encryptString:s=>Buffer.concat([Buffer.from('ENC1'),Buffer.from(s,'utf8').map(b=>b^0x5a)]),decryptString:b=>{if(b.subarray(0,4).toString()!=='ENC1')throw Error('bad');return Buffer.from(b.subarray(4)).map(x=>x^0x5a).toString('utf8');}});
const tmp=()=>mkdtemp(join(tmpdir(),'hs-cloud-'));

test('salaisuus tallentuu salattuna, tila näyttää vain onko avain asetettu',async()=>{
 const dir=await tmp(),store=new CloudSecretStore({dir,safeStorage:fakeSafe()});
 await store.set('HAHMOSTUDIO_COLAB_COMFYUI_URL',URL_SECRET);await store.set('HAHMOSTUDIO_COMFYUI_BEARER',MARK+MARK);
 const file=await readFile(join(dir,'cloud-secrets.bin'));assert.ok(!file.toString('latin1').includes(MARK)&&!file.toString('latin1').includes(MARK.toLowerCase()));
 assert.equal((await stat(join(dir,'cloud-secrets.bin'))).mode&0o777,0o600);
 assert.deepEqual(await readdir(dir),['cloud-secrets.bin']);
 const view=await store.view(),json=JSON.stringify(view);assert.ok(!json.includes(MARK)&&!json.includes(MARK.toLowerCase()));
 assert.equal(view.keys.HAHMOSTUDIO_COLAB_COMFYUI_URL.set,true);assert.equal(view.keys.GOOGLE_OAUTH_CLIENT_ID.set,false);assert.equal(view.encryption,true);
 const again=new CloudSecretStore({dir,safeStorage:fakeSafe()});assert.equal((await again.values()).HAHMOSTUDIO_COLAB_COMFYUI_URL,URL_SECRET);
 await again.clear('HAHMOSTUDIO_COMFYUI_BEARER');assert.equal((await again.view()).keys.HAHMOSTUDIO_COMFYUI_BEARER.set,false);
 await again.clear('all');assert.deepEqual(await readdir(dir),[]);
});

test('ilman järjestelmän salausta mitään ei tallenneta (ei selväkielistä varavaihtoehtoa)',async()=>{
 const dir=await tmp(),store=new CloudSecretStore({dir,safeStorage:fakeSafe(false)});
 await assert.rejects(store.set('HAHMOSTUDIO_COMFYUI_BEARER',MARK+MARK),/avainnippu ei ole käytettävissä/);
 assert.deepEqual(await readdir(dir),[]);assert.equal((await store.view()).encryption,false);
});

test('virheellinen arvo tai avain hylätään ilman että arvo näkyy virheviestissä',async()=>{
 const store=new CloudSecretStore({dir:await tmp(),safeStorage:fakeSafe()});
 for(const [key,value] of [['HAHMOSTUDIO_COLAB_COMFYUI_URL','http://'+MARK],['HAHMOSTUDIO_COLAB_COMFYUI_URL',`https://user:${MARK}@x.example/`],['HAHMOSTUDIO_COMFYUI_BEARER',MARK+' ;rm'],['GOOGLE_OAUTH_CLIENT_ID',MARK]])
  await assert.rejects(store.set(key,value),e=>!e.message.includes(MARK)&&/ei ole oikeassa muodossa/.test(e.message));
 await assert.rejects(store.set('HAHMOSTUDIO_ALLOW_PAID_COMPUTE','yes-i-accept-charges'),/Tuntematon pilviasetus/);
 assert.throws(()=>secretKey('__proto__'),/Tuntematon/);assert.throws(()=>clearTarget('toString'),/Tuntematon/);assert.equal(clearTarget('all'),'all');
});

test('asetustiedostosta otetaan vain sallitut avaimet; maksullisen laskennan avaimet ohitetaan nimellä',()=>{
 const {values,ignored}=parseSecretFile(`# kommentti\nexport HAHMOSTUDIO_COLAB_COMFYUI_URL="${URL_SECRET}"\nHAHMOSTUDIO_ALLOW_PAID_COMPUTE=yes-i-accept-charges\nHAHMOSTUDIO_MAX_COST_EUR=5\nGOOGLE_OAUTH_CLIENT_ID=abc.apps.googleusercontent.com\nroskaa\n`);
 assert.deepEqual(values,{HAHMOSTUDIO_COLAB_COMFYUI_URL:URL_SECRET,GOOGLE_OAUTH_CLIENT_ID:'abc.apps.googleusercontent.com'});
 assert.deepEqual(ignored,['HAHMOSTUDIO_ALLOW_PAID_COMPUTE','HAHMOSTUDIO_MAX_COST_EUR','(rivi ilman avainta)']);
 assert.throws(()=>parseSecretFile('GOOGLE_OAUTH_CLIENT_SECRET='+MARK+'!!'),e=>!e.message.includes(MARK));
 assert.throws(()=>parseSecretFile('x'.repeat(70000)),/liian suuri/);
});

test('peittäminen poistaa salaisuudet ja osoitteet virheviesteistä ennen rendereriä',async()=>{
 assert.equal(redact(`yhteys ${URL_SECRET}api/prompt epäonnistui, tunnus ${MARK}`,[MARK]),'yhteys https://*** epäonnistui, tunnus ***');
 const store=new CloudSecretStore({dir:await tmp(),safeStorage:fakeSafe()});await store.set('HAHMOSTUDIO_COMFYUI_BEARER',MARK+MARK);
 const fn=guarded(store,async()=>{throw new Error('palvelin hylkäsi tunnuksen '+MARK+MARK);});
 await assert.rejects(fn(),e=>e.message==='palvelin hylkäsi tunnuksen ***');
});

test('työpöydän pilvitila: aina nollakustannus, pilvi ei vielä saatavilla, ei arvoja',async()=>{
 const {ZERO_COST_POLICY}=await import('../lib/cloud-render/compute.ts');
 assert.deepEqual({...DESKTOP_COMPUTE_POLICY,allowedBackendClasses:[...DESKTOP_COMPUTE_POLICY.allowedBackendClasses]},{...ZERO_COST_POLICY,allowedBackendClasses:[...ZERO_COST_POLICY.allowedBackendClasses]});
 assert.ok(Object.isFrozen(DESKTOP_COMPUTE_POLICY));assert.equal(CLOUD_RENDER_AVAILABLE,false);
 const store=new CloudSecretStore({dir:await tmp(),safeStorage:fakeSafe()});await store.set('HAHMOSTUDIO_COLAB_COMFYUI_URL',URL_SECRET);
 const status=await cloudStatus(store);assert.equal(status.available,false);assert.equal(status.enabled,false);assert.equal(status.policy.maxCostEur,0);
 assert.ok(!JSON.stringify(status).includes(MARK.toLowerCase()));
});

test('IPC-pinta: renderer saa vain neljä pilvitoimintoa eikä yksikään palauta arvoja; web-omistajan tunnuksia ei lueta',()=>{
 const main=readFileSync(new URL('./main.mjs',import.meta.url),'utf8'),preload=readFileSync(new URL('./preload.cjs',import.meta.url),'utf8');
 assert.deepEqual([...preload.matchAll(/'(studio:cloud-[a-z-]+)'/g)].map(m=>m[1]).sort(),['studio:cloud-secret-clear','studio:cloud-secret-import','studio:cloud-secret-paste','studio:cloud-status']);
 assert.deepEqual([...main.matchAll(/handle\('(studio:cloud-[a-z-]+)'/g)].map(m=>m[1]).sort(),['studio:cloud-secret-clear','studio:cloud-secret-import','studio:cloud-secret-paste','studio:cloud-status']);
 assert.ok(!/cloudSecrets\.values\(\)/.test(main),'arvot eivät kulje IPC-käsittelijöistä');
 for(const name of ['cloud-secret-paste','cloud-secret-import','cloud-secret-clear'])assert.match(main,new RegExp(`handle\\('studio:${name}',guarded\\(`));
 assert.match(main,/async function confirmSecrets/);assert.match(main,/handle\('studio:cloud-secret-paste',guarded\(cloudSecrets,async key=>\{secretKey\(key\);const value=clipboard\.readText\(\)\.trim\(\);if\(!await confirmSecrets/);
 const sources=execFileSync('git',['ls-files','desktop'],{encoding:'utf8'}).split('\n').filter(f=>/\.(mjs|cjs|js)$/.test(f)&&!f.includes('.test.')&&!f.includes('test-fixtures'));
 for(const f of sources){const text=readFileSync(f,'utf8');for(const banned of ['owner.json','.private-storage','HAHMOSTUDIO_SETUP_TOKEN','HAHMOSTUDIO_DATA_DIR','HAHMOSTUDIO_ALLOW_PAID_COMPUTE','HAHMOSTUDIO_MAX_COST_EUR'])assert.ok(!text.includes(banned),`${f}: ${banned}`);}
});

test('testisalaisuus ei esiinny missään gitin seuraamassa tiedostossa tämän testin ulkopuolella',()=>{
 let out='';try{out=execFileSync('git',['grep','-l','-i','HSLEAKMARK'],{encoding:'utf8'});}catch(e){if(e.status!==1)throw e;}
 assert.deepEqual(out.split('\n').filter(Boolean).filter(f=>f!=='desktop/cloud-secrets.test.mjs'),[]);
});
