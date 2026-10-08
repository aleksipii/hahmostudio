import test from 'node:test';
import assert from 'node:assert/strict';
import {writePsd,type Layer,type Psd} from 'ag-psd';
import {register} from 'node:module';

// psd-import.ts tuo './psd-model' ilman päätettä (Vite ratkaisee sen); Node-testissä lisätään .ts.
register('data:text/javascript,'+encodeURIComponent(`export async function resolve(s,c,n){try{return await n(s,c)}catch(e){if(/^\\.\\.?\\//.test(s)&&!/\\.[a-z]+$/.test(s))return n(s+'.ts',c);throw e}}`));
const {validateHeader,readStructure,layerWarnings}=await import('./psd-import.ts');

// Rakentaa 26-tavuisen PSD-otsakkeen: allekirjoitus, versio, kanavat, korkeus, leveys, syvyys, väritila.
const header=({signature=0x38425053,version=1,height=100,width=100,depth=8,mode=3}={})=>{const b=new ArrayBuffer(26),v=new DataView(b);v.setUint32(0,signature);v.setUint16(4,version);v.setUint16(12,3);v.setUint32(14,height);v.setUint32(18,width);v.setUint16(22,depth);v.setUint16(24,mode);return b;};
const psdBuffer=(psd:Psd)=>{const out=writePsd(psd,{});return out instanceof ArrayBuffer?out:new Uint8Array(out as unknown as ArrayLike<number>).buffer;};

test('validateHeader accepts 8-bit RGB and grayscale PSD headers up to the documented limits',()=>{
 assert.doesNotThrow(()=>validateHeader(header()));
 assert.doesNotThrow(()=>validateHeader(header({mode:1})));
 assert.doesNotThrow(()=>validateHeader(header({width:8192,height:1953})));
 assert.doesNotThrow(()=>validateHeader(header({width:4000,height:4000})));
});

test('validateHeader rejects short, foreign, PSB, 16-bit, CMYK, empty and oversized files with Finnish messages',()=>{
 assert.throws(()=>validateHeader(new ArrayBuffer(0)),/kelvollinen PSD/);
 assert.throws(()=>validateHeader(new ArrayBuffer(25)),/kelvollinen PSD/);
 assert.throws(()=>validateHeader(header({signature:0x89504e47})),/\.psd-tiedosto/);
 assert.throws(()=>validateHeader(header({version:2})),/PSB/);
 assert.throws(()=>validateHeader(header({depth:16})),/8 bittiä/);
 assert.throws(()=>validateHeader(header({depth:1})),/8 bittiä/);
 assert.throws(()=>validateHeader(header({mode:4})),/RGB- tai harmaasävy/);
 assert.throws(()=>validateHeader(header({mode:2})),/RGB- tai harmaasävy/);
 for(const size of [{width:0},{height:0},{width:8193},{height:8193},{width:8192,height:8192},{width:4001,height:4000}])
  assert.throws(()=>validateHeader(header(size)),/liian suuri/,JSON.stringify(size));
});

test('readStructure keeps layer order and hierarchy of a valid PSD',()=>{
 const psd=readStructure(psdBuffer({width:40,height:30,children:[{name:'Tausta'},{name:'Ryhmä',children:[{name:'Käsi'},{name:'Pää'}]}]}));
 assert.equal(psd.width,40);assert.equal(psd.height,30);
 assert.deepEqual(psd.children!.map(l=>l.name),['Tausta','Ryhmä']);
 assert.deepEqual(psd.children![1].children!.map(l=>l.name),['Käsi','Pää']);
});

test('readStructure enforces the 1000-layer limit, counting nested layers',()=>{
 const flat=(n:number):Layer[]=>Array.from({length:n},(_,i)=>({name:'t'+i}));
 assert.doesNotThrow(()=>readStructure(psdBuffer({width:10,height:10,children:flat(1000)})));
 assert.throws(()=>readStructure(psdBuffer({width:10,height:10,children:flat(1001)})),/1000 tasoa/);
 // 999 tasoa + ryhmä, jossa 2 lasta = 1002
 assert.throws(()=>readStructure(psdBuffer({width:10,height:10,children:[...flat(999),{name:'g',children:flat(2)}]})),/1000 tasoa/);
});

test('readStructure group nesting limit: 19 groups around a layer pass, deeper nesting is rejected',()=>{
 const nest=(depth:number):Layer=>depth?{name:'g'+depth,children:[nest(depth-1)]}:{name:'lehti'};
 assert.doesNotThrow(()=>readStructure(psdBuffer({width:10,height:10,children:[nest(19)]})));
 assert.throws(()=>readStructure(psdBuffer({width:10,height:10,children:[nest(21)]})),/sisäkkäin/);
});

// Tunnettu bugi (TIIMI.md, testaaja): check() tarkistaa myös tason tyhjän lapsilistan syvyydellä 21,
// joten 20 ryhmää + taso hylätään, vaikka viesti lupaa "enintään 20". todo ei kaada ajoa; korjauksen jälkeen poista todo.
test('readStructure accepts a layer inside exactly 20 nested groups',{todo:'tunnettu off-by-one lib/psd-import.ts check()'},()=>{
 const nest=(depth:number):Layer=>depth?{name:'g'+depth,children:[nest(depth-1)]}:{name:'lehti'};
 assert.doesNotThrow(()=>readStructure(psdBuffer({width:10,height:10,children:[nest(20)]})));
});

test('readStructure rejects a layer wider than 16384 px before decoding',()=>{
 const wide={width:16385,height:1,data:new Uint8ClampedArray(16385*4).fill(255)};
 assert.throws(()=>readStructure(psdBuffer({width:10,height:10,children:[{name:'iso',left:0,top:0,imageData:wide}]})),/tasokoko/);
 const ok={width:16,height:16,data:new Uint8ClampedArray(16*16*4).fill(255)};
 assert.equal(readStructure(psdBuffer({width:10,height:10,children:[{name:'pieni',left:0,top:0,imageData:ok}]})).children!.length,1);
});

test('layerWarnings reports every unsupported feature and stays empty for a plain layer',()=>{
 assert.deepEqual(layerWarnings({name:'tavallinen'}),[]);
 assert.deepEqual(layerWarnings({name:'n',blendMode:'normal'}),[]);
 const all=layerWarnings({name:'x',effects:{},clipping:true,adjustment:{type:'brightness/contrast'},vectorMask:{paths:[]},realMask:{},mask:{userMaskFeather:2},children:[],blendMode:'not-a-mode' as Layer['blendMode']} as Layer);
 for(const re of [/Tasotehosteita/,/Leikkausmaskia/,/Säätötason/,/Vektorimaskia/,/Ryhmän maskia/,/Yhdistettyä/,/pehmennystä/,/not-a-mode/])
  assert.ok(all.some(w=>re.test(w)),String(re));
});
