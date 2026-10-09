// Electron-diagnostiikka pilvirenderöinnille (npm run desktop:test:cloud). Ajetaan vain eristetyllä
// HAHMOSTUDIO_TEST_DATA_DIR-datalla; vahvistusdialogit vastataan kyllä ja kirjataan raporttiin.
// Kulkee oikean rendererin sillan (window.hahmostudio), oikean IPC:n, oikean utilityProcess-pilviprosessin
// ja oikean lib/cloud-render-koodin läpi. Ei verkkoa: yhtään ilmaista taustaa ei ole määritetty toimivaksi.
import {readFile,readdir,writeFile} from 'node:fs/promises';import {join} from 'node:path';
const MARK='hs'+'leak'+'mark'+'diag'+'7f3a91c2';
const TUNNEL=`https://${MARK}.trycloudflare.com/`;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function waitFor(fn,{timeoutMs=45000,stepMs=150}={}){const end=Date.now()+timeoutMs;while(Date.now()<end){try{const v=await fn();if(v)return v;}catch{}await sleep(stepMs);}throw new Error('Aikakatkaisu odottaessa ehtoa.');}
async function filesUnder(dir){const out=[];for(const e of await readdir(dir,{withFileTypes:true}).catch(()=>[])){const p=join(dir,e.name);if(e.isDirectory())out.push(...await filesUnder(p));else out.push(p);}return out;}

