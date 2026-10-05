import {join,isAbsolute} from 'node:path';
import {ArchiveStore} from './archive-store.mjs';
const states=['queued','preparing','rendering','packing','done','canceled','error','interrupted'];
export class ExportQueueStore{
 constructor(dataDir,validatePreset){this.store=new ArchiveStore(join(dataDir,'render-queue'),512*1024**2);this.validatePreset=validatePreset;this.reserved=new Set();}
 validate(index){
  if(!index||index.schemaVersion!==1||!Array.isArray(index.jobs)||index.jobs.length>20)throw Error('Vientijonon hakemisto on vioittunut.');
  const ids=new Set();
  for(const j of index.jobs){if(!j||!/^[-a-f0-9]{36}$/.test(j.id)||ids.has(j.id)||typeof j.name!=='string'||j.name.length>200||typeof j.destination!=='string'||j.destination.length>4096||!isAbsolute(j.destination)||/[\x00-\x1f]/.test(j.destination)||!states.includes(j.state)||!Number.isFinite(j.progress)||j.progress<0||j.progress>1||j.snapshotHash!==undefined&&(!/^[a-f0-9]{64}$/.test(j.snapshotHash)||!Number.isInteger(j.snapshotSize)||j.snapshotSize<1||j.snapshotSize>128*1024**2)||j.state!=='done'&&!j.snapshotHash||j.error!==undefined&&(typeof j.error!=='string'||j.error.length>2000)||j.manifest&&JSON.stringify(j.manifest).length>1024*1024)throw Error('Tallennetun vientityön tiedot ovat virheelliset.');ids.add(j.id);this.validatePreset(j.preset);}
  return index;
 }
 load(){return this.store.serial(async()=>{const index=this.validate(await this.store.index({schemaVersion:1,jobs:[]}));await this.store.prune(new Set(index.jobs.flatMap(j=>j.snapshotHash?[j.snapshotHash]:[])));return structuredClone(index.jobs);});}
 put(bytes){return this.store.serial(async()=>{const hash=await this.store.put(bytes);this.reserved.add(hash);return hash;});}
 read(hash){return this.store.serial(()=>this.store.get(hash));}
 write(jobs){const index=this.validate({schemaVersion:1,jobs:structuredClone(jobs)});return this.store.serial(async()=>{await this.store.writeIndex(index);const used=new Set(index.jobs.flatMap(j=>j.snapshotHash?[j.snapshotHash]:[]));for(const h of used)this.reserved.delete(h);await this.store.prune(new Set([...used,...this.reserved]));});}
 release(hash){return this.store.serial(async()=>{this.reserved.delete(hash);const index=this.validate(await this.store.index({schemaVersion:1,jobs:[]}));await this.store.prune(new Set([...this.reserved,...index.jobs.flatMap(j=>j.snapshotHash?[j.snapshotHash]:[])]));});}
}
