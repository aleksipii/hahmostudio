import {useEffect,type RefObject} from 'react';
import {DIALOG_FOCUSABLE,trappedFocusTarget} from '../lib/dialog-focus';

/** Keep keyboard focus inside the topmost open modal and return it to the opener (or its closed menu) on close. */
export function useDialogFocus(ref:RefObject<HTMLElement|null>,open=true,returnTo?:()=>HTMLElement|null|undefined){
 useEffect(()=>{
  if(!open)return;
  const opener=document.activeElement instanceof HTMLElement&&document.activeElement!==document.body?document.activeElement:null;
  const items=(root:HTMLElement)=>[...root.querySelectorAll<HTMLElement>(DIALOG_FOCUSABLE)].filter(el=>el.getClientRects().length>0);
  const initial=requestAnimationFrame(()=>{const root=ref.current;if(root&&!root.contains(document.activeElement))(items(root)[0]??root).focus({preventScroll:true});});
  const keyboard=(e:KeyboardEvent)=>{
   const root=ref.current;if(e.key!=='Tab'||!root)return;
   if([...document.querySelectorAll('[aria-modal="true"]')].at(-1)!==root)return;
   const list=items(root),active=document.activeElement instanceof HTMLElement?document.activeElement:null;
   const target=trappedFocusTarget(list,active,!!active&&root.contains(active),e.shiftKey);
   if(target){e.preventDefault();target.focus();}else if(!list.length){e.preventDefault();root.focus();}
  };
  document.addEventListener('keydown',keyboard);
  return()=>{
   cancelAnimationFrame(initial);document.removeEventListener('keydown',keyboard);
   const back=opener?.isConnected&&opener.getClientRects().length?opener:opener?.closest('details')?.querySelector<HTMLElement>('summary')??returnTo?.();
   back?.focus({preventScroll:true});
  };
 },[open,ref]);
}
