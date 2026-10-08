import test from 'node:test';import assert from 'node:assert/strict';
import {cloudOpFor,desktopCloudApi,CloudSendCancelled} from './cloud-desktop.ts';

test('pilvidialogin jokainen kutsu kartoittuu yhteen pääprosessin pilvitoimintoon',()=>{
 const cases:[string,string,unknown,string][]=[['GET','/api/health',undefined,'health'],['GET','/api/backends',undefined,'backends'],['PUT','/api/projects/p1',{projectId:'p1'},'sync'],['POST','/api/projects/p1/scenes/s1/lock',undefined,'lock'],['POST','/api/projects/p1/characters/c1/reference',{mime:'image/png',dataBase64:'AA==',label:'x'},'reference'],['POST','/api/ai/direct',{projectId:'p1',sceneId:'s1'},'direct'],['POST','/api/live-verification/smoke',{},'smoke'],['POST','/api/render/preflight',{projectId:'p',sceneId:'s',workflowId:'w'},'preflight'],['POST','/api/render',{projectId:'p',sceneId:'s',workflowId:'w',authorizationFingerprint:'f'},'render'],['GET','/api/render/j1',undefined,'job'],['GET','/api/render/j1/notebook',undefined,'notebook-save'],['POST','/api/render/j1/import',{big:1},'import'],['POST','/api/render/j1/cancel',undefined,'cancel']];
 for(const [m,p,b,op] of cases)assert.equal(cloudOpFor(m,p,b).op,op,p);
 assert.deepEqual(cloudOpFor('POST','/api/render/j1/import',{big:1}).args,{jobId:'j1'},'tuonnin tiedosto valitaan pääprosessissa, ei rendereristä');
 assert.deepEqual(cloudOpFor('POST','/api/render/preflight',{projectId:'p',sceneId:'s',workflowId:'w',maxCostEur:9,backendId:'runpod'}).args,{projectId:'p',sceneId:'s',workflowId:'w'});
 for(const [m,p] of [['GET','/api/compute/policy'],['PUT','/api/compute/policy'],['DELETE','/api/projects/p/scenes/s/lock'],['GET','/api/models'],['POST','/api/ai/validate']])assert.throws(()=>cloudOpFor(m,p),/ei ole työpöytäsovelluksessa/);
});

test('peruttu lupa näkyy dialogille virheenä eikä onnistumisena',async()=>{
 const calls:unknown[]=[];
 const api=desktopCloudApi({cloudCall:async(op,args)=>{calls.push([op,args]);return op==='render'?{status:200,body:{cancelled:true}}:{status:200,body:{ok:true}};}});
 assert.deepEqual((await api('GET','/api/health')).body,{ok:true});
 await assert.rejects(api('POST','/api/render',{projectId:'p',sceneId:'s',workflowId:'w',authorizationFingerprint:'f'}),(e:unknown)=>e instanceof CloudSendCancelled&&/Mitään ei lähetetty/.test((e as Error).message));
 assert.deepEqual(calls[0],['health',undefined]);
});
