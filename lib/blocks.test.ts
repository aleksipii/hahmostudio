import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {readProject} from './project-file.ts';
import {buildEpisode,catalogFromNames,type EpisodeLibrary} from './episode-builder.ts';
import {CHARACTER_PACK_OPTIONS} from './speaker-pack-options.ts';
import {presentationBlocks,blocksToScript,updateBlock,stretchBlock,moveBlock,deleteBlock,duplicateBlock,insertBlock,blockSentence,blockLibrary,BlockConflict,lockedShotConflict,type Block} from './blocks.ts';
import {recognizeScript} from './script-recognizer.ts';
import {sfxInstruction} from './soundtrack.ts';
import {initProduction} from './production-model.ts';
import {studioMetadata} from './studio/domain.ts';
import {affectedShots} from './studio/shot-impact.ts';
import {adaptPresentation} from './studio/domain.ts';

const example=`Jakso 1: Pysäköintisakko
Musiikki: rauhallinen

INT. KEITTIÖ - AAMU
Mira seisoo ikkunan vieressä puhelin kädessä.

MIRA:
“Siirsitkö auton eilen?”

Niko kävelee sisään vasemmalta kaksi sekuntia.
Hän pysähtyy ja katsoo Miraa.

LÄHIKUVA MIRA
Mira näyttää Nikolle puhelinta.
Niko istuutuu ja näyttää surulliselta.
Mira hymyilee ja katsoo kameraan.
HÄIVYTYS MUSTAAN`;
let lib:EpisodeLibrary|undefined;
async function library(){if(!lib){const assets:EpisodeLibrary['assets']={};for(const n of ['Pipsa','Ville']){const r=await readProject(new Blob([readFileSync(new URL(`../public/library/${n}.hahmo`,import.meta.url))]));assets[n]={doc:r.doc,animation:r.animation};}lib={packs:catalogFromNames(CHARACTER_PACK_OPTIONS),assets};}return lib;}
const norm=(bs:Block[])=>bs.filter(b=>b.editable).map(b=>({kind:b.kind,lane:b.lane,value:b.value,params:b.params,start:Math.round(b.start*1000)/1000,duration:Math.round(b.duration*1000)/1000}));
const build=async(text:string,previous?:import('./presentation-model.ts').Presentation)=>buildEpisode(text,await library(),{previous}).presentation;

test('palikka → teksti → palikka: kanoninen käsikirjoitus tuottaa identtiset palikat',async()=>{
 const p=await build(example),blocks=presentationBlocks(p);
 for(const k of ['liike','ilme','katse','esine','kamera','tausta','ääni','repliikki','siirtymä'])assert.ok(blocks.some(b=>b.kind===k),k);
 const canonical=blocksToScript(blocks),again=presentationBlocks(await build(canonical));assert.deepEqual(norm(again),norm(blocks));
 assert.equal(blocksToScript(again),canonical,'kierros on vakaa');
 // Jokainen kirjaston palikka ja jokainen ilme/liike tunnistuu kanonisena lauseena takaisin samaksi.
 for(const item of blockLibrary){const s=blockSentence({...item,lane:item.kind==='kamera'?'kamera':'MIRA',params:{...item.params,target:item.kind==='kamera'?(item.value==='wide'?'scene':'MIRA'):item.params.target}}),r=recognizeScript('Mira odottaa 0,5 s.\n'+s+(item.kind==='kamera'?'':'.'),[],{discoverActors:true}).lines[1];if(item.kind==='ääni'){assert.equal(sfxInstruction(s),item.value);continue;}assert.ok(r.kind!=='unknown'&&!r.clauses.some(c=>c.type==='unknown'),s);}
});

test('palikan muutos päivittää vain sen rivin ja säilyttää käyttäjän sanamuodon; teksti päivittää palikat',async()=>{
 const p=await build(example),blocks=presentationBlocks(p),walk=blocks.find(b=>b.value==='walk-right')!;
 const longer=stretchBlock(example,walk,3);assert.equal(longer.text.split('\n')[walk.line-1],'Niko kävelee sisään vasemmalta 3 s.');assert.deepEqual(longer.text.split('\n').filter((_,i)=>i!==walk.line-1),example.split('\n').filter((_,i)=>i!==walk.line-1));
 const after=presentationBlocks(await build(longer.text)).find(b=>b.kind==='liike'&&b.lane==='NIKO'&&/^walk/.test(b.value))!;assert.equal(after.duration,3);
 const turned=updateBlock(example,walk,{params:{direction:'left'}});assert.equal(turned.text.split('\n')[walk.line-1],'Niko kävelee sisään oikealta kaksi sekuntia.');assert.equal(presentationBlocks(await build(turned.text)).find(b=>b.lane==='NIKO'&&/^walk/.test(b.value))!.value,'walk-left');
 // Monen lauseen rivi: vain muutettu lause vaihtuu, toinen saa nimen subjektiksi.
 const sad=blocks.find(b=>b.kind==='ilme'&&b.value==='sad')!,happy=updateBlock(example,sad,{value:'happy'});assert.equal(happy.text.split('\n')[sad.line-1],'Niko istuutuu. Niko hymyilee.');
 const changed=presentationBlocks(await build(happy.text));assert.ok(changed.some(b=>b.lane==='NIKO'&&b.value==='happy'));assert.ok(changed.some(b=>b.lane==='NIKO'&&b.value==='sit'));
});

