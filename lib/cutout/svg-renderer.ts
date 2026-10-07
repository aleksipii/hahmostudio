import {backgroundSvg,type BackgroundId} from '../backgrounds.ts';
import {frameState} from './renderer.ts';
import {multiply,invert} from './hierarchy.ts';
import {heldProp,heldPropFragment} from '../held-props.ts';
import type {Timeline,Viseme} from './model.ts';
export type CutoutArt={format:'kilsat-cutout-art';version:1;width:number;height:number;layers:Record<string,string>};
export const sceneBackgrounds:Record<string,BackgroundId>={WHITE_STUDIO:'cutout-studio-v1',STUDIO:'cutout-studio-v1',STREET:'cutout-street-v1',CAR:'cutout-car-v1'};
export type CutoutBackgroundImage={href:string;width:number;height:number};
/** Only packaged, trusted shape fragments are accepted as art; no user SVG is executed. */
export function renderFrameSvg(t:Timeline,frame:number,art:Record<string,CutoutArt>,voices:Record<string,Viseme[]>={},backgroundImages:Record<string,CutoutBackgroundImage>={}){
 const state=frameState(t,frame,voices);
 let bgInner='';
 if(state.scene.startsWith('CUSTOM:')){
  const key=state.scene.slice(7),img=backgroundImages[key];
  if(!img)throw Error('Taustakuva puuttuu: '+key);
  bgInner=`<image href="${img.href}" x="0" y="0" width="${t.width}" height="${t.height}" preserveAspectRatio="xMidYMid slice"/>`;
 }else{
  const design=sceneBackgrounds[state.scene];if(!design)throw Error('Tuntematon lavastus: '+state.scene);
  bgInner=backgroundSvg(design,t.width,t.height).replace(/^<svg[^>]+>/,'').replace(/<\/svg>$/,'');
 }
 const bg=bgInner;
 const figures=state.actors.map(actor=>{const pack=art[actor.asset];if(!pack||pack.format!=='kilsat-cutout-art')throw Error('Hahmon kerrosgrafiikka puuttuu: '+actor.asset);return actor.layers.filter(l=>l.opacity>0&&pack.layers[l.id]).map(l=>`<g transform="matrix(${l.matrix.join(' ')})" opacity="${l.opacity}" stroke="#000" stroke-width="3" stroke-linejoin="round" filter="url(#paper)">${pack.layers[l.id]}</g>`).join('')+heldSvg(t,frame,state,actor.id);}).join('');
 // Foreground paper edging stays in world space and shares the camera transform.
 const foreground=state.scene==='STREET'?`<path d="M0 ${t.height*.97}H${t.width}V${t.height}H0z" fill="#68665e"/>`:'';
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${t.width}" height="${t.height}" viewBox="0 0 ${t.width} ${t.height}"><defs><filter id="paper" filterUnits="userSpaceOnUse" x="-200" y="-200" width="800" height="1000"><feDropShadow dx="1" dy="2" stdDeviation="1.5" flood-opacity="0.25"/></filter></defs><g transform="matrix(${state.camera.join(' ')})"><svg width="${t.width}" height="${t.height}" viewBox="0 0 1 1" preserveAspectRatio="none">${bg}</svg></g>${figures}<g transform="matrix(${state.camera.join(' ')})">${foreground}</g></svg>`;
}

/** Käteen annetut kirjaston esineet kartonkihahmon kämmenkerroksessa; vapautettu esine jää paikalleen ja seuraa kameraa. */
function heldSvg(t:Timeline,frame:number,state:ReturnType<typeof frameState>,actorId:string){
 const index=t.actors.findIndex(a=>a.id===actorId);
 return (t.held??[]).filter(h=>h.actor===actorId&&frame>=h.start).map(h=>{
  const spec=heldProp(h.id),layer=t.actors[index].rig.layers.find(l=>l.id===(h.hand==='leftHand'?'ARM_LEFT_HAND':'ARM_RIGHT_HAND'));
  if(!spec||!layer)return '';
  const released=h.end!==undefined&&frame>=h.end,at=released?Math.max(0,Math.min(t.duration-1,h.end!)):frame,source=released?frameState(t,at):state,hand=source.actors[index].layers.find(l=>l.id===layer.id);
  if(!hand)return '';
  const world=released?multiply(state.camera,multiply(invert(source.camera),hand.matrix)):hand.matrix;
  const [bx,by,bw,bh]=layer.pivotFrame??layer.bounds,height=Math.max(bw,bh)*spec.handRatio,width=height*spec.aspect;
  const m=multiply(world,[width,0,0,height,bx+bw/2-width*spec.grip.x,by+bh/2-height*spec.grip.y]);
  return `<g transform="matrix(${m.join(' ')})" opacity="${hand.opacity}" stroke="#000" stroke-width="${(3/Math.sqrt(width*height)).toFixed(4)}" stroke-linejoin="round" filter="url(#paper)">${heldPropFragment(spec,'front')}</g>`;
 }).join('');
}
