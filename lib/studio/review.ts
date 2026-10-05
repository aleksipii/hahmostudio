import {adaptPresentation,studioMetadata,type StudioMetadata,seconds,type Shot} from './domain.ts';
import {initProduction} from '../production-model.ts';
import {validatePresentation,type Presentation} from '../presentation-model.ts';
export type ReviewComment={id:string;shotId:string;offset:number;body:string;status:'open'|'resolved';revision:number;createdAt:string;resolvedAt?:string};
export type CommentCommand={kind:'add';shotId:string;offset:number;body:string}|{kind:'resolve'|'reopen';id:string};
export function validateReviewComments(value:unknown,revision:number):ReviewComment[]{
 if(!Array.isArray(value)||value.length>1000)throw Error('Tarkistuskommenttien määrä on virheellinen.');const ids=new Set<string>();
 for(const c of value){if(!c||typeof c.id!=='string'||!/^[-a-f0-9]{36}$/.test(c.id)||ids.has(c.id)||typeof c.shotId!=='string'||!c.shotId||c.shotId.length>400||['__proto__','constructor','prototype'].includes(c.shotId)||!Number.isSafeInteger(c.offset)||c.offset<0||typeof c.body!=='string'||!c.body.trim()||c.body.length>4000||!['open','resolved'].includes(c.status)||!Number.isSafeInteger(c.revision)||c.revision<1||c.revision>revision||typeof c.createdAt!=='string'||!Number.isFinite(Date.parse(c.createdAt))||c.status==='resolved'&&(typeof c.resolvedAt!=='string'||!Number.isFinite(Date.parse(c.resolvedAt)))||c.status==='open'&&c.resolvedAt!==undefined)throw Error('Tarkistuskommentin tiedot ovat virheelliset.');ids.add(c.id);}
 return structuredClone(value);
}
export function commentProduction(p:Presentation,command:CommentCommand,expectedRevision:number):Presentation{
 const meta=studioMetadata(p);if(meta.revision!==expectedRevision)throw Error('Tuotanto muuttui. Tarkista kommentin kohde uudelleen.');const comments=meta.reviewComments??[],next=structuredClone(p);next.production??=initProduction(next);let reason:string;
 const updated:StudioMetadata={...meta,shots:{...meta.shots}};
 if(command.kind==='add'){
  const shot=adaptPresentation(p).shots.find(s=>s.id===command.shotId);if(!shot)throw Error('Kommentin kuvaa ei löydy.');
  if(!Number.isSafeInteger(command.offset)||command.offset<0||command.offset>=shot.duration)throw Error('Kommentin toistokohta ei ole kuvan sisällä.');
  if(typeof command.body!=='string'||!command.body.trim()||command.body.length>4000)throw Error('Kirjoita kommentti, enintään 4000 merkkiä.');if(comments.length>=1000)throw Error('Projektissa on enintään 1000 tarkistuskommenttia.');
  updated.reviewComments=[...comments,{id:crypto.randomUUID(),shotId:shot.id,offset:command.offset,body:command.body.trim(),status:'open',revision:meta.revision,createdAt:new Date().toISOString()}];
  if(shot.status==='approved')updated.shots[shot.id]={status:'draft'};
  reason='Tarkistuskommentti: '+shot.name;
 }else{
  const comment=comments.find(c=>c.id===command.id);if(!comment)throw Error('Kommenttia ei löydy.');
  if(comment.status===(command.kind==='resolve'?'resolved':'open'))throw Error('Kommentti on jo tässä tilassa.');
  updated.reviewComments=comments.map(c=>c.id!==comment.id?c:command.kind==='resolve'?{...c,status:'resolved',resolvedAt:new Date().toISOString()}:{...c,status:'open',resolvedAt:undefined});
  if(command.kind==='reopen'&&updated.shots[comment.shotId]?.status==='approved')updated.shots[comment.shotId]={status:'draft'};
  reason=command.kind==='resolve'?'Kommentti käsitelty':'Kommentti avattu uudelleen';
 }
 updated.changes=[...meta.changes,{revision:meta.revision,reason,createdAt:new Date().toISOString()}].slice(-100);next.production.studio=updated;return validatePresentation(next);
}
/** Shot-relative anchors follow retiming. Shortened shots clamp navigation, preserving the original anchor. */
export function commentNavigation(p:Presentation,comment:ReviewComment,fps:number):{shot:Shot;frame:number;clamped:boolean}|null{
 if(!Number.isFinite(fps)||fps<1||fps>60)throw Error('Kuvataajuus on virheellinen.');const shot=adaptPresentation(p).shots.find(s=>s.id===comment.shotId);if(!shot)return null;
 const offset=Math.min(comment.offset,Math.max(0,shot.duration-1)),last=Math.max(0,Math.ceil(seconds(shot.at+shot.duration)*fps)-1);const first=Math.min(last,Math.ceil(seconds(shot.at)*fps));return{shot,frame:Math.max(first,Math.min(last,Math.round(seconds(shot.at+offset)*fps))),clamped:offset!==comment.offset};
}
