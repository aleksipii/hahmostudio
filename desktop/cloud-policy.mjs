// Työpöydän pilvi-IPC:n politiikka ja syötteiden validointi. Ei Electron-riippuvuuksia, joten testattavissa Nodessa.
import {redact,secretKey} from './cloud-secrets.mjs';

/** Työpöydällä kustannuspolitiikka on aina nollakustannus. Maksullisen laskennan ympäristömuuttujia ei lueta. */
export const DESKTOP_COMPUTE_POLICY=Object.freeze({mode:'zero-cost',allowPaidCompute:false,maxCostEur:0,allowPaidFallback:false,allowUnknownCost:false,allowedBackendClasses:Object.freeze(['free'])});
/** Pilvirenderöinti on työpöydällä vaiheessa 2 vielä käytettävissä vain asetusten osalta; prosessi tulee vaiheessa 3. */
export const CLOUD_RENDER_AVAILABLE=false;

export function clearTarget(value){return value==='all'?'all':secretKey(value);}
export function noArgs(args){if(args.length)throw new Error('Pyyntö ei odota parametreja.');}

/** Rendererille näkyvä tila. Ei salaisuuksien arvoja. */
export async function cloudStatus(store){
 return {available:CLOUD_RENDER_AVAILABLE,enabled:false,policy:{...DESKTOP_COMPUTE_POLICY,allowedBackendClasses:[...DESKTOP_COMPUTE_POLICY.allowedBackendClasses]},secrets:await store.view()};
}

/** Käärii pilvi-IPC:n käsittelijän: virheviesti peitetään ennen kuin se kulkee rendererille. */
export function guarded(store,fn){
 return async function(...args){
  try{return await fn(...args);}catch(e){const message=e instanceof Error?e.message:'Pilviasetuksen käsittely epäonnistui.';const values=await store.values().catch(()=>({}));throw new Error(redact(message,Object.values(values)));}
 };
}
