import {contentChunks} from './content-chunks.ts';
import {desktop} from '../platform.ts';
import {prepareProject,saveProject,type ProjectAudio} from '../project-file.ts';
import type {PsdDocument} from '../psd-model.ts';import type {Animation} from '../animation-model.ts';import type {Scene} from '../scene-model.ts';
import {semanticDelta,equalJson} from './semantic-delta.ts';import {sha256} from './hash.ts';import type {DurableCommandReceipt} from './durable-command.ts';
import {saveRecovery,type RecoveryAck} from './recovery.ts';import {readProjectHistory,type HistoryReference} from './project-history.ts';
import type {ResourceReference,DeltaRequest} from './delta-protocol.ts';
const chunkLists=new WeakMap<Uint8Array,Promise<{hash:string;size:number;bytes:Uint8Array}[]>>();
function resourceChunks(bytes:Uint8Array){let list=chunkLists.get(bytes);if(!list){list=Promise.all(contentChunks(bytes).map(async part=>({hash:await resourceHash(part),size:part.length,bytes:part})));if(!bytes.length)list=Promise.resolve([{hash:emptyHash,size:0,bytes}]);chunkLists.set(bytes,list);}return list;}
const emptyHash='e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
const hashes=new WeakMap<Uint8Array,Promise<string>>();
const resourceHash=(b:Uint8Array)=>{let h=hashes.get(b);if(!h){h=sha256(b);hashes.set(b,h);}return h;};
let cache:{ref:HistoryReference;metadata:unknown;resources:ResourceReference[]}|undefined;
const acknowledgedChunks=new WeakMap<object,Set<string>>();
export function drainDeltaRecovery(){return writes;}
export function resetDeltaRecoveryCache(){cache=undefined;const bridge=desktop();if(bridge)acknowledgedChunks.delete(bridge);}
let writes=Promise.resolve();
export function saveProjectRecovery(doc:PsdDocument,animation:Animation,audio:ProjectAudio|undefined,scene:Scene,command:DurableCommandReceipt,base?:HistoryReference):Promise<RecoveryAck>{
 const next=writes.then(async()=>{
  const bridge=desktop();if(!bridge?.recoveryTransaction){const blob=await saveProject(doc,animation,audio,scene);return saveRecovery(doc.name,new Uint8Array(await blob.arrayBuffer()),command);}
  const prepared=await prepareProject(doc,animation,audio,scene),resources:ResourceReference[]=[];const content=new Map<string,Uint8Array>();
  for(const [path,bytes] of Object.entries(prepared.files)){const hash=await resourceHash(bytes),chunks=await resourceChunks(bytes);resources.push({path,hash,size:bytes.length,chunks:chunks.map(c=>({hash:c.hash,size:c.size}))});for(const c of chunks)content.set(c.hash,c.bytes);}
  const previous=base&&cache?.ref.file===base.file&&cache.ref.hash===base.hash?cache:undefined,old=new Map(previous?.resources.map(r=>[r.path,r])??[]);
  const patch={set:resources.filter(r=>!equalJson(old.get(r.path),r)),remove:[...old.keys()].filter(p=>!resources.some(r=>r.path===p))};
  const delta=semanticDelta(previous?.metadata??null,prepared.metadata),allChunks=[...new Map(resources.flatMap(r=>r.chunks??[{hash:r.hash,size:r.size}]).map(c=>[c.hash,c])).values()],known=acknowledgedChunks.get(bridge)??new Set<string>(),unknown=allChunks.filter(c=>!known.has(c.hash)),missing=unknown.length?await bridge.recoveryResources(unknown):[];
  if(missing.some(h=>!content.has(h)))throw Error('Resurssikysely palautti tuntemattoman viitteen.');
  const request:DeltaRequest={version:1,name:doc.name,...(previous?{base:previous.ref}:{}),delta,resources:patch,uploads:[...new Set(missing)].map(hash=>({hash,bytes:content.get(hash)!})),command};
  const requestHash=await sha256(new TextEncoder().encode(JSON.stringify({version:1,name:request.name,base:request.base??null,delta:request.delta,resources:request.resources,command:request.command})));
  const ack=await bridge.recoveryTransaction(request) as RecoveryAck&{requestHash?:string;delta?:boolean};
  if(ack.requestHash!==requestHash||ack.command?.id!==command.id||ack.delta!==true||!Number.isFinite(Date.parse(ack.createdAt)))throw Error('Deltajournalin kuittaus ei vastaa lähetettyä komentoa.');readProjectHistory({past:[ack],future:[]});
  for(const c of allChunks)known.add(c.hash);acknowledgedChunks.set(bridge,known);
  cache={ref:{file:ack.file,hash:ack.hash,size:ack.size},metadata:prepared.metadata,resources};return ack;
 });writes=next.then(()=>{},()=>{});return next;
}
