import {boundedPresentation} from './stage-production.ts';
import {toonCamera} from './toon-render.ts';
import {drawProps} from './prop-library.ts';
import {renderToonCast} from './toon-render.ts';
import type {Cutout3D} from './cutout-3d';
import {sampleTrack} from './animation-model.ts';
import {drawBackground} from './backgrounds.ts';
import {isHardCameraCutSource} from './presentation-camera-cut.ts';
import {stageState,stageActor} from './presentation-stage.ts';
import {viewAtFrame} from './character-view.ts';
import {paintAnimatedLayers} from './psd-render.ts';import {drawPhone,phonePlacement,defaultPhone} from './phone-prop.ts';import {actorPlacement,type PresentationAssets} from './presentation-compile.ts';import type {Pose} from './animation-model.ts';import type {Presentation} from './presentation-model.ts';
export function presentationState(p:Presentation,time:number){const active=(kind:string)=>p.events.filter(e=>e.kind===kind&&(e.at??0)<=time).sort((a,b)=>(a.at??0)-(b.at??0)).at(-1);return {shot:active('shot'),title:p.events.filter(e=>e.kind==='title'&&(e.at??0)<=time&&time<(e.at??0)+(e.duration??.7)).at(-1)};}
export function renderPresentation(canvas:HTMLCanvasElement,scratch:HTMLCanvasElement,p:Presentation,assets:PresentationAssets,time:number,width:number,height:number,live?:{roles:Record<string,string>;poses:Record<string,Pose>},depth?:Cutout3D,transparent=false,safeArea?:import('./stage-bounds').SafeArea){
 p=boundedPresentation(p,assets,time,safeArea);
 canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d')!;if(!transparent){ctx.fillStyle=p.world.background;ctx.fillRect(0,0,width,height);}const state=presentationState(p,time),world=stageState(p,time);if(!transparent&&world.design&&world.design!=='white')drawBackground(ctx,world.design,width,height);
 if(state.title){ctx.fillStyle='#242a31';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`700 ${Math.round(width*.11)}px -apple-system, sans-serif`;ctx.fillText(state.title.value,width/2,height/2,width*.9);return;}
 const hasToon=p.bindings.some(b=>p.production?.representations[b.speaker]==='toon3d');if(hasToon)renderToonCast(ctx,p,assets,time,width,height);
 const camera=toonCamera(p,time),target=p.bindings.find(b=>b.speaker===camera.target),asset=target?assets[target.asset]:undefined;
 if(!hasToon&&p.original.trimStart().startsWith('#!kilsat')) {
  const transform=(at:number)=>{const c=toonCamera(p,at),binding=p.bindings.find(b=>b.speaker===c.target),resource=binding?assets[binding.asset]:undefined;let x=width/2,y=height*.46;
   if(binding&&resource&&c.target!=='scene'){const r=stageActor(p,binding,at,width,height),a=p.actorAnimations?.[binding.speaker],q=resource.doc.quick,root=a&&q?(q.views?.[viewAtFrame(q,a,at*a.fps)]??q.roles).root:undefined,pose=a?sampleTrack(a.tracks.find(t=>t.key===root),at*a.fps):undefined;x=r.x+(pose?.x??0)*r.scale;y=r.y+(pose?.y??0)*r.scale-resource.doc.height*r.scale*.22;}
   return {scale:c.zoom,x:width/2-(c.offsetX+c.pan*c.panX)*width*c.zoom-x*c.zoom,y:height*.46-(c.offsetY+c.pan*c.panY)*height*c.zoom-y*c.zoom};};
  const next=transform(time),shot=state.shot,hard=shot&&isHardCameraCutSource(shot.sourceRef.text),progress=shot?Math.max(0,Math.min(1,(time-(shot.at??0))/.35)):1,u=progress*progress*(3-2*progress),before=shot?transform(Math.max(0,(shot.at??0)-.000001)):next;
  const blend=hard?1:u;ctx.translate(before.x+(next.x-before.x)*blend,before.y+(next.y-before.y)*blend);const scale=before.scale+(next.scale-before.scale)*blend;ctx.scale(scale,scale);
 } else {
 if(!hasToon&&target&&asset&&camera.target!=='scene'){const r=stageActor(p,target,time,width,height),zoom=camera.zoom;ctx.translate(width/2-(camera.offsetX+camera.pan*camera.panX)*width*zoom,height*.46-(camera.offsetY+camera.pan*camera.panY)*height*zoom);ctx.scale(zoom,zoom);const a=p.actorAnimations?.[target.speaker],q=asset.doc.quick,root=a&&q?(q.views?.[viewAtFrame(q,a,time*a.fps)]??q.roles).root:undefined,pose=a?sampleTrack(a.tracks.find(t=>t.key===root),time*a.fps):undefined;ctx.translate(-(r.x+(pose?.x??0)*r.scale),-(r.y+(pose?.y??0)*r.scale-asset.doc.height*r.scale*.22));}
 if(!hasToon&&camera.target==='scene'&&(camera.zoom!==1||camera.pan||camera.offsetX||camera.offsetY)){ctx.translate(width/2,height*.46);ctx.scale(camera.zoom,camera.zoom);ctx.translate(-width/2-(camera.offsetX+camera.pan*camera.panX)*width,-height*.46-(camera.offsetY+camera.pan*camera.panY)*height);}
 }
 drawProps(ctx,p.production?.props??[],time,width,height);
 for(const b of p.bindings){if(p.production?.representations[b.speaker]==='toon3d')continue;const resource=assets[b.asset],animation=p.actorAnimations?.[b.speaker];if(!resource||!animation)continue;const frame=Math.max(0,Math.min(animation.duration-1,time*animation.fps)),r=stageActor(p,b,time,width,height);ctx.save();ctx.translate(r.x-resource.doc.width*r.scale/2,r.y-resource.doc.height*r.scale/2);ctx.scale(r.scale,r.scale);const poses:Record<string,Pose>={};const constraint=p.events.filter(e=>e.kind==='constraint'&&['still','release-still'].includes(e.value)&&[b.speaker,'scene'].includes(e.target)&&(e.at??0)<=time).at(-1);if(live&&p.source==='live'&&constraint?.value!=='still'&&b===p.bindings[0]&&!p.events.some(e=>e.kind==='hold'&&e.protected&&e.value==='dead_stare'&&e.target===b.speaker&&time>=e.at!&&time<e.at!+e.duration!))for(const role of ['head','leftPupil','rightPupil','leftBrow','rightBrow','leftBlink','rightBlink']){const src=live.poses[live.roles[role]],key=(resource.doc.quick?.views?.[viewAtFrame(resource.doc.quick,animation,frame)]??resource.doc.quick?.roles)?.[role];if(src&&key)poses[key]=src;}paintAnimatedLayers(ctx,resource.doc,animation,frame,Object.keys(poses).length?{key:resource.doc.quick!.roles.head,pose:poses[resource.doc.quick!.roles.head]??{x:0,y:0,rotation:0,scale:1,opacity:1},poses}:undefined,depth);ctx.restore();
  if(world.phone.enabled&&b.speaker===world.phone.carrier){const phoneTime=world.phone.releasedAt??time,phoneR=stageActor(p,b,phoneTime,width,height);const phone=phonePlacement({width,height,background:'#ffffff',guides:false,...phoneR,phone:{...defaultPhone(),scale:.5,anchor:world.phone.hand,view:world.phone.view}},resource.doc,animation,phoneTime*animation.fps);if(phone)drawPhone(ctx,phone);}
 }
}
