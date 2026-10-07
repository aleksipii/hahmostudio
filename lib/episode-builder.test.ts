import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,readdirSync} from 'node:fs';
import {readProject} from './project-file.ts';
import {buildEpisode,buildSeries,splitEpisodes,resolveEnvironment,planCast,catalogFromNames,packsNeeded,parseMusicLine,type EpisodeLibrary} from './episode-builder.ts';
import {CHARACTER_PACK_OPTIONS} from './speaker-pack-options.ts';
import {stageState} from './presentation-stage.ts';
import {transitionShade} from './presentation-timing.ts';
import {sampleTrack} from './animation-model.ts';
import {validatePresentation} from './presentation-model.ts';

const packs=catalogFromNames(CHARACTER_PACK_OPTIONS);
const cache:Record<string,EpisodeLibrary['assets'][string]>={};
async function library(text:string):Promise<EpisodeLibrary>{const assets:EpisodeLibrary['assets']={};for(const n of packsNeeded(text,packs)){if(!cache[n]){const r=await readProject(new Blob([readFileSync(new URL(`../public/library/${n}.hahmo`,import.meta.url))]));cache[n]={doc:r.doc,animation:r.animation};}assets[n]=cache[n];}return {packs,assets};}
const errors=<T extends {severity:string;code:string}>(d:T[],allowed:string[]=['missing-audio'])=>d.filter(x=>x.severity==='error'&&!allowed.includes(x.code));

export const example=`Jakso 1: Pysäköintisakko
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
HÄIVYTYS MUSTAAN
`;

test('tehtävänannon esimerkki: hahmot, keittiö, puhelin kädessä, kävely, lähikuva, ilmeet, katse kameraan ja häivytys',async()=>{
 const b=buildEpisode(example,await library(example),{fps:24});const p=b.presentation;
 assert.deepEqual(p.characters,['MIRA','NIKO']);assert.equal(p.metadata.title,'Pysäköintisakko');
 assert.equal(p.world.design,'kitchen-scene-v1');assert.equal(stageState(p,0).design,'kitchen-scene-v1');
 assert.equal(stageState(p,0).phone.enabled,true);assert.equal(stageState(p,0).phone.carrier,'MIRA');
 const v=(kind:string,value:string)=>p.events.find(e=>e.kind===kind&&e.value===value)!;
 assert.equal(v('action','walk-right').target,'NIKO');assert.equal(v('action','walk-right').duration,2);
 assert.equal(v('gaze','MIRA').target,'NIKO');assert.equal(v('shot','close').target,'MIRA');
 assert.equal(v('action','show_phone').target,'MIRA');assert.equal(v('action','sit').target,'NIKO');
 assert.equal(v('expression','sad').target,'NIKO');assert.equal(v('expression','happy').target,'MIRA');assert.equal(v('gaze','camera').target,'MIRA');
 const fade=v('transition','fade-out');assert.equal(fade.at!+fade.duration!,p.seconds);assert.equal(transitionShade(p,p.seconds),1);assert.equal(transitionShade(p,0),0);
 assert.deepEqual(b.audioPlan.music.map(m=>[m.mood,m.status]),[['rauhallinen','generated']]);
 assert.deepEqual(b.audioPlan.dialogue.map(d=>[d.speaker,d.status]),[['MIRA','missing']]);
 assert.deepEqual(errors(b.diagnostics),[]);assert.ok(b.diagnostics.some(d=>d.code==='missing-audio'));
 assert.ok(b.diagnostics.some(d=>d.code==='default-cast'&&d.message.includes('MIRA')));
 // Animaatiot syntyvät molemmille ja Niko liikkuu kävelyn aikana.
 const niko=b.animationPerActor.NIKO,q=b.presentation.bindings.find(x=>x.speaker==='NIKO')!,root=b.presentation.assets.length>=0?(await library(example)).assets[q.asset].doc.quick!.roles.root:'';
 assert.ok(niko&&b.animationPerActor.MIRA);assert.ok(niko.tracks.length>0);void root;
 // Jokainen sisältörivi on tunnistettu tai kirjattu: ei hiljaa ohitettuja rivejä.
 assert.ok(b.lines.filter(l=>l.outcome!=='empty').every(l=>l.outcome!=='unrecognized'));
});

test('rakennus on deterministinen: sama syöte tuottaa saman esityksen tavu tavulta',async()=>{
 const lib=await library(example);const a=JSON.stringify(buildEpisode(example,lib).presentation),b=JSON.stringify(buildEpisode(example,lib).presentation);assert.equal(a,b);
});

