import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {recognizeScript,parseDuration,detectLanguage,ScriptRecognizer,ALL_ACTORS,type Clause,type RecognizedLine} from './script-recognizer.ts';
import {scriptTemplates} from './script-templates.ts';
import {parseRuleScript} from './script-grammar.ts';
import {parsePresentation} from './presentation-parser.ts';
import {scanScriptLineAnnotations} from './script-line-annotations.ts';

const fixture=(name:string)=>readFileSync(new URL('../tests/fixtures/scripts/'+name,import.meta.url),'utf8');
const library=(name:string)=>readFileSync(new URL('../public/library/'+name,import.meta.url),'utf8');
const at=(r:{lines:RecognizedLine[]},n:number)=>r.lines[n-1];
const clause=(l:RecognizedLine,type:Clause['type'])=>l.clauses.find(c=>c.type===type) as any;
const one=(text:string,characters=['Kille','Handu','Mira','Niko'])=>new ScriptRecognizer(characters).clauses(text,detectLanguage(text));

test('every line of the repository scripts, templates and fi/en fixtures is classified',()=>{
 const sources=[...['Aamu-autossa.md','KILSAT-S01E01.md','YouTube-kartonki-jaksot-1-5.md','YouTube-kartonki-runko.md'].map(library),...scriptTemplates.map(t=>t.source),fixture('feature-en.fountain'),fixture('vapaa-fi.md')];
 for(const source of sources){const r=recognizeScript(source);assert.equal(r.stats.unknown,0,r.lines.filter(l=>l.kind==='unknown').map(l=>l.line+': '+l.text).join('\n'));}
});

test('English screenplay format: headings, transitions, cues with extensions, parentheticals and dialogue',()=>{
 const r=recognizeScript(fixture('feature-en.fountain'));
 assert.equal(r.language,'en');assert.deepEqual(r.characters,['MIRA','NIKO']);
 assert.equal(at(r,1).metadata?.key,'title');assert.equal(at(r,5).transition,'fade-in');
 assert.deepEqual(at(r,7).scene,{name:'KITCHEN',place:'int',time:'MORNING'});
 assert.equal(at(r,11).kind,'cue');assert.equal(at(r,12).kind,'parenthetical');assert.equal(at(r,13).kind,'dialogue');assert.equal(at(r,13).speaker,'MIRA');
 assert.equal(at(r,15).extension,'O.S.');assert.equal(at(r,16).dialogue,'Define "move".');
 assert.equal(at(r,27).kind,'dialogue','"a very wide sidewalk" is dialogue, not a WIDE shot');
 assert.equal(at(r,33).extension,"CONT'D");assert.equal(at(r,44).transition,'cut');assert.equal(at(r,46).scene?.place,'ext');assert.equal(at(r,51).transition,'fade-out');
});

test('English directions: motion with direction and spoken duration, gaze, expression, phone, plural actors',()=>{
 const r=recognizeScript(fixture('feature-en.fountain'));
 assert.deepEqual(clause(at(r,18),'motion'),{type:'motion',actor:'NIKO',value:'walk-right',seconds:2,estimated:false,text:'Niko walks in from the left, two seconds'});
 assert.deepEqual(at(r,19).clauses.map(c=>c.type),['motion','gaze']);assert.equal(clause(at(r,19),'gaze').target,'MIRA');assert.equal(clause(at(r,19),'motion').actor,'NIKO','pronoun resolves to previous actor');
 assert.equal(at(r,24).clauses[0].type,'hold');assert.equal((at(r,24).clauses[0] as any).seconds,.5);
 assert.equal(at(r,29).shot?.[0].size,'close');assert.equal(clause(at(r,29),'expression').value,'eyebrow_raise');
 assert.equal(clause(at(r,30),'phone').value,'show_phone');
 assert.deepEqual(at(r,31).clauses.map(c=>c.type==='motion'?c.value:c.type==='gaze'?c.target:c.type),['phone','sit']);
 assert.deepEqual(at(r,36).clauses.map(c=>(c as any).value),['nod','wave']);
 assert.equal((at(r,37).clauses[0] as any).seconds,1.5);
 assert.deepEqual(at(r,38).clauses.map(c=>(c as any).value),['crouch','point']);
 assert.equal(clause(at(r,39),'motion').actor,ALL_ACTORS);
 assert.deepEqual(clause(at(r,40),'motion'),{type:'motion',actor:'NIKO',value:'run-right',seconds:1.5,estimated:false,text:'Niko runs to the right 1.5 seconds'});
 assert.equal(clause(at(r,42),'expression').value,'happy');
 assert.equal(at(r,48).shot?.[0].move,'tracking');assert.equal(clause(at(r,49),'constraint').value,'camera-still');
});

