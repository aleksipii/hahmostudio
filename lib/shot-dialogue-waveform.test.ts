import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildStudioExample} from './studio-example.ts';
import {createScene} from './scene-model.ts';
import {readProject} from './project-file.ts';
import {adaptPresentation} from './studio/domain.ts';
import {shotDialogueRail} from './shot-dialogue-waveform.ts';

test('studio motion example marks silent shots without fabricating waveform energy',async()=>{
 const load=async(name:string)=>readProject(new Blob([readFileSync(new URL('../public/library/'+name+'.hahmo',import.meta.url))]));
 const [kille,handu]=await Promise.all([load('Kille-Oma'),load('Handu-Oma')]);
 const built=buildStudioExample({kille:{doc:kille.doc,animation:kille.animation},handu:{doc:handu.doc,animation:handu.animation}},createScene({width:1080,height:1920}));
 const p=built.scene.presentations![0],shots=adaptPresentation(p).shots;
 assert.ok(shots.length>=3);
 for(const shot of shots){
  const rail=shotDialogueRail(p,shot);
  assert.equal(rail.shotId,shot.id);
  assert.equal(rail.hasDialogue,false);
  assert.ok(rail.levels.every(v=>v===0));
 }
});
