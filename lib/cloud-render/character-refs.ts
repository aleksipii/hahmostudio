import type {RenderInput} from './types.ts';
import {Blocked} from './types.ts';
import {getJson,putJson,type AssetRef,type StorageBackend} from './storage.ts';
import {safeId} from './canonical.ts';

/** sourceSha256: the character graphics the user approved this image for. Missing on references made before it existed. */
export type CharacterReference={characterId:string;assetId:string;label:string;mime:string;storageRef:AssetRef;sourceSha256?:string};
/** Approved reference images per canonical character. The AI never invents or replaces them. */
export class CharacterReferenceSystem{
 private refs=new Map<string,CharacterReference[]>();
 private storage?:StorageBackend;
 constructor(storage?:StorageBackend){this.storage=storage;}
 private key(p:string,c:string){return p+'\0'+c;}
 async register(projectId:string,r:CharacterReference){
  if(!safeId(r.characterId)||!safeId(r.assetId)||!/^image\/(png|jpeg|webp)$/.test(r.mime)||r.sourceSha256!==undefined&&!/^[0-9a-f]{64}$/.test(r.sourceSha256))throw new Blocked('reference-invalid','Reference must be a PNG, JPEG or WebP asset with safe ids.');
  const list=this.refs.get(this.key(projectId,r.characterId))??[];this.refs.set(this.key(projectId,r.characterId),[...list.filter(x=>x.assetId!==r.assetId),r]);
  if(this.storage)await putJson(this.storage,projectId,'characters',`${r.characterId}.references.json`,this.refs.get(this.key(projectId,r.characterId)));
 }
 list(projectId:string,characterId:string){return [...(this.refs.get(this.key(projectId,characterId))??[])];}
 /**
  * Missing reference → BLOCK when the workflow requires one. When the canonical character carries its graphics hash
  * (sources), only a reference approved for that same hash is used: a reference made for other graphics is stale and
  * BLOCKs a required input (an optional input is left out rather than rendering outdated graphics).
  */
 resolve(projectId:string,characterIds:string[],required:boolean,sources:Record<string,string|undefined>={}):RenderInput[]{
  const out:RenderInput[]=[];
  for(const c of characterIds){
   const l=this.list(projectId,c);if(!l.length){if(required)throw new Blocked('reference-missing',`Character "${c}" has no approved reference image.`);continue;}
   const source=Object.hasOwn(sources,c)?sources[c]:undefined,current=source?l.filter(function(r){return r.sourceSha256===source;}).at(-1):l[0];
   if(!current){if(required)throw new Blocked('reference-stale',`Character "${c}" graphics changed after its reference image was approved. Approve a new reference.`);continue;}
   out.push({kind:'character_reference',assetId:current.assetId,characterId:c,storageRef:JSON.stringify(current.storageRef),mime:current.mime});
  }
  return out;
 }
 async load(projectId:string,characterIds:string[]){if(!this.storage)return;const all=await this.storage.listProjectAssets(projectId,'characters');for(const c of characterIds){const f=all.find(a=>a.name===`${c}.references.json`);if(f)this.refs.set(this.key(projectId,c),await getJson<CharacterReference[]>(this.storage,f));}}
}
