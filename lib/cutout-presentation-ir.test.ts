import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parsePresentation} from './presentation-parser.ts';
import {compilePresentation} from './presentation-compile.ts';
import {functions} from './presentation-model.ts';
import {buildCutoutTimelineFromPresentation,isCutoutPresentation} from './cutout/presentation-ir.ts';
import {validateRig,type Rig} from './cutout/model.ts';
import {frameState} from './cutout/renderer.ts';
import {parseScriptResourceManifest,validateScriptResources} from './script-resource-manifest.ts';
import {readProject} from './project-file.ts';

const readRig=(name:string)=>validateRig(JSON.parse(readFileSync(new URL('../public/library/cutout/'+name+'.rig.json',import.meta.url),'utf8')) as Rig);

test('script resource manifest validates backgrounds and applies design',()=>{
 const m=parseScriptResourceManifest('Resurssi tausta: cutout-street-v1\nResurssi hahmo KILLE: kille');
 assert.equal(validateScriptResources(m).length,0);
 assert.equal(m.resources[0].libraryId,'cutout-street-v1');
 const bad=parseScriptResourceManifest('Resurssi prop: sateenvarjo');
 assert.ok(validateScriptResources(bad).some(s=>s.includes('sateenvarjo')));
 const props=parseScriptResourceManifest('Resurssi esine: muki\nResurssi prop: table-prop-v1');
 assert.equal(validateScriptResources(props).length,0);
 assert.equal(props.resources[0].propId,'mug-prop-v1');
});

test('manifest props merge into presentation production',()=>{
 const text=`Resurssi esine: pöytä
Hahmo: Testi
Testi sanoo: "Hei." 1 s`;
 let p=parsePresentation(`#!kilsat\nResurssi hahmo TESTI: kille\n${text}`);
 p.bindings=[{speaker:p.characters[0],asset:'kille',voice:'Oma',side:'left',functions:Object.fromEntries(functions.map(f=>[f,'supported']))}];
 assert.ok(p.production?.props?.some(x=>x.asset==='table-prop-v1'));
});

test('presentation compiles to cutout IR with preset point and camera',async()=>{
 const kille=await readProject(new Blob([readFileSync(new URL('../public/library/Mr.Kille.hahmo',import.meta.url))]));
 const handu=await readProject(new Blob([readFileSync(new URL('../public/library/Mr.Handu.hahmo',import.meta.url))]));
 const assets={kille:{doc:kille.doc,animation:kille.animation},handu:{doc:handu.doc,animation:handu.animation}};
 const text=`#!kilsat
Resurssi tausta: cutout-studio-v1
Resurssi hahmo KILLE: kille
Resurssi hahmo HANDU: handu
Hahmo: Kille
Hahmo: Handu
Kohtaus: Studio
Tausta: studio 0.5 s
Kamera: laaja 0.5 s
Kille sanoo: "Hei!" 2 s
Samalla: Kille osoittaa 2 s
Handu sanoo: "Moi." 2 s
Samalla: Handu ilme: vihainen 2 s
Odota 1 s`;
 let p=parsePresentation(text);
 p.bindings=[
  {speaker:'KILLE',asset:'kille',voice:'Oma',side:'left',functions:Object.fromEntries(functions.map(f=>[f,f==='show_phone'?'none':'supported']))},
  {speaker:'HANDU',asset:'handu',voice:'Oma',side:'right',functions:Object.fromEntries(functions.map(f=>[f,f==='show_phone'?'none':'supported']))},
 ];
 p=compilePresentation(p,assets,24);
 assert.ok(isCutoutPresentation(p,assets));
 const packs={'Mr.Kille':{asset:'Mr.Kille' as const,rig:readRig('Mr.Kille')},'Mr.Handu':{asset:'Mr.Handu' as const,rig:readRig('Mr.Handu')}};
 const timeline=buildCutoutTimelineFromPresentation(p,assets,packs);
 assert.ok(timeline.events.some(e=>e.kind==='action'&&e.value==='POINT'));
 assert.ok(timeline.events.some(e=>e.kind==='emotion'&&e.value==='ANGRY'));
 assert.ok(timeline.duration>24);
 assert.equal(frameState(timeline,12).scene,'STUDIO');
});

test('fist and sit map to cutout IR actions',async()=>{
 const kille=await readProject(new Blob([readFileSync(new URL('../public/library/Mr.Kille.hahmo',import.meta.url))]));
 const assets={kille:{doc:kille.doc,animation:kille.animation}};
 const text=`#!kilsat
Resurssi hahmo KILLE: kille
Hahmo: Kille
Kohtaus: Studio
Kille nyrkki 1 s
Samalla: Kille istuu 2 s`;
 let p=parsePresentation(text);
 p.bindings=[{speaker:'KILLE',asset:'kille',voice:'Oma',side:'left',functions:Object.fromEntries(functions.map(f=>[f,'supported']))}];
 p=compilePresentation(p,assets,24);
 const packs={'Mr.Kille':{asset:'Mr.Kille' as const,rig:readRig('Mr.Kille')}};
 const timeline=buildCutoutTimelineFromPresentation(p,assets,packs);
 assert.ok(timeline.events.some(e=>e.kind==='action'&&e.value==='FIST'));
 assert.ok(timeline.events.some(e=>e.kind==='action'&&e.value==='SIT'));
});

