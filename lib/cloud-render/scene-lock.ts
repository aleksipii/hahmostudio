import {canonicalJson,sha256} from '../studio/hash.ts';
import {own,stateAtSceneStart,deepFreeze,validateCanonicalState,type CanonicalState} from './canonical.ts';
import {Blocked} from './types.ts';

export type SceneLock={id:string;projectId:string;sceneId:string;hash:string;lockedAt:string;lockedBy:string;snapshot:CanonicalState};
/** Scene-scoped projection of canon: entities, timeline, actions and visual constraints that the scene depends on. */
export function sceneSnapshot(state:CanonicalState,sceneId:string):CanonicalState{
 const sc=own(state.scenes,sceneId);if(!sc)throw new Blocked('scene-unknown',`Unknown scene "${sceneId}".`);
 const start=stateAtSceneStart(state,sceneId),pick=<T>(o:Record<string,T>,ids:string[])=>Object.fromEntries(ids.map(i=>[i,o[i]]));
 const held=new Set(sc.characterIds.flatMap(c=>start.characters[c].holding)),propIds=[...new Set([...sc.propIds,...held])];
 // Baseline of the snapshot IS the scene-start state, so replay of the scene's events reproduces canon.
 const locIds=[...new Set([sc.locationId,...sc.characterIds.map(c=>start.characters[c].location),...sc.approvedTransitions.map(t=>t.from),...sc.events.filter(e=>e.target&&own(start.locations,e.target)).map(e=>e.target as string)])];
 const scene={...sc,propIds:sc.propIds};
 return{schemaVersion:1,projectId:state.projectId,revision:state.revision,characters:pick(start.characters,sc.characterIds),locations:pick(start.locations,locIds),props:pick(start.props,propIds.filter(p=>!start.props[p].heldBy||sc.characterIds.includes(start.props[p].heldBy as string))),scenes:{[sceneId]:scene},timeline:{currentTime:Math.min(state.timeline.currentTime,state.timeline.duration),duration:state.timeline.duration},allowedActions:state.allowedActions,forbiddenActions:state.forbiddenActions,visualStyle:state.visualStyle};
}
export async function lockScene(state:CanonicalState,sceneId:string,lockedBy:string,now=new Date()):Promise<SceneLock>{
 const snapshot=validateCanonicalState(sceneSnapshot(state,sceneId)),hash=await sha256(new TextEncoder().encode(canonicalJson(snapshot)));
 return deepFreeze({id:`lock:${state.projectId}:${sceneId}:${hash.slice(0,12)}`,projectId:state.projectId,sceneId,hash,lockedAt:now.toISOString(),lockedBy,snapshot}) as SceneLock;
}
/** True when the live canon would produce exactly the locked scene. Revision numbers may differ; content may not. */
export async function lockMatches(lock:SceneLock,state:CanonicalState):Promise<boolean>{
 try{const live=sceneSnapshot(state,lock.sceneId);const norm=(s:CanonicalState)=>canonicalJson({...s,revision:0});return norm(live)===norm(lock.snapshot);}catch{return false;}
}
