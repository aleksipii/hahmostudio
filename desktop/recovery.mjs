import {DeltaJournal} from './delta-journal.mjs';
import {ProjectChunks} from './project-chunks.mjs';
import {readFile,writeFile,mkdir,rename,rm,open,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const limit=128*1024*1024;
function history(value){if(value===undefined)return undefined;if(!value||!Array.isArray(value.past)||!Array.isArray(value.future)||value.past.length+value.future.length>16||[...value.past,...value.future].some(r=>!r||!/^snapshot-[a-f0-9-]{36}\.hahmo$/.test(r.file)||!/^[a-f0-9]{64}$/.test(r.hash)||!Number.isInteger(r.size)||r.size<1||r.size>limit))throw Error('Kumoamishistorian viite on virheellinen.');return{past:value.past.map(r=>({file:r.file,hash:r.hash,size:r.size})),future:value.future.map(r=>({file:r.file,hash:r.hash,size:r.size}))};}

/** Fixed paths, serialized writes, immutable snapshots and one atomically committed index. */
export class RecoveryStore{
 constructor(dataDir){this.dir=join(dataDir,'recovery');this.writes=Promise.resolve();this.chunks=new ProjectChunks(this.dir);this.delta=new DeltaJournal(this.dir,{externalRead:r=>this.readLegacy(r)});}
 enqueue(work){const pending=this.writes.then(work);this.writes=pending.catch(()=>{});return pending;}
 async syncDirectory(){const handle=await open(this.dir,'r');try{await handle.sync();}finally{await handle.close();}}
 async index(){try{const value=JSON.parse(await readFile(join(this.dir,'journal.json'),'utf8'));if(value.schemaVersion!==1||!Array.isArray(value.entries)||value.entries.length>2||value.entries.some(e=>!e||(e.command&&(!/^[a-f0-9-]{36}$/.test(e.command.id)||!/^[-a-z]{1,80}$/.test(e.command.kind)))||!/^snapshot-[a-f0-9-]{36}\.hahmo$/.test(e.file)||!/^[a-f0-9]{64}$/.test(e.hash)||typeof e.name!=='string'||e.name.length>256||!Number.isFinite(Date.parse(e.createdAt))||!Number.isInteger(e.size)||e.size<1||e.size>limit))throw Error('Palautuksen hakemisto on vioittunut.');return value;}catch(e){if(e.code==='ENOENT')return{schemaVersion:1,entries:[]};throw e;}}
 async replayRecords(){
  const records=[];for(const file of await readdir(this.dir).catch(e=>{if(e.code==='ENOENT')return[];throw e;})){
   if(!/^commit-[a-f0-9-]{36}\.json$/.test(file))continue;
   try{const bytes=await readFile(join(this.dir,file));if(bytes.length>4096)continue;const envelope=JSON.parse(bytes.toString()),r=envelope.record;
    if(envelope.hash!==hash(Buffer.from(JSON.stringify(r)))||r?.schemaVersion!==1||!Number.isSafeInteger(r.sequence)||r.sequence<1)continue;
    const e=r.entry;this.validateEntries([e]);history(e.command?.history);if(file!=='commit-'+e.file.slice(9,-6)+'.json')continue;records.push({file,...r});
   }catch{/* A partial/corrupt commit is never replayed. */}
  }return records.sort((a,b)=>b.sequence-a.sequence);
 }
 validateEntries(entries){if(entries.some(e=>!e||(e.command&&(!/^[a-f0-9-]{36}$/.test(e.command.id)||!/^[-a-z]{1,80}$/.test(e.command.kind)))||!/^snapshot-[a-f0-9-]{36}\.hahmo$/.test(e.file)||!/^[a-f0-9]{64}$/.test(e.hash)||typeof e.name!=='string'||e.name.length>256||!Number.isFinite(Date.parse(e.createdAt))||!Number.isInteger(e.size)||e.size<1||e.size>limit))throw Error('Palautuksen commit on vioittunut.');}
 async committedIndex(){let index,error;try{index=await this.index();}catch(e){error=e;}const records=await this.replayRecords();if(!records.length){if(error)throw error;return{index,records,replayed:false};}
  const entries=[...records.map(r=>r.entry),...(index?.entries??[])].filter((e,i,a)=>a.findIndex(v=>v.file===e.file)===i);
  return{index:{schemaVersion:1,entries},records,replayed:!!error||index?.entries[0]?.file!==entries[0]?.file};
 }
 async prune(index){for(const file of await readdir(this.dir).catch(e=>{if(e.code==='ENOENT')return[];throw e;}))if(/^snapshot-[a-f0-9-]{36}\.hahmo$/.test(file)&&!index.entries.some(e=>e.file===file))await rm(join(this.dir,file),{force:true});}
 save({name,bytes,command}){return this.enqueue(async()=>{
  if(typeof name!=='string'||name.length>256||/[\x00-\x1f]/.test(name)||!(bytes instanceof Uint8Array)||!bytes.length||bytes.length>limit)throw Error('Automaattitallennus on virheellinen.');
  if(command&&(!/^[a-f0-9-]{36}$/.test(command.id)||typeof command.kind!=='string'||!/^[-a-z]{1,80}$/.test(command.kind)))throw Error('Komentojournalin tunniste on virheellinen.');
  command=command?{id:command.id,kind:command.kind,...(command.history?{history:history(command.history)}:{})}:undefined;
  await mkdir(this.dir,{recursive:true,mode:0o700});const {index,records}=await this.committedIndex();const references=[...(command?.history?.past??[]),...(command?.history?.future??[])];for(const r of references)if(!index.entries.some(e=>e.file===r.file&&e.hash===r.hash&&e.size===r.size))throw Error('Kumoamishistorian palautuskohde puuttuu.');if(references.reduce((n,r)=>n+r.size,bytes.length)>512*1024*1024)throw Error('Kumoamishistorian kokoraja ylittyy.');const digest=hash(bytes);if(!command&&index.entries[0]?.hash===digest){const existing=await readFile(join(this.dir,index.entries[0].file)).catch(()=>null);if(existing&&hash(await this.chunks.decode(existing))===digest){await this.syncDirectory();return index.entries[0];}}
  const encoded=await this.chunks.encode(bytes);
  const file='snapshot-'+randomUUID()+'.hahmo',path=join(this.dir,file);const handle=await open(path,'wx',0o600);try{await handle.writeFile(encoded);await handle.sync();}finally{await handle.close();}
  const entry={file,name,hash:digest,size:bytes.length,createdAt:new Date().toISOString(),...(command?{command}:{})},next={schemaVersion:1,entries:[entry,...index.entries].slice(0,2)},temp=join(this.dir,'journal.next');
  const record={schemaVersion:1,sequence:(records[0]?.sequence??0)+1,entry},commitPath=join(this.dir,'commit-'+file.slice(9,-6)+'.json'),commit=await open(commitPath,'wx',0o600);try{await commit.writeFile(JSON.stringify({record,hash:hash(Buffer.from(JSON.stringify(record)))}));await commit.sync();}finally{await commit.close();}
  const journal=await open(temp,'w',0o600);try{await journal.writeFile(JSON.stringify(next));await journal.sync();}finally{await journal.close();}await rename(temp,join(this.dir,'journal.json'));await this.syncDirectory();
  const all=[{file:commitPath.split('/').at(-1),...record},...records],required=new Set([entry.file,...references.map(r=>r.file),...next.entries.map(e=>e.file)]);
  let total=all.filter(r=>required.has(r.entry.file)).reduce((n,r)=>n+r.entry.size,0);const keep=all.filter(r=>required.has(r.entry.file));
  for(const r of all)if(!required.has(r.entry.file)&&keep.length<20&&total+r.entry.size<=512*1024*1024){keep.push(r);total+=r.entry.size;}
  const retained=new Set([...keep.map(r=>r.entry.file),...next.entries.map(e=>e.file)]);
  for(const old of all)if(!retained.has(old.entry.file)){await rm(join(this.dir,old.file),{force:true});await rm(join(this.dir,old.entry.file),{force:true});}
  await this.prune({entries:[...keep.map(r=>r.entry),...next.entries]});const retainedBytes=await Promise.all([...retained].map(f=>readFile(join(this.dir,f))));await this.chunks.prune(retainedBytes);
  return entry;
 });}
 latestLegacy(){return this.enqueue(async()=>{const {index,replayed}=await this.committedIndex(),errors=[];for(const entry of index.entries){try{const bytes=await this.chunks.decode(await readFile(join(this.dir,entry.file)));if(bytes.length!==entry.size||hash(bytes)!==entry.hash)throw Error('Palautustiedoston tarkistussumma ei täsmää.');const h=history(entry.command?.history),available=new Set(index.entries.map(e=>e.file)),filtered=h?{past:h.past.filter(r=>available.has(r.file)),future:h.future.filter(r=>available.has(r.file))}:undefined;return{name:entry.name,bytes,createdAt:entry.createdAt,previous:errors.length>0,replayed,reference:{file:entry.file,hash:entry.hash,size:entry.size},history:filtered,historyIncomplete:!!h&&(h.past.length!==filtered.past.length||h.future.length!==filtered.future.length)};}catch(e){errors.push(e.message);}}if(errors.length)throw Error(errors.join(' '));return null;});}
 readLegacy(reference){return this.enqueue(async()=>{const {index}=await this.committedIndex();const entry=index.entries.find(e=>e.file===reference?.file&&e.hash===reference?.hash&&e.size===reference?.size);if(!entry)throw Error('Kumoamishistorian palautuskohde puuttuu.');const bytes=await this.chunks.decode(await readFile(join(this.dir,entry.file)));if(bytes.length!==entry.size||hash(bytes)!==entry.hash)throw Error('Kumoamishistorian tarkistussumma ei täsmää.');return{name:entry.name,bytes,createdAt:entry.createdAt};});}
 transaction(request){return this.delta.transaction(request);}
 importBatch(request){return this.delta.importBatch(request);}
 async latest(){const [delta,legacy]=await Promise.all([this.delta.latest(),this.latestLegacy()]);return delta&&(!legacy||Date.parse(delta.createdAt)>=Date.parse(legacy.createdAt))?delta:legacy;}
 async read(reference){return await this.delta.owns(reference)?this.delta.read(reference):this.readLegacy(reference);}
 clear(){return this.enqueue(async()=>{await this.delta.queue;await rm(this.dir,{recursive:true,force:true});this.delta.loaded=false;this.delta.verifiedResources.clear();});}
}
