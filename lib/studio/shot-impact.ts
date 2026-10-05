import type {Presentation} from '../presentation-model.ts';
import {adaptPresentation,seconds,type Shot} from './domain.ts';
import {canonicalJson} from './hash.ts';
/** Conservative dependency projection: prior events can leave state active in later shots. */
export function shotDependencies(p:Presentation,shot:Shot):string{
 const end=seconds(shot.at+shot.duration),events=p.events.filter(e=>e.at===undefined||e.at<end),ids=new Set(events.map(e=>e.id)),production=p.production;
 const keyed=(record:Record<string,unknown>|undefined)=>Object.fromEntries(Object.entries(record??{}).filter(([id])=>ids.has(id)));
 const actors=Object.fromEntries(Object.entries(p.actorAnimations??{}).map(([id,a])=>[id,{fps:a.fps,duration:Math.min(a.duration,Math.ceil(end*a.fps)),rig:a.rig,tracks:a.tracks.map(t=>{
  // The first key after the boundary influences interpolation within the shot.
  const boundary=Math.ceil(end*a.fps),next=t.frames.find(f=>f.frame>=boundary);
  return{key:t.key,frames:[...t.frames.filter(f=>f.frame<boundary),...(next?[next]:[])]};
 })}]));
 return canonicalJson({at:shot.at,duration:shot.duration,sceneId:shot.sceneId,world:p.world,startFrame:p.startFrame,metadata:p.metadata,bindings:p.bindings,characters:p.characters,natural:p.natural,source:p.source,direction:p.direction,events:events.map(({sourceRef,basis,section,...e})=>({...e,section})),audio:p.audioClips.filter(c=>ids.has(c.dialogue)),actors,production:production&&{cameras:keyed(production.cameras),manualOverrides:keyed(production.manualOverrides),locks:keyed(production.locks),representations:production.representations,assetVersions:production.assetVersions,characterProfiles:production.characterProfiles,props:production.props?.filter(prop=>prop.start<end),noCameraMotion:production.seriesProfile.noCameraMotion}});
}
export function affectedShots(before:Presentation,after:Presentation):Set<string>{
 const previous=adaptPresentation(before),next=new Map(adaptPresentation(after).shots.map(s=>[s.id,s]));
 return new Set(previous.shots.filter(shot=>{const candidate=next.get(shot.id);return!candidate||shotDependencies(before,shot)!==shotDependencies(after,candidate);}).map(s=>s.id));
}