test('Finnish free-form script: cue extension, inflected names, illative cut, negation and adverbial expression',()=>{
 const r=recognizeScript(fixture('vapaa-fi.md'));
 assert.equal(r.language,'fi');assert.equal(at(r,1).metadata?.key,'title');
 assert.equal(at(r,14).kind,'cue');assert.equal(at(r,14).extension,'ruudun ulkopuolelta');assert.equal(at(r,15).kind,'dialogue');
 assert.equal(clause(at(r,8),'phone').value,'phone_hold');
 assert.deepEqual(clause(at(r,17),'motion'),{type:'motion',actor:'NIKO',value:'walk-right',seconds:2,estimated:false,text:'Niko kävelee sisään vasemmalta kaksi sekuntia'});
 assert.equal(clause(at(r,18),'gaze').target,'MIRA','"Miraa" partitive resolves to MIRA');
 assert.equal(clause(at(r,29),'expression').value,'eyebrow_raise');
 assert.equal(clause(at(r,31),'gaze').target,'phone');assert.equal(clause(at(r,31),'motion').value,'sit');
 assert.equal(clause(at(r,40),'expression').value,'angry');
 assert.equal(clause(at(r,41),'expression').value,'worried','"ei ole vihainen vaan huolestunut" is worried, not angry');
 assert.deepEqual(at(r,44).shot,[{size:'medium',target:'NIKO'}],'LEIKKAUS NIKOON uses the illative');
 assert.equal(clause(at(r,45),'gaze').target,'MIRA');assert.equal(clause(at(r,45),'gaze').seconds,.5);assert.equal(clause(at(r,45),'expression').value,'dead_stare');
 assert.equal(clause(at(r,46),'constraint').value,'camera-still');assert.equal(clause(at(r,47),'constraint').value,'small-gestures');
 assert.equal(at(r,50).shot?.[0].size,'medium');assert.equal(at(r,50).shot?.[0].move,'zoom-in');
 assert.equal(clause(at(r,51),'title-card').seconds,2);assert.equal(at(r,52).transition,'fade-out');
});

test('KILSAT episode: dialogue ends at the closing quote and the next action line is a direction',()=>{
 const r=recognizeScript(library('KILSAT-S01E01.md'));
 assert.equal(at(r,9).kind,'dialogue');assert.equal(at(r,10).kind,'direction');assert.equal(clause(at(r,10),'gaze').target,'KILLE');
 assert.equal(at(r,11).kind,'cue');assert.equal(at(r,13).clauses[0].type,'hold');
 assert.equal(clause(at(r,7),'expression').value,'worried','"katsoo puhelintaan hieman huolestuneena" adds worried');
 assert.equal(clause(at(r,42),'expression').value,'mildly_hurt','"loukkaantuneelta, mutta ei vihaiselta"');
 assert.deepEqual(at(r,91).shot?.map(s=>s.target),['HANDU','KILLE','HANDU','KILLE']);
 assert.equal(at(r,81).transition,'cut');assert.equal(at(r,82).kind,'comment');
});

