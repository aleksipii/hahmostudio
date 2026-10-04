import {requirementStatus} from './presentation-direction.ts';
import {compilePresentation,type PresentationAssets} from './presentation-compile.ts';import type {Presentation} from './presentation-model.ts';import type {Animation} from './animation-model.ts';import type {Scene} from './scene-model.ts';
export function appendPresentation(animation:Animation,scene:Scene,input:Presentation,assets:PresentationAssets,newProject=false){
 const p=compilePresentation({...input,world:{...input.world,width:scene.width,height:scene.height}},assets,animation.fps);if(p.diagnostics.some(d=>d.severity==='error'))throw Error(p.diagnostics.filter(d=>d.severity==='error').map(d=>d.message).join('\n'));
 if(p.direction?.requirements.some(r=>requirementStatus(p,r)==='estimated'&&!r.accepted))throw Error('Tarkista ja hyväksy ohjaussuunnitelman arviot ennen jakson rakentamista.');
 const existing=scene.presentations?.find(s=>s.id===p.id),start=existing?.startFrame??(newProject?0:animation.duration),end=start+Math.ceil(p.seconds*animation.fps);
 if(existing&&existing.startFrame!+Math.ceil(existing.seconds*animation.fps)!==animation.duration&&end!==existing.startFrame!+Math.ceil(existing.seconds*animation.fps))throw Error('Uudelleenrakennus muuttaisi myöhempää sisältöä. Tee erillinen projektikopio tai muokkaa kohtauksen ajoitusta.');
 if(end>(p.production?.longForm?72000:1800)||end/animation.fps>(p.production?.longForm?1200:60))throw Error('Kohtaus ja aiempi sisältö ylittävät 60 s / 1800 ruutua. Luo seuraava jakso erilliseen projektiin.');
 p.startFrame=start;
 return {presentation:p,animation:{...animation,duration:existing&&existing.startFrame!+Math.ceil(existing.seconds*animation.fps)!==animation.duration?animation.duration:end},scene:{...scene,presentationDraft:undefined,presentations:[...(scene.presentations??[]).filter(s=>s.id!==p.id),p]},start};
}

export function retimePresentations(animation:Animation,scene:Scene,assets:PresentationAssets,fps:number,duration:number){
 const nextDuration=fps!==animation.fps?Math.ceil(animation.duration/animation.fps*fps):duration,presentations=scene.presentations?.map(old=>({...compilePresentation(old,assets,fps),startFrame:Math.round(old.startFrame!/animation.fps*fps)}));
 if(nextDuration>72000||nextDuration/fps>1200||presentations?.some(p=>p.startFrame!+Math.ceil(p.seconds*fps)>nextDuration))throw Error('Kuvataajuuden tai keston muutos katkaisisi dialogikohtauksen. Kohtaus säilytettiin.');
 const tracks=animation.tracks.map(t=>({...t,frames:[...new Map(t.frames.map(k=>{const next={...k,frame:Math.round(k.frame/animation.fps*fps)};return [next.frame,next] as const;})).values()].filter(k=>k.frame<nextDuration)}));
 return {animation:{...animation,fps,duration:nextDuration,tracks},scene:{...scene,presentations}};
}
