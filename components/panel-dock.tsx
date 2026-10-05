import {useLayoutEffect,useRef,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';

/** Move one persistent portal container, preserving controllers and their effects. */
export default function PanelDock({target,children,className=''}:{target?:HTMLElement|null;children:ReactNode;className?:string}){
 const fallback=useRef<HTMLDivElement>(null);
 const [host]=useState(()=>typeof document==='undefined'?null:document.createElement('div'));
 useLayoutEffect(()=>{if(!host)return;host.className='panel-dock '+className;(target??fallback.current)?.appendChild(host);return()=>host.remove();},[target,host,className]);
 return <><div className="dock-fallback" ref={fallback}/>{host?createPortal(children,host):children}</>;
}