test('Finnish verb morphology is recognised from whole words; look-alike words are not',()=>{
 for(const [text,value] of [['Kille kävelee vasemmalle 2 s','walk-left'],['Kille käveli vasemmalle','walk-left'],['Kille ja Handu kävelevät oikealle','walk-right'],['Kille astelee suoraan','walk-front'],['Kille juoksi oikealle','run-right'],['Kille ryntää vasemmalle','run-left'],['Kille hyppäsi','jump'],['Kille kyykistyy','crouch'],['Kille istuutuu','sit'],['Kille istahti','sit'],['Kille vilkutti','wave'],['Kille heiluttaa kättä','wave'],['Kille nyökkäsi','nod'],['Kille osoittaa Handua','point'],['Kille puristaa nyrkkinsä','fist'],['Kille pysähtyi','stop'],['Kille hämmästyy','react-surprise']] as const)
  assert.equal((one(text)[0] as any).value,value,text);
 for(const text of ['Kille seisoo kuistulla','Kille kirjoittaa osoitteen','Kille katsoo stopwatchia','Istumapaikka on tyhjä','Kille ei kävele','Kille ei nyökkää'])
  assert.ok(!one(text).some(c=>c.type==='motion'),text);
});

test('English verb forms, directions from/to and negation',()=>{
 for(const [text,value] of [['Mira walks left','walk-left'],['Mira walked to the right','walk-right'],['Mira strolls toward the camera','walk-front'],['Mira enters running from the right','run-left'],['Mira sprinted forward','run-front'],['Mira hops','jump'],['Mira squats','crouch'],['Mira sits down','sit'],['Mira waved','wave'],['Mira nodded','nod'],['Mira points at Niko','point'],['Mira clenches a fist','fist'],['Mira halts','stop'],['Mira gasps','react-surprise']] as const)
  assert.equal((one(text)[0] as any).value,value,text);
 assert.ok(!one('Mira does not move').some(c=>c.type==='motion'));
 assert.equal((one('Mira does not move')[0] as any).value,'still');
 assert.equal((one('Niko is not angry')[0] as any).type,'unknown');
});

test('names resolve through Finnish cases and pronouns; unknown names are never guessed',()=>{
 const r=new ScriptRecognizer(['Kille','Handu','Mira']);
 for(const t of ['Kille','Killen','Killeä','Killelle','Killeltä','Killellä','Killeen','Killestä','Killekin']) assert.equal(r.resolveActor(t,'fi'),'KILLE',t);
 for(const t of ['Handua','Handun','Handulle','Handuun']) assert.equal(r.resolveActor(t,'fi'),'HANDU',t);
 for(const t of ['Miraa','Miran','Miraan','Miralle']) assert.equal(r.resolveActor(t,'fi'),'MIRA',t);
 assert.equal(r.resolveActor('Kalle','fi'),undefined);assert.equal(r.resolveActor('hän','fi'),undefined,'no antecedent yet');
 r.clauses('Mira nyökkää','fi');assert.equal(r.resolveActor('hän','fi'),'MIRA');assert.equal(r.resolveActor('molemmat','fi'),ALL_ACTORS);
});

test('durations: digits, decimals with comma, ranges, Finnish and English number words, beats',()=>{
 for(const [text,seconds] of [['2 s',2],['0,5 sekuntia',.5],['noin 0,7 sekunnin hiljaisuus',.7],['1–2 s',2],['puoli sekuntia',.5],['kaksi sekuntia',2],['kolmen sekunnin ajan',3],['viisi sekuntia',5],['two seconds',2],['half a second',.5],['1.5 seconds',1.5],['500 ms',.5],['noin 0,5 sekuntiin',.5]] as const)
  assert.equal(parseDuration(text)?.seconds,seconds,text);
 assert.equal(parseDuration('noin 2 s')?.approximate,true);assert.equal(parseDuration('kaksi kertaa'),undefined);
 assert.equal((one('Beat.')[0] as any).seconds,.5);assert.equal((one('Pitkä tauko.')[0] as any).seconds,1.5);
});

