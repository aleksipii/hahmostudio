import {localCalendarDate,validCalendarDate} from './shot-tasks.ts';
import {adaptPresentation,studioMetadata,type Shot} from './domain.ts';
import type {Presentation} from '../presentation-model.ts';
export type ShotFilter='all'|'draft'|'approved'|'locked'|'attention'|'ready'|'missingAudio'|'comments'|'overdue'|'unassigned';
/** Projection only: no new production state or automatic approvals are introduced. */
export function productionOverview(p:Presentation,today=localCalendarDate()){
 if(!validCalendarDate(today))throw Error('Työjonon vertailupäivä on virheellinen.');
 const projected=adaptPresentation(p),episode=p.events.length?projected:{...projected,scenes:[],shots:[]},comments=studioMetadata(p).reviewComments??[],byShot=new Map<string,number>(),known=new Set(episode.shots.map(s=>s.id));
 for(const c of comments)if(c.status==='open')byShot.set(c.shotId,(byShot.get(c.shotId)??0)+1);
 const tasks=studioMetadata(p).shotTasks??{};
 const hasIssues=(shot:Shot)=>!!shot.errors.length||shot.audioStatus==='missing'||!!byShot.get(shot.id)||shot.duration<=0;
 const unfinished=(shot:Shot)=>shot.status==='draft'||hasIssues(shot);
 const overdue=(shot:Shot)=>unfinished(shot)&&!!tasks[shot.id]?.dueDate&&tasks[shot.id].dueDate!<today;
 const unassigned=(shot:Shot)=>unfinished(shot)&&!tasks[shot.id]?.owner;
 const ready=(shot:Shot)=>shot.status==='draft'&&!hasIssues(shot);
 const counts={all:episode.shots.length,draft:0,approved:0,locked:0,attention:0,ready:0,missingAudio:0,comments:0,overdue:0,unassigned:0};
 for(const s of episode.shots){counts[s.status]++;if(hasIssues(s))counts.attention++;if(ready(s))counts.ready++;if(s.audioStatus==='missing')counts.missingAudio++;if(byShot.get(s.id))counts.comments++;if(overdue(s))counts.overdue++;if(unassigned(s))counts.unassigned++;}
 return{episode,counts,tasks,today,overdue,unassigned,byShot,hasIssues,ready,openComments:comments.filter(c=>c.status==='open').length,orphanComments:comments.filter(c=>c.status==='open'&&!known.has(c.shotId)).length,errors:p.diagnostics.filter(d=>d.severity==='error').length,warnings:p.diagnostics.filter(d=>d.severity==='warning').length};
}
export type ProductionOverview=ReturnType<typeof productionOverview>;
export function filterProductionShots(overview:ProductionOverview,filter:ShotFilter,query=''):Shot[]{
 const q=query.trim().toLocaleLowerCase('fi-FI'),names=new Map(overview.episode.scenes.map(s=>[s.id,s.name]));
 return overview.episode.shots.filter(s=>{
  const matches=filter==='all'||filter===s.status||filter==='attention'&&overview.hasIssues(s)||filter==='ready'&&overview.ready(s)||filter==='missingAudio'&&s.audioStatus==='missing'||filter==='comments'&&!!overview.byShot.get(s.id)||filter==='overdue'&&overview.overdue(s)||filter==='unassigned'&&overview.unassigned(s);
  return matches&&(!q||(s.name+' '+s.characterIds.join(' ')+' '+(names.get(s.sceneId)??'')+' '+(overview.tasks[s.id]?.owner??'')).toLocaleLowerCase('fi-FI').includes(q));
 });
}
/** Unfinished includes draft content and any issue on approved/locked shots. Wraps deterministically. */
export function nextUnfinishedShot(overview:ProductionOverview,currentId?:string):Shot|undefined{
 const shots=overview.episode.shots,current=shots.findIndex(s=>s.id===currentId),ordered=[...shots.slice(current+1),...shots.slice(0,current+1)];
 return ordered.find(s=>s.status==='draft'||overview.hasIssues(s));
}
