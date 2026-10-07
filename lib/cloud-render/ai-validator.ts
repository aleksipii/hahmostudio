import {own,type CanonicalState,type CanonicalScene,type ActionRule} from './canonical.ts';
import {parseSuggestion,SchemaError,type AISceneSuggestion} from './ai-suggestion.ts';
import {validateContinuity,type Issue} from './continuity.ts';
import {INJECTION,VISUAL_VOCABULARY} from './vocabulary.ts';

export type Check={id:string;label:string;ok:boolean};
export type ApprovedSuggestion=Readonly<{sceneId:string;suggestion:AISceneSuggestion;stateRevision:number}>;
export type ValidationResult={status:'APPROVED'|'REJECTED';issues:Issue[];checks:Check[];approved?:ApprovedSuggestion};
const approvedBrand=new WeakSet<object>();
/** Layer 7 gate: the prompt compiler accepts only objects minted here. */
export const isApproved=(x:unknown):x is ApprovedSuggestion=>!!x&&typeof x==='object'&&approvedBrand.has(x as object);
const TOL=0.5;
function sceneEntity(state:CanonicalState,sc:CanonicalScene,id:string){return sc.characterIds.includes(id)?'character':sc.propIds.includes(id)?'prop':id===sc.locationId?'location':undefined;}
function targetOk(state:CanonicalState,sc:CanonicalScene,r:ActionRule,t?:string){
 if(r.targetKind==='none')return t===undefined;if(t===undefined)return false;const k=sceneEntity(state,sc,t);
 return r.targetKind==='any'?!!k:r.targetKind==='location'?!!own(state.locations,t):k===r.targetKind;
}
function describeMissing(state:CanonicalState,sc:CanonicalScene,kind:'character'|'prop'|'target',id:string){
 const known=kind==='character'?own(state.characters,id):kind==='prop'?own(state.props,id):own(state.characters,id)||own(state.props,id)||own(state.locations,id);
 return known?`${kind==='target'?'Entity':kind==='character'?'Character':'Prop'} "${id}" exists but is not part of scene "${sc.id}".`:`Unknown ${kind==='target'?'entity':kind} "${id}".`;
}
export function validateSuggestion(state:CanonicalState,sceneId:string,raw:unknown):ValidationResult{
 const issues:Issue[]=[],add=(layer:number,code:string,message:string,path?:string)=>{issues.push({layer,code,message,path});};
 let s:AISceneSuggestion;
 try{s=parseSuggestion(raw);}catch(e){return finish(state,[{layer:1,code:'schema',message:e instanceof SchemaError?e.message:'Suggestion is not valid structured output.'}],undefined,sceneId);}
 const sc=own(state.scenes,sceneId);
 if(!sc)return finish(state,[{layer:2,code:'scene-unknown',message:`Unknown scene "${sceneId}".`}],s,sceneId);
 if(s.sceneId!==sceneId)add(2,'scene-mismatch',`Suggestion is for scene "${s.sceneId}", not "${sceneId}".`,'sceneId');
 // Layer 2: closed-world entities
 if(s.camera.focusOn!==undefined&&!sceneEntity(state,sc,s.camera.focusOn))add(2,'entity',describeMissing(state,sc,'target',s.camera.focusOn),'camera.focusOn');
 if(s.environment.location!==undefined&&s.environment.location!==sc.locationId)add(2,'location',own(state.locations,s.environment.location)?`Location changed: scene is in "${sc.locationId}", AI proposed "${s.environment.location}".`:`Unknown location "${s.environment.location}".`,'environment.location');
 for(const [i,p] of (s.environment.props??[]).entries())if(!sc.propIds.includes(p))add(2,'prop',describeMissing(state,sc,'prop',p),`environment.props[${i}]`);
 if(!state.visualStyle.allowed.includes(s.visualStyle.style))add(2,'visual-style',`Visual style "${s.visualStyle.style}" is not allowed by the project.`,'visualStyle.style');
 for(const [i,a] of s.characterActions.entries()){
  const p=`characterActions[${i}]`;
  if(!sc.characterIds.includes(a.id)){add(2,'character',describeMissing(state,sc,'character',a.id),p+'.id');continue;}
  // Layer 3: attributes
  const c=state.characters[a.id];
  for(const [k,v] of Object.entries(a.claims??{})){
   if(!Object.hasOwn(c.attributes,k))add(3,'attribute-unknown',`Attribute "${k}" of "${a.id}" is not canonical.`,`${p}.claims.${k}`);
   else if(c.attributes[k]!==v)add(3,'attribute-changed',`Canonical ${k} of "${a.id}" is "${String(c.attributes[k])}"; AI proposed "${String(v)}".`,`${p}.claims.${k}`);
  }
  // Layer 4: actions
  const rule=state.allowedActions.find(r=>r.action===a.action);
  if(!rule||state.forbiddenActions.includes(a.action)){add(4,'action',`Action "${a.action}" is not allowed.`,p+'.action');continue;}
  if(a.target!==undefined&&!sceneEntity(state,sc,a.target)&&!(rule.targetKind==='location'&&own(state.locations,a.target)))add(2,'entity',describeMissing(state,sc,'target',a.target),p+'.target');
  else if(!targetOk(state,sc,rule,a.target))add(4,'action-target',`Action "${a.action}" has an invalid target.`,p+'.target');
  if(rule.effect!=='visual'){
   const m=sc.events.find(e=>e.actor===a.id&&e.action===a.action&&e.target===a.target&&(a.at===undefined||Math.abs(e.at-a.at)<=TOL));
   if(!m)add(4,'unapproved-state-change',`"${a.action}" changes world state and is not an approved event of scene "${sceneId}". Only the Rule Engine may introduce it.`,p);
  }
  // Layer 5: timeline
  if(a.at!==undefined&&(a.at<sc.start-1e-9||a.at>sc.end+1e-9))add(5,'timeline',`Time ${a.at}s is outside scene window ${sc.start}–${sc.end}s.`,p+'.at');
 }
 // Layer 6
 for(const i of validateContinuity(state,sceneId,s))issues.push(i);
 // Layer 7 (prompt fragments)
 const allowed=new Set<string>();const addTokens=(v:unknown)=>{for(const t of String(v).toLowerCase().split(/[^a-z0-9äöå]+/))if(t)allowed.add(t);};
 for(const id of sc.characterIds){const c=state.characters[id];addTokens(c.id);addTokens(c.name);for(const v of Object.values(c.attributes))addTokens(v);}
 for(const id of sc.propIds){const p=state.props[id];addTokens(p.id);addTokens(p.type);for(const v of Object.values(p.attributes))addTokens(v);}
 const loc=state.locations[sc.locationId];addTokens(loc.id);addTokens(loc.name);for(const v of Object.values(loc.attributes))addTokens(v);addTokens(s.visualStyle.style);
 for(const [i,f] of s.promptFragments.entries()){
  const p=`promptFragments[${i}]`;
  if(!/^[A-Za-z0-9 ,.'_-]+$/.test(f)){add(7,'fragment-charset','Fragment contains disallowed characters.',p);continue;}
  const bad=INJECTION.find(r=>r.test(f));if(bad){add(7,'fragment-injection','Fragment looks like an instruction or policy override.',p);continue;}
  const unknown=f.toLowerCase().split(/[^a-z0-9äöå]+/).filter(Boolean).filter(t=>!VISUAL_VOCABULARY.has(t)&&!allowed.has(t)&&!/^\d+$/.test(t));
  if(unknown.length)add(7,'fragment-term',`Fragment uses terms that are neither visual vocabulary nor canonical: ${[...new Set(unknown)].join(', ')}.`,p);
 }
 return finish(state,issues,s,sceneId);
}
const LABELS:[number,string][]=[[1,'Structured output valid'],[2,'Entities and location exist in scene'],[3,'Canonical attributes unchanged'],[4,'Actions allowed and approved'],[5,'Timeline valid'],[6,'Continuity respected'],[7,'Prompt fragments safe']];
function finish(state:CanonicalState,issues:Issue[],s:AISceneSuggestion|undefined,sceneId:string):ValidationResult{
 const checks=LABELS.map(([l,label])=>({id:'layer-'+l,label,ok:!issues.some(i=>i.layer===l)}));
 if(issues.length||!s)return{status:'REJECTED',issues,checks};
 const approved=Object.freeze({sceneId,suggestion:structuredClone(s),stateRevision:state.revision}) as ApprovedSuggestion;approvedBrand.add(approved);
 return{status:'APPROVED',issues,checks,approved};
}
