import type {Presentation} from '../presentation-model.ts';
import {environmentId} from '../presentation-direction.ts';
import {DEFAULT_ACTIONS,safeId,validateCanonicalState,type ActionRule,type CanonicalProp,type CanonicalScene,type CanonicalState,type SceneEvent} from './canonical.ts';
import type {Attr} from './types.ts';

/**
 * Read-only projection of the existing rule-based Presentation into canonical state. The Presentation stays the animation
 * authority; this adapter never writes back. Appearance attributes (hair, outfit, ...) are NOT in a Presentation, so they come from
 * an explicit supplement authored by a human; anything not supplied simply does not exist for validation (closed world).
 */
export type CanonSupplement={projectId?:string;characters?:Record<string,{attributes?:Record<string,Attr>}>;locations?:Record<string,{name?:string;attributes?:Record<string,Attr>}>;visualStyles?:string[];forbiddenActions?:string[];revision?:number};
const slug=(s:string)=>s.normalize('NFKD').replace(/[^A-Za-z0-9]+/g,'_').replace(/^_+|_+$/g,'').toLowerCase().slice(0,60)||'x';
export function canonicalFromPresentation(p:Presentation,sup:CanonSupplement={}):CanonicalState{
 const ids=new Map<string,string>(),used=new Set<string>();
 for(const name of p.characters){let id=slug(name),n=1;while(used.has(id))id=slug(name)+'_'+(++n);used.add(id);ids.set(name,id);}
 const defaultLoc=(p.world.design&&String(p.world.design))||'unspecified',envAt=(t:number)=>{const e=p.events.filter(x=>x.kind==='environment'&&(x.at??0)<=t).sort((a,b)=>(a.at??0)-(b.at??0)).at(-1);return (e&&environmentId(e.value))||defaultLoc;};
 const secs=p.sections.length?[...p.sections].sort((a,b)=>a.start-b.start):[{id:'default',name:'Scene',start:0,end:Math.max(1,p.seconds)}];
 const actionRules=new Map<string,ActionRule>(DEFAULT_ACTIONS.map(a=>[a.action,a]));
 const locations:CanonicalState['locations']={},scenes:Record<string,CanonicalScene>={};
 const addLoc=(id:string)=>{if(!locations[id])locations[id]={id,name:sup.locations?.[id]?.name??id,attributes:sup.locations?.[id]?.attributes??{}};};
 const hasPhone=p.world.phone.enabled||p.events.some(e=>e.kind==='prop');
 const phoneCarrier=ids.get(p.world.phone.carrier),props:Record<string,CanonicalProp>={};
 let prevLoc:string|undefined;const firstLoc=envAt(secs[0].start);
 for(const sec of secs){
  const loc=envAt(sec.start);addLoc(loc);
  const evs=p.events.filter(e=>e.section===sec.id&&(e.kind==='action'||e.kind==='dialogue')&&ids.has(e.target)).sort((a,b)=>(a.at??sec.start)-(b.at??sec.start));
  const events:SceneEvent[]=evs.map(e=>{
   const at=Math.max(sec.start,e.at??sec.start);let action=e.kind==='dialogue'?'speak':slug(e.value);let target:string|undefined;
   if(action==='phone_down'&&hasPhone){action='put_down';target='phone';}
   else if(!actionRules.has(action))actionRules.set(action,{action,targetKind:'none',effect:'visual'});
   return{id:e.id,at,actor:ids.get(e.target) as string,action,...(target?{target}:{})};
  });
  const end=Math.max(sec.end,...events.map(e=>e.at+0.001));
  const chars=[...new Set(events.map(e=>e.actor))];const charIds=chars.length?chars:[...ids.values()];
  scenes[slug(sec.id)||'scene']={id:slug(sec.id),locationId:loc,characterIds:charIds,propIds:hasPhone?['phone']:[],start:sec.start,end,events,approvedTransitions:prevLoc&&prevLoc!==loc?charIds.map(c=>({characterId:c,from:prevLoc as string})):[]};
  prevLoc=loc;
 }
 addLoc(firstLoc);
 if(hasPhone)props.phone={id:'phone',type:'phone',attributes:{},location:phoneCarrier?null:firstLoc,heldBy:phoneCarrier??null};
 const characters:CanonicalState['characters']={};
 for(const [name,id] of ids)characters[id]={id,name,attributes:sup.characters?.[name]?.attributes??sup.characters?.[id]?.attributes??{},location:firstLoc,holding:phoneCarrier===id?['phone']:[]};
 const end=Math.max(1,p.seconds,...Object.values(scenes).map(s=>s.end));
 return validateCanonicalState({schemaVersion:1,projectId:safeId(sup.projectId)?sup.projectId:('p_'+slug(p.id)),revision:sup.revision??p.production?.studio?.revision??1,characters,locations,props,scenes,timeline:{currentTime:0,duration:end},allowedActions:[...actionRules.values()],forbiddenActions:sup.forbiddenActions??[],visualStyle:{allowed:sup.visualStyles??['anime','cartoon','stylized_2d','illustration'],constraints:[]}});
}
