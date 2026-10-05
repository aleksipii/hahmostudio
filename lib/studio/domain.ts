import {validateCommandJournal,type CommandEntry} from './command-journal.ts';
import {validateShotTasks,type ShotTask} from './shot-tasks.ts';
import {validateReviewComments,type ReviewComment} from './review.ts';
import {affectedShots} from './shot-impact.ts';
import type {Presentation} from '../presentation-model.ts';

export const TIMEBASE=35_280_000;
export function ticks(seconds:number){const value=Math.round(seconds*TIMEBASE);if(!Number.isFinite(seconds)||seconds<0||!Number.isSafeInteger(value))throw Error('Tuotannon aika on virheellinen.');return value;}
export function seconds(value:number){if(!Number.isSafeInteger(value)||value<0)throw Error('Tuotannon aika on virheellinen.');return value/TIMEBASE;}
export type ShotStatus='draft'|'approved'|'locked';
export type StudioMetadata={schemaVersion:1;commandJournal?:CommandEntry[];shotTasks?:Record<string,ShotTask>;reviewComments?:ReviewComment[];episodeId:string;revision:number;rawScript?:string;sceneIds?:Record<string,string>;changes:{revision:number;reason:string;createdAt:string}[];shots:Record<string,{status:ShotStatus;approvedRevision?:number}>};
export type Shot={id:string;sourceEventId:string;sceneId:string;name:string;at:number;duration:number;revision:number;status:ShotStatus;eventIds:string[];characterIds:string[];audioStatus:'missing'|'ready'|'silent';errors:{eventId?:string;message:string}[]};
export type ProductionScene={id:string;sourceSectionId:string;episodeId:string;name:string;at:number;duration:number;shotIds:string[]};
export type Episode={id:string;name:string;revision:number;timebase:typeof TIMEBASE;duration:number;scenes:ProductionScene[];shots:Shot[]};
const safeId=(v:unknown):v is string=>typeof v==='string'&&v.length>0&&v.length<=400&&!['__proto__','prototype','constructor'].includes(v);
export function readStudio(value:unknown):StudioMetadata{
 const s=value as StudioMetadata;if(!s||s.schemaVersion!==1||!safeId(s.episodeId)||!Number.isSafeInteger(s.revision)||s.revision<1||!Array.isArray(s.changes)||s.changes.length>100||!s.shots||typeof s.shots!=='object'||Array.isArray(s.shots)||Object.keys(s.shots).length>2500)throw Error('Studion tuotantotiedot ovat virheelliset.');
 if(s.rawScript!==undefined&&(typeof s.rawScript!=='string'||s.rawScript.length>60000))throw Error('Käsikirjoitusluonnos on liian suuri.');
 if(s.sceneIds&&(typeof s.sceneIds!=='object'||Array.isArray(s.sceneIds)||Object.keys(s.sceneIds).length>200||Object.entries(s.sceneIds).some(([k,v])=>!safeId(k)||!safeId(v))))throw Error('Kohtausten tunnisteet ovat virheelliset.');
 for(const c of s.changes)if(!c||!Number.isSafeInteger(c.revision)||c.revision<1||c.revision>s.revision||typeof c.reason!=='string'||c.reason.length>200||typeof c.createdAt!=='string'||!Number.isFinite(Date.parse(c.createdAt)))throw Error('Tuotantorevision tiedot ovat virheelliset.');
 for(const [id,v] of Object.entries(s.shots))if(!safeId(id)||!v||!['draft','approved','locked'].includes(v.status)||v.approvedRevision!==undefined&&(!Number.isSafeInteger(v.approvedRevision)||v.approvedRevision<1||v.approvedRevision>s.revision))throw Error('Kuvan hyväksyntä on virheellinen.');
 if(s.commandJournal!==undefined&&validateCommandJournal(s.commandJournal).some(e=>e.revisionAfter>s.revision))throw Error('Komentohistorian revisio ylittää projektin revision.');
 if(s.shotTasks!==undefined)validateShotTasks(s.shotTasks);
 if(s.reviewComments!==undefined)validateReviewComments(s.reviewComments,s.revision);
 return structuredClone(s);
}
export function studioMetadata(p:Presentation):StudioMetadata{const meta:StudioMetadata=p.production?.studio?readStudio(p.production.studio):{schemaVersion:1,episodeId:'episode:'+p.id,revision:1,changes:[],shots:{}};return{...meta,sceneIds:meta.sceneIds??Object.fromEntries([...new Set([...p.sections.map(s=>s.id),...p.events.map(e=>e.section)])].map(id=>[id,meta.episodeId+':scene:'+id]))};}

