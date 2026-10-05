import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sampleBezierCurve,EASING_PRESETS,validateBezierCurve} from './easing-model.ts';
import {sampleTrack,createAnimation,validateAnimation,neutral} from './animation-model.ts';
import {createStateMachine,evaluateConditions,parameterId,validateStateMachine} from './state-machine-model.ts';
import {createRig} from './rig-model.ts';
import type {PsdDocument} from './psd-model.ts';
const doc={name:'test',width:100,height:100,layers:[{key:'a',path:'a',name:'a',kind:'layer',children:[],left:0,top:0,width:100,height:100,opacity:1,visible:true}]} as unknown as PsdDocument;
test('Bezier evaluation, preset timing and malformed coordinates',()=>{
 for(const x of [.1,.5,.9])assert.ok(Math.abs(sampleBezierCurve(EASING_PRESETS.linear.curve,x)-x)<1e-7);
 assert.ok(sampleBezierCurve(EASING_PRESETS.easeIn.curve,.5)<.5);
 assert.ok(sampleBezierCurve(EASING_PRESETS.easeOut.curve,.5)>.5);
 assert.ok(validateBezierCurve({cp1:{x:NaN,y:0},cp2:{x:1,y:1}}).length);
});
test('custom easing and machine survive animation validation; holds remain holds',()=>{
 const animation=createAnimation(createRig(doc));animation.stateMachine=createStateMachine('a');
 animation.tracks=[{key:'a',frames:[{...neutral,frame:0,easing:'linear',bezierCurve:EASING_PRESETS.easeIn.curve},{...neutral,x:100,frame:100,easing:'linear'}]}];
 const normalized=validateAnimation(JSON.parse(JSON.stringify(animation)),doc);
 assert.deepEqual(normalized.stateMachine,animation.stateMachine);
 assert.deepEqual(normalized.tracks[0].frames[0].bezierCurve,EASING_PRESETS.easeIn.curve);
 assert.ok(sampleTrack(normalized.tracks[0],50).x<50);
 normalized.tracks[0].frames[0].easing='hold';assert.equal(sampleTrack(normalized.tracks[0],50).x,0);
 normalized.tracks[0].frames[0].bezierCurve!.cp1.x=2;assert.throws(()=>validateAnimation(normalized,doc));
});
test('state conditions preserve enum values and invalid state metadata is rejected',()=>{
 assert.equal(evaluateConditions([{paramId:parameterId('mood'),op:'eq',value:'happy'}],{mood:'happy'}),true);
 const machine=createStateMachine('a');machine.states[0].speed=NaN;assert.ok(validateStateMachine(machine).length);
});
