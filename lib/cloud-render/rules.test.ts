import {test} from 'node:test';import assert from 'node:assert/strict';
import {CanonicalStore,RuleEngine,RuleViolation,validateCanonicalState,stateAtSceneStart} from './canonical.ts';
import {buildAIContext} from './ai-context.ts';
import {canon} from './test-fixtures.ts';

test('canonical fixture validates and replays',()=>{const s=validateCanonicalState(canon());assert.equal(stateAtSceneStart(s,'scene_002').characters.alice.holding[0],'cup_01');});
test('closed world: unknown references and prototype keys are rejected',()=>{
 const a=canon();a.scenes.scene_001.characterIds.push('bob');assert.throws(()=>validateCanonicalState(a),RuleViolation);
 const b=canon();b.scenes.scene_001.events[0].target='constructor';assert.throws(()=>validateCanonicalState(b),RuleViolation);
 const c=canon();c.scenes.scene_001.events[0].action='fly';assert.throws(()=>validateCanonicalState(c),/not allowed/);
});
test('canon with an impossible history is rejected',()=>{const s=canon();s.scenes.scene_001.events.push({id:'e9',at:6,actor:'alice',action:'pick_up',target:'cup_01'});assert.throws(()=>validateCanonicalState(s),/already held/);});
test('overlapping scenes and events outside the window are rejected',()=>{const s=canon();s.scenes.scene_002.start=9;assert.throws(()=>validateCanonicalState(s),/overlap/);const t=canon();t.scenes.scene_001.events[0].at=11;assert.throws(()=>validateCanonicalState(t),/outside/);});
test('only the rule engine commits state transitions',()=>{
 const base=canon();base.scenes.scene_001.events=[];base.scenes.scene_002.events=[];const store=new CanonicalStore(base),engine=new RuleEngine(store);
 const snap=store.get();assert.throws(()=>{(snap.characters.alice.attributes as Record<string,unknown>).hair='blonde';},TypeError);
 assert.equal(store.get().characters.alice.attributes.hair,'black');
 assert.throws(()=>engine.commit({actor:'alice',action:'pick_up',target:'cup_99'}),RuleViolation);
 assert.throws(()=>engine.commit({actor:'alice',action:'fly'}),RuleViolation);
 assert.equal(store.get().revision,1);
 const next=engine.commit({actor:'alice',action:'pick_up',target:'cup_01'});
 assert.throws(()=>engine.commit({actor:'alice',action:'pick_up',target:'cup_01'}),/already held/);
 assert.equal(next.revision,2);assert.deepEqual(next.characters.alice.holding,['cup_01']);assert.equal(next.props.cup_01.heldBy,'alice');
});
test('AI context is frozen, scene-scoped and derived from canon',()=>{
 const c=buildAIContext(validateCanonicalState(canon()),'scene_001');
 assert.deepEqual(c.canonicalCharacters.map(x=>x.id),['alice']);assert.equal(c.canonicalLocations[0].id,'kitchen');
 assert.throws(()=>{(c.canonicalCharacters[0] as {name:string}).name='Mallory';},TypeError);
 assert.ok(c.continuityConstraints.some(x=>x.kind==='attribute'&&x.key==='hair'&&x.value==='black'));
 assert.equal(JSON.stringify(c).includes('policy'),false);
});
