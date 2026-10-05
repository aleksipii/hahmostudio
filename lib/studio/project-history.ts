export type HistoryReference={file:string;hash:string;size:number};
export type ProjectHistory={past:HistoryReference[];future:HistoryReference[]};
export const emptyProjectHistory=():ProjectHistory=>({past:[],future:[]});
export function readProjectHistory(value:unknown):ProjectHistory{
 const h=value as ProjectHistory;
 if(!h||!Array.isArray(h.past)||!Array.isArray(h.future)||h.past.length+h.future.length>16||[...h.past,...h.future].some(r=>!r||!/^snapshot-[a-f0-9-]{36}\.hahmo$/.test(r.file)||!/^[a-f0-9]{64}$/.test(r.hash)||!Number.isInteger(r.size)||r.size<1||r.size>128*1024*1024))throw Error('Projektin kumoamishistoria on virheellinen.');
 const reference=(r:HistoryReference)=>({file:r.file,hash:r.hash,size:r.size});
 return {past:h.past.map(reference),future:h.future.map(reference)};
}
export function nextProjectHistory(h:ProjectHistory,current:HistoryReference,mode:'edit'|'undo'|'redo'):ProjectHistory{
 const next=readProjectHistory(h),reference={file:current.file,hash:current.hash,size:current.size};
 if(mode==='edit'){next.past.push(reference);next.future=[];}
 else if(mode==='undo'){if(!next.past.length)throw Error('Ei kumottavaa muutosta.');next.past.pop();next.future.push(reference);}
 else {if(!next.future.length)throw Error('Ei uudelleen tehtävää muutosta.');next.future.pop();next.past.push(reference);}
 const budget=384*1024*1024;
 while(next.past.length+next.future.length>16||[...next.past,...next.future].reduce((n,r)=>n+r.size,0)>budget){if(next.past.length)next.past.shift();else next.future.shift();}
 return next;
}
