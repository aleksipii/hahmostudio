import {validShotSort,type ShotSort} from './shot-sort.ts';
import type {ShotFilter} from './production-overview.ts';
export const shotViewKey='kilsat-shot-views-v1';
export const shotFilters:ShotFilter[]=['all','draft','approved','locked','attention','ready','missingAudio','comments','overdue','unassigned'];
export type SavedShotView={id:string;name:string;filter:ShotFilter;query:string;sort?:ShotSort;descending?:boolean};
export type ShotViews={schemaVersion:1;views:SavedShotView[]};
export function readShotViews(raw:string|null):ShotViews{
 if(raw===null)return{schemaVersion:1,views:[]};if(raw.length>40000)throw Error('Hakunäkymien asetustiedosto on liian suuri.');
 const data=JSON.parse(raw) as ShotViews;
 if(!data||data.schemaVersion!==1||!Array.isArray(data.views)||data.views.length>20)throw Error('Tallennettujen hakunäkymien versio tai rakenne ei ole tuettu.');
 const ids=new Set<string>(),names=new Set<string>();
 for(const v of data.views){if(!v||typeof v.id!=='string'||!/^[-\w]{1,80}$/.test(v.id)||ids.has(v.id)||typeof v.name!=='string'||!v.name.trim()||v.name.length>80||names.has(v.name.trim().toLocaleLowerCase('fi-FI'))||!shotFilters.includes(v.filter)||v.descending!==undefined&&typeof v.descending!=='boolean'||v.sort!==undefined&&!validShotSort(v.sort)||typeof v.query!=='string'||v.query.length>500)throw Error('Tallennettu hakunäkymä on virheellinen.');ids.add(v.id);names.add(v.name.trim().toLocaleLowerCase('fi-FI'));}
 return{schemaVersion:1,views:data.views.map(v=>({id:v.id,name:v.name.trim(),filter:v.filter,query:v.query,...(v.sort?{sort:v.sort}:{}),...(v.descending!==undefined?{descending:v.descending}:{})}))};
}
export function addShotView(data:ShotViews,view:SavedShotView){return readShotViews(JSON.stringify({schemaVersion:1,views:[...data.views,{...view,name:view.name.trim()}]}));}
export function removeShotView(data:ShotViews,id:string){return readShotViews(JSON.stringify({...data,views:data.views.filter(v=>v.id!==id)}));}
export function storeShotViews(storage:Pick<Storage,'setItem'>,data:ShotViews){const checked=readShotViews(JSON.stringify(data));storage.setItem(shotViewKey,JSON.stringify(checked));return checked;}
