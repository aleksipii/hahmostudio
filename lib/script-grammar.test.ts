import {readFileSync} from 'node:fs';
import {readProject} from './project-file.ts';
import {compilePresentation} from './presentation-compile.ts';
import {functions} from './presentation-model.ts';
import {stageState} from './presentation-stage.ts';
import {test} from 'node:test';import assert from 'node:assert/strict';
import {parseRuleScript,verbs,grammarCoverage} from './script-grammar.ts';
import {parsePresentation} from './presentation-parser.ts';
const commands=['Kille kävelee oikealle 2 s','Kille juoksee vasemmalle 2 s','Kille vilkuttaa 2 s','Kille ilme: huolestunut 2 s','Kamera: lähikuva Kille 2 s','Tausta: studio 2 s','Kille puhelin: takaa 2 s','Kille katsoo: Handu 2 s','Kille sanoo: "Hei Handu!" 2 s','Odota 2 s'];
const resources=Promise.all(['Pipsa','Ville'].map(n=>readProject(new Blob([readFileSync(new URL('../public/library/'+n+'-3D.hahmo',import.meta.url))]))));
const expectedValues=['walk-right','run-left','wave','worried','close','studio-v1','phone-on','HANDU','neutral_talk','pause'];
const expectedKinds=['action','action','action','expression','camera','environment','prop','gaze','dialogue','hold'];
for(let i=0;i<500;i++)test(`strict corpus ${i+1}: scenes, source refs, ordered/parallel and ${expectedKinds[i%10]}`,async()=>{
 const n=i%10,seconds=(.5+Math.floor(i/10)/10).toFixed(1),parallel=i%2===0;
 const script=`#!kilsat\nHahmo: Kille\nHahmo: Handu\nKohtaus: Alku\nKille nyökkää 1 s\nKohtaus: Loppu\n${parallel?'Samalla: ':''}${commands[n].replace('2 s',seconds+' s')}`;
 const model=parseRuleScript(script);assert.deepEqual(model.diagnostics,[]);assert.equal(model.commands.length,2);
 const command=model.commands[1];assert.equal(command.kind,expectedKinds[n]);assert.equal(command.source.line,7);assert.equal(command.source.text,script.split('\n')[6]);assert.equal(command.seconds,Number(seconds));assert.equal(command.at,parallel?0:1);assert.equal(command.scene,'scene-3');
 const presentation=parsePresentation(script);assert.equal(presentation.events[1].sourceRef.line,7);assert.equal(presentation.events[1].at,parallel?0:1);assert.equal(presentation.events[1].duration,Number(seconds));
 assert.equal(presentation.events[1].value,expectedValues[n]);if(n===8)assert.equal(presentation.events[1].text,'Hei Handu!');
 const [first,second]=await resources,assets={first:{doc:first.doc,animation:first.animation},second:{doc:second.doc,animation:second.animation}};
 presentation.bindings=presentation.characters.map((speaker,index)=>({speaker,asset:index?'second':'first',voice:'Test metadata',side:index?'right':'left',functions:Object.fromEntries(functions.map(f=>[f,'supported']))}));
 presentation.audioClips=presentation.events.filter(e=>e.kind==='dialogue').map(e=>({id:'audio-'+e.id,dialogue:e.id,asset:'test-audio',start:0,end:e.seconds!,duration:e.seconds!,source:'volume',mouth:[{time:0,shape:'rest'},{time:.1,shape:'open'}]}));
 const compiled=compilePresentation(presentation,assets,24);
 assert.deepEqual(compiled.diagnostics.filter(d=>d.severity==='error'),[]);
 assert.equal(compiled.events[1].at,parallel?0:1);assert.equal(compiled.events[1].duration,Number(seconds));assert.equal(compiled.events[1].value,expectedValues[n]);
 assert.ok(compiled.actorAnimations?.KILLE);if(n===5)assert.equal(stageState(compiled,command.at).design,'studio-v1');if(n===6){assert.equal(stageState(compiled,command.at).phone.enabled,true);assert.equal(stageState(compiled,command.at).phone.view,'back');}

});
test('coverage is finite and >1 million without storing generated sentences',()=>{assert.equal(grammarCoverage().recognizedMotionSentences,2457600);for(const v of [...verbs.walk,...verbs.run])assert.equal(parseRuleScript(`Hahmo: Kille\nKille ${v} suoraan 2 seconds`).diagnostics.length,0);});
test('unknowns, negation, unsupported camera/motion, pronouns and invalid middle line are never guessed',()=>{
 for(const text of ['hän kävelee oikealle 2 s','Kille ei kävele oikealle 2 s','Kamera: ylhäältä 2 s','Samalla: Kille kävelee oikealle 2 s','Kille kävelee oikealle','Kille katsoo: se 2 s'])assert.ok(parseRuleScript('Hahmo: Kille\n'+text).diagnostics.length,text);
 assert.equal(parseRuleScript('Hahmo: Kille\nKille istuu 2 s').commands.find(c=>c.kind==='action')?.value,'sit');
 const valid=parseRuleScript('Hahmo: Kille\nKille puhelin: esille 1 s\nKohtaus: Uusi\nhän katsoo: se 1 s');assert.equal(valid.diagnostics.length,0);assert.equal(valid.commands[1].value,'phone');
 const invalid=parseRuleScript('Hahmo: Kille\nKille nyökkää 1 s\nväärä rivi\nKille vilkuttaa 2 s');assert.equal(invalid.diagnostics.length,1);assert.equal(invalid.commands.length,2);assert.equal(invalid.diagnostics[0].line,3);
});
