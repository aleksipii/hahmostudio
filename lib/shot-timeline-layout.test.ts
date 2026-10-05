import test from 'node:test';
import assert from 'node:assert/strict';
import {ticks,type Shot} from './studio/domain.ts';
import {shotTimelinePlayhead,shotTimelineSegments,visibleShotSegments} from './shot-timeline-layout.ts';

test('shot timeline width scales with duration and playhead follows time',()=>{
 const shots:Pick<Shot,'id'|'duration'|'at'>[]=[{id:'a',duration:ticks(2),at:ticks(0)},{id:'b',duration:ticks(4),at:ticks(2)}];
 const {segments,trackWidth}=shotTimelineSegments(shots as Shot[]);
 assert.ok(segments[1]!.width>segments[0]!.width);
 assert.ok(trackWidth>segments[0]!.width+segments[1]!.width);
 assert.equal(shotTimelinePlayhead(segments,6,1),segments[0]!.width/2);
 assert.equal(shotTimelinePlayhead(segments,6,3),segments[1]!.left+segments[1]!.width/4);
 const visible=visibleShotSegments(segments,segments[1]!.left,200);
 assert.ok(visible.some(s=>s.id==='b'));
});