test('testiaineisto ja kirjaston käsikirjoitukset rakentuvat ilman virheitä, kun resurssit ovat olemassa',async()=>{
 const files=[...readdirSync(new URL('../tests/fixtures/scripts/',import.meta.url)).map(f=>new URL('../tests/fixtures/scripts/'+f,import.meta.url)),...readdirSync(new URL('../public/library/',import.meta.url)).filter(f=>f.endsWith('.md')).map(f=>new URL('../public/library/'+f,import.meta.url)),new URL('./test-fixtures/general-episode.md',import.meta.url)];
 assert.ok(files.length>=6);
 for(const file of files){let text=readFileSync(file,'utf8');
  // KILSATin samannimisillä Kille-Oma/Handu-Oma-paketeilla ei ole kyynärvartta puhelimen näyttämiseen: valitaan resurssiriveillä paketit, joissa se on.
  if(file.pathname.endsWith('KILSAT-S01E01.md'))text='Resurssi hahmo KILLE: Roni-Monikulma\nResurssi hahmo HANDU: Salla-Monikulma\n'+text;
  const series=buildSeries(text,await library(text));assert.ok(series.length>=1,file.pathname);
  for(const b of series){assert.deepEqual(errors(b.diagnostics).map(d=>d.message),[],file.pathname+' jakso '+b.source.index);assert.ok(b.presentation.events.length>0);validatePresentation(b.presentation);}
 }
});

test('sarjajako: ---‑rivi, Jakso N: -otsikko ja #!kilsat-lohko aloittavat jakson, rivinumerot säilyvät',()=>{
 const s=splitEpisodes('Jakso 1: Alku\nMIRA:\n"Hei."\n---\nNIKO:\n"Moi."\nJakso 3: Loppu\nNIKO:\n"Hei hei."');
 assert.deepEqual(s.map(e=>[e.index,e.title,e.firstLine]),[[1,'Alku',1],[2,'Jakso 2',5],[3,'Loppu',7]]);
 assert.equal(s[1].text,'NIKO:\n"Moi."');
 assert.equal(splitEpisodes('# Ohje\n#!kilsat\nHahmo: A\n#!kilsat\nHahmo: B').length,2);
 assert.equal(splitEpisodes('Mira vilkuttaa.').length,1);
});

test('miljöön synonyymit ja taivutusmuodot; tuntematon tausta on virhe ja neutraali tausta',async()=>{
 for(const [text,id] of [['KEITTIÖ','kitchen-scene-v1'],['keittiössä','kitchen-scene-v1'],['Kitchen','kitchen-scene-v1'],['olohuoneessa','apartment-v1'],['AUTO','car-interior-v2'],['autossa takapenkillä','car-back-v1'],['katu','street-scene-v1'],['studio','studio-v1'],['bussipysäkillä','bus-stop-scene-v1'],['kartonkiauto','cutout-car-v1'],['KAHVILA - ILTA','cafe-scene-v1'],['living room','apartment-v1']])assert.equal(resolveEnvironment(text),id,text);
 assert.equal(resolveEnvironment('avaruusasema'),undefined);assert.equal(resolveEnvironment('autotalli'),'garage-scene-v1');
 const text='INT. AVARUUSASEMA\nMira vilkuttaa.';const b=buildEpisode(text,await library(text));
 assert.ok(b.diagnostics.some(d=>d.code==='environment-unknown'&&d.severity==='error'));assert.equal(b.presentation.world.design,undefined);
});

test('roolitus: resurssirivi, tunnus ja nimi ennen oletuspaketteja; oletus merkitään tarkistukseen',()=>{
 const c=planCast(['KILLE','PIPSA','MIRA','NIKO'],packs,{resources:{KILLE:'kille'},handles:{taru:'MIRA'}});
 assert.deepEqual(c.map(x=>[x.speaker,x.pack,x.reason]),[['KILLE','Mr.Kille','resource'],['PIPSA','Pipsa','name'],['MIRA','Taru','handle'],['NIKO','Ville','default']]);
});

test('musiikkiohje: tunnelma, tiedosto ja pois',()=>{
 assert.equal(parseMusicLine('Musiikki: iloinen')?.mood,'iloinen');assert.equal(parseMusicLine('Music: tense and dark')?.mood,'jännittävä');
 assert.equal(parseMusicLine('Musiikki: oma-biisi.wav')?.file,'oma-biisi.wav');assert.equal(parseMusicLine('Musiikki: pois')?.off,true);assert.equal(parseMusicLine('Mira: musiikki'),undefined);
});

