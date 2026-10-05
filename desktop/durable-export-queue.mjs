import {ExportQueue} from './export-queue.mjs';
const active=['queued','preparing','rendering','packing'];
/** Durable checkpoints precede dispatch. Recovered work requires an explicit retry. */
export class DurableExportQueue extends ExportQueue{
 constructor({run,notify,store}){super({run,notify});this.store=store;this.saves=Promise.resolve();this.lastWrite=this.saves;this.mutations=Promise.resolve();this.paused=true;this.signature='';this.persistenceError=null;this.ready=this.restore();this.ready.catch(()=>{});}
 async restore(){this.jobs=await this.store.load();for(const j of this.jobs)if(active.includes(j.state)){j.state='interrupted';j.error='Sovellus päättyi kesken viennin. Tarkista kohde ja käynnistä sama tilannekuva uudelleen.';j.progress=0;}this.emit();await this.flush();this.paused=false;}
 records(){return this.list().map(j=>{if(j.state==='done'){delete j.snapshotHash;delete j.snapshotSize;}return j;});}
 emit(){this.notify(this.list());if(!this.store)return;const records=this.records(),signature=JSON.stringify(records.map(j=>[j.id,j.state,j.error,j.snapshotHash]));if(signature===this.signature)return;this.signature=signature;const write=this.saves.then(()=>this.store.write(records));this.lastWrite=write;this.saves=write.then(()=>{this.persistenceError=null;},e=>{this.persistenceError=e;this.notify(this.list().map(j=>({...j,error:'Vientijonon tallennus epäonnistui: '+e.message})));});}
 async flush(){await this.lastWrite;}
 enqueue(request){if(!(request.bytes instanceof Uint8Array)||!request.bytes.length||request.bytes.length>128*1024**2)throw Error('Viennin projektitiedosto on virheellinen.');request={...request,bytes:new Uint8Array(request.bytes),preset:structuredClone(request.preset),...(request.manifest?{manifest:structuredClone(request.manifest)}:{})};const task=this.mutations.then(async()=>{
  await this.ready;this.paused=true;let hash,id;
  try{
   if(this.jobs.length>=20)throw Error('Vientihistoriassa on 20 työtä. Poista itse tarpeettomia töitä ennen uuden lisäämistä.');
   if(this.jobs.filter(j=>active.includes(j.state)).length>=4)throw Error('Jonossa voi olla enintään neljä keskeneräistä vientiä.');
   if(this.jobs.filter(j=>j.state!=='done').reduce((n,j)=>n+(j.snapshotSize??0),0)+request.bytes.length>256*1024**2)throw Error('Säilytetyt vientivedokset ylittävät 256 Mt. Poista tarpeettomia keskeytyneitä töitä.');
   hash=await this.store.put(request.bytes);
   // Base enqueue stays synchronous for existing callers; dispatch is paused until its checkpoint commits.
   id=super.enqueue({...request,snapshotHash:hash,snapshotSize:request.bytes.length});await this.flush();return id;
  }catch(e){if(id){this.jobs=this.jobs.filter(j=>j.id!==id);this.snapshots.delete(id);this.emit();try{await this.flush();}catch{/* Do not dispatch when the rollback cannot be persisted. */}}if(hash)await this.store.release(hash);throw e;}
  finally{this.paused=false;void this.pump();}
 });this.mutations=task.catch(()=>{});return task;}
 async pump(){
  if(this.paused||this.active||this.persistenceError)return;const job=this.jobs.find(j=>j.state==='queued');if(!job)return;
  this.active=job.id;job.controller=new AbortController();job.state='preparing';this.emit();
  try{await this.flush();const bytes=this.snapshots.get(job.id)??await this.store.read(job.snapshotHash);job.controller.signal.throwIfAborted();await this.run(job,bytes,job.controller.signal,patch=>{if(job.controller.signal.aborted)return;Object.assign(job,patch);this.emit();});if(job.controller.signal.aborted)job.state='canceled';else{job.state='done';job.progress=1;this.snapshots.delete(job.id);}}
  catch(e){job.state=job.controller.signal.aborted?'canceled':'error';job.error=String(e.message).slice(0,2000);}
  finally{delete job.controller;this.emit();try{await this.flush();}catch{/* emit reports the durable checkpoint error. */}this.active=null;void this.pump();}
 }
 forget(id){const j=this.jobs.find(j=>j.id===id);if(j?.state==='interrupted'){this.jobs=this.jobs.filter(j=>j.id!==id);this.snapshots.delete(id);this.emit();return;}super.forget(id);}
 retry(id){const j=this.jobs.find(j=>j.id===id);if(!j||!['error','canceled','interrupted'].includes(j.state))throw Error('Vientiä ei voi yrittää uudelleen.');if(this.jobs.filter(j=>active.includes(j.state)).length>=4)throw Error('Jonossa on jo neljä keskeneräistä työtä.');j.state='queued';j.progress=0;delete j.error;this.emit();void this.flush().then(()=>this.pump()).catch(()=>{});}
}
