import {sceneBackgrounds} from './svg-renderer.ts';
import {validateRig,type CutoutHeld,type Actor,type Rig,type Timeline,type TimedEvent,type Viseme,visemes} from './model.ts';
import {actorPlacement,type PresentationAssets} from '../presentation-compile.ts';
import {stageActor,stageState} from '../presentation-stage.ts';
import {heldProp} from '../held-props.ts';
import type {Presentation,Event} from '../presentation-model.ts';
import {packSupportsReaction,presentationReaction,type CutoutReactionId} from './pack-reactions.ts';
import {resolveManifestProp} from '../script-resource-manifest.ts';
import {initProduction} from '../production-model.ts';
import {propLibrary} from '../prop-library.ts';

export const cutoutQuickAssets=new Set(['kilsat-mr-kille-cutout-v1','kilsat-mr-handu-cutout-v1']);
export const cutoutPresetActions={
 POINT:{id:'POINT',label:'Osoitus',presentation:'point'},
 HAND_WAVE:{id:'HAND_WAVE',label:'Vilkutus',presentation:'wave'},
 FIST:{id:'FIST',label:'Nyrkki',presentation:'fist'},
 SIT:{id:'SIT',label:'Istu',presentation:'sit'},
 WALK_LEFT:{id:'WALK_LEFT',label:'Kävely vasemmalle',presentation:'walk-left'},
 WALK_RIGHT:{id:'WALK_RIGHT',label:'Kävely oikealle',presentation:'walk-right'},
 RUN_LEFT:{id:'RUN_LEFT',label:'Juoksu vasemmalle',presentation:'run-left'},
 RUN_RIGHT:{id:'RUN_RIGHT',label:'Juoksu oikealle',presentation:'run-right'},
 IDLE:{id:'IDLE',label:'Lepo',presentation:'stop'},
 REACT_NOD:{id:'REACT_NOD',label:'Reaktio · nyökkäys',presentation:'react-nod'},
 REACT_SURPRISE:{id:'REACT_SURPRISE',label:'Reaktio · hämmästys',presentation:'react-surprise'},
 REACT_WAVE:{id:'REACT_WAVE',label:'Reaktio · vilkutus',presentation:'react-wave'},
} as const;

const presentationAction:Record<string,string>={'walk-left':'WALK_LEFT','walk-right':'WALK_RIGHT','run-left':'RUN_LEFT','run-right':'RUN_RIGHT',wave:'HAND_WAVE',point:'POINT',fist:'FIST',sit:'SIT',stop:'IDLE',...presentationReaction};
const shotCamera:Record<string,string>={wide:'WIDE_SHOT',medium:'MEDIUM_TWO_SHOT',close:'CLOSE_UP'};
const expressionEmotion:Record<string,string>={angry:'ANGRY',worried:'SQUINT',confused:'SQUINT',mildly_hurt:'SQUINT',dead_stare:'NORMAL',eyebrow_raise:'NORMAL',happy:'HAPPY',sad:'SQUINT',scared:'NORMAL'};

const backgroundScene:Record<string,string>={};
for(const [scene,id] of Object.entries(sceneBackgrounds))backgroundScene[id]=scene;

export type CutoutPack={asset:Actor['asset'];rig:Rig};
export function quickAssetToCutoutPack(asset:string):Actor['asset']|undefined{
 if(asset==='kilsat-mr-kille-cutout-v1')return 'Mr.Kille';
 if(asset==='kilsat-mr-handu-cutout-v1')return 'Mr.Handu';
 return;
}

export function isCutoutPresentation(p:Presentation,assets:PresentationAssets){
 if(!p.bindings.length)return false;
 return p.bindings.every(b=>{const q=assets[b.asset]?.doc?.quick;return q&&cutoutQuickAssets.has(q.asset);});
}

export function buildCutoutVisemes(p:Presentation):Record<string,Viseme[]>{
 const out:Record<string,Viseme[]>={};
 for(const clip of p.audioClips){
  out[clip.dialogue]=Array.from({length:Math.ceil(clip.duration*24)},(_,frame)=>{
   const t=frame/24,m=[...clip.mouth].reverse().find(x=>x.time<=t);
   if(m?.viseme&&visemes.includes(m.viseme))return m.viseme;
   return m?.shape==='rest'?'REST':m?.shape==='round'?'O':'AI';
  });
 }
 return out;
}

