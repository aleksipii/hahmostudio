import type {Attr} from './types.ts';
import {safeId} from './canonical.ts';
import type {AIContext} from './ai-context.ts';

export const AI_DIRECTOR_VERSION='ai-director-1.0.0';
export const CAMERA_SHOTS=['wide','medium','close_up','extreme_close_up','over_shoulder','two_shot','establishing'] as const;
export const CAMERA_MOVES=['static','slow_pan_left','slow_pan_right','slow_zoom_in','slow_zoom_out','tilt_up','tilt_down','dolly_in','dolly_out','handheld_subtle'] as const;
export const LIGHTING_STYLES=['neutral','warm','cool','soft','dramatic','high_key','low_key','backlit','natural'] as const;
export const ATMOSPHERES=['clear','hazy','dusty','misty'] as const;
export type AISceneSuggestion={
 sceneId:string;
 camera:{shot:typeof CAMERA_SHOTS[number];movement:typeof CAMERA_MOVES[number];focusOn?:string};
 characterActions:{id:string;action:string;target?:string;at?:number;/** Claimed canonical attributes. Checked, never applied. */claims?:Record<string,Attr>;claimedLocation?:string;claimedHolding?:string[]}[];
 environment:{location?:string;atmosphere?:typeof ATMOSPHERES[number];props?:string[]};
 lighting:{style:typeof LIGHTING_STYLES[number];intensity?:number};
 visualStyle:{style:string};
 promptFragments:string[];
};
export class SchemaError extends Error{readonly path:string;constructor(path:string,message:string){super(`${path}: ${message}`);this.name='SchemaError';this.path=path;}}
const only=(o:Record<string,unknown>,keys:string[],path:string)=>{for(const k of Object.keys(o))if(!keys.includes(k))throw new SchemaError(path?path+'.'+k:k,'unknown field (not part of the suggestion schema).');};
const obj=(v:unknown,path:string)=>{if(!v||typeof v!=='object'||Array.isArray(v))throw new SchemaError(path,'must be an object.');return v as Record<string,unknown>;};
const str=(v:unknown,path:string,max=100)=>{if(typeof v!=='string'||!v||v.length>max)throw new SchemaError(path,'must be a non-empty string.');return v;};
const oneOf=<T extends string>(v:unknown,list:readonly T[],path:string):T=>{if(typeof v!=='string'||!(list as readonly string[]).includes(v))throw new SchemaError(path,`must be one of ${list.join(', ')}.`);return v as T;};
/** Layer 1: schema-valid structured output. Unknown fields are rejected, never ignored. */
export function parseSuggestion(raw:unknown):AISceneSuggestion{
 const o=obj(raw,'suggestion');only(o,['sceneId','camera','characterActions','environment','lighting','visualStyle','promptFragments'],'');
 const cam=obj(o.camera,'camera');only(cam,['shot','movement','focusOn'],'camera');
 const acts=o.characterActions;if(!Array.isArray(acts)||acts.length>40)throw new SchemaError('characterActions','must be an array of at most 40 items.');
 const env=obj(o.environment,'environment');only(env,['location','atmosphere','props'],'environment');
 const lit=obj(o.lighting,'lighting');only(lit,['style','intensity'],'lighting');
 const vs=obj(o.visualStyle,'visualStyle');only(vs,['style'],'visualStyle');
 const frags=o.promptFragments;if(!Array.isArray(frags)||frags.length>12)throw new SchemaError('promptFragments','must be an array of at most 12 strings.');
 const out:AISceneSuggestion={
  sceneId:str(o.sceneId,'sceneId'),
  camera:{shot:oneOf(cam.shot,CAMERA_SHOTS,'camera.shot'),movement:oneOf(cam.movement,CAMERA_MOVES,'camera.movement'),...(cam.focusOn!==undefined?{focusOn:str(cam.focusOn,'camera.focusOn')}:{})},
  characterActions:acts.map((a,i)=>{const p=`characterActions[${i}]`,x=obj(a,p);only(x,['id','action','target','at','claims','claimedLocation','claimedHolding'],p);
   const r:AISceneSuggestion['characterActions'][number]={id:str(x.id,p+'.id'),action:str(x.action,p+'.action')};
   if(x.target!==undefined)r.target=str(x.target,p+'.target');
   if(x.at!==undefined){if(typeof x.at!=='number'||!Number.isFinite(x.at))throw new SchemaError(p+'.at','must be a finite number.');r.at=x.at;}
   if(x.claims!==undefined){const c=obj(x.claims,p+'.claims');if(Object.keys(c).length>20)throw new SchemaError(p+'.claims','too many claims.');for(const [k,v] of Object.entries(c))if(!/^[a-z][A-Za-z0-9_]{0,40}$/.test(k)||!['string','number','boolean'].includes(typeof v))throw new SchemaError(p+'.claims.'+k,'invalid claim.');r.claims=c as Record<string,Attr>;}
   if(x.claimedLocation!==undefined)r.claimedLocation=str(x.claimedLocation,p+'.claimedLocation');
   if(x.claimedHolding!==undefined){if(!Array.isArray(x.claimedHolding)||x.claimedHolding.length>20)throw new SchemaError(p+'.claimedHolding','must be an array.');r.claimedHolding=x.claimedHolding.map((h,j)=>str(h,`${p}.claimedHolding[${j}]`));}
   return r;}),
  environment:{...(env.location!==undefined?{location:str(env.location,'environment.location')}:{}),...(env.atmosphere!==undefined?{atmosphere:oneOf(env.atmosphere,ATMOSPHERES,'environment.atmosphere')}:{}),...(env.props!==undefined?{props:(Array.isArray(env.props)&&env.props.length<=20?env.props:(()=>{throw new SchemaError('environment.props','must be an array.');})()).map((p,i)=>str(p,`environment.props[${i}]`))}:{})},
  lighting:{style:oneOf(lit.style,LIGHTING_STYLES,'lighting.style'),...(lit.intensity!==undefined?{intensity:typeof lit.intensity==='number'&&lit.intensity>=0&&lit.intensity<=1?lit.intensity:(()=>{throw new SchemaError('lighting.intensity','must be 0..1.');})()}:{})},
  visualStyle:{style:str(vs.style,'visualStyle.style')},
  promptFragments:frags.map((f,i)=>str(f,`promptFragments[${i}]`,160)),
 };
 if(!safeId(out.sceneId))throw new SchemaError('sceneId','invalid id.');
 return out;
}
/** Untrusted producer of suggestions. Receives only a frozen AIContext. */
export interface AIDirector{readonly id:string;readonly version:string;suggest(context:AIContext):Promise<unknown>;}
/** Deterministic, zero-cost director: conservative framing, no extra actions. Used when no LLM is configured. */
export class RuleBasedDirector implements AIDirector{
 readonly id='rule-based';readonly version=AI_DIRECTOR_VERSION;
 async suggest(c:AIContext){
  const first=c.approvedEvents[0],focus=first?.target&&(c.canonicalProps.some(p=>p.id===first.target)||c.canonicalCharacters.some(x=>x.id===first.target))?first.target:undefined;
  return{sceneId:c.sceneId,camera:{shot:c.canonicalCharacters.length>1?'two_shot':'medium',movement:'static',...(focus?{focusOn:focus}:{})},characterActions:[],environment:{},lighting:{style:'neutral'},visualStyle:{style:c.visualStyleConstraints[0]?.allowed[0]??'illustration'},promptFragments:[]};
 }
}
/** Scripted director for tests and demos. */
export class MockAIDirector implements AIDirector{
 readonly id='mock';readonly version=AI_DIRECTOR_VERSION;calls=0;lastContext?:AIContext;
 private response:unknown|((c:AIContext)=>unknown);
 constructor(response:unknown|((c:AIContext)=>unknown)){this.response=response;}
 async suggest(c:AIContext){this.calls++;this.lastContext=c;return typeof this.response==='function'?(this.response as (c:AIContext)=>unknown)(c):structuredClone(this.response);}
}
/** Adapter for a user-configured language model. Never constructed by default: an LLM may cost money. */
export class LLMDirector implements AIDirector{
 readonly id='llm';readonly version=AI_DIRECTOR_VERSION;
 private complete:(system:string,user:string)=>Promise<string>;
 constructor(complete:(system:string,user:string)=>Promise<string>){this.complete=complete;}
 async suggest(c:AIContext){
  const system='You are a visual director. Reply with ONE JSON object matching the AISceneSuggestion schema and nothing else. You may suggest camera, lighting, atmosphere, visual style, actions from the allowed list and short style fragments. You cannot change characters, locations, props, story, timeline or any policy; such fields are rejected.';
  const text=await this.complete(system,JSON.stringify(c));
  try{return JSON.parse(text);}catch{return{__unparseable:true};}
 }
}
