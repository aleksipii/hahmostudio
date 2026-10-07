import {own,type CanonicalState} from './canonical.ts';
import {isApproved,type ApprovedSuggestion} from './ai-validator.ts';
import {Blocked} from './types.ts';
import type {SceneLock} from './scene-lock.ts';

export const PROMPT_COMPILER_VERSION='prompt-compiler-1.0.0';
const SHOT:Record<string,string>={wide:'wide shot',medium:'medium shot',close_up:'close-up shot',extreme_close_up:'extreme close-up',over_shoulder:'over-the-shoulder shot',two_shot:'two-shot',establishing:'establishing shot'};
const MOVE:Record<string,string>={static:'static camera',slow_pan_left:'camera slowly pans left',slow_pan_right:'camera slowly pans right',slow_zoom_in:'slow zoom in',slow_zoom_out:'slow zoom out',tilt_up:'camera tilts up',tilt_down:'camera tilts down',dolly_in:'dolly in',dolly_out:'dolly out',handheld_subtle:'subtle handheld motion'};
const LIGHT:Record<string,string>={neutral:'neutral lighting',warm:'warm lighting',cool:'cool lighting',soft:'soft lighting',dramatic:'dramatic lighting',high_key:'high-key lighting',low_key:'low-key lighting',backlit:'backlit',natural:'natural light'};
const human=(s:string)=>s.replace(/_/g,' ');
const attrText=(a:Record<string,unknown>)=>Object.keys(a).sort().map(k=>`${human(k)} ${human(String(a[k]))}`).join(', ');
export type CompiledPrompt={prompt:string;negativePrompt:string;compilerVersion:string;characterIds:string[];sources:string[]};
/** Deterministic: identical input always yields identical text. Uses only the approved suggestion and the locked canonical scene. */
export function compilePrompt(approved:ApprovedSuggestion,state:CanonicalState,lock?:SceneLock,focus?:{eventId:string}):CompiledPrompt{
 if(!isApproved(approved))throw new Blocked('unvalidated','Only validated suggestions can be compiled into a render prompt.');
 const sc=own(state.scenes,approved.sceneId);if(!sc)throw new Blocked('scene-unknown','Unknown scene.');
 const s=approved.suggestion,parts:string[]=[],name=(id:string)=>state.characters[id]?.name??state.props[id]?.type??id;
 parts.push(`${s.visualStyle.style.replace(/_/g,' ')} style`);
 parts.push(`${SHOT[s.camera.shot]}, ${MOVE[s.camera.movement]}`+(s.camera.focusOn?`, focus on ${name(s.camera.focusOn)}`:''));
 const loc=state.locations[sc.locationId];parts.push(`location: ${loc.name}${Object.keys(loc.attributes).length?` (${attrText(loc.attributes)})`:''}`);
 for(const id of sc.characterIds){const c=state.characters[id];parts.push(`${c.name}: ${attrText(c.attributes)||'canonical appearance'}`);}
 for(const id of sc.propIds){const p=state.props[id];parts.push(`${human(p.type)}${Object.keys(p.attributes).length?` (${attrText(p.attributes)})`:''}`);}
 const acts=[...sc.events].filter(e=>!focus||e.id===focus.eventId).sort((a,b)=>a.at-b.at).map(e=>`${name(e.actor)} ${human(e.action)}${e.target?' '+name(e.target):''}`);
 const ai=s.characterActions.filter(a=>!sc.events.some(e=>e.actor===a.id&&e.action===a.action&&e.target===a.target)).map(a=>`${name(a.id)} ${human(a.action)}${a.target?' '+name(a.target):''}`);
 if(acts.length)parts.push('actions: '+acts.join('; '));if(ai.length)parts.push('performance: '+ai.join('; '));
 parts.push(LIGHT[s.lighting.style]+(s.lighting.intensity!==undefined?` intensity ${s.lighting.intensity}`:''));
 if(s.environment.atmosphere)parts.push(`${s.environment.atmosphere} atmosphere`);
 for(const f of s.promptFragments)parts.push(f);
 const names=sc.characterIds.map(id=>state.characters[id].name);
 const neg=['change of character identity','change of clothing','unapproved characters','unapproved objects','change of location','altered canonical colors','scene continuity errors','extra people','text, watermark, logo',...names.map(n=>`different appearance of ${n}`)];
 return{prompt:parts.join('. ')+'.',negativePrompt:neg.join(', '),compilerVersion:PROMPT_COMPILER_VERSION,characterIds:[...sc.characterIds],sources:[`scene:${sc.id}`,`revision:${approved.stateRevision}`,...(lock?[`lock:${lock.id}`]:[]),...(focus?[`event:${focus.eventId}`]:[])]};
}
