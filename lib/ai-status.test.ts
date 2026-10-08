import test from 'node:test';import assert from 'node:assert/strict';
import {aiStatusRows,recordAiActivity,aiActivity,trackAi,onAiActivity} from './ai-status.ts';

test('tekoälypaneeli näyttää vain ominaisuudet, joiden tila on luettu; kustannus on aina €0,00 tai estetty',()=>{
 assert.deepEqual(aiStatusRows({}).map(r=>r.id),['rhubarb']);
 const rows=aiStatusRows({audioModel:{model:true,binary:true},kokoro:{installed:false},camera:'prompt',cloud:{available:false}});
 assert.deepEqual(rows.map(r=>r.id),['rhubarb','whisper','kokoro','face','cloud-render']);
 for(const r of rows)assert.ok(r.cost==='€0,00'||r.cost==='estetty',r.id);
 const whisper=rows.find(r=>r.id==='whisper')!,kokoro=rows.find(r=>r.id==='kokoro')!,face=rows.find(r=>r.id==='face')!;
 assert.equal(whisper.location,'local');assert.equal(whisper.permission,'granted');
 assert.equal(kokoro.location,'off');assert.equal(kokoro.permission,'missing');assert.match(kokoro.note!,/synteettisiksi/);
 assert.equal(face.permission,'missing');assert.equal(face.available,false);
 for(const r of rows.filter(r=>r.id!=='cloud-render'))assert.match(r.data,/Ei lähde minnekään/);
});

test('vaihe 1: pilvirenderöinti näkyy vain tekstinä "ei saatavilla", pois päältä ja estettynä',()=>{
 const cloud=aiStatusRows({cloud:{available:false}}).find(r=>r.id==='cloud-render')!;
 assert.equal(cloud.location,'off');assert.equal(cloud.available,false);assert.equal(cloud.cost,'estetty');
 assert.equal(cloud.permissionText,'Ei saatavilla');assert.equal(cloud.data,'Ei mitään.');
});

test('puuttuva tai virheellinen malli ei näy käytössä olevana',()=>{
 const rows=aiStatusRows({audioModel:{model:true,binary:false},kokoro:{installed:true,error:'rikki'},camera:'denied'});
 assert.equal(rows.find(r=>r.id==='whisper')!.location,'off');
 const k=rows.find(r=>r.id==='kokoro')!;assert.equal(k.location,'off');assert.match(k.note!,/rikki/);
 assert.equal(rows.find(r=>r.id==='face')!.permission,'denied');
 assert.equal(aiStatusRows({audioModel:null}).find(r=>r.id==='whisper')!.available,false);
});

test('viimeisin tulos tallentuu vain istunnon muistiin ja trackAi palauttaa saman arvon tai virheen',async()=>{
 let calls=0;const off=onAiActivity(()=>calls++);
 recordAiActivity('rhubarb',true,'x'.repeat(500),new Date('2026-10-08T10:00:00Z'));
 assert.equal(aiActivity().rhubarb!.text.length,160);assert.equal(aiActivity().rhubarb!.at,'2026-10-08T10:00:00.000Z');
 const value={a:1};assert.equal(await trackAi('kokoro',Promise.resolve(value),()=>'ok'),value);
 assert.equal(aiActivity().kokoro!.ok,true);
 const err=new Error('ei onnistunut');await assert.rejects(trackAi('whisper',Promise.reject(err),()=>'-'),e=>e===err);
 assert.deepEqual({ok:aiActivity().whisper!.ok,text:aiActivity().whisper!.text},{ok:false,text:'ei onnistunut'});
 off();const before=calls;recordAiActivity('face',true,'y');assert.equal(calls,before);assert.equal(before,3);
 assert.equal(aiStatusRows({camera:'granted',activity:aiActivity()}).find(r=>r.id==='face')!.last!.text,'y');
});
