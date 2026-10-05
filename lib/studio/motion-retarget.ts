import type {Animation} from '../animation-model.ts';
import {readAnimation} from '../animation-model.ts';
import type {PsdDocument} from '../psd-model.ts';
import type {Rig} from '../rig-model.ts';
/** Explicit correspondence; target anatomy remains authoritative. No name guessing. */
export function retargetMotion(source:Animation,target:Rig,doc:PsdDocument,mapping:Record<string,string>):Animation{
 const from=new Map(source.rig.parts.map(p=>[p.key,p])),to=new Map(target.parts.map(p=>[p.key,p]));
 if(new Set(Object.values(mapping)).size!==Object.keys(mapping).length)throw Error('Liikesovituksen kohteet eivät ole yksilöllisiä.');
 for(const [a,b] of Object.entries(mapping)){const p=from.get(a),q=to.get(b);if(!p||!q||p.role!==q.role)throw Error('Liikesovituksen osan rooli tai kohde ei vastaa lähdettä.');if(p.parentKey&&mapping[p.parentKey]!==q.parentKey)throw Error('Luustojen liitosketjut eivät vastaa toisiaan.');}
 const ratio=(key:string)=>{const p=from.get(key)!,q=to.get(mapping[key])!;const a=p.parentKey?from.get(p.parentKey):undefined,b=q.parentKey?to.get(q.parentKey):undefined;const l=a?Math.hypot(p.pivot.x-a.pivot.x,p.pivot.y-a.pivot.y):0,m=b?Math.hypot(q.pivot.x-b.pivot.x,q.pivot.y-b.pivot.y):0;return l>1e-6&&m>1e-6?m/l:Math.sqrt(target.source.width*target.source.height/(source.rig.source.width*source.rig.source.height));};
 const tracks=source.tracks.map(t=>{if(!mapping[t.key])throw Error('Animoidun osan vastaavuus puuttuu: '+t.key);const scale=ratio(t.key);return{key:mapping[t.key],frames:t.frames.map(k=>({...k,x:k.x*scale,y:k.y*scale}))};});
 return readAnimation(JSON.stringify({...source,rig:target,tracks}),doc);
}
export function suggestMotionMapping(source:Rig,target:Rig,sourceRoles:Record<string,string>,targetRoles:Record<string,string>):Record<string,string>{
 const mapping:Record<string,string>={};
 for(const p of source.parts){const candidates=new Set(Object.entries(sourceRoles).filter(([,key])=>key===p.key).map(([role])=>targetRoles[role]).filter(key=>!!key&&target.parts.some(q=>q.key===key&&q.role===p.role)));if(candidates.size===1)mapping[p.key]=[...candidates][0];else if(!candidates.size){const matches=target.parts.filter(q=>q.role===p.role&&(p.psdId!==undefined?q.psdId===p.psdId:q.key===p.key&&q.path===p.path));if(matches.length===1)mapping[p.key]=matches[0].key;}}
 const used=new Map<string,string[]>();for(const [a,b] of Object.entries(mapping))used.set(b,[...(used.get(b)??[]),a]);for(const keys of used.values())if(keys.length>1)for(const key of keys)delete mapping[key];return mapping;
}
