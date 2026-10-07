import type {Attr} from './types.ts';
import {Blocked} from './types.ts';
import {deepFreeze,own,stateAtSceneStart,type ActionRule,type CanonicalCharacter,type CanonicalLocation,type CanonicalProp,type CanonicalScene,type CanonicalState,type SceneEvent} from './canonical.ts';

export type ContinuityConstraint={kind:'location'|'attribute'|'holding';subject:string;key?:string;value:Attr|string[]|string};
export type VisualConstraint={key:string;allowed:string[]};
export interface AIContext{
 projectId:string;sceneId:string;
 canonicalCharacters:CanonicalCharacter[];canonicalLocations:CanonicalLocation[];canonicalProps:CanonicalProp[];
 approvedEvents:SceneEvent[];allowedActions:ActionRule[];forbiddenActions:string[];
 timelineState:{currentTime:number;sceneStart:number;sceneEnd:number;duration:number};
 continuityConstraints:ContinuityConstraint[];visualStyleConstraints:VisualConstraint[];
}
/** The only data the AI Director ever receives: derived, scene-scoped, deep-frozen. Holds no reference to policy or the store. */
export function buildAIContext(state:CanonicalState,sceneId:string):AIContext{
 const sc=own(state.scenes,sceneId) as CanonicalScene|undefined;if(!sc)throw new Blocked('scene-unknown',`Unknown scene "${sceneId}".`);
 const start=stateAtSceneStart(state,sceneId),chars=sc.characterIds.map(id=>start.characters[id]),props=sc.propIds.map(id=>start.props[id]);
 const cont:ContinuityConstraint[]=[];
 for(const c of chars){cont.push({kind:'location',subject:c.id,value:c.location});cont.push({kind:'holding',subject:c.id,value:[...c.holding]});for(const [k,v] of Object.entries(c.attributes))cont.push({kind:'attribute',subject:c.id,key:k,value:v});}
 for(const p of props)for(const [k,v] of Object.entries(p.attributes))cont.push({kind:'attribute',subject:p.id,key:k,value:v});
 return deepFreeze(structuredClone({projectId:state.projectId,sceneId,canonicalCharacters:chars,canonicalLocations:[state.locations[sc.locationId]],canonicalProps:props,approvedEvents:sc.events,allowedActions:state.allowedActions,forbiddenActions:state.forbiddenActions,timelineState:{currentTime:state.timeline.currentTime,sceneStart:sc.start,sceneEnd:sc.end,duration:state.timeline.duration},continuityConstraints:cont,visualStyleConstraints:[{key:'style',allowed:state.visualStyle.allowed}]})) as AIContext;
}
