import type {Attr} from './types.ts';
import {Blocked} from './types.ts';

/** The Rule Engine owns truth. This module defines canonical state, the only legal state transitions, and the only writer. */
export const RULE_ENGINE_VERSION='rule-engine-1.0.0';
/** sourceSha256: SHA-256 of the character's graphics source (pack file). A reference approved for another hash is stale. */
export type CanonicalCharacter={id:string;name:string;attributes:Record<string,Attr>;location:string;holding:string[];sourceSha256?:string};
export type CanonicalLocation={id:string;name:string;attributes:Record<string,Attr>};
export type CanonicalProp={id:string;type:string;attributes:Record<string,Attr>;location:string|null;heldBy:string|null};
export type ActionEffect='visual'|'pick_up'|'put_down'|'move_to';
export type ActionRule={action:string;targetKind:'none'|'prop'|'character'|'location'|'any';effect:ActionEffect};
export type SceneEvent={id:string;at:number;actor:string;action:string;target?:string};
export type CanonicalScene={id:string;locationId:string;characterIds:string[];propIds:string[];start:number;end:number;events:SceneEvent[];approvedTransitions:{characterId:string;from:string}[]};
export type CanonicalState={schemaVersion:1;projectId:string;revision:number;characters:Record<string,CanonicalCharacter>;locations:Record<string,CanonicalLocation>;props:Record<string,CanonicalProp>;scenes:Record<string,CanonicalScene>;timeline:{currentTime:number;duration:number};allowedActions:ActionRule[];forbiddenActions:string[];visualStyle:{allowed:string[];constraints:string[]}};
export class RuleViolation extends Error{constructor(message:string){super(message);this.name='RuleViolation';}}

export const ID=/^[A-Za-z0-9_.:-]{1,100}$/;
const BAD=new Set(['__proto__','prototype','constructor']);
// NB: function declaration, not a generic arrow: server/ui.test.mjs transpiles .ts files as TSX.
export function own<T>(o:Record<string,T>,k:string):T|undefined{return Object.hasOwn(o,k)?o[k]:undefined;}
export const safeId=(v:unknown):v is string=>typeof v==='string'&&ID.test(v)&&!BAD.has(v);
export function deepFreeze<T>(v:T):T{if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.freeze(v);for(const x of Object.values(v as object))deepFreeze(x);}return v;}
export const DEFAULT_ACTIONS:ActionRule[]=[
 {action:'pick_up',targetKind:'prop',effect:'pick_up'},{action:'put_down',targetKind:'prop',effect:'put_down'},{action:'move_to',targetKind:'location',effect:'move_to'},
 {action:'look_at',targetKind:'any',effect:'visual'},{action:'gesture',targetKind:'none',effect:'visual'},{action:'smile',targetKind:'none',effect:'visual'},{action:'turn_head',targetKind:'any',effect:'visual'},{action:'speak',targetKind:'none',effect:'visual'},{action:'idle',targetKind:'none',effect:'visual'},
];
const attrs=(a:unknown,what:string)=>{if(!a||typeof a!=='object'||Array.isArray(a))throw new RuleViolation(what+': attributes must be an object.');const e=Object.entries(a);if(e.length>40)throw new RuleViolation(what+': too many attributes.');for(const [k,v] of e)if(!/^[a-z][A-Za-z0-9_]{0,40}$/.test(k)||BAD.has(k)||!['string','number','boolean'].includes(typeof v)||typeof v==='string'&&v.length>200||typeof v==='number'&&!Number.isFinite(v))throw new RuleViolation(`${what}: invalid attribute "${k}".`);};
const rec=(o:unknown,what:string,max:number)=>{if(!o||typeof o!=='object'||Array.isArray(o)||Object.keys(o).length>max)throw new RuleViolation(what+' is invalid.');return o as Record<string,any>;};

