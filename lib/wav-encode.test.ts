import test from 'node:test';import assert from 'node:assert/strict';
import {encodePcmWav} from './wav-encode.ts';
test('PCM-WAV säilyttää taajuuden ja kanavat, kaventaa rajalle eikä uudelleennäytteistä',()=>{
 const l=new Float32Array([0,.5,-.5,1.5]),r=new Float32Array([1,-1,0,.25]),wav=encodePcmWav([l,r],48000),v=new DataView(wav.buffer);
 assert.equal(String.fromCharCode(...wav.slice(0,4)),'RIFF');assert.equal(v.getUint32(24,true),48000);assert.equal(v.getUint16(22,true),2);assert.equal(v.getUint32(40,true),4*2*2);
 const at=(frame:number,channel:number)=>v.getInt16(44+(frame*2+channel)*2,true);
 assert.deepEqual([0,1,2,3].map(f=>at(f,0)),[0,16384,-16384,32767],'vasen kanava (1,5 rajataan 1,0:aan)');assert.deepEqual([0,1,2,3].map(f=>at(f,1)),[32767,-32768,0,8192],'oikea kanava');
 assert.equal(wav.length,44+16);
 assert.equal(new DataView(encodePcmWav([l],44100).buffer).getUint16(22,true),1);
 assert.equal(new DataView(encodePcmWav([l,r,l],44100).buffer).getUint16(22,true),2,'enintään kaksi kanavaa');
 assert.throws(()=>encodePcmWav([new Float32Array(0)],48000),/tyhjä/);assert.throws(()=>encodePcmWav([l],100),/näytetaajuus/);assert.throws(()=>encodePcmWav([new Float32Array(48000*3)],48000,2),/ylittää/);
});
