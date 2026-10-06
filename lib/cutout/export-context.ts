import {compilePresentation,type PresentationAssets} from '../presentation-compile.ts';
import {buildCutoutTimelineFromPresentation,buildCutoutVisemes,isCutoutPresentation} from './presentation-ir.ts';
import {loadCutoutArt,loadCutoutPacks} from './pack-loader.ts';
import type {CutoutArt} from './svg-renderer.ts';
import type {Timeline,Viseme,Actor} from './model.ts';
import type {CutoutPack} from './presentation-ir.ts';
import type {Presentation} from '../presentation-model.ts';
import type {PresentationImage} from '../presentation-images.ts';
import type {Animation} from '../animation-model.ts';
import type {Scene} from '../scene-model.ts';
import type {PsdDocument} from '../psd-model.ts';

export type CutoutPresentationBundle={timeline:Timeline;voices:Record<string,Viseme[]>;presentation:Presentation};
export type CutoutRenderContext={
 packs:Partial<Record<Actor['asset'],CutoutPack>>;
 art:Record<string,CutoutArt>;
 images:Record<string,ImageBitmap>;
 backgroundHrefs:Record<string,{href:string;width:number;height:number}>;
 byId:Map<string,CutoutPresentationBundle>;
};

async function bitmapFromBlob(blob:Blob){return createImageBitmap(blob);}
async function bitmapToDataUrl(bmp:ImageBitmap){
 const canvas=document.createElement('canvas');canvas.width=bmp.width;canvas.height=bmp.height;
 canvas.getContext('2d')!.drawImage(bmp,0,0);return canvas.toDataURL('image/png');
}

/** PNG taustat SVG-piirtoon (esikatselu + MP4). */
export async function buildCutoutBackgroundHrefs(images?:Record<string,PresentationImage>){
 const backgroundHrefs:Record<string,{href:string;width:number;height:number}>={};
 for(const [id,img] of Object.entries(images??{})){const bmp=await bitmapFromBlob(img.blob);backgroundHrefs[id]={href:await bitmapToDataUrl(bmp),width:bmp.width,height:bmp.height};}
 return backgroundHrefs;
}

/** Preloads cutout rigs, art, optional PNG backgrounds and presentation timelines for MP4/preview export. */
export async function buildCutoutRenderContext(input:{
 presentations:Presentation[];
 assets:PresentationAssets;
 images?:Record<string,PresentationImage>;
 fps:number;
}):Promise<CutoutRenderContext|undefined>{
 const targets=input.presentations.filter(p=>isCutoutPresentation(p,input.assets));
 if(!targets.length)return;
 const [packs,art]=await Promise.all([loadCutoutPacks(),loadCutoutArt()]);
 const images:Record<string,ImageBitmap>={};
 const backgroundHrefs=await buildCutoutBackgroundHrefs(input.images);
 for(const [id,img] of Object.entries(input.images??{}))images[id]=await bitmapFromBlob(img.blob);
 const byId=new Map<string,CutoutPresentationBundle>();
 for(const raw of targets){
  const p=compilePresentation({...raw,world:{...raw.world,width:raw.world.width,height:raw.world.height}},input.assets,input.fps);
  byId.set(p.id,{presentation:p,timeline:buildCutoutTimelineFromPresentation(p,input.assets,packs),voices:buildCutoutVisemes(p)});
 }
 return {packs,art,images,backgroundHrefs,byId};
}

/** Shared preload for browser MP4, desktop ExportQueue and preview. */
export async function buildCutoutRenderContextFromProject(project:{doc:PsdDocument;animation:Animation;scene:Scene}){
 const presentations=[...(project.scene.presentations??[]),...(project.scene.presentationDraft?[project.scene.presentationDraft]:[])];
 if(!presentations.length)return;
 return buildCutoutRenderContext({presentations,assets:project.doc.presentationAssets??{},images:project.doc.presentationImages??{},fps:project.animation.fps});
}

export function findCutoutBundle(ctx:CutoutRenderContext,p:Presentation){
 return ctx.byId.get(p.id)??[...ctx.byId.values()].find(b=>b.presentation.original===p.original);
}
