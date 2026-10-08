import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readProject} from './project-file.ts';
import {parseScreenplay,buildScreenplay} from './screenplay.ts';
import {sampleTrack} from './animation-model.ts';

test('takanäkymä: [hahmo takaa] valitsee 4-kulmaisen hahmon selkäpuolen ja kasvotasot ovat tyhjiä mutta olemassa',async()=>{
 const p=await readProject(new Blob([readFileSync(new URL('../public/library/Taru-3D.hahmo',import.meta.url))])),q=p.doc.quick!;
 assert.ok(q.views?.back,'takanäkymä on profiilissa');
 for(const tag of ['hahmo takaa','hahmo selin','view back']){
  const plan=parseScreenplay(`[${tag}]\n[vilkuta 1s]`);assert.equal(plan.beats[0].view,'back',tag);
  const out=buildScreenplay(p.animation,q,p.scene,plan),at=out.start+5;
  assert.equal(sampleTrack(out.animation.tracks.find(t=>t.key===q.views!.back!.root),at).opacity,1,tag);
  for(const v of ['front','right','left'] as const)assert.equal(sampleTrack(out.animation.tracks.find(t=>t.key===q.views![v]!.root),at).opacity,0,tag+' '+v);
 }
 const parts=p.animation.rig.parts,back=q.views!.back!,front=q.views!.front!;
 const part=(k:string)=>parts.find(x=>x.key===k)!;
 assert.equal(part(back.rightHand).pivot.x,600-part(front.rightHand).pivot.x,'takaa hahmon oikea käsi on katsojan oikealla');
 assert.equal(part(back.rightHand).pivot.y,part(front.rightHand).pivot.y,'nivelkorkeudet pysyvät 3D-luurangon mukaisina');
});