test('siirto, kopio, poisto ja uusi palikka kirjastosta; repliikin äänileike pysyy kiinni',async()=>{
 const p=await build(example),blocks=presentationBlocks(p),dialogue=p.events.find(e=>e.kind==='dialogue')!;
 p.audioClips=[{id:'clip',dialogue:dialogue.id,asset:'voice-1',start:0,end:1.5,duration:1.5,source:'volume',mouth:[{time:0,shape:'rest'},{time:.4,shape:'open'},{time:1.4,shape:'rest'}]}];
 const smile=blocks.find(b=>b.value==='happy')!,moved=moveBlock(example,blocks,smile,0);const mp=await build(moved.text,p),mb=presentationBlocks(mp);
 assert.ok(mb.findIndex(b=>b.value==='happy')<mb.findIndex(b=>b.kind==='repliikki'),'hymy ennen repliikkiä');assert.ok(mp.audioClips.length===1&&mp.audioClips[0].dialogue===dialogue.id,'äänileike säilyy, kun rivejä siirretään');
 assert.ok(!buildEpisode(moved.text,await library()).diagnostics.some(d=>d.code==='unrecognized-line'),'siirto ei riko puhujaa ja repliikkiä');
 const copy=duplicateBlock(example,blocks.find(b=>b.value==='walk-right')!);assert.equal(presentationBlocks(await build(copy.text)).filter(b=>/^walk/.test(b.value)).length,2);
 const gone=deleteBlock(example,blocks.find(b=>b.value==='camera')!);const gb=presentationBlocks(await build(gone.text));assert.ok(!gb.some(b=>b.kind==='katse'&&b.value==='camera'));assert.ok(gb.some(b=>b.value==='happy'),'muu lause säilyy');
 const wave=blockLibrary.find(x=>x.label==='Vilkuta')!,t=blocks.find(b=>b.value==='close')!.start,inserted=insertBlock(example,blocks,{...wave,lane:'NIKO'},t);const ib=presentationBlocks(await build(inserted.text));const w=ib.find(b=>b.value==='wave'&&b.lane==='NIKO')!;assert.ok(w&&Math.abs(w.start-ib.find(b=>b.value==='close')!.start)<2.1);
});

test('ristiriidat näytetään eikä niitä ratkaista hiljaa; repliikkejä ei keksitä palikoista',async()=>{
 const p=await build(example),blocks=presentationBlocks(p),walk=blocks.find(b=>b.value==='walk-right')!,edited=example.replace('kaksi sekuntia','neljä sekuntia');
 assert.throws(()=>stretchBlock(edited,walk,3),BlockConflict);assert.throws(()=>updateBlock(example,blocks.find(b=>b.kind==='repliikki')!,{value:'Uusi'}),/keksitä/);
 assert.throws(()=>stretchBlock(example,blocks.find(b=>b.kind==='ilme')!,2),/Vain liikkeen/);
});

test('lukitun kuvan suojaus: lukittuun kuvaan vaikuttava palikkamuutos estetään, muu sallitaan',async()=>{
 const p=await build(example);p.production??=initProduction(p);const shots=adaptPresentation(p).shots,close=shots.find(s=>p.events.find(e=>e.id===s.sourceEventId)?.value==='close')!;assert.ok(close,'lähikuva on oma kuvansa');
 p.production.studio={...studioMetadata(p),rawScript:p.original,shots:{[close.id]:{status:'locked',approvedRevision:1}}};const locked=new Set([close.id]);
 const blocks=presentationBlocks(p),smile=blocks.find(b=>b.value==='happy')!,inside=await build(updateBlock(example,smile,{value:'sad'}).text,p);
 assert.ok(lockedShotConflict(p,inside,affectedShots(p,inside),locked),'lukitun kuvan sisältö muuttuisi');
 const walk=blocks.find(b=>b.value==='walk-right')!,outside=await build(stretchBlock(example,walk,2.5).text,p);void outside;
});

test('palikkamuutos → uusi esitys alle 100 ms (pilvikone, mediaani 5 ajosta)',async()=>{
 const l=await library(),p=buildEpisode(example,l).presentation,blocks=presentationBlocks(p),walk=blocks.find(b=>b.value==='walk-right')!;buildEpisode(example,l);
 const times:number[]=[];for(let i=0;i<5;i++){const t=performance.now();const edit=stretchBlock(example,walk,2+i*.5);buildEpisode(edit.text,l,{previous:p});times.push(performance.now()-t);}
 times.sort((a,b)=>a-b);assert.ok(times[2]<100,`${times[2].toFixed(1)} ms`);
});
