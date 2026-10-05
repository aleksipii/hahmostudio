import {resetDeltaRecoveryCache,drainDeltaRecovery} from './delta-recovery.ts';
import {desktop} from '../platform.ts';
import {verifyRecoveryAck,type DurableCommandReceipt} from './durable-command.ts';
import {readProjectHistory,type HistoryReference,type ProjectHistory} from './project-history.ts';
import {sha256} from './hash.ts';
export type RecoverySnapshot={name:string;bytes:Uint8Array;createdAt:string;previous?:boolean;replayed?:boolean;reference?:HistoryReference;history?:ProjectHistory;historyIncomplete?:boolean;stateHash?:string;archiveHash?:string};
type BrowserRecord=RecoverySnapshot&{file:string;hash:string;command?:DurableCommandReceipt};
function database():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{const request=indexedDB.open('kilsat-studio-recovery',1);request.onupgradeneeded=()=>request.result.createObjectStore('snapshots');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
async function transact<T>(mode:IDBTransactionMode,work:(store:IDBObjectStore,done:(value:T)=>void)=>void):Promise<T>{const db=await database();return new Promise((resolve,reject)=>{const transaction=db.transaction('snapshots',mode);let result:T;work(transaction.objectStore('snapshots'),value=>{result=value;});transaction.oncomplete=()=>{db.close();resolve(result);};transaction.onerror=()=>{db.close();reject(transaction.error);};transaction.onabort=()=>{db.close();reject(transaction.error??Error('Automaattitallennus keskeytyi.'));};});}
let writes=Promise.resolve();
export type RecoveryAck=HistoryReference&{createdAt:string;command?:DurableCommandReceipt};
export function saveRecovery(name:string,bytes:Uint8Array,command?:DurableCommandReceipt):Promise<RecoveryAck>{
 const copy=new Uint8Array(bytes);const next=writes.then(async()=>{
  if(command?.history)readProjectHistory(command.history);
  const hash=await sha256(copy),bridge=desktop();
  if(bridge){const ack=await bridge.recoverySave({name,bytes:copy,command});verifyRecoveryAck(ack,hash,copy.length,command);const result=ack as RecoveryAck;readProjectHistory({past:[result],future:[]});return result;}
  const record:BrowserRecord={name,bytes:copy,createdAt:new Date().toISOString(),hash,file:'snapshot-'+crypto.randomUUID()+'.hahmo',command};
  const ack:RecoveryAck={file:record.file,hash,size:copy.length,createdAt:record.createdAt,command};
  await transact<void>('readwrite',(store,done)=>{
   const latest=store.get('latest'),log=store.get('log');log.onsuccess=()=>{
    const existing=(log.result??[]) as RecoveryAck[],refs=[...(command?.history?.past??[]),...(command?.history?.future??[])];
    if(refs.some(r=>!existing.some(e=>e.file===r.file&&e.hash===r.hash&&e.size===r.size))){store.transaction.abort();return;}
    const required=new Set([record.file,...refs.map(r=>r.file),typeof latest.result==='string'?latest.result:latest.result?.file].filter(Boolean));
    const all=[ack,...existing],kept=all.filter(e=>required.has(e.file));let size=kept.reduce((n,e)=>n+e.size,0);
    for(const e of all)if(!required.has(e.file)&&kept.length<20&&size+e.size<=512*1024*1024){kept.push(e);size+=e.size;}
    for(const e of existing)if(!kept.some(v=>v.file===e.file))store.delete(e.file);
    if(latest.result)store.put(latest.result,'previous');store.put(record,record.file);store.put(record.file,'latest');store.put(kept,'log');done();
   };
  });return ack;
 });writes=next.then(()=>{},()=>{});return next;
}
export async function readRecovery():Promise<RecoverySnapshot|null>{
 const bridge=desktop();if(bridge)return bridge.recoveryLatest();
 const records=await transact<BrowserRecord[]>('readonly',(store,done)=>{
  const result:(BrowserRecord|undefined)[]=[];let pending=2;const finish=(index:number,record:BrowserRecord|undefined)=>{result[index]=record;if(--pending===0)done(result.filter((r):r is BrowserRecord=>!!r));};
  for(const [index,key] of ['latest','previous'].entries()){const request=store.get(key);request.onsuccess=()=>{if(typeof request.result==='string'){const get=store.get(request.result);get.onsuccess=()=>finish(index,get.result);}else finish(index,request.result);};}
 });
 for(const [index,record] of records.entries())if(await sha256(record.bytes)===record.hash)return{...record,previous:index>0,...(record.file?{reference:{file:record.file,hash:record.hash,size:record.bytes.length}}:{}),history:record.command?.history?readProjectHistory(record.command.history):undefined};
 if(records.length)throw Error('Automaattitallennuksen tarkistussumma ei täsmää.');return null;
}
export async function readRecoveryState(reference:HistoryReference):Promise<RecoverySnapshot>{
 readProjectHistory({past:[reference],future:[]});const bridge=desktop();
 const record=bridge?await bridge.recoveryRead(reference):await transact<BrowserRecord>('readonly',(store,done)=>{const get=store.get(reference.file);get.onsuccess=()=>done(get.result);});
 if(!record||record.bytes.length!==reference.size||(record.stateHash?record.stateHash!==reference.hash||await sha256(record.bytes)!==record.archiveHash:await sha256(record.bytes)!==reference.hash))throw Error('Kumoamishistorian palautuskohde puuttuu tai on vioittunut.');return record;
}
export async function clearRecovery(){await writes;await drainDeltaRecovery();const bridge=desktop();if(bridge){await bridge.recoveryClear();resetDeltaRecoveryCache();return;}resetDeltaRecoveryCache();return transact<void>('readwrite',(store,done)=>{store.clear();done();});}

/** One native commit / one IndexedDB transaction: never publish individual imported states. */
export async function importRecoveryStates(request:import('./delta-protocol.ts').RecoveryImport):Promise<import('./delta-protocol.ts').ImportedHistory>{
 await writes;const bridge=desktop();if(bridge?.recoveryImport){const result=await bridge.recoveryImport(request);readProjectHistory(result.history);readProjectHistory({past:[result.reference],future:[]});return result;}
 if(request.past.length+request.future.length>16)throw Error('Historiatuonnissa on liikaa tiloja.');const entries:BrowserRecord[]=[];let total=0;
 for(const bytes of [...request.past,...request.future,request.current]){if(bytes.length>128*1024*1024||(total+=bytes.length)>512*1024*1024)throw Error('Historiatuonti ylittää kokorajan.');entries.push({name:request.name,bytes:new Uint8Array(bytes),createdAt:new Date().toISOString(),hash:await sha256(bytes),file:'snapshot-'+crypto.randomUUID()+'.hahmo'});}
 const refs=entries.map(e=>({file:e.file,hash:e.hash,size:e.bytes.length})),history={past:refs.slice(0,request.past.length),future:refs.slice(request.past.length,-1)};entries.at(-1)!.command={id:crypto.randomUUID(),kind:'history-import-current',history};
 await transact<void>('readwrite',(store,done)=>{for(const e of entries)store.put(e,e.file);store.put(entries.at(-1)!.file,'latest');store.delete('previous');store.put(entries.map(e=>({file:e.file,hash:e.hash,size:e.bytes.length,createdAt:e.createdAt,command:e.command})),'log');done();});return{history,reference:refs.at(-1)!};
}