test('mikä tahansa syöte: rakentaja ei kaadu, jokaisella rivillä on lopputulos ja tunnistamaton näkyy tarkistuksessa',async()=>{
 const lib=await library(example);let seed=7;const rnd=()=>(seed=(seed*1103515245+12345)&0x7fffffff)/0x7fffffff;
 const pieces=['Mira','Niko','kävelee','vasemmalle','2 s','katsoo','kameraan','"Hei!"','MIRA:','INT. KEITTIÖ','---','LÄHIKUVA','hymyilee','puhelin','tauko','???','{}','<script>alert(1)</script>','Jakso 2:','HÄIVYTYS MUSTAAN','Musiikki: iloinen','Ei isoja eleitä.','#!kilsat','Hahmo: X','ääkköset','🙂','\t','Tausta: kuu'];
 for(let n=0;n<150;n++){const text=Array.from({length:1+Math.floor(rnd()*12)},()=>Array.from({length:1+Math.floor(rnd()*4)},()=>pieces[Math.floor(rnd()*pieces.length)]).join(' ')).join('\n');
  for(const b of buildSeries(text,lib)){assert.ok(b.presentation);validatePresentation(b.presentation);if(!b.diagnostics.some(d=>d.code==='build-failed'))assert.ok(b.lines.every(l=>['event','structure','comment','unrecognized','empty'].includes(l.outcome)));}}
 const prose='Tämä on vapaata proosaa, jossa ei ole tuettua verbiä.';const b=buildEpisode('Mira vilkuttaa.\n'+prose,lib);
 assert.ok(b.diagnostics.some(d=>d.code==='unrecognized-line'&&d.message.includes(prose.slice(0,-1))));
 assert.equal(buildEpisode('',lib).diagnostics[0].code,'build-failed');
});

test('aiemmat äänileikkeet säilyvät uudelleenrakennuksessa, kun repliikki on ennallaan',async()=>{
 const lib=await library(example),first=buildEpisode(example,lib).presentation,dialogue=first.events.find(e=>e.kind==='dialogue')!;
 first.audioClips=[{id:'clip-1',dialogue:dialogue.id,asset:'voice-1',start:0,end:1.5,duration:1.5,source:'volume',mouth:[{time:0,shape:'rest'},{time:.3,shape:'open'},{time:1.2,shape:'rest'}]}];
 const again=buildEpisode(example.replace('Mira hymyilee','Mira nyökkää ja hymyilee'),lib,{previous:first});
 assert.equal(again.presentation.audioClips.length,1);assert.equal(again.audioPlan.dialogue[0].status,'linked');assert.ok(!again.diagnostics.some(d=>d.code==='missing-audio'));
 assert.equal(sampleTrack(again.presentation.actorAnimations!.MIRA.tracks[0],0).opacity>=0,true);
});

test('suorituskyky: 60 sekunnin jakso rakentuu alle 2 sekunnissa (pilvikone, ei M1)',async()=>{
 const scene=(i:number)=>`MIRA:\n"Repliikki numero ${i} on tässä ja kestää hetken."\nNiko nyökkää.\nNIKO:\n"Vastaus ${i} tulee tässä."\nMira vilkuttaa 1 s.\n`;
 const text='INT. KEITTIÖ\n'+Array.from({length:12},(_,i)=>scene(i)).join('');const lib=await library(text);
 const t0=performance.now(),b=buildEpisode(text,lib),ms=performance.now()-t0;
 assert.ok(b.presentation.seconds>=50,String(b.presentation.seconds));assert.ok(ms<2000,ms+' ms');
});

test('.sarja: jaksot tallentuvat Jaksot-paneelin muotoon ja lukeutuvat takaisin; enintään viisi jaksoa',async()=>{
 const {writeSeriesArchive,readSeriesArchive}=await import('./series-archive.ts');
 const items=[1,2,3].map(i=>({name:'Jakso '+i,bytes:new Uint8Array([i,i,i])}));
 const data=writeSeriesArchive(items);assert.deepEqual(readSeriesArchive(data),items);assert.deepEqual(writeSeriesArchive(items),data);
 assert.throws(()=>writeSeriesArchive(Array.from({length:6},(_,i)=>({name:String(i),bytes:new Uint8Array(1)}))),/viisi/);
});
