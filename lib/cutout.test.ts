import test from 'node:test';
import assert from 'node:assert/strict';
import {parseScript,compileScript} from './cutout/parser.ts';
import {validateRig,type Rig,type Actor} from './cutout/model.ts';
import {layerMatrices,visibleLayers} from './cutout/hierarchy.ts';
import {heldFrame,blinking} from './cutout/motion.ts';
import {rhubarbVisemes,visemeFrames} from './cutout/lip-sync.ts';
import {frameState,serializeFrames} from './cutout/renderer.ts';
const rig:Rig={version:1,width:400,height:600,layers:[{id:'ROOT',pivot:[0,0],bounds:[0,0,400,600],z:0},{id:'TORSO',parent:'ROOT',pivot:[.5,.2],bounds:[100,200,200,200],z:1},{id:'HEAD_GROUP',parent:'TORSO',pivot:[.5,.05],bounds:[100,0,200,200],z:2}]};
const actors:Actor[]=[{id:'Kille',asset:'Kille',x:200,y:900,scale:1,rig},{id:'Mr.Handu',asset:'Mr.Handu',x:600,y:900,scale:1,rig}];
test('explicit combined commands preserve dialogue and reject unknown instructions',()=>{const e=parseScript('Kille: "Hei" [ACTION: POINT, EMOTION: ANGRY]');assert.deepEqual(e.map(e=>e.kind),['dialogue','action','emotion']);assert.throws(()=>parseScript('[ACTION: POINT]'));assert.throws(()=>parseScript('[MAGIC: anything]'));});
test('measured durations are required and two actors produce reproducible frame JSON',()=>{const source='Kille: "Hei"\nMr.Handu: "Moi"';assert.throws(()=>compileScript(source,actors,{}));const t=compileScript(source,actors,{'line-1-dialogue':1,'line-2-dialogue':2});assert.equal(t.duration,72);assert.equal(frameState(t,0).actors.length,2);assert.equal(JSON.stringify(serializeFrames(t)),JSON.stringify(serializeFrames(t)));assert.throws(()=>frameState(t,72));});
test('parent rotation moves the child and pivot remains fixed',()=>{const m=layerMatrices(rig,{TORSO:90});const point=(x:number,y:number)=>[m.HEAD_GROUP[0]*x+m.HEAD_GROUP[2]*y+m.HEAD_GROUP[4],m.HEAD_GROUP[1]*x+m.HEAD_GROUP[3]*y+m.HEAD_GROUP[5]];assert.deepEqual(point(200,240).map(Math.round),[200,240]);assert.deepEqual(point(200,100).map(Math.round),[340,240]);assert.throws(()=>validateRig({...rig,layers:rig.layers.map(l=>l.id==='ROOT'?{...l,parent:'HEAD_GROUP'}:l)}));});
test('twos, threes and alternating three/two holds are exact',()=>{assert.deepEqual(Array.from({length:10},(_,i)=>heldFrame(i,'three-two')),[0,0,0,3,3,5,5,5,8,8]);assert.equal(heldFrame(5,'twos'),4);assert.equal(heldFrame(5,'threes'),3);const blinks=Array.from({length:1000},(_,f)=>blinking('Kille',f));assert.ok(blinks.some(Boolean));for(let f=1;f<999;f++)if(blinks[f]&&!blinks[f-1])assert.ok(blinks[f+1]&&!blinks[f+2]);});
test('walk endpoint survives subsequent idle frames',()=>{const t=compileScript('Kille: "Hei" [ACTION: WALK_RIGHT]\n[HOLD: 1]',actors,{'line-1-dialogue':1,'line-1-1':1});const at=frameState(t,48).actors[0].layers.find(l=>l.id==='ROOT')!;const later=frameState(t,60).actors[0].layers.find(l=>l.id==='ROOT')!;assert.equal(at.matrix[4],248);assert.equal(later.matrix[4],248);});
test('switch layers select exactly one state and mouth mapping is explicit',()=>{const r={...rig,layers:[...rig.layers,{id:'M_REST',parent:'HEAD_GROUP',pivot:[0,0] as [number,number],bounds:[0,0,1,1] as [number,number,number,number],z:3,switch:'MOUTH_SWITCH',state:'REST',default:true},{id:'M_AI',parent:'HEAD_GROUP',pivot:[0,0] as [number,number],bounds:[0,0,1,1] as [number,number,number,number],z:4,switch:'MOUTH_SWITCH',state:'AI'}]};assert.deepEqual(visibleLayers(r,{MOUTH_SWITCH:'AI'}).slice(-2).map(l=>l.opacity),[0,1]);assert.equal(rhubarbVisemes.A,'REST');assert.equal(rhubarbVisemes.D,'AI');assert.deepEqual(visemeFrames({mouthCues:[{start:0,end:.125,value:'D'}]},.25),['AI','AI','AI','REST','REST','REST']);});

