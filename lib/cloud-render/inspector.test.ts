import {test} from 'node:test';import assert from 'node:assert/strict';
import {deflateSync,crc32} from 'node:zlib';
import {decodePng,palette,paletteDistance,PaletteInspector} from './inspector.ts';
import {InMemoryStorage} from './storage.ts';
import {validateOutput} from './output-validation.ts';
import type {RenderJob} from './types.ts';

function png(w:number,h:number,px:(x:number,y:number)=>[number,number,number,number],filter=0){
 const stride=w*4,raw=new Uint8Array((stride+1)*h);
 for(let y=0;y<h;y++){raw[y*(stride+1)]=filter;for(let x=0;x<w;x++){const p=px(x,y);for(let c=0;c<4;c++){let v=p[c];if(filter===1&&x>0)v=(v-px(x-1,y)[c]+256)&255;if(filter===2&&y>0)v=(v-px(x,y-1)[c]+256)&255;raw[y*(stride+1)+1+x*4+c]=v;}}}
 const chunk=(t:string,d:Uint8Array)=>{const b=Buffer.alloc(12+d.length);b.writeUInt32BE(d.length,0);b.write(t,4,'latin1');Buffer.from(d).copy(b,8);b.writeUInt32BE(crc32(b.subarray(4,8+d.length)),8+d.length);return b;};
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w,0);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=6;
 return new Uint8Array(Buffer.concat([Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(raw)),chunk('IEND',new Uint8Array())]));
}
const red=(x:number,y:number):[number,number,number,number]=>(x+y)%7===0?[250,250,250,255]:[200,30,30,255];
const blue=(x:number,y:number):[number,number,number,number]=>(x+y)%7===0?[20,20,30,255]:[30,40,220,255];
const job=(ref:unknown):RenderJob=>({id:'j',projectId:'p',sceneId:'s',workflowId:'w',modelId:'m',prompt:'',inputs:[{kind:'character_reference',assetId:'r',characterId:'alice',storageRef:JSON.stringify(ref)}],outputFormat:'png',requestedBy:'t',createdAt:'x',params:{width:32,height:32,steps:1,sampler:'e',scheduler:'n',cfg:1}});

test('PNG decoder handles filters and rejects garbage',()=>{
 for(const f of [0,1,2]){const d=decodePng(png(16,16,red,f))!;assert.deepEqual([d.w,d.h,...d.rgba.subarray(0,4)],[16,16,250,250,250,255]);assert.deepEqual([...d.rgba.subarray(4,8)],[200,30,30,255]);}
 assert.equal(decodePng(new Uint8Array([1,2,3])),undefined);assert.equal(decodePng(png(16,16,red).subarray(0,40)),undefined);
});
test('palette distance: same ~0, different large',()=>{
 const a=palette(decodePng(png(32,32,red))!),b=palette(decodePng(png(32,32,red))!),c=palette(decodePng(png(32,32,blue))!);
 assert.ok(paletteDistance(a.bins,b.bins)<0.01);assert.ok(paletteDistance(a.bins,c.bins)>0.7);
});
test('inspector: ok for matching palette, flag for drift, reject for blank/transparent, ignores video',async()=>{
 const s=new InMemoryStorage(),ref=await s.uploadAsset('p','references','alice.png',png(32,32,red),'image/png'),insp=new PaletteInspector(s),j=job(ref);
 const art=(b:Uint8Array)=>({name:'o.png',mime:'image/png',bytes:b});
 assert.equal((await insp.inspect(j,art(png(32,32,red)))).verdict,'ok');
 const drift=await insp.inspect(j,art(png(32,32,blue)));assert.equal(drift.verdict,'flag');assert.match(drift.notes[0],/alice/);
 assert.equal((await insp.inspect(j,art(png(32,32,()=>[10,10,10,255])))).verdict,'reject');
 assert.equal((await insp.inspect(j,art(png(32,32,()=>[10,10,10,0])))).verdict,'reject');
 assert.equal((await insp.inspect(j,{name:'o.mp4',mime:'video/mp4',bytes:new Uint8Array([0,0,0,0,0x66,0x74,0x79,0x70])})).verdict,'ok');
 assert.equal((await insp.inspect(job({backend:'memory',id:'missing'}),art(png(32,32,blue)))).verdict,'ok','unusable reference is not a detected failure');
});
test('strictness decides whether a drift flag blocks the output',async()=>{
 const s=new InMemoryStorage(),ref=await s.uploadAsset('p','references','alice.png',png(32,32,red),'image/png'),insp=new PaletteInspector(s),j=job(ref),art=[{name:'o.png',mime:'image/png',bytes:png(32,32,blue)}];
 const soft=await validateOutput(j,art,'flag',insp);assert.equal(soft.ok,true);assert.equal(soft.flags.length,1);
 const hard=await validateOutput(j,art,'reject',insp);assert.equal(hard.ok,false);assert.ok(hard.rejects.some(r=>r.includes('(strict)')));
 const blank=await validateOutput(j,[{name:'o.png',mime:'image/png',bytes:png(32,32,()=>[1,2,3,255])}],'flag',insp);assert.equal(blank.ok,false);
});