/** Projection only: the legacy Presentation remains the authoritative animation source. */
export function adaptPresentation(p:Presentation):Episode{
 const meta=studioMetadata(p),scenes:ProductionScene[]=[],shots:Shot[]=[];
 const sectionIds=[...new Set([...p.sections.map(s=>s.id),...p.events.map(e=>e.section)])].sort((a,b)=>Math.min(p.seconds,...p.events.filter(e=>e.section===a).map(e=>e.at??0))-Math.min(p.seconds,...p.events.filter(e=>e.section===b).map(e=>e.at??0)));
 if(!sectionIds.length)sectionIds.push('default');
 for(const sectionId of sectionIds){
  const events=p.events.filter(e=>e.section===sectionId),section=p.sections.find(s=>s.id===sectionId);
  if(!events.length&&p.events.length)continue;
  const start=Math.min(...events.map(e=>e.at??0),p.seconds),nextStart=Math.min(p.seconds,...p.events.filter(e=>e.section!==sectionId&&(e.at??0)>start).map(e=>e.at??0)),end=Math.max(start,nextStart,...events.map(e=>(e.at??0)+(e.duration??0)));
  const sceneId=meta.sceneIds?.[sectionId]??meta.episodeId+':scene:'+sectionId,scene:ProductionScene={id:sceneId,sourceSectionId:sectionId,episodeId:meta.episodeId,name:section?.name??'Kohtaus',at:ticks(start),duration:ticks(end-start),shotIds:[]};
  // Several camera commands at one instant resolve to the last command, as in the stage renderer.
  const cuts=[...new Map(events.filter(e=>e.kind==='shot').sort((a,b)=>(a.at??0)-(b.at??0)).map(e=>[ticks(e.at??0),e])).values()];
  const boundaries=cuts.length?[...(cuts[0].at!>start?[{id:'implicit:'+sceneId,at:start}]:[]),...cuts]:[{id:'implicit:'+sceneId,at:start}];
  for(let i=0;i<boundaries.length;i++){
   const cut=boundaries[i],at=cut.at??start,last=Math.max(at,boundaries[i+1]?.at??end),id=cut.id.startsWith('implicit:')?sceneId+':shot:implicit':meta.episodeId+':shot:'+cut.id;
   const related=events.filter(e=>(e.at??0)<last&&((e.at??0)+(e.duration??0)>at||(e.at??0)>=at));
   const dialogue=related.filter(e=>e.kind==='dialogue');
   const state=meta.shots[id],status=state?.approvedRevision===meta.revision?state.status:state?.status==='locked'?'locked':'draft';
   shots.push({id,sourceEventId:cut.id,sceneId,name:'Kuva '+String(shots.length+1).padStart(3,'0'),at:ticks(at),duration:ticks(last-at),revision:meta.revision,status,eventIds:related.map(e=>e.id),characterIds:[...new Set(related.map(e=>e.target).filter(c=>p.characters.includes(c)))],audioStatus:!dialogue.length?'silent':dialogue.every(e=>p.audioClips.some(c=>c.dialogue===e.id))?'ready':'missing',errors:p.diagnostics.filter(d=>d.severity==='error'&&(!d.event||related.some(e=>e.id===d.event))).map(d=>({eventId:d.event,message:d.message}))});
   scene.shotIds.push(id);
  }
  scenes.push(scene);
 }
 return{id:meta.episodeId,name:p.metadata.title,revision:meta.revision,timebase:TIMEBASE,duration:ticks(p.seconds),scenes,shots};
}
export function revise(before:Presentation,after:Presentation,reason:string):StudioMetadata{
 const meta=studioMetadata(before);
 const sceneIds:Record<string,string>={},claimed=new Set<string>(),sections=[...new Set(after.events.map(e=>e.section))];
 const surviving=new Map(sections.map(section=>{const old=before.events.find(e=>after.events.some(n=>n.id===e.id&&n.section===section));return[section,old?meta.sceneIds?.[old.section]:undefined] as const;})),reserved=new Set([...surviving.values()].filter(Boolean));
 for(const section of sections){
  const candidate=surviving.get(section);
  let id=candidate&&!claimed.has(candidate)?candidate:meta.episodeId+':scene:'+section;if(claimed.has(id)||reserved.has(id)&&candidate!==id)id+=':revision:'+(meta.revision+1)+':'+Object.keys(sceneIds).length;sceneIds[section]=id;claimed.add(id);
 }
 const revision=meta.revision+1,projected={...after,production:{...after.production!,studio:{...meta,sceneIds}}},affected=affectedShots(before,projected);
 const locked=adaptPresentation(before).shots.find(s=>s.status==='locked'&&affected.has(s.id));if(locked)throw Error(locked.name+' on lukittu ja muutos vaikuttaa siihen. Avaa tämän kuvan lukitus ennen muutosta.');
 return{...meta,sceneIds,revision,rawScript:after.original,changes:[...meta.changes,{revision,reason,createdAt:new Date().toISOString()}].slice(-100),shots:Object.fromEntries(Object.entries(meta.shots).map(([id,state])=>[id,affected.has(id)?{status:'draft'}:state.approvedRevision===meta.revision?{...state,approvedRevision:revision}:state]))};
}
/** One navigation result for the board, event inspector and existing playhead. Frame is scene-local. */
export function selectShot(p:Presentation,shotId:string,fps:number,eventId?:string){
 if(!Number.isFinite(fps)||fps<1||fps>60)throw Error('Kuvataajuus on virheellinen.');
 const shot=adaptPresentation(p).shots.find(s=>s.id===shotId);if(!shot)throw Error('Kuvaa ei löydy.');
 if(eventId&&!shot.eventIds.includes(eventId))throw Error('Tapahtuma ei kuulu valittuun kuvaan.');
 const event=p.events.find(e=>e.id===(eventId??shot.sourceEventId))??p.events.find(e=>shot.eventIds.includes(e.id));
 const at=eventId?event?.at??seconds(shot.at):seconds(shot.at);
 return{shotId:shot.id,eventId:event?.id??shot.sourceEventId,frame:Math.round(at*fps)};
}