import {readFileSync} from 'node:fs';
import {readAnimationPackage,readRenderedFrames} from './cutout/read.ts';
import {renderFrameSvg} from './cutout/svg-renderer.ts';
import {readProject,saveProject} from './project-file.ts';
import {parsePresentation} from './presentation-parser.ts';
import {compilePresentation} from './presentation-compile.ts';
import {functions} from './presentation-model.ts';
import {sampleTrack} from './animation-model.ts';
import {quickPoses,initialQuick} from './quick-animation.ts';
import {animationTransforms} from './animation-transform.ts';
test('cutout hips, legs and shoulders remain attached during torso and limb motion',async()=>{
 for(const name of ['Mr.Kille','Mr.Handu']){
  const {animation}=await readProject(new Blob([readFileSync(new URL('../public/library/'+name+'.hahmo',import.meta.url))]));
  const parts=new Map(animation.rig.parts.map(p=>[p.key,p]));
  assert.equal(parts.get('PANTS')!.parentKey,'TORSO');
  assert.deepEqual(parts.get('TORSO')!.pivot,{x:200,y:430});
  assert.deepEqual(parts.get('PANTS')!.pivot,{x:200,y:445});
  const pose={x:35,y:-12,rotation:17,scale:1,opacity:1};
  const transforms=animationTransforms(animation,0,{key:'TORSO',pose});
  const torso=transforms.get('TORSO')!;
  const point=(t:typeof torso,x:number,y:number)=>[t.a*x+t.c*y+t.e,t.b*x+t.d*y+t.f];
  for(const side of ['LEFT','RIGHT']){
   assert.equal(parts.get('LEG_'+side)!.parentKey,'PANTS');
   for(const id of ['PANTS','LEG_'+side,'ARM_'+side+'_UPPER','HEAD_GROUP'])assert.deepEqual(point(transforms.get(id)!,200,445),point(torso,200,445));
   const arm=parts.get('ARM_'+side+'_UPPER')!;assert.deepEqual(arm.pivot,{x:side==='LEFT'?110:290,y:290});
   const rotated=animationTransforms(animation,0,{key:arm.key,pose:{x:0,y:0,rotation:90,scale:1,opacity:1}});
   for(const id of [arm.key,'ARM_'+side+'_HAND','HAND_'+side+'_DEFAULT']){
    const actual=point(rotated.get(id)!,arm.pivot.x,arm.pivot.y);
    assert.ok(Math.abs(actual[0]-arm.pivot.x)<1e-9&&Math.abs(actual[1]-arm.pivot.y)<1e-9);
   }
  }
 }
});
const readAsset=(name:string,suffix:string)=>JSON.parse(readFileSync(new URL('../public/library/cutout/'+name+suffix,import.meta.url),'utf8'));
test('quoted dialogue preserves apostrophes and command-like text verbatim',()=>{assert.equal(parseScript('Kille: "I don\'t need [ACTION: POINT, EMOTION: ANGRY]."')[0].value,"I don't need [ACTION: POINT, EMOTION: ANGRY].");});
test('original cutout packs keep specified normalized pivots and actual neck/shoulder anchors',()=>{for(const name of ['Mr.Kille','Mr.Handu']){const r=validateRig(readAsset(name,'.rig.json'));const h=r.layers.find(l=>l.id==='HEAD_GROUP')!;assert.deepEqual(h.pivot,[.5,.05]);const anchor=h.pivotFrame!;assert.equal(anchor[1]+anchor[3]*h.pivot[1],244);const a=r.layers.find(l=>l.id==='ARM_LEFT_UPPER')!;assert.deepEqual(a.pivot,[.15,.85]);assert.equal(a.pivotFrame![1]+a.pivotFrame![3]*a.pivot[1],290);const m=layerMatrices(r,{HEAD_GROUP:25}),neck=[m.HEAD_GROUP[0]*200+m.HEAD_GROUP[2]*244+m.HEAD_GROUP[4],m.HEAD_GROUP[1]*200+m.HEAD_GROUP[3]*244+m.HEAD_GROUP[5]];assert.ok(Math.abs(neck[0]-200)<1e-9&&Math.abs(neck[1]-244)<1e-9);assert.ok(555/220>=2.5&&555/220<=3);}});
test('timeline and complete frame JSON roundtrip reject malformed states',()=>{const t=compileScript('Kille: "Hei"',actors,{'line-1-dialogue':.25});assert.equal(readAnimationPackage(JSON.stringify({timeline:t,voices:{'line-1-dialogue':['AI','REST']}})).timeline.duration,6);const data=serializeFrames(t);assert.equal(readRenderedFrames(JSON.stringify(data)).frames.length,6);data.frames[0].actors[0].layers[0].matrix[0]=NaN;assert.throws(()=>readRenderedFrames(JSON.stringify(data)));assert.throws(()=>readAnimationPackage(JSON.stringify({timeline:t,voices:{unknown:['AI']}})));assert.throws(()=>validateRig({...rig,layers:[null] as any}));});
test('blink hides pupils and flat rest-mouth strokes survive SVG filter bounds',()=>{const r=readAsset('Mr.Kille','.rig.json'),art=readAsset('Mr.Kille','.art.json'),a:Actor={...actors[0],asset:'Mr.Kille',rig:r};const t=compileScript('Kille: "Hei"',[a],{'line-1-dialogue':6});const f=Array.from({length:144},(_,i)=>i).find(i=>blinking('Kille',i))!;assert.ok(f>=72);const state=frameState(t,f);assert.equal(state.actors[0].layers.find(l=>l.id==='PUPIL_LEFT')?.opacity,0);const svg=renderFrameSvg(t,0,{'Mr.Kille':art});assert.ok(svg.includes('filterUnits="userSpaceOnUse"'));assert.ok(svg.includes(art.layers.MOUTH_REST));assert.throws(()=>renderFrameSvg(t,0,{}));});
test('current editor compiles nine-mouth phonemes and preserves them on project save',async()=>{const r=await readProject(new Blob([readFileSync(new URL('../public/library/Mr.Kille.hahmo',import.meta.url))]));const q=r.doc.quick!,p=parsePresentation('Kohtaus: cutout-studio-v1\nKILLE:\n“Hello.”');p.bindings=[{speaker:'KILLE',asset:'kille',voice:'Own',side:'left',functions:Object.fromEntries(functions.map(f=>[f,f==='show_phone'?'none':'supported']))}];const e=p.events.find(e=>e.kind==='dialogue')!;p.audioClips=[{id:'clip',asset:'voice',dialogue:e.id,start:0,end:1,duration:1,source:'viseme',mouth:[{time:0,shape:'open',viseme:'E'},{time:.5,shape:'open',viseme:'FV'},{time:1,shape:'rest',viseme:'REST'}]}];const compiled=compilePresentation(p,{kille:{doc:r.doc,animation:r.animation}},24),a=compiled.actorAnimations!.KILLE;for(const [frame,selected] of [[0,'mouthE'],[12,'mouthFV']] as const){for(const role of ['mouthNeutral','mouthOpen','mouthRound','mouthE','mouthU','mouthMBP','mouthFV','mouthConsonants','mouthL'])assert.equal(sampleTrack(a.tracks.find(t=>t.key===q.roles[role]),frame).opacity,role===selected?1:0);}assert.equal(sampleTrack(a.tracks.find(t=>t.key==='EYES_ANGRY'),0).opacity,0);const live=quickPoses(initialQuick(),q,r.animation.rig,0);assert.equal(live.MOUTH_FV.opacity,0);assert.equal(live.EYES_ANGRY.opacity,0);const packed=await saveProject({...r.doc,presentationAssets:{kille:{doc:r.doc,animation:r.animation}},presentationAudio:{voice:{name:'test.wav',blob:new Blob([new Uint8Array(44)],{type:'audio/wav'})}}},{...r.animation,duration:24},undefined,{...r.scene,presentations:[],presentationDraft:compiled});const reopened=await readProject(packed);assert.equal(reopened.scene.presentationDraft!.audioClips[0].mouth[1].viseme,'FV');});
test('rendered gait keeps two down frames and three up frames under stepped cadence',()=>{const t=compileScript('Kille: "Hi" [ACTION: WALK_RIGHT]',actors,{'line-1-dialogue':1,'line-1-1':1},'three-two');const ys=Array.from({length:5},(_,i)=>frameState(t,24+i).actors[0].layers.find(l=>l.id==='ROOT')!.matrix[5]);assert.deepEqual(ys,[900,900,896,896,896]);});
