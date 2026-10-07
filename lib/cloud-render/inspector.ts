import {inflateSync} from 'node:zlib';
import type {RenderArtifact,RenderJob} from './types.ts';
import type {OutputInspector,OutputVerdict} from './output-validation.ts';
import type {AssetRef,StorageBackend} from './storage.ts';

/** Minimal PNG reader (8-bit, non-interlaced; gray, RGB, palette, +alpha). Returns RGBA or undefined when unsupported/invalid. */
export function decodePng(b:Uint8Array,maxPixels=16_000_000):{w:number;h:number;rgba:Uint8Array}|undefined{
 const sig=[0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a];if(b.length<33||sig.some((x,i)=>b[i]!==x))return;
 const dv=new DataView(b.buffer,b.byteOffset,b.byteLength);let o=8,w=0,h=0,depth=0,ct=0,il=0;const idat:Uint8Array[]=[];let plte:Uint8Array|undefined;
 while(o+8<=b.length){const len=dv.getUint32(o),type=String.fromCharCode(b[o+4],b[o+5],b[o+6],b[o+7]),d=b.subarray(o+8,o+8+len);if(d.length!==len)return;
  if(type==='IHDR'){w=dv.getUint32(o+8);h=dv.getUint32(o+12);depth=b[o+16];ct=b[o+17];il=b[o+20];}else if(type==='PLTE')plte=d;else if(type==='IDAT')idat.push(d);else if(type==='IEND')break;o+=12+len;}
 if(!w||!h||w*h>maxPixels||depth!==8||il!==0||![0,2,3,4,6].includes(ct)||ct===3&&!plte)return;
 const ch={0:1,2:3,3:1,4:2,6:4}[ct as 0|2|3|4|6],stride=w*ch;let raw:Uint8Array;
 try{raw=inflateSync(Buffer.concat(idat),{maxOutputLength:(stride+1)*h+16});}catch{return;}
 if(raw.length<(stride+1)*h)return;
 const img=new Uint8Array(stride*h);
 for(let y=0;y<h;y++){const f=raw[y*(stride+1)],src=raw.subarray(y*(stride+1)+1,(y+1)*(stride+1));
  for(let x=0;x<stride;x++){const a=x>=ch?img[y*stride+x-ch]:0,up=y?img[(y-1)*stride+x]:0,c=x>=ch&&y?img[(y-1)*stride+x-ch]:0;let v=src[x];
   if(f===1)v+=a;else if(f===2)v+=up;else if(f===3)v+=(a+up)>>1;else if(f===4){const p=a+up-c,pa=Math.abs(p-a),pb=Math.abs(p-up),pc=Math.abs(p-c);v+=pa<=pb&&pa<=pc?a:pb<=pc?up:c;}else if(f!==0)return;
   img[y*stride+x]=v&255;}}
 const rgba=new Uint8Array(w*h*4);
 for(let i=0;i<w*h;i++){const s=i*ch;let r,g,bl,al=255;
  if(ct===0){r=g=bl=img[s];}else if(ct===4){r=g=bl=img[s];al=img[s+1];}else if(ct===2){r=img[s];g=img[s+1];bl=img[s+2];}else if(ct===6){r=img[s];g=img[s+1];bl=img[s+2];al=img[s+3];}else{const p=img[s]*3;r=plte![p]??0;g=plte![p+1]??0;bl=plte![p+2]??0;}
  rgba.set([r,g,bl,al],i*4);}
 return{w,h,rgba};
}
/** Coarse 4x4x4 color histogram of visible pixels, normalised. Also reports transparency and the dominant-colour share. */
export function palette(img:{w:number;h:number;rgba:Uint8Array}){
 const bins=new Float64Array(64);let seen=0;
 for(let i=0;i<img.w*img.h;i++){if(img.rgba[i*4+3]<16)continue;bins[(img.rgba[i*4]>>6)*16+(img.rgba[i*4+1]>>6)*4+(img.rgba[i*4+2]>>6)]++;seen++;}
 if(seen)for(let i=0;i<64;i++)bins[i]/=seen;
 return{bins,visible:seen/(img.w*img.h),dominant:Math.max(...bins)};
}
/** Hellinger distance between histograms: 0 identical, 1 disjoint. */
export function paletteDistance(a:Float64Array,b:Float64Array){let s=0;for(let i=0;i<64;i++)s+=(Math.sqrt(a[i])-Math.sqrt(b[i]))**2;return Math.sqrt(s/2);}
/**
 * Local, deterministic output check. It is a weak signal and NOT identity verification:
 * - rejects blank, solid-colour or fully transparent images;
 * - flags a palette far from the approved character reference (possible identity/outfit drift).
 * Video and non-PNG files are not inspected (reported as ok); the reference must be a PNG to be compared.
 */
export class PaletteInspector implements OutputInspector{
 private storage:StorageBackend;private threshold:number;
 constructor(storage:StorageBackend,threshold=0.55){this.storage=storage;this.threshold=threshold;}
 async inspect(job:RenderJob,artifact:RenderArtifact):Promise<OutputVerdict>{
  const out=decodePng(artifact.bytes);if(!out)return{verdict:'ok',notes:[]};
  const p=palette(out);
  if(p.visible<0.02)return{verdict:'reject',notes:['Image is (almost) fully transparent.']};
  if(p.dominant>0.995)return{verdict:'reject',notes:['Image is blank or a single solid colour.']};
  const notes:string[]=[];
  for(const i of job.inputs.filter(x=>x.kind==='character_reference')){
   let ref:AssetRef|null=null;try{ref=JSON.parse(i.storageRef??'null');}catch{/* unusable */}
   if(!ref)continue;let bytes:Uint8Array;try{bytes=await this.storage.downloadAsset(ref);}catch{continue;}
   const r=decodePng(bytes);if(!r)continue;const rp=palette(r);if(rp.visible<0.02)continue;
   const d=paletteDistance(p.bins,rp.bins);
   if(d>this.threshold)notes.push(`Palette differs strongly from the approved reference of "${i.characterId??i.assetId}" (distance ${d.toFixed(2)} > ${this.threshold}); possible identity or outfit drift.`);
  }
  return notes.length?{verdict:'flag',notes}:{verdict:'ok',notes:[]};
 }
}
