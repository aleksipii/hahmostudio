import {boundedPresentation,stageProjection} from './stage-production.ts';
import {transitionShade} from './presentation-timing.ts';
import {heldPropPlacement,drawHeldProp,heldProp,type HeldPropSpec,type Hand} from './held-props.ts';
import {drawProps} from './prop-library.ts';
import {renderToonCast} from './toon-render.ts';
import type {Cutout3D} from './cutout-3d';
import {sampleTrack} from './animation-model.ts';
import {drawBackground} from './backgrounds.ts';
import {stageState,stageActor} from './presentation-stage.ts';
import {viewAtFrame} from './character-view.ts';
import {paintAnimatedLayers} from './psd-render.ts';import {actorPlacement,type PresentationAssets} from './presentation-compile.ts';import type {Pose} from './animation-model.ts';import type {Presentation} from './presentation-model.ts';
export function presentationState(p:Presentation,time:number){const active=(kind:string)=>p.events.filter(e=>e.kind===kind&&(e.at??0)<=time).sort((a,b)=>(a.at??0)-(b.at??0)).at(-1);return {shot:active('shot'),title:p.events.filter(e=>e.kind==='title'&&(e.at??0)<=time&&time<(e.at??0)+(e.duration??.7)).at(-1)};}
export function renderPresentation(canvas:HTMLCanvasElement,scratch:HTMLCanvasElement,p:Presentation,assets:PresentationAssets,time:number,width:number,height:number,live?:{roles:Record<string,string>;poses:Record<string,Pose>},depth?:Cutout3D,transparent=false,safeArea?:import('./stage-bounds').SafeArea){
 renderPresentationFrame(canvas,scratch,p,assets,time,width,height,live,depth,transparent,safeArea);const shade=transitionShade(p,time);if(shade>0){const ctx=canvas.getContext('2d')!;ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=shade;ctx.fillStyle='#000000';ctx.fillRect(0,0,width,height);ctx.globalAlpha=1;}
}
function renderPresentationFrame(canvas:HTMLCanvasElement,scratch:HTMLCanvasElement,p:Presentation,assets:PresentationAssets,time:number,width:number,height:number,live?:{roles:Record<string,string>;poses:Record<string,Pose>},depth?:Cutout3D,transparent=false,safeArea?:import('./stage-bounds').SafeArea){
 p=boundedPresentation(p,assets,time,safeArea);
 canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d')!;if(!transparent){ctx.fillStyle=p.world.background;ctx.fillRect(0,0,width,height);}const state=presentationState(p,time),world=stageState(p,time);if(!transparent&&world.design&&world.design!=='white')drawBackground(ctx,world.design,width,height);
 if(state.title){ctx.fillStyle='#242a31';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`700 ${Math.round(width*.11)}px -apple-system, sans-serif`;ctx.fillText(state.title.value,width/2,height/2,width*.9);return;}
 const hasToon=p.bindings.some(b=>p.production?.representations[b.speaker]==='toon3d');if(hasToon)renderToonCast(ctx,p,assets,time,width,height);
 // Sama kameramuunnos esikatselulle, viennille ja näyttämön suoralle muokkaukselle (stageProjection).
 if(!hasToon){const view=stageProjection(p,assets,time,width,height);ctx.translate(view.x,view.y);ctx.scale(view.scale,view.scale);}
 drawProps(ctx,p.production?.props??[],time,width,height);
 for(const b of p.bindings){if(p.production?.representations[b.speaker]==='toon3d')continue;const resource=assets[b.asset],animation=p.actorAnimations?.[b.speaker];if(!resource||!animation)continue;const frame=Math.max(0,Math.min(animation.duration-1,time*animation.fps)),r=stageActor(p,b,time,width,height);ctx.save();ctx.translate(r.x-resource.doc.width*r.scale/2,r.y-resource.doc.height*r.scale/2);ctx.scale(r.scale,r.scale);const poses:Record<string,Pose>={};const constraint=p.events.filter(e=>e.kind==='constraint'&&['still','release-still'].includes(e.value)&&[b.speaker,'scene'].includes(e.target)&&(e.at??0)<=time).at(-1);if(live&&p.source==='live'&&constraint?.value!=='still'&&b===p.bindings[0]&&!p.events.some(e=>e.kind==='hold'&&e.protected&&e.value==='dead_stare'&&e.target===b.speaker&&time>=e.at!&&time<e.at!+e.duration!))for(const role of ['head','leftPupil','rightPupil','leftBrow','rightBrow','leftBlink','rightBlink']){const src=live.poses[live.roles[role]],key=(resource.doc.quick?.views?.[viewAtFrame(resource.doc.quick,animation,frame)]??resource.doc.quick?.roles)?.[role];if(src&&key)poses[key]=src;}const draft=Object.keys(poses).length?{key:resource.doc.quick!.roles.head,pose:poses[resource.doc.quick!.roles.head]??{x:0,y:0,rotation:0,scale:1,opacity:1},poses}:undefined;const items=heldItems(p,world,b.speaker),inHand=new Map<string,(target:CanvasRenderingContext2D)=>void>();
  for(const item of items){if(item.releasedAt!==undefined)continue;const placement=heldPropPlacement(resource.doc,animation,frame,item.hand,item.spec,draft);if(placement)inHand.set(placement.handKey,target=>drawHeldProp(target,item.spec,placement));}
  paintAnimatedLayers(ctx,resource.doc,animation,frame,draft,depth,inHand);ctx.restore();
  for(const item of items){if(item.releasedAt===undefined)continue;const at=Math.max(0,Math.min(animation.duration-1,item.releasedAt*animation.fps)),placement=heldPropPlacement(resource.doc,animation,at,item.hand,item.spec);if(!placement)continue;const rr=stageActor(p,b,item.releasedAt,width,height);ctx.save();ctx.translate(rr.x-resource.doc.width*rr.scale/2,rr.y-resource.doc.height*rr.scale/2);ctx.scale(rr.scale,rr.scale);drawHeldProp(ctx,item.spec,placement);ctx.restore();}
 }
}

/** Hahmon kädessä olevat tai laskemat esineet hetkellä: puhelin (maailman tila) ja muut kirjaston esineet. */
export function heldItems(p:Presentation,world:ReturnType<typeof stageState>,speaker:string):{spec:HeldPropSpec;hand:Hand;releasedAt?:number}[]{
 const out:{spec:HeldPropSpec;hand:Hand;releasedAt?:number}[]=[];
 if(world.phone.enabled&&world.phone.carrier===speaker)out.push({spec:heldProp('phone-v1')!,hand:world.phone.hand,releasedAt:world.phone.releasedAt});
 for(const item of world.held.filter(h=>h.carrier===speaker)){const spec=heldProp(item.id);if(spec)out.push({spec,hand:item.hand,releasedAt:item.releasedAt});}
 return out;
}
