import {useEffect,useRef,useState} from 'react';
import {renderPresentation} from '../lib/presentation-render.ts';
import {getShotThumbDataUrl,setShotThumbDataUrl,shotThumbCacheKey} from '../lib/shot-thumb-cache.ts';
import type {Presentation} from '../lib/presentation-model.ts';
import type {PresentationAssets} from '../lib/presentation-compile.ts';
import type {Event} from '../lib/presentation-model.ts';

export default function ShotThumb({presentation,assets,event,width=64,height=36,label}:{presentation:Presentation;assets:PresentationAssets;event:Event;width?:number;height?:number;label?:string}){
 const canvas=useRef<HTMLCanvasElement>(null);
 const cacheKey=shotThumbCacheKey(presentation.id,event.id,event.at??0,width,height);
 const [dataUrl,setDataUrl]=useState(()=>getShotThumbDataUrl(cacheKey));
 useEffect(()=>{
  const cached=getShotThumbDataUrl(cacheKey);
  if(cached){setDataUrl(cached);return;}
  const timer=setTimeout(()=>{
   const node=canvas.current;
   if(!node)return;
   renderPresentation(node,document.createElement('canvas'),presentation,assets,event.at??0,width,height);
   try{
    const url=node.toDataURL('image/jpeg',0.75);
    setShotThumbDataUrl(cacheKey,url);
    setDataUrl(url);
   }catch{/* tainted canvas — keep canvas only */}
  },0);
  return()=>clearTimeout(timer);
 },[presentation,assets,event.id,event.at,width,height,cacheKey]);
 if(dataUrl)return <img src={dataUrl} width={width} height={height} className="shot-thumb" alt={label??''} aria-hidden={label?undefined:true}/>;
 return <canvas ref={canvas} width={width} height={height} className="shot-thumb" aria-label={label} aria-hidden={label?undefined:true}/>;
}
