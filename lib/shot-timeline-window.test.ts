import test from 'node:test';
import assert from 'node:assert/strict';
import {visibleShotWindow} from './shot-timeline-window.ts';

test('visibleShotWindow clamps to total shots and includes padding',()=>{
 assert.deepEqual(visibleShotWindow(0,0,800,80),{start:0,end:0,indices:[]});
 const w=visibleShotWindow(100,400,320,80,2);
 assert.equal(w.start,3);
 assert.ok(w.indices.length>=4);
 assert.ok(w.end<=100);
 assert.equal(w.indices[0],w.start);
});
