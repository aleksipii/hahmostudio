import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {captureFrame} from './capture-clock.ts';
import {cameraCaptureTimes,mixPerformance} from './performance-mixer.ts';
import {initialQuick,quickPoses} from './quick-animation.ts';
import {neutral} from './animation-model.ts';
import {readProject} from './project-file.ts';
import {keyframeRecordFrame,performanceTakeFrame} from './quick-recording-sync.ts';

test('analysis delay places head keyframes on capture time while arms follow the live tick',()=>{
 const startMs=1000,fps=24,maxFrame=48;
 const tickMs=1541;
 const timelineFrame=performanceTakeFrame(tickMs,startMs/1000,fps,maxFrame);
 assert.equal(timelineFrame,13);
 const headMs=1100;
 assert.equal(keyframeRecordFrame(headMs,timelineFrame,startMs,fps,maxFrame),2);
 assert.equal(keyframeRecordFrame(undefined,timelineFrame,startMs,fps,maxFrame),13);
});

test('camera offset shifts recorded face frames without moving keyboard-driven channels',async()=>{
 const p=await readProject(new Blob([readFileSync(new URL('../public/library/Ukko.hahmo',import.meta.url))]));
 const q={...p.doc.quick!,cameraOffsetMs:120},startMs=1000,fps=24,maxFrame=100;
 const sampleTimes=cameraCaptureTimes(q,{[q.roles.head]:neutral},1100,false,false);
 const tick=performanceTakeFrame(1200,startMs/1000,fps,maxFrame);
 assert.equal(sampleTimes[q.roles.head],1220);
 assert.equal(keyframeRecordFrame(sampleTimes[q.roles.head],tick,startMs,fps,maxFrame),5);
 assert.equal(keyframeRecordFrame(undefined,tick,startMs,fps,maxFrame),5);
});

test('speech tail keeps camera mouth until voice activity ends then microphone mouth follows RMS',async()=>{
 const p=await readProject(new Blob([readFileSync(new URL('../public/library/Ukko.hahmo',import.meta.url))]));
 const q={...p.doc.quick!,mouthSource:'auto' as const},camera={[q.roles.mouthOpen]:{...neutral,opacity:1,scale:1.3}};
 const silent=mixPerformance(p.animation,0,q,quickPoses(initialQuick(),q,p.animation.rig,1,0),camera,true,false);
 assert.equal(silent[q.roles.mouthOpen].scale,1.3);
 const s=initialQuick();
 s.energy=0.2;
 const quick=quickPoses(s,q,p.animation.rig,1,0);
 const talking=mixPerformance(p.animation,0,q,quick,camera,true,true);
 assert.ok(talking[q.roles.mouthOpen].opacity>0);
 assert.notEqual(talking[q.roles.mouthOpen].scale,1.3);
});

test('long sustained blink samples stay on timeline across simulated seconds',async()=>{
 const {facePoses,initialFaceFilter}=await import('./face-motion.ts');
 const p=await readProject(new Blob([readFileSync(new URL('../public/library/Pipsa.hahmo',import.meta.url))]));
 const q=p.doc.quick!,filter=initialFaceFilter(),base={x:.5,y:.5,width:.2,roll:0,blinkLeft:0,blinkRight:0,jaw:0};
 const fps=24,startMs=0;
 for(const sec of [0,1,2,3]){
  const poses=facePoses({...base,blinkLeft:.95,blinkRight:.95},base,q.roles,p.animation.rig,filter,sec) as Record<string,typeof neutral>;
  const frame=captureFrame(sec*1000+500,startMs,fps)!;
  assert.equal(poses[q.roles.leftBlink].opacity,1,`blink at ${sec}s`);
  assert.equal(poses[q.roles.leftPupil].opacity,0);
  assert.ok(frame>=sec*fps);
 }
});