/** Maps timed Presentation events to a 24 fps cutout timeline for preview/export parity. */
export function buildCutoutTimelineFromPresentation(p:Presentation,assets:PresentationAssets,packs:Partial<Record<Actor['asset'],CutoutPack>>,cadence:Timeline['cadence']='three-two'):Timeline{
 if(!isCutoutPresentation(p,assets))throw Error('Kartonkiaikajana vaatii Kille- tai Handu-paketin kaikille puhujille.');
 const fps=24,w=p.world.width,h=p.world.height;
 const actors:Actor[]=p.bindings.map(b=>{
  const packId=quickAssetToCutoutPack(assets[b.asset]!.doc!.quick!.asset)!;
  const pack=packs[packId];if(!pack)throw Error('Kartonkiluusto puuttuu: '+packId);
  validateRig(pack.rig);
  const doc=assets[b.asset]!.doc,place=actorPlacement(b,w,h);
  return {id:b.speaker,asset:pack.asset,x:place.x+doc.width*place.scale/2,y:place.y+doc.height*place.scale*.88,scale:place.scale,rig:pack.rig};
 });
 const events:TimedEvent[]=[];
 for(const e of [...p.events].sort((a,b)=>(a.at??0)-(b.at??0))){
  const start=Math.max(0,Math.round((e.at??0)*fps)),dur=Math.max(1,Math.round((e.duration??e.seconds??0)*fps)),end=start+dur;
  if(e.kind==='environment'){
   const custom=p.world.customBackgrounds?.[e.value];
   const scene=custom?`CUSTOM:${e.value}`:backgroundScene[e.value]??(/cutout|studio/i.test(e.value)?'STUDIO':'WHITE_STUDIO');
   events.push({id:e.id,kind:'scene',value:scene,line:e.sourceRef.line,start,end:start+1});
  }else if(e.kind==='shot'){
   events.push({id:e.id,kind:'camera',value:shotCamera[e.value]??'WIDE_SHOT',actor:e.target!=='scene'?e.target:undefined,line:e.sourceRef.line,start,end});
  }else if(e.kind==='dialogue'){
   events.push({id:e.id,kind:'dialogue',actor:e.target,value:e.text??'',line:e.sourceRef.line,start,end});
  }else if(e.kind==='action'){
   const mapped=presentationAction[e.value];if(!mapped)continue;
   const binding=p.bindings.find(b=>b.speaker===e.target),quickAsset=binding?assets[binding.asset]?.doc?.quick?.asset:undefined,packId=quickAsset?quickAssetToCutoutPack(quickAsset):undefined;
   if(mapped.startsWith('REACT_')&&packId&&!packSupportsReaction(packId,mapped as CutoutReactionId))throw Error(`Reaktio «${e.value}» ei ole tuettu hahmopaketissa ${packId}.`);
   events.push({id:e.id,kind:'action',actor:e.target,value:mapped,line:e.sourceRef.line,start,end});
  }else if(e.kind==='expression'){
   events.push({id:e.id,kind:'emotion',actor:e.target,value:expressionEmotion[e.value]??'NORMAL',line:e.sourceRef.line,start,end});
  }else if(e.kind==='hold'){
   const seconds=e.seconds??e.duration??.25;
   events.push({id:e.id,kind:'hold',value:'pause',line:e.sourceRef.line,seconds,start,end:start+Math.max(1,Math.round(seconds*fps))});
  }
 }
 const duration=Math.max(1,...events.map(ev=>ev.end),1);
 // Käteen annetut esineet (kirjaston esineet; puhelin kulkee omaa reittiään).
 const held:CutoutHeld[]=stageState(p,p.seconds+60).held.filter(h=>heldProp(h.id)&&actors.some(a=>a.id===h.carrier)).map(h=>({id:h.id,actor:h.carrier,hand:h.hand,start:Math.round(h.at*fps),...(h.releasedAt!==undefined?{end:Math.round(h.releasedAt*fps)}:{})}));
 return {format:'kilsat-cutout',version:1,fps:24,source:p.original,events,duration,actors,...(held.length?{held}:{}),width:w,height:h,cadence};
}

export function mergeScriptResourceManifest(p:Presentation,manifest:import('../script-resource-manifest.ts').ScriptResourceManifest){
 const env=manifest.resources.filter(r=>r.kind==='background').at(-1);
 if(env?.libraryId)p.world.design=env.libraryId as Presentation['world']['design'];
 const customBackgrounds:Record<string,{asset:string}>={...p.world.customBackgrounds};
 for(const row of manifest.resources.filter(r=>r.kind==='backgroundImage'))if(row.imageKey)customBackgrounds[row.imageKey]={asset:row.imageKey};
 for(const row of manifest.resources.filter(r=>r.kind==='character')){
  const binding=p.bindings.find(b=>b.speaker===row.speaker);if(binding&&row.assetKey)binding.asset=row.assetKey;
 }
 if(Object.keys(customBackgrounds).length)p.world.customBackgrounds=customBackgrounds;
 const props=[...(p.production?.props??[])];
 for(const row of manifest.resources.filter(r=>r.kind==='prop')){
  const id=resolveManifestProp(row.propId??row.label);if(!id)continue;
  if(!p.assets.some(a=>a.id===id))p.assets.push({id,kind:'prop'});
  if(id==='phone-v1')p.world.phone.enabled=true;
  if(!props.some(v=>v.asset===id&&v.id.startsWith('res-manifest-'))){const meta=propLibrary.find(x=>x.id===id);props.push({id:'res-manifest-'+row.sourceLine,asset:id,x:id==='table-prop-v1'?.5:.72,y:id==='table-prop-v1'?.78:.58,scale:meta?.scale??(id==='phone-v1'?.08:.1),start:0,end:Math.max(p.seconds,1)});}
 }
 if(props.length){p.production??=initProduction(p);p.production.props=props;}
 return p;
}
