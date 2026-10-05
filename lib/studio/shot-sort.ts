import type {Shot} from './domain.ts';
import type {ProductionOverview} from './production-overview.ts';
export const shotSortNames={timeline:'Jakson järjestys',deadline:'Määräaika · lähin ensin',owner:'Vastuuhenkilö · A–Ö',status:'Tila · luonnokset ensin'};
export type ShotSort=keyof typeof shotSortNames;
export function validShotSort(value:unknown):value is ShotSort{return typeof value==='string'&&Object.hasOwn(shotSortNames,value);}
/** Stable projection; missing scheduling values are last, ties retain episode order. */
export function sortProductionShots(overview:ProductionOverview,shots:Shot[],sort:ShotSort,descending=false):Shot[]{
 if(!validShotSort(sort))throw Error('Kuvien lajittelu on virheellinen.');
 const order=new Map(overview.episode.shots.map((s,i)=>[s.id,i])),status={draft:0,approved:1,locked:2};
 const compareText=(a:string|undefined,b:string|undefined)=>!a&&!b?0:!a?1:!b?-1:a.localeCompare(b,'fi-FI',{sensitivity:'base',numeric:true});
 return [...shots].sort((a,b)=>{
 const ta=overview.tasks[a.id],tb=overview.tasks[b.id];
 const empty=sort==='deadline'?!ta?.dueDate||!tb?.dueDate:sort==='owner'?!ta?.owner||!tb?.owner:false;
 const compared=sort==='deadline'?compareText(ta?.dueDate,tb?.dueDate):sort==='owner'?compareText(ta?.owner,tb?.owner):sort==='status'?status[a.status]-status[b.status]:0;
 return compared*(descending&&!empty?-1:1)||((order.get(a.id)??Infinity)-(order.get(b.id)??Infinity))*(sort==='timeline'&&descending?-1:1);
 });
}
