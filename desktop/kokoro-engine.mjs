import {dirname} from 'node:path';
/**
 * Moottori ajetaan työprosessissa. `fork` on Electronin utilityProcess.fork (injektoitu, jotta tämä on testattavissa).
 * Ajoympäristö (kokoro-js + riippuvuudet) tulee Mac-paketin resursseista; malli tulee tietokansiosta.
 */
export function createProcessEngineFactory({fork,workerPath,runtimeDir}){
 return async({modelDir,modelId})=>{
  const child=fork(workerPath,[],{serviceName:'kokoro'}),pending=new Map();let next=1,dead=false;
  const fail=error=>{dead=true;for(const p of pending.values())p.reject(error);pending.clear();};
  child.on('message',m=>{const p=pending.get(m?.id);if(!p)return;pending.delete(m.id);m.ok?p.resolve(m):p.reject(Error(m.error||'Puhemoottori epäonnistui.'));});
  child.on('exit',()=>fail(Error('Puhemoottorin prosessi päättyi.')));
  const call=message=>new Promise((resolve,reject)=>{if(dead)return reject(Error('Puhemoottorin prosessi päättyi.'));const id=next++;pending.set(id,{resolve,reject});child.postMessage({id,...message});});
  const dispose=async()=>{dead=true;child.kill();};
  try{await call({type:'init',runtime:runtimeDir,modelsDir:dirname(dirname(modelDir)),modelId});}catch(error){await dispose();throw error;}
  return {
   async synthesize(request,signal){
    signal?.throwIfAborted();const onAbort=()=>{void dispose();fail(Error('Puhesynteesi peruttiin.'));};signal?.addEventListener('abort',onAbort,{once:true});
    try{const m=await call({type:'synthesize',...request});return {samples:new Float32Array(m.samples),sampleRate:m.sampleRate};}finally{signal?.removeEventListener('abort',onAbort);}
   },
   dispose
  };
 };
}
