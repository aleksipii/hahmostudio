import {retargetChains,profileChains,type RetargetDiagnostic} from './chain-retarget.ts';
import {retargetMotion} from './motion-retarget.ts';
import {flatten} from '../psd-model.ts';
import {readAnimation} from '../animation-model.ts';
import {readQuick,type QuickProfile} from '../quick-animation.ts';
import type {PresentationAssets} from '../presentation-compile.ts';
import {executeProductionCommand} from './production-command.ts';
import type {ProductionState} from './commands.ts';
/** Map stable PSD IDs with the existing importer; never guess a layer by its display name. */
export function relinkCharacter(state:ProductionState,assets:PresentationAssets,speaker:string,id:string,incoming:PresentationAssets[string],fps:number,mapping?:Record<string,string>,motion?:{mode:'fk'|'ik'|'proportional';frameStep?:number;autoContacts?:boolean;ikWeight?:number}){
 const binding=state.model.bindings.find(b=>b.speaker===speaker);if(!binding)throw Error('Hahmosidontaa ei löydy.');if(!/^cast-sha256-[a-f0-9]{64}$/.test(id)||assets[id])throw Error('Uuden resurssin tunniste on virheellinen tai jo käytössä.');
 const old=assets[binding.asset];let replacement=incoming;let diagnostics:RetargetDiagnostic[]=[];
 if(old&&incoming.doc.quick&&mapping&&motion&&motion.mode!=='proportional'){
 const explicit=Object.fromEntries(Object.entries(mapping).filter(([,key])=>key)),chains=old.doc.quick?profileChains(old.animation.rig,incoming.animation.rig,old.doc.quick,incoming.doc.quick):[];
 const result=retargetChains(old.animation,incoming.animation.rig,incoming.doc,explicit,{mode:motion.mode,chains,frameStep:motion.frameStep??1,autoContacts:motion.autoContacts,ikWeight:motion.ikWeight});replacement={doc:incoming.doc,animation:result.animation};diagnostics=result.diagnostics;
 }else if(old){
 let source=old.animation;
 const sx=incoming.doc.width/old.doc.width,sy=incoming.doc.height/old.doc.height;
 const point=(p:{x:number;y:number})=>({x:p.x*sx,y:p.y*sy});
 if(mapping){
  const parts=old.animation.rig.parts,nodes=flatten(incoming.doc.layers),keys=new Set(parts.map(p=>p.key));
  if(Object.keys(mapping).length!==parts.length||Object.keys(mapping).some(k=>!keys.has(k))||new Set(Object.values(mapping)).size!==parts.length)throw Error('Tasovastaavuuden pitää yhdistää jokainen vanha osa eri uuteen tasoon.');
  const targets=new Map(nodes.map(n=>[n.key,n]));for(const p of parts)if(!targets.has(mapping[p.key]))throw Error('Valittu uusi taso puuttuu: '+p.path);
  const mapped={...old.animation.rig,source:{name:incoming.doc.name,width:incoming.doc.width,height:incoming.doc.height},parts:parts.map(p=>{const n=targets.get(mapping[p.key])!;return{...p,pivot:point(p.pivot),joints:p.joints.map(point),key:n.key,path:n.path,psdId:n.psdId,...(p.parentKey?{parentKey:mapping[p.parentKey]}:{})};})};
  source={...old.animation,rig:mapped,tracks:old.animation.tracks.map(t=>({...t,key:mapping[t.key],frames:t.frames.map(k=>({...k,x:k.x*sx,y:k.y*sy}))}))};
 }
 const animation=incoming.doc.quick&&mapping?retargetMotion(old.animation,incoming.animation.rig,incoming.doc,mapping):readAnimation(JSON.stringify(source),incoming.doc),map=new Map(old.animation.rig.parts.map(p=>{const candidates=animation.rig.parts.filter(n=>mapping?n.key===mapping[p.key]:p.psdId!==undefined?n.psdId===p.psdId:n.key===p.key&&n.path===p.path);if(candidates.length!==1)throw Error('PSD/rig-tasoja ei voida yhdistää yksiselitteisesti.');return[p.key,candidates[0].key];}));
 const remap=(roles:Record<string,string>)=>Object.fromEntries(Object.entries(roles).map(([role,key])=>{const mapped=map.get(key);if(!mapped)throw Error('Hahmon roolille ei löydy tasoa: '+role);return[role,mapped];}));
 const q=old.doc.quick;if(!q)throw Error('Alkuperäiset hahmosidokset puuttuvat.');
 const profile:QuickProfile={...q,roles:remap(q.roles),...(q.views?{views:Object.fromEntries(Object.entries(q.views).map(([view,roles])=>[view,remap(roles!)]))}:{}),...(q.switchDefaults?{switchDefaults:Object.fromEntries(Object.entries(q.switchDefaults).map(([key,value])=>{const mapped=map.get(key);if(!mapped)throw Error('Kytkintasoa ei löydy.');return[mapped,value];}))}:{})};
 replacement={doc:{...incoming.doc,quick:readQuick(profile,animation.rig)},animation};
 }
 if(!replacement.doc.quick)throw Error('Valitse .hahmo, jossa on hahmosidokset.');
 const nextAssets={...assets,[id]:replacement},proposal={...state.model,bindings:state.model.bindings.map(b=>b.speaker===speaker?{...b,asset:id}:b)};
 const changed=executeProductionCommand(state,{kind:'edit',proposal},nextAssets,fps,state.model.production?.studio?.revision??1);
 return{...changed,assets:nextAssets,diagnostics};
}
