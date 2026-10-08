import test from 'node:test';import assert from 'node:assert/strict';
import {checkSummary,comparableWords,compareTranscript,lineVoices,replaceBlockedBy,voiceCounts,voiceSource} from './voice-sources.ts';
import type {AudioClip,Presentation} from './presentation-model.ts';

const clip=(over:Partial<AudioClip>={}):AudioClip=>({id:'voice-d1',dialogue:'d1',asset:'audio-x',start:0,end:1,duration:1,mouth:[{time:0,shape:'rest'}],source:'volume',...over});
const synthetic={engine:'kokoro' as const,voice:'af_heart',speed:1,modelVersion:'m',key:'a'.repeat(64)};

test('lähde: käyttäjän ääni, synteettinen tai puuttuva',()=>{
 assert.equal(voiceSource(undefined),'none');assert.equal(voiceSource(clip()),'user');assert.equal(voiceSource(clip({synthetic})),'synthetic');
});

test('synteettinen ei koskaan korvaa käyttäjän ääntä; käyttäjän ääni korvaa synteettisen',()=>{
 assert.match(replaceBlockedBy(clip(),true)!,/Synteettinen ääni ei koskaan korvaa/);
 assert.match(replaceBlockedBy(clip({locked:true}),true)!,/Synteettinen ääni ei koskaan korvaa/);
 assert.match(replaceBlockedBy(clip({synthetic,locked:true}),true)!,/lukittu/);
 assert.equal(replaceBlockedBy(clip({synthetic}),true),undefined,'uudempi synteettinen saa päivittää synteettisen');
 assert.equal(replaceBlockedBy(clip({synthetic}),false),undefined,'oma äänitys tai tuonti voittaa');
 assert.equal(replaceBlockedBy(clip(),false),undefined,'oma uusi äänitys saa korvata oman vanhan');
 assert.equal(replaceBlockedBy(undefined,true),undefined);
});

test('repliikkien äänitilanne ja määrät',()=>{
 const p={events:[{id:'d1',kind:'dialogue',target:'MIRA',text:'Hei'},{id:'x',kind:'gaze',target:'MIRA',value:'camera'},{id:'d2',kind:'dialogue',target:'NIKO',text:'Moi'},{id:'d3',kind:'dialogue',target:'NIKO',text:'Hello'}],
  audioClips:[clip(),clip({id:'voice-d3',dialogue:'d3',synthetic,locked:true})]} as unknown as Presentation;
 assert.deepEqual(lineVoices(p).map(l=>[l.id,l.source,l.locked]),[['d1','user',false],['d2','none',false],['d3','synthetic',true]]);
 assert.deepEqual(voiceCounts(p),{user:1,synthetic:1,none:1});
});

test('vertailusanat: ei välimerkkejä, sulkeohjeita eikä litteroijan merkintöjä',()=>{
 assert.deepEqual(comparableWords('“Siirsitkö auton eilen?” (huokaa) [MUSIIKKI] Älä!'),['siirsitkö','auton','eilen','älä']);
 assert.deepEqual(comparableWords("Don't — stop."),["don't",'stop']);
});

test('litteraatin vertailu: täsmää, puuttuu ja ylimääräinen; mitään ei korjata',()=>{
 const same=compareTranscript('MIRA: “Siirsitkö auton eilen?”'.split(': ')[1],' Siirsitkö auton eilen.');
 assert.equal(same.matches,true);assert.equal(checkSummary(same),'Litteraatti vastaa repliikkiä (3/3 sanaa).');
 const diff=compareTranscript('Siirsitkö auton eilen?','Siirsitkö sen auton');
 assert.deepEqual(diff.words,[{text:'siirsitkö',kind:'same'},{text:'sen',kind:'extra'},{text:'auton',kind:'same'},{text:'eilen',kind:'missing'}]);
 assert.equal(diff.matches,false);assert.equal(checkSummary(diff),'Eroja: 1 sanaa puuttuu, 1 ylimääräistä (2/3 sanaa täsmää).');
 const silent=compareTranscript('Hei',''),empty=compareTranscript('(huokaa)','hei');
 assert.equal(silent.missing,1);assert.equal(silent.matches,false);
 assert.equal(empty.matches,false);assert.match(checkSummary(empty),/ei ole puhuttavaa/);
});

test('vertailu on rajattu (ei kasva rajatta pitkällä litteraatilla)',()=>{
 const long=Array.from({length:5000},(_,i)=>'sana'+i).join(' '),c=compareTranscript('sana0 sana1',long);
 assert.equal(c.words.filter(w=>w.kind==='extra').length,598);assert.equal(c.matched,2);
});
