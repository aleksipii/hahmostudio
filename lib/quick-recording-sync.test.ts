import test from 'node:test';
import assert from 'node:assert/strict';
import {captureFrame} from './capture-clock.ts';
import {keyframeRecordFrame,performanceTakeFrame} from './quick-recording-sync.ts';

test('performance take frame matches legacy rounded timeline indexing',()=>{
 assert.equal(performanceTakeFrame(1541,1,24,48),13);
 assert.equal(performanceTakeFrame(1000,1,24,48),0);
});

test('keyframe record frame prefers acquisition ms for camera channels',()=>{
 const startMs=1000,fps=24,max=100;
 assert.equal(keyframeRecordFrame(1100,99,startMs,fps,max),captureFrame(1100,startMs,fps,max));
 assert.equal(keyframeRecordFrame(undefined,7,startMs,fps,max),7);
});
