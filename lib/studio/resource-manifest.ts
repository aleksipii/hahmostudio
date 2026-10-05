import {strFromU8,strToU8} from 'fflate';
import {sha256} from './hash.ts';
const cachedHashes=new WeakMap<Uint8Array,Promise<string>>();
const resourceHash=(b:Uint8Array)=>{let h=cachedHashes.get(b);if(!h){h=sha256(b);cachedHashes.set(b,h);}return h;};
const path='resource-manifest.json';
type ResourceManifest={schemaVersion:1;assets:{path:string;size:number;sha256:string}[]};
export async function addResourceManifest(files:Record<string,Uint8Array>){
 const manifest:ResourceManifest={schemaVersion:1,assets:[]};
 for(const name of Object.keys(files).sort())if(name!==path)manifest.assets.push({path:name,size:files[name].length,sha256:await resourceHash(files[name])});
 files[path]=strToU8(JSON.stringify(manifest));return files[path].length;
}
/** Optional extension: old v1–v5 archives remain readable. Verify before interpreting project data. */
export async function verifyResourceManifest(files:Record<string,Uint8Array>){
 if(!files[path])return;
 if(files[path].length>3*1024*1024)throw Error('Resurssimanifesti on liian suuri.');
 const m=JSON.parse(strFromU8(files[path])) as ResourceManifest;
 if(m?.schemaVersion!==1||!Array.isArray(m.assets)||m.assets.length>10000)throw Error('Resurssimanifesti on virheellinen.');
 const seen=new Set<string>();
 for(const a of m.assets){
  if(!a||typeof a.path!=='string'||a.path===path||a.path.length>2000||seen.has(a.path)||!Number.isSafeInteger(a.size)||a.size<0||typeof a.sha256!=='string'||!/^[a-f0-9]{64}$/.test(a.sha256))throw Error('Resurssimanifestin viite on virheellinen.');
  seen.add(a.path);const bytes=files[a.path];
  if(!bytes||bytes.length!==a.size||await sha256(bytes)!==a.sha256)throw Error('Projektin resurssi puuttuu tai on muuttunut: '+a.path);
 }
 if(Object.keys(files).some(name=>name!==path&&!seen.has(name)))throw Error('Projektissa on manifestiin kuulumaton resurssi.');
}
