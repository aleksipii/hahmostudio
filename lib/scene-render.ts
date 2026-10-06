import {clampAnimatedPlacement,animationRoot} from './stage-bounds';
import {sampleTrack} from './animation-model';
import {renderPresentation} from './presentation-render';
import {phonePlacement,drawPhone} from './phone-prop';
import {drawBackground} from './backgrounds';
import {paintAnimatedLayers} from './psd-render';
import {placement,sceneDesign,type Scene} from './scene-model';
import type {PsdDocument} from './psd-model';
import type {Animation,Pose} from './animation-model';
import type {CutoutRenderContext} from './cutout/export-context';
import {findCutoutBundle} from './cutout/export-context';
import {renderCutoutFrameToCanvas} from './cutout/canvas-render';
export function renderScene(canvas:HTMLCanvasElement,scratch:HTMLCanvasElement,doc:PsdDocument,animation:Animation,frame:number,scene:Scene,draft?:{key:string;pose:Pose;poses?:Record<string,Pose>},transparent=false,previewScale=1,cutout?:CutoutRenderContext):void|Promise<void>{
 const production=scene.presentations?.find(p=>p.startFrame!==undefined&&frame>=p.startFrame&&frame<p.startFrame+Math.ceil(p.seconds*animation.fps));
 if(production){
  const w=Math.round(scene.width*previewScale),h=Math.round(scene.height*previewScale),time=(frame-production.startFrame!)/animation.fps;
  const bundle=cutout&&findCutoutBundle(cutout,production);
  if(bundle)return renderCutoutFrameToCanvas(canvas,bundle.timeline,Math.round(time*24),cutout!.art,bundle.voices,w,h,cutout!.backgroundHrefs);
  renderPresentation(canvas,scratch,production,doc.presentationAssets??{},time,w,h,draft?.poses&&doc.quick?{roles:doc.quick.roles,poses:draft.poses}:undefined,scene.cutout3d,transparent,scene.safeArea);
  return;
 }
 canvas.width=Math.round(scene.width*previewScale);canvas.height=Math.round(scene.height*previewScale);const ctx=canvas.getContext('2d')!;ctx.scale(previewScale,previewScale);if(!transparent){ctx.fillStyle=scene.background;ctx.fillRect(0,0,scene.width,scene.height);}const design=sceneDesign(scene,frame);if(design&&!transparent)drawBackground(ctx,design,scene.width,scene.height);const root=animationRoot(doc,animation,frame),pose=sampleTrack(animation.tracks.find(t=>t.key===root),frame),limited=clampAnimatedPlacement(scene,doc,animation,frame,pose);const r=placement(limited,doc);ctx.save();ctx.translate(r.x,r.y);ctx.scale(limited.scale,limited.scale);paintAnimatedLayers(ctx,doc,animation,frame,draft,scene.cutout3d);ctx.restore();const phone=phonePlacement(limited,doc,animation,frame,draft);if(phone)drawPhone(ctx,phone);
}
