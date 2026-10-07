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