test('manifest background image selects CUSTOM scene in cutout IR',async()=>{
 const kille=await readProject(new Blob([readFileSync(new URL('../public/library/Mr.Kille.hahmo',import.meta.url))]));
 const assets={kille:{doc:kille.doc,animation:kille.animation}};
 const text=`#!kilsat
Resurssi taustakuva: oma-tausta
Resurssi hahmo KILLE: kille
Hahmo: Kille
Kohtaus: Studio
Tausta: oma-tausta 1 s
Odota 1 s`;
 let p=parsePresentation(text);
 p.bindings=[{speaker:p.characters[0],asset:'kille',voice:'Oma',side:'left',functions:Object.fromEntries(functions.map(f=>[f,'supported']))}];
 p=compilePresentation(p,assets,24);
 assert.deepEqual(p.world.customBackgrounds?.['oma-tausta'],{asset:'oma-tausta'});
 const packs={'Mr.Kille':{asset:'Mr.Kille' as const,rig:readRig('Mr.Kille')}};
 const timeline=buildCutoutTimelineFromPresentation(p,assets,packs);
 assert.equal(frameState(timeline,0).scene,'CUSTOM:oma-tausta');
});

test('pack reaction clips map to cutout IR',async()=>{
 const kille=await readProject(new Blob([readFileSync(new URL('../public/library/Mr.Kille.hahmo',import.meta.url))]));
 const assets={kille:{doc:kille.doc,animation:kille.animation}};
 const text=`#!kilsat
Resurssi hahmo KILLE: kille
Hahmo: Kille
Kohtaus: Studio
Kille sanoo: "Hei!" 2 s
Samalla: Kille reaktio: nyökkäys 0.7 s`;
 let p=parsePresentation(text);
 p.bindings=[{speaker:p.characters[0],asset:'kille',voice:'Oma',side:'left',functions:Object.fromEntries(functions.map(f=>[f,'supported']))}];
 p=compilePresentation(p,assets,24);
 const packs={'Mr.Kille':{asset:'Mr.Kille' as const,rig:readRig('Mr.Kille')}};
 const timeline=buildCutoutTimelineFromPresentation(p,assets,packs);
 assert.ok(timeline.events.some(e=>e.kind==='action'&&e.value==='REACT_NOD'));
});

test('käteen annetut esineet piirtyvät kartonkihahmon kämmeneen, seuraavat sitä ja vapautettu esine jää paikalleen',async()=>{
 const kille=await readProject(new Blob([readFileSync(new URL('../public/library/Mr.Kille.hahmo',import.meta.url))]));
 const assets={kille:{doc:kille.doc,animation:kille.animation}};
 let p=parsePresentation(`#!kilsat\nResurssi hahmo KILLE: kille\nHahmo: Kille\nKohtaus: Studio\nTausta: studio 0.5 s\nKille sanoo: "Hei!" 2 s\nKille osoittaa 2 s\nOdota 2 s`);
 p.bindings=[{speaker:'KILLE',asset:'kille',voice:'Oma',side:'left',functions:Object.fromEntries(functions.map(f=>[f,f==='show_phone'?'none':'supported']))}];
 p=compilePresentation(p,assets,24);
 const ref={line:1,text:''},mk=(id:string,value:string,at:number):import('./presentation-model.ts').Event=>({id,kind:'prop',target:'KILLE',value,text:'rightHand',at,duration:0,sourceRef:ref,basis:'explicit',section:'x'} as never);
 p.events.push(mk('h1','hold:mug-prop-v1',.5),mk('h2','drop:mug-prop-v1',3));
 const packs={'Mr.Kille':{asset:'Mr.Kille' as const,rig:readRig('Mr.Kille')}},timeline=buildCutoutTimelineFromPresentation(p,assets,packs);
 assert.deepEqual(timeline.held,[{id:'mug-prop-v1',actor:'KILLE',hand:'rightHand',start:12,end:72}]);
 const art=JSON.parse(readFileSync(new URL('../public/library/cutout/Mr.Kille.art.json',import.meta.url),'utf8'));
 const {renderFrameSvg}=await import('./cutout/svg-renderer.ts');
 const frames=[2,20,40,80].map(f=>renderFrameSvg(timeline,f,{'Mr.Kille':art}));
 const count=(s:string)=>(s.match(/<ellipse/g)??[]).length;
 assert.ok(count(frames[1])>count(frames[0]),'esine näkyy kädessä');
 assert.ok(count(frames[3])>count(frames[0]),'vapautettu esine jää näkyviin');
 assert.notEqual(frames[1].match(/matrix\([^)]*\)" opacity="[^"]*" stroke="#000" stroke-width="0\.\d+"/)?.[0],undefined,'esineryhmä käyttää kämmenen matriisia');
});
