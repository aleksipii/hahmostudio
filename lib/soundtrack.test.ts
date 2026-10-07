import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {readProject} from './project-file.ts';
import {buildEpisode,catalogFromNames} from './episode-builder.ts';
import {CHARACTER_PACK_OPTIONS} from './speaker-pack-options.ts';
import {synthSfx,synthMusic,sfxIds,SOUND_RATE,type MusicMood} from './sound-library.ts';
import {renderSoundtrack,duckEnvelope,cueTime,sfxInstruction,footContacts} from './soundtrack.ts';
import {footPoint} from './motion-quality.ts';
import {mixDialogueAudio} from './presentation-audio.ts';
import {validatePresentation} from './presentation-model.ts';

const peak=(a:Float32Array)=>{let m=0;for(const v of a)m=Math.max(m,Math.abs(v));return m;};
const rms=(a:Float32Array,from=0,to=a.length)=>{let s=0;for(let i=from;i<to;i++)s+=a[i]*a[i];return Math.sqrt(s/Math.max(1,to-from));};
const cache=new Map<string,{doc:any;animation:any}>();
async function pack(n:string){if(!cache.has(n)){const r=await readProject(new Blob([readFileSync(new URL(`../public/library/${n}.hahmo`,import.meta.url))]));cache.set(n,{doc:r.doc,animation:r.animation});}return cache.get(n)!;}
async function build(text:string){const assets={Pipsa:await pack('Pipsa'),Ville:await pack('Ville')};return {b:buildEpisode(text,{packs:catalogFromNames(CHARACTER_PACK_OPTIONS),assets}),assets};}

test('tehosteet: kaikki kahdeksan syntetisoidaan deterministisesti, eivät ole hiljaisia eivätkä särö',()=>{
 for(const id of sfxIds){const a=synthSfx(id),b=synthSfx(id);assert.deepEqual(a,b,id);assert.ok(rms(a)>.005,id+' '+rms(a));assert.ok(peak(a)<=1,id);assert.ok(Math.abs(a[0])<1e-12);}
 assert.notDeepEqual(synthSfx('askel',0),synthSfx('askel',1),'peräkkäiset askeleet vaihtelevat');
});

test('musiikki: neljä tunnelmaa, alkuperäinen ohjelmallinen sävellys, häivytys alussa ja lopussa',()=>{
 const moods:MusicMood[]=['iloinen','jännittävä','rauhallinen','surullinen'],out=moods.map(m=>synthMusic(m,6));
 for(const [i,a] of out.entries()){assert.equal(a.length,6*SOUND_RATE);assert.ok(rms(a,SOUND_RATE*2,SOUND_RATE*4)>.02,moods[i]);assert.ok(peak(a)<1);assert.ok(Math.abs(a[0])<1e-12);assert.ok(Math.abs(a.at(-1)!)<1e-6);assert.deepEqual(synthMusic(moods[i],6),a);}
 for(let i=0;i<4;i++)for(let j=i+1;j<4;j++)assert.notDeepEqual(out[i].slice(48000,48100),out[j].slice(48000,48100));
});

