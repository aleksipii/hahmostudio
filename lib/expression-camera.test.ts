import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parsePresentation} from './presentation-parser.ts';
import {compilePresentation} from './presentation-compile.ts';
import {readProject} from './project-file.ts';
import {functions} from './presentation-model.ts';
import {sampleTrack} from './animation-model.ts';
import {parseRuleScript} from './script-grammar.ts';
import {ScriptRecognizer} from './script-recognizer.ts';

const script='Kohtaus: Studio\nMIRA:\n“Hei.”\nNIKO:\n“Moi.”\nMira hymyilee.\nOdota 1 s.\nMIRA:\n“Kiva nähdä.”\nOdota 1 s.\nNiko näyttää surulliselta.\nMira katsoo kameraan.\nOdota 1 s.\nMira näyttää vihaiselta.\nOdota 1 s.';
const pack=async(name:string)=>{const r=await readProject(new Blob([readFileSync(new URL('../public/library/'+name+'.hahmo',import.meta.url))]));return {doc:r.doc,animation:r.animation};};
async function compiled(mira:string,niko:string,tweak?:(assets:Record<string,any>)=>void){
 const p=parsePresentation(script),assets={mira:await pack(mira),niko:await pack(niko)};tweak?.(assets);
 p.bindings=p.characters.map((speaker,i)=>({speaker,asset:i?'niko':'mira',voice:'Imported voice '+i,side:i?'right':'left',functions:Object.fromEntries(functions.map(f=>[f,'supported']))}));
 p.audioClips=p.events.filter(e=>e.kind==='dialogue').map(e=>({id:'voice-'+e.id,dialogue:e.id,asset:'sound',start:0,end:1,duration:1,source:'volume' as const,mouth:[{time:0,shape:'rest' as const},{time:.1,shape:'open' as const},{time:.9,shape:'rest' as const}]}));
 p.direction!.requirements.forEach(r=>r.accepted=true);
 const c=compilePresentation(p,assets,24);return {c,assets};
}
const opacityAt=(c:any,speaker:string,role:string,seconds:number,roles:Record<string,string>)=>sampleTrack(c.actorAnimations[speaker].tracks.find((t:any)=>t.key===roles[role]),Math.round(seconds*24)).opacity;
const at=(c:any,line:number,kind:string)=>c.events.find((e:any)=>e.sourceRef.line===line&&e.kind===kind);

test('smile from the script shows the smile mouth, yields to speech and returns after the line until the next expression',async()=>{
 const {c,assets}=await compiled('Pipsa-3D','Ville-3D'),roles=assets.mira.doc.quick!.roles as Record<string,string>;
 const smile=at(c,6,'expression'),line=at(c,9,'dialogue'),angry=at(c,14,'expression');
 assert.equal(smile.value,'happy');assert.equal(angry.value,'angry');
 assert.equal(opacityAt(c,'MIRA','mouthSmile',0,roles),0,'smile hidden at rest');
 assert.equal(opacityAt(c,'MIRA','mouthSmile',smile.at+.01,roles),1);assert.equal(opacityAt(c,'MIRA','mouthNeutral',smile.at+.01,roles),0);
 assert.equal(opacityAt(c,'MIRA','mouthSmile',line.at+.5,roles),0,'speech owns the mouth');
 const clip=c.audioClips.find((a:any)=>a.dialogue===line.id)!;
 assert.equal(opacityAt(c,'MIRA','mouthSmile',line.at+clip.duration+.05,roles),1,'smile returns after the line');
 assert.equal(opacityAt(c,'MIRA','mouthSmile',angry.at+.05,roles),0,'a new expression ends the smile');assert.equal(opacityAt(c,'MIRA','mouthNeutral',angry.at+.05,roles),1);
 assert.ok(!c.diagnostics.some((d:any)=>d.code==='smile-missing'));
});

