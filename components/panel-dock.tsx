import {useLayoutEffect,useRef,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';

/** Move one persistent portal container, preserving controllers and their effects. */
export default function PanelDock({target,children,className=''}:{target?:HTMLElement|null;children:ReactNode;className?:string}){
 const fallback=useRef<HTMLDivElement>(null);
 const [host]=useState(()=>typeof document==='undefined'?null:document.createElement('div'));
 const refocus=useRef<HTMLElement|null>(null);
 // Detaching a host blurs the control inside it; restore focus so keyboard and VoiceOver users keep their place.
 useLayoutEffect(()=>{if(!host)return;host.className='panel-dock '+className;(target??fallback.current)?.appendChild(host);const lost=refocus.current;refocus.current=null;if(lost&&host.contains(lost)&&lost.getClientRects().length&&(document.activeElement===document.body||!document.activeElement))lost.focus({preventScroll:true});return()=>{const active=document.activeElement;refocus.current=active instanceof HTMLElement&&host.contains(active)?active:null;host.remove();};},[target,host,className]);
 return <><div className="dock-fallback" ref={fallback}/>{host?createPortal(children,host):children}</>;
}
