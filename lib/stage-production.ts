import {isHardCameraCutSource} from './presentation-camera-cut.ts';
import {measureCharacter,shotAnchor} from './stage-composition.ts';
import {stageActor} from './presentation-stage.ts';import {toonCamera} from './toon-render.ts';import {sampleTrack} from './animation-model.ts';import {animationRoot,clampAnimatedPlacement,defaultSafeArea,type SafeArea} from './stage-bounds.ts';import type {Presentation} from './presentation-model.ts';import type {PresentationAssets} from './presentation-compile.ts';
export function boundedPresentation(p:Presentation,assets:PresentationAssets,time:number,safe:SafeArea=defaultSafeArea):Presentation{return {...p,bindings:p.bindings.map(b=>{const resource=assets[b.asset],a=p.actorAnimations?.[b.speaker];if(!resource||!a)return b;const r=stageActor(p,b,time),root=animationRoot(resource.doc,a,time*a.fps),pose=sampleTrack(a.tracks.find(t=>t.key===root),time*a.fps),limited=clampAnimatedPlacement({width:p.world.width,height:p.world.height,x:r.x,y:r.y,scale:r.scale,background:p.world.background,guides:false,safeArea:safe},resource.doc,a,time*a.fps,pose);return {...b,x:limited.x,y:limited.y,scale:limited.scale};})};}
const measures=new WeakMap<object,ReturnType<typeof measureCharacter>>();
const measureOf=(doc:import('./psd-model.ts').PsdDocument)=>{let m=measures.get(doc);if(!m){m=measureCharacter(doc);measures.set(doc,m);}return m;};
/**
 * Kameran muunnos hetkellä `time`: ruutu = maailma·scale + (x, y). Kohdehahmon kuvissa silmäpiste asetetaan
 * kuvakoon silmälinjalle (lähikuva 1/3, puolikuva 0,3) ja katseen suuntaan jätetään tilaa. Laaja kuva näyttää näyttämön.
 */
export function cameraTransform(p:Presentation,assets:PresentationAssets,at:number,width=p.world.width,height=p.world.height){
 const c=toonCamera(p,at),b=p.bindings.find(b=>b.speaker===c.target),resource=b?assets[b.asset]:undefined;
 if(b&&resource&&c.target!=='scene'){
  const r=stageActor(p,b,at,width,height),a=p.actorAnimations?.[b.speaker],root=a?animationRoot(resource.doc,a,at*a.fps):undefined,pose=a?sampleTrack(a.tracks.find(t=>t.key===root),at*a.fps):undefined,m=measureOf(resource.doc);
  const eye={x:r.x+(m.eyeX-resource.doc.width/2+(pose?.x??0))*r.scale,y:r.y+(m.eyeY-resource.doc.height/2+(pose?.y??0))*r.scale};
  const shot=p.events.filter(e=>e.kind==='shot'&&(e.at??0)<=at).sort((x,y)=>(x.at??0)-(y.at??0)).at(-1),size=(shot?.value==='close'||shot?.value==='medium'?shot.value:'medium') as 'close'|'medium';
  const gaze=p.events.filter(e=>e.kind==='gaze'&&e.target===b.speaker&&(e.at??0)<=at).sort((x,y)=>(x.at??0)-(y.at??0)).at(-1),other=gaze?p.bindings.find(o=>o.speaker===gaze.value):undefined;
  const looking=gaze?.value==='camera'?'camera':other?(stageActor(p,other,at,width,height).x>r.x?'right':'left'):undefined;
  const side=r.x<width*.45?'left':r.x>width*.55?'right':'center',anchor=shotAnchor(size,side,looking,width,height);
  return {scale:c.zoom,x:anchor.x-(c.offsetX+c.pan*c.panX)*width*c.zoom-eye.x*c.zoom,y:anchor.y-(c.offsetY+c.pan*c.panY)*height*c.zoom-eye.y*c.zoom};
 }
 if(c.zoom!==1||c.pan||c.offsetX||c.offsetY)return {scale:c.zoom,x:width/2-(width/2+(c.offsetX+c.pan*c.panX)*width)*c.zoom,y:height*.46-(height*.46+(c.offsetY+c.pan*c.panY)*height)*c.zoom};
 return {scale:1,x:0,y:0};
}
/** Read-only inverse of the existing orthographic 2D camera framing. */
export function stageProjection(p:Presentation,assets:PresentationAssets,time:number,width=p.world.width,height=p.world.height){const next=cameraTransform(p,assets,time,width,height);if(!p.original.trimStart().startsWith('#!kilsat'))return next;const shot=p.events.filter(e=>e.kind==='shot'&&(e.at??0)<=time).sort((a,b)=>(a.at??0)-(b.at??0)).at(-1);if(!shot)return next;const t=Math.max(0,Math.min(1,(time-(shot.at??0))/.35)),u=isHardCameraCutSource(shot.sourceRef.text)?1:t*t*(3-2*t),before=cameraTransform(p,assets,Math.max(0,(shot.at??0)-.000001),width,height);return {scale:before.scale+(next.scale-before.scale)*u,x:before.x+(next.x-before.x)*u,y:before.y+(next.y-before.y)*u};}