test('sadness tilts the inner brows up and lowers the gaze; camera gaze centres the pupils',async()=>{
 const {c,assets}=await compiled('Pipsa-3D','Ville-3D'),niko=assets.niko.doc.quick!.roles as Record<string,string>,mira=assets.mira.doc.quick!.roles as Record<string,string>;
 const sad=at(c,11,'expression'),frame=Math.round((sad.at+.05)*24),track=(sp:string,key:string)=>c.actorAnimations![sp].tracks.find((t:any)=>t.key===key);
 assert.equal(sad.value,'sad');
 const left=sampleTrack(track('NIKO',niko.leftBrow),frame),right=sampleTrack(track('NIKO',niko.rightBrow),frame);
 assert.ok(left.rotation<0&&right.rotation>0,'inner brow ends rise');assert.ok(left.y<0);
 assert.equal(sampleTrack(track('NIKO',niko.leftPupil),frame).y,4);
 const gaze=at(c,12,'gaze');assert.equal(gaze.value,'camera');
 const pupil=sampleTrack(track('MIRA',mira.leftPupil),Math.round((gaze.at+.05)*24));assert.equal(pupil.x,0);assert.equal(pupil.y,0);
 assert.ok(!c.diagnostics.some((d:any)=>d.code==='camera-gaze-profile'),'front view can look at the viewer');
});

test('a pack without a smile mouth warns instead of faking the expression',async()=>{
 // Paketti ilman hymysuuta: poistetaan mouthSmile-rooli kaikista kuvakulmista.
 const {c}=await compiled('Pipsa-3D','Ville-3D',a=>{const q=a.mira.doc.quick;delete q.roles.mouthSmile;for(const v of Object.values(q.views??{}))delete (v as any).mouthSmile;});
 assert.ok(c.diagnostics.some((d:any)=>d.code==='smile-missing'&&d.severity==='warning'));
});

test('recogniser, strict grammar and negation agree on smile, sadness and camera gaze',()=>{
 const r=new ScriptRecognizer(['Mira','Niko']);
 for(const [text,type,value] of [['Mira hymyilee','expression','happy'],['Niko smiles','expression','happy'],['Mira on iloinen','expression','happy'],['Niko itkee','expression','sad'],['Mira looks sad','expression','sad'],['Niko on alakuloinen','expression','sad'],['Mira katsoo kameraan','gaze','camera'],['Niko looks into the camera','gaze','camera'],['Katse kameraan','gaze','camera'],['Mira pelkää','expression','scared'],['Niko is terrified','expression','scared']] as const){
  const c=r.clauses(text,text.match(/[äö]|on |katse|katsoo|itkee|hymyilee/i)?'fi':'en')[0] as any;assert.equal(c.type,type,text);assert.equal(type==='gaze'?c.target:c.value,value,text);
 }
 assert.ok(!r.clauses('Mira ei hymyile','fi').some(c=>c.type==='expression'));
 const strict=parseRuleScript('Hahmo: Kille\nKille ilme: iloinen 1 s\nKille ilme: surullinen 1 s\nKille katsoo: kamera 1 s\nKille hymyilee 2 s\nKille katsoo kameraan 1 s');
 assert.deepEqual(strict.diagnostics,[]);assert.deepEqual(strict.commands.map(c=>c.kind+':'+c.value),['expression:happy','expression:sad','gaze:camera','expression:happy','gaze:camera']);
});