test('askel osuu jalan tukivaiheen alkuun ±1 ruutu; istuutuminen ja käsikirjoituksen tehosterivit ajoittuvat tapahtumiin',async()=>{
 const {b,assets}=await build('INT. KEITTIÖ\nMira kävelee oikealle 2 s.\nPuhelin soi.\nMira istuu.\nÄäni: ovi\nMira juoksee vasemmalle 2 s.');const p=b.presentation;
 const steps=p.soundCues!.filter(c=>c.sound==='askel').map(c=>Math.round(cueTime(p,c)!*24));assert.ok(steps.length>=6,String(steps));
 const bind=p.bindings[0],doc=assets[bind.asset as 'Pipsa'].doc,a=p.actorAnimations!.MIRA;
 // Riippumaton tunnistus: ruutu, jossa jalka on maassa mutta edellisessä ilmassa.
 const starts:number[]=[];for(const side of ['left','right'] as const){const ys=Array.from({length:a.duration},(_,f)=>footPoint(doc,a,f,side)!.y),floor=Math.max(...ys);for(let f=1;f<ys.length;f++)if(floor-ys[f]<.5&&floor-ys[f-1]>=.5&&p.events.some(e=>/^(walk|run)/.test(e.value)&&f>=e.at!*24&&f<=(e.at!+e.duration!)*24))starts.push(f);}
 for(const s of starts)assert.ok(steps.some(x=>Math.abs(x-s)<=1),`tukivaihe ${s} ilman askelta (${steps})`);for(const x of steps)assert.ok(starts.some(s=>Math.abs(x-s)<=1),`askel ${x} ilman tukivaihetta`);
 const sit=p.events.find(e=>e.value==='sit')!,thump=p.soundCues!.find(c=>c.sound==='istuutuminen')!;assert.ok(Math.abs(cueTime(p,thump)!-(sit.at!+sit.duration!*.6))<1e-9);
 const ring=p.soundCues!.find(c=>c.sound==='soitto')!,door=p.soundCues!.find(c=>c.sound==='ovi')!;assert.equal(cueTime(p,ring),sit.at);assert.equal(cueTime(p,door),p.events.find(e=>e.value==='run-left')!.at);
 assert.ok(!b.diagnostics.some(d=>d.code==='unrecognized-line'),'tehosterivit eivät jää tunnistamatta');
 assert.equal(sfxInstruction('SFX: door'),'ovi');assert.equal(sfxInstruction('Puhelin värisee pöydällä.'),'varina');assert.equal(sfxInstruction('Joku koputtaa oveen.'),'koputus');assert.equal(sfxInstruction('Mira katsoo ovea.'),undefined);
});

test('ducking: musiikki hiljenee repliikkien alle (−10 dB) pehmeästi ja palaa tauolla',()=>{
 const g=duckEnvelope([[2,3]],5*SOUND_RATE);assert.equal(g[SOUND_RATE],1);assert.ok(Math.abs(g[Math.round(2.5*SOUND_RATE)]-.3)<1e-6);assert.equal(g[Math.round(4*SOUND_RATE)],1);
 for(let i=1;i<g.length;i++)assert.ok(Math.abs(g[i]-g[i-1])<.001,'ei hyppyä');assert.ok(g[Math.round(1.9*SOUND_RATE)]<1&&g[Math.round(1.9*SOUND_RATE)]>.3,'alkaa ennen repliikkiä');
});

test('miksaus: repliikit, tehosteet ja musiikki omina väylinään; musiikki duckataan repliikin alle; .hahmo-malli säilyttää merkinnät',async()=>{
 const {b}=await build('Musiikki: rauhallinen\nINT. KEITTIÖ\nMira kävelee oikealle 2 s.\nMIRA:\n“Siirsitkö auton eilen?”\nMira istuu.');const p=b.presentation,dialogue=p.events.find(e=>e.kind==='dialogue')!;
 assert.ok(p.soundCues!.some(c=>c.kind==='music'&&c.sound==='rauhallinen'));assert.ok(p.soundCues!.some(c=>c.kind==='sfx'));
 const len=Math.ceil(p.seconds*SOUND_RATE),voice=new Float32Array(len);for(let i=Math.round(dialogue.at!*SOUND_RATE);i<Math.round((dialogue.at!+dialogue.duration!)*SOUND_RATE);i++)voice[i]=.3*Math.sin(i*.05);
 const s=renderSoundtrack(p,voice);assert.ok(rms(s.dialogue)>0&&rms(s.sfx)>0&&rms(s.music)>0,'kolme lähdettä');
 const during=[Math.round((dialogue.at!+.3)*SOUND_RATE),Math.round((dialogue.at!+dialogue.duration!-.1)*SOUND_RATE)],before=[Math.round(1.2*SOUND_RATE),Math.round(1.8*SOUND_RATE)];
 const mDuring=rms(s.music.map((v,i)=>v*s.duck[i]),during[0],during[1]),mBefore=rms(s.music,before[0],before[1]);assert.ok(20*Math.log10(mDuring/mBefore)<-8,`ducking ${(20*Math.log10(mDuring/mBefore)).toFixed(1)} dB`);
 assert.ok(peak(s.mix)<=1);assert.deepEqual(validatePresentation(p).soundCues,p.soundCues);
 // Sama miksaus kulkee viennin WAV-polun läpi (mixDialogueAudio): musiikki kuuluu myös ilman repliikkiääniä.
 class Context{async decodeAudioData(){return {duration:1,sampleRate:SOUND_RATE,numberOfChannels:1,getChannelData:()=>new Float32Array(SOUND_RATE)} as unknown as AudioBuffer;}async close(){}}
 const original=(globalThis as any).AudioContext;(globalThis as any).AudioContext=Context;try{const wav=await mixDialogueAudio(p,{},24,0);const pcm=new Int16Array((await wav.blob.arrayBuffer()).slice(44));let e=0;for(let i=SOUND_RATE;i<2*SOUND_RATE;i++)e+=Math.abs(pcm[i]);assert.ok(e/SOUND_RATE>20,'musiikki ja askeleet WAV:ssa');}finally{(globalThis as any).AudioContext=original;}
 const kille=buildEpisode('Musiikki: pois\nMira vilkuttaa.',{packs:catalogFromNames(CHARACTER_PACK_OPTIONS),assets:{Pipsa:await pack('Pipsa')}});assert.ok(!kille.presentation.soundCues!.some(c=>c.kind==='music'&&c.sound!=='pois'));
 void footContacts;
});

