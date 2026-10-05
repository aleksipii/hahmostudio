import {adaptPresentation,selectShot,type Shot} from './domain.ts';
import type {Presentation} from '../presentation-model.ts';
export type ProductionIssue={id:string;severity:'error'|'warning';code:string;message:string;recommendation:string;eventId?:string;shotId?:string;scope:'event'|'project'|'orphan'};
function recommendation(code:string){
 if(/audio|voice/.test(code))return 'Valitse repliikki ja liitä tai tarkista sen äänitiedosto repliikkiäänissä.';
 if(/rig/.test(code))return 'Tarkista hahmon osat ja nivelmääritys Hahmo-työtilassa.';
 if(/camera|flat-environment/.test(code))return 'Tarkista valitun kuvan kamera ohjauspöydässä ja hahmojen esitystapa.';
 if(/environment|prop|phone/.test(code))return 'Tarkista miljöö, esine ja haltija ohjauspöydässä.';
 if(/asset|binding/.test(code))return 'Tarkista hahmosidonta ja tuodun hahmopaketin saatavuus.';
 return 'Tarkista alkuperäinen käsikirjoitus ja ohjauspöydän tapahtuman asetukset. Korjaa tieto ja muodosta esitys uudelleen.';
}
/** Global and deleted-event diagnostics must never pretend to belong to the first shot. */
export function productionIssues(p:Presentation):ProductionIssue[]{
 const shots=p.events.length?adaptPresentation(p).shots:[],known=new Set(p.events.map(e=>e.id));
 const issue=(code:string,severity:'error'|'warning',message:string,eventId:string|undefined,id:string):ProductionIssue=>{
  const shot=eventId&&shots.find(s=>s.eventIds.includes(eventId));
  return{id,code,severity,message,recommendation:recommendation(code),...(eventId?{eventId}:{}),...(shot?{shotId:shot.id}:{}),scope:!eventId?'project':known.has(eventId)&&shot?'event':'orphan'};
 };
 const list=p.diagnostics.map((d,i)=>issue(d.code,d.severity,d.message,d.event,'diagnostic:'+i));
 for(const e of p.events)if(e.kind==='dialogue'&&!p.audioClips.some(c=>c.dialogue===e.id)&&!list.some(d=>d.eventId===e.id&&/audio|voice/.test(d.code)))list.push(issue('missing-audio-reference','error','Repliikiltä puuttuu ääniviite: '+(e.text??e.value),e.id,'audio:'+e.id));
 return list;
}
export function issueNavigation(p:Presentation,issueId:string,fps:number):{shot:Shot;eventId:string;frame:number}|undefined{
 const issue=productionIssues(p).find(i=>i.id===issueId);if(!issue?.shotId||!issue.eventId)return;
 const shot=adaptPresentation(p).shots.find(s=>s.id===issue.shotId);if(!shot)return;
 const nav=selectShot(p,shot.id,fps,issue.eventId);return{shot,eventId:nav.eventId,frame:nav.frame};
}

export function filterProductionIssues(issues:ProductionIssue[],severity='all',query=''){
 const q=query.trim().toLocaleLowerCase('fi-FI');return issues.filter(i=>(severity==='all'||i.severity===severity)&&(!q||(i.code+' '+i.message+' '+i.recommendation).toLocaleLowerCase('fi-FI').includes(q)));
}
/** Only actionable current targets; global/orphan messages remain in the visible list. */
export function nextProductionIssue(issues:ProductionIssue[],currentId?:string){
 const actionable=issues.filter(i=>i.scope==='event'),index=actionable.findIndex(i=>i.id===currentId);return actionable.length?actionable[(index+1)%actionable.length]:undefined;
}
