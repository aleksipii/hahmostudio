import {validateRig,type Rig,type Actor} from './model.ts';
import type {CutoutArt} from './svg-renderer.ts';
import type {CutoutPack} from './presentation-ir.ts';

let cache:Partial<Record<Actor['asset'],CutoutPack>>|undefined;
let artCache:Partial<Record<Actor['asset'],CutoutArt>>|undefined;
let loading:Promise<Partial<Record<Actor['asset'],CutoutPack>>>|undefined;

async function fetchRig(name:Actor['asset']){
 const base=(import.meta as ImportMeta).env?.BASE_URL??'/';
 const res=await fetch(`${base}library/cutout/${name}.rig.json`);
 if(!res.ok)throw Error('Kartonkiluustoa ei voitu ladata: '+name);
 const rig=validateRig(await res.json() as Rig);
 return {asset:name,rig} satisfies CutoutPack;
}

export async function loadCutoutPacks(force=false){
 if(cache&&!force)return cache;
 if(loading&&!force)return loading;
 loading=(async()=>{
  const packs:Partial<Record<Actor['asset'],CutoutPack>>={};
  for(const name of ['Mr.Kille','Mr.Handu'] as const)packs[name]=await fetchRig(name);
  cache=packs;return packs;
 })();
 return loading;
}

export async function loadCutoutArt(force=false){
 if(artCache&&!force)return artCache;
 await loadCutoutPacks(force);
 const base=(import.meta as ImportMeta).env?.BASE_URL??'/';
 const out:Partial<Record<Actor['asset'],CutoutArt>>={};
 for(const name of ['Mr.Kille','Mr.Handu'] as const){
  const res=await fetch(`${base}library/cutout/${name}.art.json`);
  if(!res.ok)throw Error('Kartonkikerrosgrafiikka puuttuu: '+name);
  out[name]=await res.json() as CutoutArt;
 }
 artCache=out;return out;
}

export function cutoutPacksSync(){return cache;}
