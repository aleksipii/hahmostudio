import {own,replay,stateAtSceneStart,applyAction,RuleViolation,type CanonicalState} from './canonical.ts';
import type {AISceneSuggestion} from './ai-suggestion.ts';

export type Issue={layer:number;code:string;message:string;path?:string};
const L=6;
/** Layer 6. Compares the scene against the state carried in from previous scenes and replays approved events. */
export function validateContinuity(state:CanonicalState,sceneId:string,suggestion?:AISceneSuggestion):Issue[]{
 const out:Issue[]=[],sc=own(state.scenes,sceneId);if(!sc)return[{layer:L,code:'scene-unknown',message:`Unknown scene "${sceneId}".`}];
 let start:CanonicalState;try{start=stateAtSceneStart(state,sceneId);}catch(e){return[{layer:L,code:'canon-replay',message:`Canonical history cannot be replayed: ${(e as Error).message}`}];}
 for(const id of sc.characterIds){
  const c=start.characters[id];
  if(c.location!==sc.locationId){
   const approved=sc.approvedTransitions.some(t=>t.characterId===id&&t.from===c.location)||sc.events.some(e=>e.actor===id&&e.action==='move_to'&&e.target===sc.locationId);
   if(!approved)out.push({layer:L,code:'continuity-location',message:`"${id}" is in "${c.location}" but the scene is in "${sc.locationId}" without an approved transition.`});
  }
 }
 for(const id of sc.propIds){const p=start.props[id];if(p.heldBy&&!sc.characterIds.includes(p.heldBy))out.push({layer:L,code:'continuity-prop',message:`Prop "${id}" is held by "${p.heldBy}", who is not in this scene.`});}
 // Replay the scene's own approved events to make sure the scene is internally consistent.
 const run=structuredClone(start);try{for(const e of [...sc.events].sort((a,b)=>a.at-b.at))applyAction(run,e);}catch(e){out.push({layer:L,code:'continuity-replay',message:(e as RuleViolation).message});}
 if(!suggestion)return out;
 const track=structuredClone(start),events=[...sc.events].sort((a,b)=>a.at-b.at);
 const acts=suggestion.characterActions.map((a,i)=>({a,i})).sort((x,y)=>(x.a.at??sc.start)-(y.a.at??sc.start));
 let ei=0;
 for(const {a,i} of acts){
  const t=a.at??sc.start;
  while(ei<events.length&&events[ei].at<=t){try{applyAction(track,events[ei]);}catch{/* already reported */}ei++;}
  const c=own(track.characters,a.id);if(!c)continue;
  if(a.claimedLocation!==undefined&&a.claimedLocation!==c.location)out.push({layer:L,code:'continuity-location-claim',message:`AI places "${a.id}" in "${a.claimedLocation}" but canon has "${c.location}" at that time.`,path:`characterActions[${i}].claimedLocation`});
  if(a.claimedHolding!==undefined&&[...a.claimedHolding].sort().join()!==[...c.holding].sort().join())out.push({layer:L,code:'continuity-holding',message:`AI claims "${a.id}" holds [${a.claimedHolding.join(', ')}] but canon has [${c.holding.join(', ')}].`,path:`characterActions[${i}].claimedHolding`});
 }
 return out;
}
