import type {RenderArtifact,RenderJob} from './types.ts';
import {isModelWeightName} from './weights.ts';

export type OutputVerdict={verdict:'ok'|'flag'|'reject';notes:string[]};
/** Secondary, non-authoritative inspector (e.g. a vision model). Never replaces deterministic validation. */
export interface OutputInspector{inspect(job:RenderJob,artifact:RenderArtifact):Promise<OutputVerdict>;}
export type OutputStrictness='flag'|'reject';
export type OutputValidation={ok:boolean;flags:string[];rejects:string[]};
const MAX=512*1024*1024;
const starts=(b:Uint8Array,sig:number[],off=0)=>sig.every((x,i)=>b[off+i]===x);
function sniff(b:Uint8Array):string|undefined{
 if(starts(b,[0x89,0x50,0x4e,0x47]))return 'png';if(starts(b,[0xff,0xd8,0xff]))return 'jpg';if(starts(b,[0x47,0x49,0x46,0x38]))return 'gif';
 if(starts(b,[0x52,0x49,0x46,0x46])&&starts(b,[0x57,0x45,0x42,0x50],8))return 'webp';if(starts(b,[0x66,0x74,0x79,0x70],4))return 'mp4';if(starts(b,[0x1a,0x45,0xdf,0xa3]))return 'webm';
}
export const pngSize=(b:Uint8Array)=>b.length>=24&&starts(b,[0x89,0x50,0x4e,0x47])?{w:new DataView(b.buffer,b.byteOffset).getUint32(16),h:new DataView(b.buffer,b.byteOffset).getUint32(20)}:undefined;
export async function validateOutput(job:RenderJob,artifacts:RenderArtifact[],strict:OutputStrictness,inspector?:OutputInspector):Promise<OutputValidation>{
 const flags:string[]=[],rejects:string[]=[];
 if(!artifacts.length)rejects.push('Backend returned no artifacts.');
 const want=job.outputFormat.toLowerCase().replace('jpeg','jpg');
 for(const a of artifacts){
  if(isModelWeightName(a.name))rejects.push(`Artifact "${a.name}" looks like a model weight file.`);
  if(!a.bytes.length)rejects.push(`Artifact "${a.name}" is empty.`);if(a.bytes.length>MAX)rejects.push(`Artifact "${a.name}" is too large.`);
  const kind=sniff(a.bytes);if(!kind)rejects.push(`Artifact "${a.name}" is not a recognised image/video container.`);
  else{if(kind!==want&&!(want==='image'&&['png','jpg','webp','gif'].includes(kind))&&!(want==='video'&&['mp4','webm'].includes(kind)))rejects.push(`Artifact "${a.name}" is ${kind}, expected ${want}.`);
   if(kind==='png'){const s=pngSize(a.bytes);if(s&&(s.w!==job.params.width||s.h!==job.params.height))flags.push(`Artifact "${a.name}" is ${s.w}x${s.h}, requested ${job.params.width}x${job.params.height}.`);}}
  if(inspector){try{const v=await inspector.inspect(job,a);if(v.verdict==='reject')rejects.push(...v.notes.map(n=>'Inspector: '+n));else if(v.verdict==='flag')flags.push(...v.notes.map(n=>'Inspector: '+n));}catch{flags.push('Visual inspector failed; output not visually verified.');}}
 }
 if(strict==='reject'&&flags.length)rejects.push(...flags.map(f=>'(strict) '+f));
 return{ok:!rejects.length,flags,rejects};
}