test('shot vocabulary: Finnish compounds in any case, English abbreviations only in capitals',()=>{
 const r=(t:string)=>recognizeScript('KILLE:\n"Hei."\n\n'+t,['Kille','Handu']).lines[3];
 assert.equal(r('Lähikuva Killestä').shot?.[0].size,'close');assert.equal(r('puolikuva Handusta').shot?.[0].target,'HANDU');
 assert.equal(r('Yleiskuva').shot?.[0].size,'wide');assert.equal(r('ECU KILLE').shot?.[0].size,'close');
 assert.equal(r('Kamera: wide 0.5 s').shot?.[0].size,'wide');assert.equal(r('OTS HANDU').shot?.[0].angle,'over-shoulder');
 assert.equal(r('Kamera panoroi oikealle').shot?.[0].move,'pan');assert.equal(r('Kille takes a cu of coffee').shot,undefined);
});

test('state machine: production-notes block lasts until the next scene; comment blocks and preamble',()=>{
 const r=recognizeScript('Johdanto ennen jaksoa.\n\nKohtaus: Studio\nKILLE:\n"Hei."\nCharacter Animator -ohjaus\nKille tarvitsee katseen.\n0:05–0:08 — Uusi\nKille nyökkää.\n/* kommentti\njatkuu */\nKille vilkuttaa.',['Kille']);
 assert.equal(at(r,1).kind,'comment');assert.equal(at(r,3).kind,'scene-heading');assert.equal(at(r,6).state,'notes');assert.equal(at(r,7).kind,'comment');
 assert.equal(at(r,8).kind,'timecode');assert.equal(at(r,9).kind,'direction');assert.equal(at(r,10).kind,'comment');assert.equal(at(r,11).kind,'comment');assert.equal(clause(at(r,12),'motion').value,'wave');
});

test('strict grammar accepts recognised inflections only for a named, declared actor with a duration',()=>{
 const ok=parseRuleScript('Hahmo: Kille\nHahmo: Handu\nKille astelee vasemmalle 2 s\nKille nyökkäsi 1 s\nKille vilkaisee Handua 1 s\nKille hämmästyy 1 s');
 assert.deepEqual(ok.diagnostics,[]);assert.deepEqual(ok.commands.map(c=>c.kind+':'+c.value),['action:walk-left','action:nod','gaze:Handu','action:react-surprise']);
 for(const text of ['hän nyökkäsi 1 s','Kille ei nyökkää 1 s','Kille astelee 2 s','Kalle nyökkäsi 1 s','Kille nyökkäsi'])assert.ok(parseRuleScript('Hahmo: Kille\n'+text).diagnostics.length,text);
 assert.deepEqual(parseRuleScript('Hahmo: Kille\nKille pelkää 2 s').commands.map(c=>c.kind+':'+c.value),['expression:scared']);
});

test('free-form presentation uses the recogniser: inflected motion, gaze and expression become events, not review notes',()=>{
 const p=parsePresentation('Kohtaus: Studio\nMIRA:\n“Hei.”\nNIKO:\n“Moi.”\nNiko astelee vasemmalle 2 s.\nMira nyökkäsi.\nNiko hämmästyy.\nMira vilkaisee Nikoa.');
 const of=(line:number)=>p.events.filter(e=>e.sourceRef.line===line).map(e=>e.kind+':'+e.target+':'+e.value);
 assert.deepEqual(of(6),['action:NIKO:walk-left']);assert.deepEqual(of(7),['action:MIRA:nod']);assert.deepEqual(of(8),['action:NIKO:react-surprise']);assert.deepEqual(of(9),['gaze:MIRA:NIKO']);
 assert.equal(p.events.find(e=>e.sourceRef.line===6)?.seconds,2);
});

test('margin annotations show the recogniser reading and flag unrecognised lines',()=>{
 const rows=scanScriptLineAnnotations('KILLE:\n"Hei."\nKille kävelee vasemmalle 2 s.\nTämä on vain proosaa ilman ohjetta.');
 assert.equal(rows[1].right,'Repliikki');assert.equal(rows[2].right,'kävely ← 2 s');assert.equal(rows[3].unrecognized,true);
});