import {applyRoom,surfaces} from './sound-library.ts';
import {surfaceFor,roomFor,loopFill,fadeGain,transitionEnvelope,environmentAt} from './soundtrack.ts';

/** Kirkkaus: ensimmäisen differenssin energia suhteessa signaalin energiaan (korkeat taajuudet). */
const brightness=(a:Float32Array)=>{let d=0,e=1e-12;for(let i=1;i<a.length;i++){d+=(a[i]-a[i-1])**2;e+=a[i]**2;}return d/e;};

test('askeleen lattia: puu, kova pinta ja nurmi kuulostavat erilaisilta, ovat deterministisiä eivätkä säry; oletus on ennallaan',()=>{
 const s=Object.fromEntries(surfaces.map(x=>[x,synthSfx('askel',0,SOUND_RATE,x)]));
 assert.deepEqual(s.oletus,synthSfx('askel',0),'oletusaskel ei muutu');
 assert.deepEqual(s.puu,synthSfx('askel',0,SOUND_RATE,'puu'),'deterministinen');
 for(const x of surfaces){assert.ok(peak(s[x])>.1&&peak(s[x])<=1,`${x} peak ${peak(s[x])}`);}
 assert.ok(brightness(s.nurmi)<brightness(s.puu)&&brightness(s.puu)<brightness(s.kova),`kirkkaus ${brightness(s.nurmi)} < ${brightness(s.puu)} < ${brightness(s.kova)}`);
 assert.equal(surfaceFor('kitchen-scene-v1'),'puu');assert.equal(surfaceFor('street-scene-v1'),'kova');assert.equal(surfaceFor('park-scene-v1'),'nurmi');assert.equal(surfaceFor('white-studio-scene-v1'),'oletus');assert.equal(surfaceFor(undefined),'oletus');
 // Muut tehosteet eivät riipu lattiasta.
 assert.deepEqual(synthSfx('ovi',0,SOUND_RATE,'nurmi'),synthSfx('ovi',0));
});

test('huonekaiku: häntä pitenee ja vaimenee nollaan; kuiva huone ja tyhjä tulo palauttavat saman; ympäristö määrää kaiun',()=>{
 const click=synthSfx('koputus',0),dry=roomFor('white-studio-scene-v1'),kitchen=roomFor('kitchen-scene-v1'),meeting=roomFor('meeting-scene-v1');
 assert.equal(applyRoom(click,SOUND_RATE,dry),click);assert.equal(applyRoom(new Float32Array(0),SOUND_RATE,kitchen).length,0);
 assert.ok(kitchen.wet>0&&meeting.decay>kitchen.decay&&roomFor('park-scene-v1').wet<kitchen.wet);
 const wet=applyRoom(click,SOUND_RATE,kitchen);assert.equal(wet.length,click.length+Math.round(kitchen.decay*SOUND_RATE));
 assert.deepEqual(wet,applyRoom(click,SOUND_RATE,kitchen),'deterministinen');
 const tail=rms(wet,click.length,wet.length),early=rms(wet,click.length-4800,click.length);assert.ok(tail>1e-4,'kaiku kuuluu yli kuivan lopun');assert.ok(tail<early,'kaiku vaimenee');
 assert.ok(Math.abs(wet.at(-1)!)<1e-3,'häntä päättyy hiljaa');assert.ok(peak(wet)<1.2*peak(click)+.2,'kaiku ei kasvata huippua kohtuuttomasti');
});

