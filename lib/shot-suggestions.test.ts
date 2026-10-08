import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {readProject} from './project-file.ts';
import {buildEpisode,catalogFromNames,type EpisodeLibrary} from './episode-builder.ts';
import {CHARACTER_PACK_OPTIONS} from './speaker-pack-options.ts';
import {presentationBlocks,blockSentence} from './blocks.ts';
import {shotSuggestions,lockedShotEvents} from './shot-suggestions.ts';
import {initProduction} from './production-model.ts';
import {studioMetadata,adaptPresentation} from './studio/domain.ts';
import type {Presentation} from './presentation-model.ts';

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
const build=async(text:string)=>buildEpisode(text,await library()).presentation;
const content=(p:Presentation)=>p.events.filter(e=>e.kind!=='shot').map(e=>[e.kind,e.target,e.value,e.text??''].join('|'));
const shots=(p:Presentation)=>p.events.filter(e=>e.kind==='shot').map(e=>`${e.value}:${e.target}`);

test('tunnereaktio toisen hahmon lähikuvan aikana: ehdotus lisää lähikuvan ja palauttaa edellisen kuvan',async()=>{
 const p=await build(example),s=shotSuggestions(p,example);
 assert.equal(s.length,1,'vain Nikon suru; Miran katse kameraan on jo Miran lähikuvassa');
 assert.equal(s[0].title,'Kuvaehdotus: lähikuva Niko (surullinen)');assert.equal(s[0].code,'shot-suggestion');assert.equal(s[0].line,15);
 assert.match(s[0].detail,/lisää “LÄHIKUVA NIKO” ennen riviä ja palauta “LÄHIKUVA MIRA” sen jälkeen/);
 const lines=s[0].edit!.text.split('\n');assert.deepEqual(lines.slice(13,17),['Mira näyttää Nikolle puhelinta.','LÄHIKUVA NIKO','Niko istuutuu ja näyttää surulliselta.','LÄHIKUVA MIRA']);
 const after=await build(s[0].edit!.text);
 assert.deepEqual(shots(after),['close:MIRA','close:NIKO','close:MIRA']);
 assert.deepEqual(content(after),content(p),'ehdotus ei lisää, poista eikä muuta muita tapahtumia, repliikkejä tai hahmoja');
 assert.ok(!after.diagnostics.some(d=>d.code==='unrecognized-line'||d.code==='unknown-shot'));
 // Ehto 2: lisätyt rivit ovat palikkaeditorin kanonisia lauseita ja kiertävät palikka → teksti → palikka muuttumattomina.
 const cams=presentationBlocks(after).filter(b=>b.kind==='kamera');
 for(const b of cams)assert.equal(blockSentence(b),b.lineText.trim(),b.lineText);
 assert.deepEqual(shotSuggestions(after,s[0].edit!.text),[],'käyttöönoton jälkeen ei uutta ehdotusta');
});

test('hylkäys ei jätä jälkeä: ehdotusten laskenta ei muuta mallia eikä tekstiä',async()=>{
 const p=await build(example),before=JSON.stringify(p);shotSuggestions(p,example);shotSuggestions(p,example);
 assert.equal(JSON.stringify(p),before);
});

test('ilman omia kuvaohjeita ei ehdoteta (lisäys poistaisi kaikki automaattiset kuvat)',async()=>{
 const text=example.replace('LÄHIKUVA MIRA\n','');const p=await build(text);
 assert.ok(p.events.some(e=>e.kind==='shot'),'automaattiset kuvat ovat olemassa');assert.deepEqual(shotSuggestions(p,text),[]);
});

test('lukittu kuva, suojattu tapahtuma ja Samalla-rivi estävät ehdotuksen',async()=>{
 const p=await build(example),shot=p.events.find(e=>e.kind==='shot')!;
 assert.deepEqual(shotSuggestions(p,example,{locked:new Set([shot.id])}),[]);
 const prot={...p,events:p.events.map(e=>e.kind==='expression'&&e.value==='sad'?{...e,protected:true}:e)};
 assert.deepEqual(shotSuggestions(prot,example),[]);
 const sam=example.replace('Mira hymyilee ja katsoo kameraan.','Samalla Mira hymyilee.');const ps=await build(sam);
 assert.ok(shotSuggestions(ps,sam).every(s=>!s.edit!.text.includes('LÄHIKUVA MIRA\nSamalla')),'Samalla-riviä ei eroteta repliikistään');
});

test('repliikin sisäinen reaktio: lähikuva lisätään puhujarivin yläpuolelle ja palautus repliikin jälkeen',async()=>{
 const text=`Jakso 1: Testi\n\nINT. KEITTIÖ - AAMU\nLAAJA KUVA\nNiko kävelee sisään vasemmalta kaksi sekuntia.\n\nMIRA:\n(huolestuneena)\n“Missä auto on?”\n\nNiko istuu.`;
 const p=await build(text),s=shotSuggestions(p,text);
 const worried=p.events.find(e=>e.kind==='expression'&&e.target==='MIRA');
 assert.ok(worried,'tunnistin lukee repliikin reaktion');
 assert.equal(s.length,1);const lines=s[0].edit!.text.split('\n');
 const cue=lines.indexOf('MIRA:');assert.equal(lines[cue-1],'LÄHIKUVA MIRA');assert.equal(lines[cue+3],'LAAJA KUVA');
 const after=await build(s[0].edit!.text);assert.deepEqual(shots(after),['wide:scene','close:MIRA','wide:scene']);assert.deepEqual(content(after),content(p));
});

test('tuotantonäkymässä lukittu kuva luetaan projektista ja estää ehdotuksen',async()=>{
 const p=await build(example);p.production??=initProduction(p);
 const shot=adaptPresentation(p).shots.find(s=>p.events.find(e=>e.id===s.sourceEventId)?.kind==='shot')!;
 assert.deepEqual([...lockedShotEvents(p)],[]);
 p.production.studio={...studioMetadata(p),shots:{...studioMetadata(p).shots,[shot.id]:{...(studioMetadata(p).shots[shot.id]??{}),status:'locked'} as never}};
 assert.deepEqual([...lockedShotEvents(p)],[shot.sourceEventId]);
 assert.deepEqual(shotSuggestions(p,example,{locked:lockedShotEvents(p)}),[]);
});
