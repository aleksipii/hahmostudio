import {adaptPresentation,studioMetadata} from './domain.ts';
import {initProduction} from '../production-model.ts';
import {validatePresentation,type Presentation} from '../presentation-model.ts';
export type ShotTask={owner?:string;dueDate?:string;updatedAt:string};
export type TaskCommand={shotId:string;owner:string;dueDate:string};
export function validCalendarDate(value:string){if(!/^[1-9]\d{3}-\d{2}-\d{2}$/.test(value))return false;const date=new Date(value+'T00:00:00Z');return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;}
export function localCalendarDate(date=new Date()){return String(date.getFullYear()).padStart(4,'0')+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');}
export function validateShotTasks(value:unknown):Record<string,ShotTask>{
 const tasks=value as Record<string,ShotTask>;if(!tasks||typeof tasks!=='object'||Array.isArray(tasks)||Object.keys(tasks).length>2500)throw Error('Kuvien työjonotiedot ovat virheelliset.');
 for(const [id,t] of Object.entries(tasks))if(!id||id.length>400||['__proto__','constructor','prototype'].includes(id)||!t||t.owner!==undefined&&(typeof t.owner!=='string'||!t.owner.trim()||t.owner.length>120)||t.dueDate!==undefined&&(typeof t.dueDate!=='string'||!validCalendarDate(t.dueDate))||t.owner===undefined&&t.dueDate===undefined||typeof t.updatedAt!=='string'||!Number.isFinite(Date.parse(t.updatedAt)))throw Error('Kuvan vastuuhenkilö tai määräaika on virheellinen.');return structuredClone(tasks);
}
/** Scheduling is review metadata, never animation or an automatic content unlock. */
export function assignShotTask(p:Presentation,command:TaskCommand,expectedRevision:number):Presentation{
 const meta=studioMetadata(p);if(meta.revision!==expectedRevision)throw Error('Tuotanto muuttui. Tarkista työjonon kohde uudelleen.');const shot=adaptPresentation(p).shots.find(s=>s.id===command.shotId);if(!shot)throw Error('Työjonon kuvaa ei löydy.');
 if(typeof command.owner!=='string'||command.owner.length>120||typeof command.dueDate!=='string'||command.dueDate&&!validCalendarDate(command.dueDate))throw Error('Anna vastuuhenkilö (enintään 120 merkkiä) ja kelvollinen määräaika.');
 const tasks={...meta.shotTasks},owner=command.owner.trim();if(!owner&&!command.dueDate)delete tasks[shot.id];else tasks[shot.id]={...(owner?{owner}:{}),...(command.dueDate?{dueDate:command.dueDate}:{}),updatedAt:new Date().toISOString()};
 const next=structuredClone(p);next.production??=initProduction(next);next.production.studio={...meta,shotTasks:tasks,changes:[...meta.changes,{revision:meta.revision,reason:'Työjonon vastuu/määräaika: '+shot.name,createdAt:new Date().toISOString()}].slice(-100)};return validatePresentation(next);
}

export type BatchTaskCommand={shotIds:string[];owner?:string;dueDate?:string};
/** Omitted fields are retained; explicit empty strings clear only that field. */
export function assignShotTasks(p:Presentation,command:BatchTaskCommand,expectedRevision:number):Presentation{
 const meta=studioMetadata(p);
 if(meta.revision!==expectedRevision)throw Error('Tuotanto muuttui. Tarkista työjonon kohteet uudelleen.');
 const ids=command.shotIds;
 if(!Array.isArray(ids)||!ids.length||ids.length>2500||new Set(ids).size!==ids.length)throw Error('Valitse 1–2500 eri kuvaa.');
 const known=new Set(adaptPresentation(p).shots.map(s=>s.id));
 if(ids.some(id=>!known.has(id)))throw Error('Työjonon kuvaa ei löydy.');
 if(command.owner===undefined&&command.dueDate===undefined)throw Error('Valitse muutettava tieto.');
 if(command.owner!==undefined&&(typeof command.owner!=='string'||command.owner.length>120)||command.dueDate!==undefined&&(typeof command.dueDate!=='string'||command.dueDate!==''&&!validCalendarDate(command.dueDate)))throw Error('Anna kelvollinen vastuuhenkilö ja määräaika.');
 const tasks={...meta.shotTasks},now=new Date().toISOString();
 for(const id of ids){const old=tasks[id],owner=command.owner===undefined?old?.owner:command.owner.trim(),dueDate=command.dueDate===undefined?old?.dueDate:command.dueDate;
 if(owner===old?.owner&&dueDate===old?.dueDate)continue;
 if(!owner&&!dueDate)delete tasks[id];else tasks[id]={...(owner?{owner}:{}),...(dueDate?{dueDate}:{}),updatedAt:now};}
 const next=structuredClone(p);next.production??=initProduction(next);
 next.production.studio={...meta,shotTasks:tasks,changes:[...meta.changes,{revision:meta.revision,reason:'Työjonon yhteismuokkaus: '+ids.length+' kuvaa',createdAt:now}].slice(-100)};
 return validatePresentation(next);
}