/** Structural + referential + replay validation. Throws RuleViolation; returns a deep copy. */
export function validateCanonicalState(value:unknown):CanonicalState{
 const s=value as CanonicalState;
 if(!s||s.schemaVersion!==1||!safeId(s.projectId)||!Number.isSafeInteger(s.revision)||s.revision<1)throw new RuleViolation('Canonical state header is invalid.');
 const chars=rec(s.characters,'characters',200),locs=rec(s.locations,'locations',200),props=rec(s.props,'props',500),scenes=rec(s.scenes,'scenes',500);
 if(!s.timeline||![s.timeline.currentTime,s.timeline.duration].every(n=>Number.isFinite(n)&&n>=0)||s.timeline.currentTime>s.timeline.duration)throw new RuleViolation('Timeline is invalid.');
 if(!Array.isArray(s.allowedActions)||s.allowedActions.length>200||!Array.isArray(s.forbiddenActions)||s.forbiddenActions.length>200||!s.forbiddenActions.every(a=>safeId(a)))throw new RuleViolation('Action rules are invalid.');
 const seenA=new Set<string>();for(const a of s.allowedActions){if(!a||!safeId(a.action)||seenA.has(a.action)||!['none','prop','character','location','any'].includes(a.targetKind)||!['visual','pick_up','put_down','move_to'].includes(a.effect))throw new RuleViolation('Action rule is invalid.');seenA.add(a.action);}
 if(!s.visualStyle||!Array.isArray(s.visualStyle.allowed)||!s.visualStyle.allowed.every(x=>safeId(x))||!Array.isArray(s.visualStyle.constraints)||!s.visualStyle.constraints.every(x=>typeof x==='string'&&x.length<=200))throw new RuleViolation('Visual style constraints are invalid.');
 for(const [id,l] of Object.entries(locs)){if(!safeId(id)||l?.id!==id||typeof l.name!=='string'||l.name.length>100)throw new RuleViolation(`Location "${id}" is invalid.`);attrs(l.attributes,'location '+id);}
 for(const [id,c] of Object.entries(chars)){if(!safeId(id)||c?.id!==id||typeof c.name!=='string'||!c.name||c.name.length>100||!own(locs,c.location)||!Array.isArray(c.holding)||c.sourceSha256!==undefined&&!/^[0-9a-f]{64}$/.test(c.sourceSha256))throw new RuleViolation(`Character "${id}" is invalid.`);attrs(c.attributes,'character '+id);}
 for(const [id,p] of Object.entries(props)){if(!safeId(id)||p?.id!==id||typeof p.type!=='string'||!p.type||p.type.length>60||p.location!==null&&!own(locs,p.location)||p.heldBy!==null&&!own(chars,p.heldBy))throw new RuleViolation(`Prop "${id}" is invalid.`);attrs(p.attributes,'prop '+id);}
 for(const c of Object.values(chars) as CanonicalCharacter[])for(const h of c.holding)if(own(props,h)?.heldBy!==c.id)throw new RuleViolation(`Character "${c.id}" holding list disagrees with prop "${h}".`);
 for(const p of Object.values(props) as CanonicalProp[])if(p.heldBy&&!own(chars,p.heldBy)!.holding.includes(p.id))throw new RuleViolation(`Prop "${p.id}" holder list disagrees.`);
 const ranges:[number,number,string][]=[],rules=new Map(s.allowedActions.map(a=>[a.action,a]));
 for(const [id,sc] of Object.entries(scenes) as [string,CanonicalScene][]){
  if(!safeId(id)||sc?.id!==id||!own(locs,sc.locationId)||!Array.isArray(sc.characterIds)||!Array.isArray(sc.propIds)||!Array.isArray(sc.events)||!Array.isArray(sc.approvedTransitions)||!Number.isFinite(sc.start)||!Number.isFinite(sc.end)||sc.start<0||sc.end<=sc.start||sc.end>s.timeline.duration+1e-9||sc.events.length>2000)throw new RuleViolation(`Scene "${id}" is invalid.`);
  if(sc.characterIds.some(c=>!own(chars,c))||sc.propIds.some(p=>!own(props,p)))throw new RuleViolation(`Scene "${id}" references an unknown entity.`);
  for(const t of sc.approvedTransitions)if(!own(chars,t.characterId)||!own(locs,t.from))throw new RuleViolation(`Scene "${id}" has an invalid approved transition.`);
  const ids=new Set<string>();for(const e of sc.events){
   if(!safeId(e.id)||ids.has(e.id)||!Number.isFinite(e.at)||e.at<sc.start||e.at>sc.end)throw new RuleViolation(`Event in scene "${id}" is invalid or outside the scene window.`);ids.add(e.id);
   const r=rules.get(e.action);if(!r||s.forbiddenActions.includes(e.action))throw new RuleViolation(`Action "${e.action}" is not allowed.`);
   if(!sc.characterIds.includes(e.actor))throw new RuleViolation(`Event actor "${e.actor}" is not in scene "${id}".`);
   checkTarget(s,sc,r,e.target);
  }
  for(const [a,b,other] of ranges)if(sc.start<b&&a<sc.end)throw new RuleViolation(`Scenes "${other}" and "${id}" overlap.`);ranges.push([sc.start,sc.end,id]);
 }
 replay(structuredClone(s));return structuredClone(s);
}
function checkTarget(s:CanonicalState,sc:CanonicalScene,r:ActionRule,t:string|undefined){
 if(r.targetKind==='none'){if(t!==undefined)throw new RuleViolation(`Action "${r.action}" takes no target.`);return;}
 if(t===undefined||!safeId(t))throw new RuleViolation(`Action "${r.action}" needs a target.`);
 const isProp=!!own(s.props,t)&&sc.propIds.includes(t),isChar=!!own(s.characters,t)&&sc.characterIds.includes(t),isLoc=!!own(s.locations,t);
 const ok=r.targetKind==='prop'?isProp:r.targetKind==='character'?isChar:r.targetKind==='location'?isLoc:isProp||isChar||isLoc&&t===sc.locationId;
 if(!ok)throw new RuleViolation(`Target "${t}" is unknown or not in scene "${sc.id}".`);
}
export function orderedEvents(s:CanonicalState){return Object.values(s.scenes).sort((a,b)=>a.start-b.start).flatMap(sc=>[...sc.events].sort((a,b)=>a.at-b.at).map(e=>({scene:sc,event:e})));}
export function applyAction(s:CanonicalState,a:{actor:string;action:string;target?:string}):void{
 const rule=s.allowedActions.find(r=>r.action===a.action);
 if(!rule||s.forbiddenActions.includes(a.action))throw new RuleViolation(`Action "${a.action}" is not allowed.`);
 const actor=own(s.characters,a.actor);if(!actor)throw new RuleViolation(`Unknown character "${a.actor}".`);
 if(rule.effect==='visual')return;
 const target=a.target;
 if(rule.effect==='pick_up'){const p=target?own(s.props,target):undefined;if(!p)throw new RuleViolation(`Unknown prop "${target}".`);if(p.heldBy)throw new RuleViolation(`Prop "${p.id}" is already held.`);if(p.location!==actor.location)throw new RuleViolation(`"${actor.id}" cannot reach prop "${p.id}" from another location.`);p.heldBy=actor.id;p.location=null;actor.holding.push(p.id);}
 else if(rule.effect==='put_down'){const p=target?own(s.props,target):undefined;if(!p||p.heldBy!==actor.id)throw new RuleViolation(`"${actor.id}" is not holding "${target}".`);p.heldBy=null;p.location=actor.location;actor.holding=actor.holding.filter(x=>x!==p.id);}
 else if(rule.effect==='move_to'){const l=target?own(s.locations,target):undefined;if(!l)throw new RuleViolation(`Unknown location "${target}".`);actor.location=l.id;}
}
/** Mutates `s` by replaying approved events with `at` strictly before `until` (all if omitted). */
export function replay(s:CanonicalState,until=Infinity,stopAtEvent?:string){for(const {event} of orderedEvents(s)){if(event.at>=until&&event.id!==stopAtEvent)break;if(event.id===stopAtEvent)break;applyAction(s,event);}}
/** State of the world at the instant a scene starts (all earlier scenes' events applied). */
export function stateAtSceneStart(s:CanonicalState,sceneId:string):CanonicalState{const sc=own(s.scenes,sceneId);if(!sc)throw new Blocked('scene-unknown',`Unknown scene "${sceneId}".`);const c=structuredClone(s);replay(c,sc.start);return c;}

const writer=Symbol('rule-engine-commit');
/** The only mutable holder of canonical truth. Readers get deep-frozen snapshots; the only writer is RuleEngine. */
export class CanonicalStore{
 #state:CanonicalState;
 constructor(initial:unknown){this.#state=validateCanonicalState(initial);}
 get():CanonicalState{return deepFreeze(structuredClone(this.#state));}
 [writer](next:CanonicalState){this.#state=next;}
}
export class RuleEngine{
 readonly version=RULE_ENGINE_VERSION;
 private store:CanonicalStore;
 constructor(store:CanonicalStore){this.store=store;}
 /** Pure check: what would this action do? Throws RuleViolation if illegal. */
 propose(a:{actor:string;action:string;target?:string}):CanonicalState{const s=structuredClone(this.store.get()) as CanonicalState;applyAction(s,a);return s;}
 /** Approved state transition. The sole path that changes canonical state. */
 commit(a:{actor:string;action:string;target?:string}):CanonicalState{
  const next=this.propose(a);next.revision+=1;const valid=validateCanonicalState(next);this.store[writer](valid);return this.store.get();
 }
}