export async function cloudDiagnostic(window,{cloud,asked,clipboard,dataDir,reportPath,openAi}){
 const steps=[],responses=[],errors=[];
 const js=code=>window.webContents.executeJavaScript(code);
 const bridge=async(expr)=>{const r=await js(`(async()=>{try{return {ok:true,value:await ${expr}};}catch(e){return {ok:false,error:String(e?.message??e)};}})()`);responses.push(r);return r;};
 const step=(name,ok,detail)=>{steps.push({name,ok:!!ok,...(detail===undefined?{}:{detail})});if(!ok)errors.push(name);};
 window.webContents.on('console-message',(_e,details,message)=>{const level=typeof details==='object'?details.level:details;const text=typeof details==='object'?details.message:message;if((level==='error'||level>=3)&&!/Electron Security Warning/.test(text))errors.push('console: '+String(text).slice(0,200));});
 await waitFor(()=>js("typeof window.hahmostudio?.cloudStatus==='function'"));

 let s=await bridge('window.hahmostudio.cloudStatus()');
 step('oletuksena pois',s.ok&&s.value.available===true&&s.value.enabled===false&&s.value.running===false&&s.value.policy.maxCostEur===0,s.value&&{enabled:s.value.enabled,running:s.value.running});
 let r=await bridge("window.hahmostudio.cloudCall('health')");step('kutsu estetty ennen opt-iniä',!r.ok&&/ei ole käytössä/.test(r.error),r.error);
 step('pilviprosessia ei ole ennen opt-iniä',!cloud.child);

 await clipboard.writeText(TUNNEL);
 r=await bridge("window.hahmostudio.cloudSecretPaste('HAHMOSTUDIO_COLAB_COMFYUI_URL')");
 step('tunnelin osoite leikepöydältä pääprosessiin',r.ok&&r.value.saved[0]==='HAHMOSTUDIO_COLAB_COMFYUI_URL',r.ok?undefined:r.error);
 await clipboard.writeText('');
 step('tallennuksen vahvistus näyttää vain palvelimen nimen',asked.some(a=>/ComfyUI-tunnelin osoite \(/.test(a.detail)&&!a.detail.includes('https://')));

 r=await bridge('window.hahmostudio.cloudEnable()');step('opt-in',r.ok&&r.value.enabled===true);
 r=await bridge("window.hahmostudio.cloudDeclareFree('notebook',true)");step('Kaggle vahvistettu ilmaiseksi',r.ok&&r.value.settings.notebookClassifiedFree===true);
 r=await bridge("window.hahmostudio.cloudCall('health')");
 step('pilviprosessi käynnistyy ja vastaa (utilityProcess)',r.ok&&r.value.status===200&&r.value.body.policy.allowPaidCompute===false&&r.value.body.policy.maxCostEur===0,r.ok?{storage:r.value.body.storage,modelMode:r.value.body.modelMode}:r.error);
 s=await bridge('window.hahmostudio.cloudStatus()');step('tila: käynnissä, paikallinen tallennus',s.ok&&s.value.running===true&&s.value.storage==='local-dev');
 r=await bridge("window.hahmostudio.cloudCall('backends')");
 step('vain ilmaiset taustat käytössä',r.ok&&r.value.body.backends.filter(b=>b.enabled).every(b=>b.class==='free'),r.ok?r.value.body.backends.map(b=>[b.id,b.class,b.enabled]):r.error);

 const {canon}=await import('../lib/cloud-render/test-fixtures.ts');const c=canon();
 r=await bridge(`window.hahmostudio.cloudCall('sync',{canonical:${JSON.stringify(c)}})`);step('kanoninen tila synkronoitu',r.ok&&r.value.status===200);
 r=await bridge(`window.hahmostudio.cloudCall('lock',{projectId:'${c.projectId}',sceneId:'scene_001'})`);step('kohtaus lukittu',r.ok&&r.value.status===200);
 r=await bridge(`window.hahmostudio.cloudCall('direct',{projectId:'${c.projectId}',sceneId:'scene_001'})`);step('ehdotus validoitu (sääntöpohjainen)',r.ok&&r.value.body.director==='rule-based'&&r.value.body.status==='APPROVED');
 r=await bridge(`window.hahmostudio.cloudCall('preflight',{projectId:'${c.projectId}',sceneId:'scene_001',workflowId:'text_to_image'})`);
 step('ilman lukittua mallia estetty oikealla syyllä',r.ok&&r.value.body.status==='BLOCKED'&&/No registered model is acceptable/.test(r.value.body.reasons.join(' ')),r.ok?r.value.body.reasons:r.error);
 r=await bridge(`window.hahmostudio.cloudCall('preflight',{projectId:'${c.projectId}',sceneId:'scene_001',workflowId:'text_to_image',maxCostEur:5})`);step('politiikkakenttä hylätään',!r.ok&&/tuntematon kenttä/.test(r.error));
 const before=asked.length;
 r=await bridge(`window.hahmostudio.cloudCall('render',{projectId:'${c.projectId}',sceneId:'scene_001',workflowId:'text_to_image',authorizationFingerprint:'${'a'.repeat(64)}'})`);
 step('lupa kysyttiin ennen lähetystä',asked.length===before+1&&/Lähetetäänkö lukittu kohtaus/.test(asked.at(-1)?.message??''),asked.at(-1)?.detail);
 const journal=JSON.parse(await readFile(join(dataDir,'cloud-render-jobs.json'),'utf8'));
 step('checkpoint levyllä',journal.records.length===1&&!!journal.records[0].jobId,journal.records[0]?.state);
 if(r.ok&&r.value.body.jobId){let job;await waitFor(async()=>{job=await bridge(`window.hahmostudio.cloudCall('job',{jobId:'${r.value.body.jobId}'})`);return ['BLOCKED','FAILED','COMPLETED','CANCELLED'].includes(job.value?.body?.state);});step('väärennetty valtuutus estyy',job.value.body.state==='BLOCKED',job.value.body.blocked?.banner?.split('\n')[0]);}

 openAi();
 const panel=await waitFor(()=>js("(()=>{const t=document.querySelector('[data-ai-feature=\"cloud-render\"]')?.textContent??'';return /Otettu käyttöön/.test(t)?t:'';})()")).catch(()=>js("document.querySelector('[data-ai-feature=\"cloud-render\"]')?.textContent??''"));
 step('Tekoäly-paneeli näyttää pilven tilan',/Pilvirenderöinti/.test(panel)&&/Otettu käyttöön/.test(panel)&&/estetty/.test(panel),panel.slice(0,200));
 window.setContentSize(1440,900);
 await js("document.querySelector('.s2-phase[data-studio-flow-step=\"shot\"]').click()");await sleep(250);openAi();
 await waitFor(()=>js("!!document.querySelector('.ai-inspector-dock:not([hidden]) .ai-cloud-controls')"));
 step('Tekoäly-välilehden pilviohjaimet työpöydällä',await js("!!document.querySelector('.ai-inspector-dock:not([hidden]) .ai-cloud-controls button')"));
 const html=await js('document.documentElement.outerHTML');
 step('salaisuus ei näy rendererissä',!html.includes(MARK)&&!(await js('JSON.stringify(Object.keys(window.hahmostudio))')).includes('values'));
 step('salaisuus ei kulje IPC-vastauksissa',!JSON.stringify(responses).includes(MARK));
 const leaks=[];for(const f of await filesUnder(dataDir)){if(f.endsWith('cloud-secrets.bin'))continue;const t=await readFile(f).catch(()=>Buffer.alloc(0));if(t.includes(MARK))leaks.push(f.slice(dataDir.length));}
 const bin=await readFile(join(dataDir,'cloud-secrets.bin')).catch(()=>Buffer.alloc(0));
 step('salaisuus ei ole selväkielisenä missään datakansion tiedostossa',!leaks.length&&bin.length>0&&!bin.includes(MARK),leaks);

 r=await bridge('window.hahmostudio.cloudDisable()');step('poisto käytöstä pysäyttää prosessin',r.ok&&r.value.enabled===false&&r.value.running===false);
 r=await bridge("window.hahmostudio.cloudSecretClear('all')");step('asetukset poistettu',r.ok&&!Object.values(r.value.secrets.keys).some(k=>k.set));
 const report={ok:errors.length===0,steps,errors,asked:asked.map(a=>a.message),platform:process.platform,electron:process.versions.electron,safeStorageBackend:'weak backend allowed only in this isolated test',note:'Simuloitu: oikea Electron, IPC ja utilityProcess, ei verkkoa eikä oikeaa ComfyUI/Kaggle-ajoa.'};
 await writeFile(reportPath,JSON.stringify(report,null,2));
}
