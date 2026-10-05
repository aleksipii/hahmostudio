import test from 'node:test';import assert from 'node:assert/strict';import {captureFrame} from './capture-clock.ts';
test('camera acquisition time does not inherit analysis delay',()=>{assert.equal(captureFrame(1100,1000,24),2);assert.equal(captureFrame(1450,1000,24),10);assert.equal(captureFrame(999,1000,24),undefined);assert.equal(captureFrame(1000,1000,60),0);});
test('invalid capture clocks are rejected before creating keyframes',()=>{for(const tuple of [[NaN,0,24],[1,Infinity,24],[1,0,0],[1,0,-1]])assert.throws(()=>captureFrame(...tuple as [number,number,number]));});
