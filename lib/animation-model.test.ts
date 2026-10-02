import {test} from 'node:test';import assert from 'node:assert/strict';import {sampleTrack,neutral,createAnimation,putKeyframe,readAnimation,removeKeyframe} from './animation-model.ts';import {createRig} from './rig-model.ts';import type {PsdDocument} from './psd-model.ts';
const doc:PsdDocument={name:'test.psd',width:640,height:480,size:0,warnings:[],layers:[{key:'0',psdId:7,name:'Head',path:'Head',kind:'layer',left:100,top:50,width:80,height:100,opacity:1,visible:true,blendMode:'normal',children:[],warnings:[]}]};
test('interpolation, hold, and endpoint sampling',()=>{
 const track={key:'0',frames:[{...neutral,frame:0,easing:'linear' as const},{...neutral,x:100,rotation:90,scale:2,opacity:.5,frame:10,easing:'linear' as const}]};
 assert.equal(sampleTrack(track,5).x,50);assert.equal(sampleTrack(track,5).rotation,45);assert.equal(sampleTrack(track,5).scale,1.5);assert.equal(sampleTrack(track,5).opacity,.75);assert.equal(sampleTrack(track,-10).x,0);assert.equal(sampleTrack(track,100).x,100);assert.deepEqual(sampleTrack(undefined,5),neutral);
 const hold={...track,frames:track.frames.map((k,i)=>({...k,easing:i===0?'hold' as const:'linear' as const}))};assert.equal(sampleTrack(hold,9).x,0);assert.equal(sampleTrack(hold,10).x,100);
 const smooth={...track,frames:track.frames.map(k=>({...k,easing:'smooth' as const}))};assert.equal(sampleTrack(smooth,2).x,10.400000000000002);
});
test('keyframe updates sort, replace and remove without mutating previous state',()=>{
 const a=createAnimation(createRig(doc));const b=putKeyframe(a,'0',{...neutral,frame:10,easing:'smooth'});const c=putKeyframe(b,'0',{...neutral,x:20,frame:0,easing:'linear'});const d=putKeyframe(c,'0',{...neutral,x:50,frame:10,easing:'linear'});
 assert.equal(a.tracks.length,0);assert.deepEqual(d.tracks[0].frames.map(k=>k.frame),[0,10]);assert.equal(d.tracks[0].frames[1].x,50);assert.equal(removeKeyframe(d,'0',10).tracks[0].frames.length,1);assert.equal(d.tracks[0].frames.length,2);
});
test('animation round trip and stable ID remapping',()=>{
 const a=putKeyframe(createAnimation(createRig(doc)),'0',{...neutral,x:42,frame:0,easing:'smooth'});assert.deepEqual(readAnimation(JSON.stringify(a),doc),a);const other=structuredClone(doc);other.layers[0].key='new';other.layers[0].path='renamed';const imported=readAnimation(JSON.stringify(a),other);assert.equal(imported.tracks[0].key,'new');assert.equal(imported.tracks[0].frames[0].x,42);
});
test('invalid animation imports reject duplicate tracks, duplicate frames, invalid poses and duration',()=>{
 for(const modify of [(a:any)=>a.fps=0,(a:any)=>a.duration=1,(a:any)=>a.tracks[0].frames[0].scale=0,(a:any)=>a.tracks[0].frames[0].frame=120,(a:any)=>a.tracks.push(a.tracks[0]),(a:any)=>a.tracks[0].frames.push(a.tracks[0].frames[0]),(a:any)=>a.tracks[0].frames[0].opacity=2,(a:any)=>a.tracks[0].key='missing']){const a=putKeyframe(createAnimation(createRig(doc)),'0',{...neutral,frame:0,easing:'linear'});modify(a);assert.throws(()=>readAnimation(JSON.stringify(a),doc));}
});