test('tuotu musiikki: lyhyt tiedosto toistuu silmukkana ristihäivytyksellä ilman napsahdusta; häivytys alussa ja lopussa',()=>{
 const tone=new Float32Array(SOUND_RATE).map((_,i)=>.5*Math.sin(2*Math.PI*220*i/SOUND_RATE)),looped=loopFill(tone,Math.round(3.4*SOUND_RATE),SOUND_RATE);
 assert.equal(looped.length,Math.round(3.4*SOUND_RATE));assert.ok(peak(looped)<=.55,'ristihäivytys ei kasvata huippua');
 // Sauman ympäristössä ei ole äkillistä hyppyä: suurin näytteiden välinen ero pysyy sinin omaa jyrkkyyttä pienempänä.
 let maxStep=0;for(let i=1;i<looped.length;i++)maxStep=Math.max(maxStep,Math.abs(looped[i]-looped[i-1]));assert.ok(maxStep<.5*2*Math.PI*220/SOUND_RATE*1.6,`näytehyppy ${maxStep}`);
 assert.equal(loopFill(tone,100,SOUND_RATE).length,100,'pitkä tiedosto leikataan');
 const n=Math.round(10*SOUND_RATE);assert.equal(fadeGain(0,n),0);assert.ok(fadeGain(n/2,n)===1);assert.ok(fadeGain(n-1,n)<.01);assert.ok(fadeGain(Math.round(.2*SOUND_RATE),n)>0&&fadeGain(Math.round(.2*SOUND_RATE),n)<1);
});

test('kuvasiirtymät ohjaavat musiikkia: häivytys mustaan vaimentaa ja pitää hiljaa; ympäristö valitaan ajan mukaan',async()=>{
 const {b}=await build('Musiikki: rauhallinen\nINT. KEITTIÖ\nMira kävelee oikealle 2 s.\nMira istuu.\nHÄIVYTYS MUSTAAN');const p=b.presentation,fo=p.events.find(e=>e.kind==='transition'&&e.value==='fade-out')!;
 assert.ok(fo,'häivytys tunnistettu');
 const length=Math.ceil((p.seconds+1)*SOUND_RATE),env=transitionEnvelope(p,length),t0=Math.round(fo.at!*SOUND_RATE);
 assert.equal(env[Math.max(0,t0-100)],1);assert.ok(env[t0+Math.round((fo.duration??.7)*SOUND_RATE/2)]<.6);assert.equal(env.at(-1),0);
 assert.equal(environmentAt(p,.01),'kitchen-scene-v1');
 const stems=renderSoundtrack(p,new Float32Array(length));assert.ok(rms(stems.music,Math.round(1*SOUND_RATE),Math.round(1.5*SOUND_RATE))>0,'musiikki soi ennen häivytystä');
 assert.ok(rms(stems.mix,length-4800,length)<1e-6||rms(stems.music.map((v,i)=>v*env[i]),length-4800,length)===0,'musiikki on hiljaa häivytyksen jälkeen');
});

test('tehosteet kaiutetaan ympäristön mukaan: keittiössä askelen perään jää kaiku, studiossa ei',async()=>{
 const kitchen=(await build('INT. KEITTIÖ\nMira kävelee oikealle 2 s.')).b.presentation,studio=(await build('Tausta: valkoinen studio\nMira kävelee oikealle 2 s.')).b.presentation;
 const render=(p:typeof kitchen)=>renderSoundtrack(p,new Float32Array(Math.ceil((p.seconds+1)*SOUND_RATE))).sfx;
 const k=render(kitchen),s=render(studio);assert.ok(rms(k)>0&&rms(s)>0);
 // Askelten välinen hiljaisuus (askel 0,22 s, askeleet ~0,5 s välein): kaiun osuus kuuluu kuivan askeleen jälkeisessä ikkunassa.
 const stepAt=Math.round(cueTime(kitchen,kitchen.soundCues!.find(c=>c.sound==='askel')!)!*SOUND_RATE),from=stepAt+Math.round(.26*SOUND_RATE),to=stepAt+Math.round(.36*SOUND_RATE);
 assert.ok(rms(k,from,to)>rms(s,from,to)*1.5+1e-6,`keittiön kaiku ${rms(k,from,to)} vs studio ${rms(s,from,to)}`);
});
