import {layerPixels} from './layer-pixels.ts';
import {animationTransforms} from './animation-transform.ts';
import type {Animation,Pose} from './animation-model.ts';import type {PsdDocument,LayerNode} from './psd-model.ts';
export type Cutout3D={enabled:boolean;yaw:number;pitch:number;depth:number};
export const defaultCutout3D:Cutout3D={enabled:false,yaw:20,pitch:-5,depth:12};
export function readCutout3D(v:unknown):Cutout3D|undefined{if(v===undefined)return;const s=v as Cutout3D;if(!s||typeof s.enabled!=='boolean'||![s.yaw,s.pitch,s.depth].every(Number.isFinite)||Math.abs(s.yaw)>70||Math.abs(s.pitch)>40||s.depth<0||s.depth>40)throw Error('3D-syvyyden asetukset ovat virheelliset.');return {...s};}
export type Point3={x:number;y:number;z:number};
/** Orthographic 3D camera rotation. X/Y image coordinates enter genuine XYZ space. */
export function projectCutout(p:Point3,yaw:number,pitch:number):Point3{const y=yaw*Math.PI/180,x=pitch*Math.PI/180,rx=p.x*Math.cos(y)+p.z*Math.sin(y),rz=-p.x*Math.sin(y)+p.z*Math.cos(y);return {x:rx,y:p.y*Math.cos(x)-rz*Math.sin(x),z:p.y*Math.sin(x)+rz*Math.cos(x)};}
function imageTriangle(ctx:CanvasRenderingContext2D,image:HTMLImageElement|HTMLCanvasElement,src:{x:number;y:number}[],dst:Point3[]){const [a,b,c]=src,[u,v,w]=dst,det=(b.x-a.x)*(c.y-a.y)-(c.x-a.x)*(b.y-a.y);if(Math.abs(det)<1e-8)return;const m00=((v.x-u.x)*(c.y-a.y)-(w.x-u.x)*(b.y-a.y))/det,m01=((w.x-u.x)*(b.x-a.x)-(v.x-u.x)*(c.x-a.x))/det,m10=((v.y-u.y)*(c.y-a.y)-(w.y-u.y)*(b.y-a.y))/det,m11=((w.y-u.y)*(b.x-a.x)-(v.y-u.y)*(c.x-a.x))/det;ctx.save();ctx.beginPath();ctx.moveTo(u.x,u.y);ctx.lineTo(v.x,v.y);ctx.lineTo(w.x,w.y);ctx.closePath();ctx.clip();ctx.transform(m00,m10,m01,m11,u.x-m00*a.x-m01*a.y,u.y-m10*a.x-m11*a.y);ctx.drawImage(image,0,0);ctx.restore();}
/** Textured extruded paper cutouts, not a volumetric human model. Shared by preview and export. */
export function paintCutout3D(ctx:CanvasRenderingContext2D,doc:PsdDocument,animation:Animation,frame:number,settings:Cutout3D,draft?:{key:string;pose:Pose;poses?:Record<string,Pose>}){
 const transforms=animationTransforms(animation,frame,draft),layers:{node:LayerNode;opacity:number}[]=[];const collect=(nodes:LayerNode[],alpha=1)=>{for(const node of nodes){if(!node.visible)continue;const opacity=alpha*node.opacity;if(node.kind==='group')collect(node.children,opacity);else if(layerPixels(node))layers.push({node,opacity});}};collect(doc.layers);
 const faces:{points:Point3[];opacity:number;image?:HTMLImageElement|HTMLCanvasElement;source?:{x:number;y:number}[];depth:number}[]=[];
 const center={x:doc.width/2,y:doc.height/2};
 layers.forEach(({node:n,opacity},index)=>{const t=transforms.get(n.key);if(!t||t.opacity<.001)return;const world=(x:number,y:number,z:number)=>{const p=projectCutout({x:t.a*x+t.c*y+t.e-center.x,y:t.b*x+t.d*y+t.f-center.y,z},settings.yaw,settings.pitch);return {...p,x:p.x+center.x,y:p.y+center.y};};const z=index*settings.depth/Math.max(1,layers.length),xy=[[n.left,n.top],[n.left+n.width,n.top],[n.left+n.width,n.top+n.height],[n.left,n.top+n.height]],front=xy.map(([x,y])=>world(x,y,z)),back=xy.map(([x,y])=>world(x,y,z-settings.depth*.3));
  const add=(points:Point3[],planeDepth:number,image?:HTMLImageElement|HTMLCanvasElement,source?:{x:number;y:number}[])=>faces.push({points,opacity:opacity*t.opacity,image,source,depth:planeDepth});
  // Transparent PSD crops must keep transparent silhouettes: depth edges are generated
  // from the actual alpha texture, never an opaque rectangle around a limb.
  add(back,z-settings.depth*.3,layerPixels(n),[{x:0,y:0},{x:n.width,y:0},{x:n.width,y:n.height},{x:0,y:n.height}]);add(front,z,layerPixels(n),[{x:0,y:0},{x:n.width,y:0},{x:n.width,y:n.height},{x:0,y:n.height}]);
 });
 faces.sort((a,b)=>a.depth-b.depth);for(const face of faces){ctx.save();ctx.globalAlpha*=face.opacity;for(const indices of [[0,1,2],[0,2,3]])imageTriangle(ctx,face.image!,indices.map(i=>face.source![i]),indices.map(i=>face.points[i]));ctx.restore();}
}
