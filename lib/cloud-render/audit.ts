import {canonicalJson,sha256} from '../studio/hash.ts';
import type {ComputeAuthorization} from './compute.ts';
import type {Issue} from './continuity.ts';
import type {Check} from './ai-validator.ts';
import type {RenderJob,RenderState} from './types.ts';
import type {AssetRef} from './storage.ts';

export type AuditEntry={seq:number;at:string;jobId:string;type:string;data:unknown;prev:string;hash:string};
/** Append-only, hash-chained. Detects after-the-fact edits; it is not tamper-proof against someone who can rewrite the whole chain. */
export class AuditLog{
 private items:AuditEntry[]=[];
 private now:()=>Date;
 constructor(now:()=>Date=()=>new Date()){this.now=now;}
 async append(jobId:string,type:string,data:unknown){
  const prev=this.items.at(-1)?.hash??'0'.repeat(64),seq=this.items.length+1,at=this.now().toISOString();
  const hash=await sha256(new TextEncoder().encode(canonicalJson({seq,at,jobId,type,data,prev})));
  const e:AuditEntry={seq,at,jobId,type,data:structuredClone(data),prev,hash};this.items.push(e);return e;
 }
 entries(jobId?:string){return this.items.filter(e=>!jobId||e.jobId===jobId).map(e=>structuredClone(e));}
 async verify(){let prev='0'.repeat(64);for(const e of this.items){const h=await sha256(new TextEncoder().encode(canonicalJson({seq:e.seq,at:e.at,jobId:e.jobId,type:e.type,data:e.data,prev})));if(e.prev!==prev||e.hash!==h)return false;prev=e.hash;}return true;}
}
export type RenderRecord={
 job:RenderJob;state:RenderState;history:{state:RenderState;at:string}[];
 versions:{ruleEngine:string;aiDirector:string;promptCompiler:string;aiDirectorId:string};
 scene:{revision:number;lockId?:string;lockHash?:string};
 model?:{id:string;revision?:string;license:string;commercialUse:string;source:string};
 workflow?:{id:string;revision:number};
 backend?:{id:string;class:string;provider:string};
 cost?:ComputeAuthorization;
 validation?:{status:'APPROVED'|'REJECTED';issues:Issue[];checks:Check[]};
 outputValidation?:{ok:boolean;flags:string[];rejects:string[]};
 reproducibility?:Record<string,unknown>;
 outputs:AssetRef[];errors:string[];blocked?:{code:string;banner:string};
 providerContacted:boolean;
};
