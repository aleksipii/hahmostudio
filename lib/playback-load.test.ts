import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {readProject,saveProject} from './project-file.ts';
import {buildStudioExample} from './studio-example.ts';
import {createScene} from './scene-model.ts';
import {flatten} from './psd-model.ts';
import {measurePresentationPlayback,PLAYBACK_VIEWPORTS,summarizeRenderTimings} from './playback-load.ts';
import {inspectRenderSnapshot} from './studio/render-contract.ts';
import {exportPresets} from './export-presets.ts';

async function studioCompiled(){
 const [kille,handu]=await Promise.all(['Kille-Oma','Handu-Oma'].map(async name=>{
  const p=await readProject(new Blob([readFileSync(new URL('../public/library/'+name+'.hahmo',import.meta.url))]));
  return {doc:p.doc,animation:p.animation};
 }));
 const built=buildStudioExample({kille,handu},createScene({width:1080,height:1920}));
 for(const pack of Object.values(built.assets))for(const n of flatten(pack.doc.layers))if(n.kind==='layer')n.image={key:n.key} as unknown as HTMLImageElement;
 const presentation=built.scene.presentations![0];
 return {presentation,assets:built.assets,doc:built.doc,animation:built.animation,scene:built.scene};
}

test('studio example playback render stays within regression budget across viewport sizes',async()=>{
 const {presentation,assets}=await studioCompiled();
 const fps=24,durationFrames=Math.ceil(presentation.seconds*fps);
 const frames=Array.from({length:36},(_,i)=>Math.min(durationFrames-1,Math.floor(i*durationFrames/36)));
 const report=measurePresentationPlayback(presentation,assets,{fps,durationFrames,frames});
 for(const vp of PLAYBACK_VIEWPORTS){
  const r=report.viewports[vp.label].render;
  assert.ok(r.frames===frames.length,vp.label);
  assert.ok(r.p95Ms<80,`${vp.label} p95 ${r.p95Ms} ms`);
  assert.ok(r.maxMs<150,`${vp.label} max ${r.maxMs} ms`);
 }
 const full=report.viewports['portrait-full'].render.p95Ms;
 const preview=report.viewports['preview-panel'].render.p95Ms;
 assert.ok(preview<=full*1.35,'preview viewport should not exceed full-frame cost disproportionately');
});

test('render preflight and snapshot inspection stay stable for the studio episode export slice',async()=>{
 const {doc,animation,scene}=await studioCompiled();
 const seconds=scene.presentations?.[0]?.seconds??9;
 const preset=exportPresets(scene.width,scene.height,animation.fps,seconds).find(p=>p.id==='project')!;
 const pack=await saveProject(doc,animation,undefined,scene);
 const bytes=new Uint8Array(await pack.arrayBuffer() as ArrayBuffer);
 const slice={...preset,start:0,end:seconds};
 const start=performance.now();
 const manifest=await inspectRenderSnapshot(bytes,slice);
 const preflightMs=performance.now()-start;
 assert.ok(manifest.expectedFrames>0);
 assert.ok(preflightMs<8000,'preflight '+preflightMs.toFixed(0)+' ms');
 assert.equal((await inspectRenderSnapshot(bytes,slice)).revisionId,manifest.revisionId);
});

test('summarizeRenderTimings reports p95 for synthetic spikes',()=>{
 const s=summarizeRenderTimings([1,1,1,1,40]);
 assert.equal(s.frames,5);
 assert.ok(s.p95Ms>=1);
 assert.equal(s.maxMs,40);
});
