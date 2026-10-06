import {renderFrameSvg,type CutoutArt,type CutoutBackgroundImage} from './svg-renderer.ts';
import type {Timeline,Viseme} from './model.ts';

export async function renderCutoutFrameToCanvas(canvas:HTMLCanvasElement,timeline:Timeline,frame:number,art:Record<string,CutoutArt>,voices:Record<string,Viseme[]>={},width=timeline.width,height=timeline.height,backgroundImages:Record<string,CutoutBackgroundImage>={}){
 canvas.width=width;canvas.height=height;
 const svg=renderFrameSvg(timeline,Math.max(0,Math.min(timeline.duration-1,frame)),art,voices,backgroundImages);
 const blob=new Blob([svg],{type:'image/svg+xml;charset=utf-8'});
 const url=URL.createObjectURL(blob);
 try{
  await new Promise<void>((resolve,reject)=>{
   const img=new Image();
   img.onload=()=>{const ctx=canvas.getContext('2d')!;ctx.clearRect(0,0,width,height);ctx.drawImage(img,0,0,width,height);resolve();};
   img.onerror=()=>reject(new Error('Kartonkiruudun piirto epäonnistui.'));
   img.src=url;
  });
 }finally{URL.revokeObjectURL(url);}
}