test('sadness uses the sad mouth and fear widens the eyes with a round mouth; gaze offsets survive later expressions',async()=>{
 const text='Kohtaus: Studio\nMIRA:\n“Hei.”\nNIKO:\n“Moi.”\nMira vilkaisee Nikoa.\nOdota 1 s.\nMira näyttää surulliselta.\nOdota 1 s.\nMira pelkää.\nOdota 1 s.\nMira hymyilee.\nOdota 1 s.';
 const p=parsePresentation(text),assets={mira:await pack('Pipsa-3D'),niko:await pack('Ville-3D')};
 p.bindings=p.characters.map((speaker,i)=>({speaker,asset:i?'niko':'mira',voice:'v'+i,side:i?'right':'left',functions:Object.fromEntries(functions.map(f=>[f,'supported']))}));
 p.audioClips=p.events.filter(e=>e.kind==='dialogue').map(e=>({id:'voice-'+e.id,dialogue:e.id,asset:'sound',start:0,end:1,duration:1,source:'volume' as const,mouth:[{time:0,shape:'rest' as const},{time:.9,shape:'rest' as const}]}));
 p.direction!.requirements.forEach(r=>r.accepted=true);
 const c=compilePresentation(p,assets,24),roles=assets.mira.doc.quick!.roles as Record<string,string>,track=(k:string)=>c.actorAnimations!.MIRA.tracks.find(t=>t.key===roles[k]);
 const ev=(line:number)=>c.events.find(e=>e.sourceRef.line===line&&e.kind!=='shot')!,f=(line:number)=>Math.round(((ev(line).at??0)+.05)*24);
 const gazeX=sampleTrack(track('leftPupil'),f(6)).x;assert.notEqual(gazeX,0,'looking at Niko moves the pupils');
 assert.equal(sampleTrack(track('mouthSad'),f(8)).opacity,1);assert.equal(sampleTrack(track('mouthNeutral'),f(8)).opacity,0);
 assert.equal(sampleTrack(track('leftPupil'),f(8)).x,gazeX,'sad keeps the horizontal gaze');assert.equal(sampleTrack(track('leftPupil'),f(8)).y,4);
 assert.equal(ev(10).value,'scared');assert.equal(sampleTrack(track('mouthRound'),f(10)).opacity,1);assert.equal(sampleTrack(track('mouthSad'),f(10)).opacity,0);
 assert.ok(sampleTrack(track('leftEye'),f(10)).scale>1);assert.ok(sampleTrack(track('leftPupil'),f(10)).scale<1);
 assert.equal(sampleTrack(track('leftEye'),f(12)).scale,1,'fear ends with the next expression');assert.equal(sampleTrack(track('mouthSmile'),f(12)).opacity,1);assert.equal(sampleTrack(track('mouthRound'),f(12)).opacity,0);
});

test('3D camera gaze centres each projected pupil on its projected eye white for any camera angle',async()=>{
 const {toonCameraGaze,centerOnEyeWhite}=await import('./toon-render.ts');
 const p=parsePresentation('Kohtaus: Studio\nMIRA:\n“Hei.”\nMira katsoo kameraan.\nOdota 1 s.\nMira vilkaisee puhelinta.');
 const gaze=p.events.find(e=>e.kind==='gaze'&&e.value==='camera')!;gaze.at=1;const later=p.events.find(e=>e.kind==='gaze'&&e.value==='phone');if(later)later.at=3;
 assert.equal(toonCameraGaze(p,'MIRA',.5),false);assert.equal(toonCameraGaze(p,'MIRA',1.5),true);assert.equal(toonCameraGaze(p,'MIRA',3.5),false);
 const white={id:'lefteye-white',color:'#fff',faces:[],vertices:[[0,0,0],[10,0,0],[10,10,0],[0,10,0]].map(position=>({position:position as [number,number,number],weights:[]}))} as any;
 for(const yaw of [0,.6,-1.2]){const project=(v:any)=>{const [x,y,z]=v.position;return [x*Math.cos(yaw)+z*Math.sin(yaw),y,-x*Math.sin(yaw)+z*Math.cos(yaw)] as [number,number,number];};
  const pupil:[number,number,number][]=[[8,3,4],[9,4,4],[8,5,4]].map(v=>project({position:v}));const depth=pupil.map(v=>v[2]);
  centerOnEyeWhite(pupil,white,project);const w=white.vertices.map(project);const mean=(l:number[][],i:number)=>l.reduce((s,v)=>s+v[i],0)/l.length;
  assert.ok(Math.abs(mean(pupil,0)-mean(w,0))<1e-9&&Math.abs(mean(pupil,1)-mean(w,1))<1e-9);assert.deepEqual(pupil.map(v=>v[2]),depth,'pupil stays in front of the eye white');}
});
