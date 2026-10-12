import test from 'node:test';import assert from 'node:assert/strict';
import {trappedFocusTarget} from './dialog-focus.ts';

test('Tab wraps inside a modal and pulls escaped focus back in',()=>{
 const items=['a','b','c'];
 assert.equal(trappedFocusTarget(items,'c',true,false),'a');
 assert.equal(trappedFocusTarget(items,'a',true,true),'c');
 assert.equal(trappedFocusTarget(items,'b',true,false),null);
 assert.equal(trappedFocusTarget(items,'b',true,true),null);
 assert.equal(trappedFocusTarget(items,'outside',false,false),'a');
 assert.equal(trappedFocusTarget(items,'outside',false,true),'c');
 assert.equal(trappedFocusTarget(items,'dialog',true,false),'a','focused container moves to first control');
 assert.equal(trappedFocusTarget(items,null,false,false),'a');
 assert.equal(trappedFocusTarget([],'a',true,false),null);
});
