/**
 * Käteen kiinnitetyt esineet: tartuntapiste (grip) esineen omassa koordinaatistossa ja kädessä.
 *
 * Esineen muunnos lasketaan joka ruudussa käden lopullisesta maailmanmatriisista (`animationTransforms`):
 *   M_esine = M_käsi · T(käden grip) · R(grip-kulma) · S(leveys, korkeus) · T(−esineen grip)
 * jolloin esineen tartuntapiste osuu täsmälleen käden tartuntapisteeseen kaikissa kuvakulmissa ja asennoissa.
 * Sama funktio palvelee esikatselua ja vientiä (renderPresentation); toon3d skinnaa puhelimen käsiluuhun erikseen.
 */
import {animationTransforms,combine,type Transform} from './animation-transform.ts';
import {flatten,type PsdDocument} from './psd-model.ts';
import type {Animation,Pose} from './animation-model.ts';
import type {CharacterView} from './character-view.ts';
import {viewAtFrame} from './character-view.ts';
import type {Shape} from './backgrounds.ts';

export type Hand='leftHand'|'rightHand';
/** Käden tartuntapiste dokumentin koordinaateissa (lepoasennossa) ja esineen kulma asteina. */
export type Grip={x:number;y:number;angle:number};
export type HandGrips=Partial<Record<CharacterView,Partial<Record<Hand,Grip>>>>;
export type PropView='front'|'side'|'back';
export type HeldPropSpec={id:string;name:string;aliases:RegExp;aspect:number;handRatio:number;grip:{x:number;y:number};angle:number;views:Record<PropView,Shape[]>};

const r=(fill:string,...rect:number[]):Shape=>({fill,rect}),e=(fill:string,...ellipse:number[]):Shape=>({fill,ellipse}),p=(fill:string,...points:number[][]):Shape=>({fill,points});
const ink='#24364b',screen='#76b5d1',cream='#f0ead9',orange='#b57860',brown='#8a5b45',teal='#4f8a8b';
/** Alkuperäinen (CC0) vektoritaide, yksikköneliössä [0,1]². Kolme näkymää: edestä, sivulta, takaa. */
export const heldProps:HeldPropSpec[]=[
 {id:'phone-v1',name:'Puhelin',aliases:/^(puhelin\p{L}*|puhelim\p{L}*|kännyk\p{L}*|phone|phones|smartphone|cellphone|mobile)$/u,aspect:.5,handRatio:1.15,grip:{x:.5,y:.7},angle:0,views:{
  front:[r(ink,.03,.02,.94,.96),r(screen,.1,.09,.8,.79),r('#bfd7e2',.36,.05,.28,.02)],
  side:[r(ink,.4,.02,.2,.96),r('#9dafbf',.55,.25,.05,.15)],
  back:[r(ink,.03,.02,.94,.96),r('#546782',.12,.08,.35,.21),e('#111c2b',.22,.13,.06,.03),e('#111c2b',.36,.21,.06,.03),e('#8192a8',.5,.54,.12,.06)]}},
 {id:'mug-prop-v1',name:'Kahvikuppi',aliases:/^(kahvikup\p{L}*|kuppi\p{L}*|kupi\p{L}*|muki\p{L}*|mug|mugs|cup|cups|coffee)$/u,aspect:1.05,handRatio:.75,grip:{x:.88,y:.5},angle:0,views:{
  front:[e(ink,.85,.5,.15,.2),e(cream,.85,.5,.08,.12),r(orange,.05,.15,.7,.8),e(orange,.4,.95,.35,.05),e(cream,.4,.15,.35,.06),e('#765448',.4,.15,.29,.035)],
  side:[e(ink,.85,.5,.04,.2),r(orange,.12,.15,.66,.8),e(orange,.45,.95,.33,.05),e(cream,.45,.15,.33,.06)],
  back:[r('#9c624e',.05,.15,.7,.8),e('#9c624e',.4,.95,.35,.05),e(cream,.4,.15,.35,.06),e(ink,.85,.5,.12,.18)]}},
 {id:'book-prop-v1',name:'Kirja',aliases:/^(kirja\p{L}*|kirjo\p{L}*|book|books|novel)$/u,aspect:.72,handRatio:1.45,grip:{x:.5,y:.82},angle:0,views:{
  front:[r(ink,.08,.04,.86,.94),r(orange,.04,.02,.86,.94),r('#9c5f4d',.04,.02,.14,.94),r(cream,.3,.2,.45,.03),r(cream,.3,.27,.32,.02)],
  side:[r(orange,.38,.02,.24,.96),r(cream,.42,.04,.18,.92),r('#c9bfa8',.42,.1,.18,.01),r('#c9bfa8',.42,.5,.18,.01)],
  back:[r('#9c5f4d',.06,.02,.86,.94),r(orange,.82,.02,.1,.94),r(cream,.25,.75,.45,.05)]}},
 {id:'bag-prop-v1',name:'Laukku',aliases:/^(lauk\p{L}*|kassi\p{L}*|kassin|reppu\p{L}*|repu\p{L}*|bag|bags|handbag|purse)$/u,aspect:1.15,handRatio:2.1,grip:{x:.5,y:.05},angle:0,views:{
  front:[e(ink,.5,.2,.26,.2),r(orange,.06,.3,.88,.66),r('#995c49',.08,.86,.84,.1),r(cream,.45,.5,.1,.1)],
  side:[e(ink,.5,.2,.06,.2),r(orange,.32,.3,.36,.66),r('#995c49',.33,.86,.34,.1)],
  back:[e(ink,.5,.2,.26,.2),r('#995c49',.06,.3,.88,.66),r(brown,.15,.45,.7,.04)]}},
 {id:'umbrella-prop-v1',name:'Sateenvarjo',aliases:/^(sateenvarj\p{L}*|varjo\p{L}*|umbrella|umbrellas|brolly)$/u,aspect:.26,handRatio:4.2,grip:{x:.5,y:.93},angle:0,views:{
  front:[p(teal,[.5,.02],[.95,.78],[.05,.78]),r('#3a6869',.46,.05,.08,.73),r(ink,.47,.78,.06,.16),e(ink,.4,.95,.12,.03)],
  side:[p(teal,[.5,.02],[.8,.78],[.2,.78]),r(ink,.47,.78,.06,.16),e(ink,.6,.95,.12,.03)],
  back:[p('#3a6869',[.5,.02],[.95,.78],[.05,.78]),r(ink,.47,.78,.06,.16),e(ink,.6,.95,.12,.03)]}},
];
export const heldPropIds=heldProps.map(h=>h.id);
export function heldProp(id:string){return heldProps.find(h=>h.id===id);}
/** Sana → kädessä pidettävä esine (sanastohaku, ei osamerkkijonoa). */
export function heldPropFromWord(word:string){const w=word.toLocaleLowerCase('fi-FI');return heldProps.find(h=>h.aliases.test(w));}
export const propViewFor=(view:CharacterView):PropView=>view==='front'?'front':view==='back'?'back':'side';

/** Käden tartuntapiste: profiilin `grips` tai oletuksena käsikerroksen rajauksen keskipiste (kämmen). */
export function handGrip(doc:PsdDocument,view:CharacterView,hand:Hand):Grip|undefined{
 const q=doc.quick;if(!q)return;const explicit=(q as {grips?:HandGrips}).grips?.[view]?.[hand];if(explicit)return explicit;
 const roles=q.views?.[view]??q.roles,key=roles[hand];if(!key)return;
 const layer=flatten(doc.layers).find(l=>l.key===key);if(!layer||!layer.width||!layer.height)return;
 return {x:layer.left+layer.width/2,y:layer.top+layer.height/2,angle:0};
}
/** Käden koko (korkeus dokumentin pikseleinä) esineen mittakaavaa varten. */
export function handSize(doc:PsdDocument,view:CharacterView,hand:Hand):number{const q=doc.quick,roles=q?.views?.[view]??q?.roles,key=roles?.[hand];const layer=key?flatten(doc.layers).find(l=>l.key===key):undefined;return Math.max(8,layer?Math.max(layer.width,layer.height):doc.height*.06);}
export const applyPoint=(t:Transform,x:number,y:number)=>({x:t.a*x+t.c*y+t.e,y:t.b*x+t.d*y+t.f});
const affine=(a:number,b:number,c:number,d:number,e:number,f:number):Transform=>({a,b,c,d,e,f,opacity:1});

export type HeldPlacement={matrix:Transform;view:PropView;handKey:string;handGrip:{x:number;y:number};propGrip:{x:number;y:number};width:number;height:number};
/** Esineen dokumenttitilan matriisi ruudussa `frame` (käden lopullisesta maailmanmatriisista). */
export function heldPropPlacement(doc:PsdDocument,animation:Animation,frame:number,hand:Hand,spec:HeldPropSpec,draft?:{key:string;pose:Pose;poses?:Record<string,Pose>},transforms=animationTransforms(animation,frame,draft)):HeldPlacement|undefined{
 const q=doc.quick;if(!q)return;const view=viewAtFrame(q,animation,frame),roles=q.views?.[view]??q.roles,handKey=roles[hand];if(!handKey)return;
 const handT=transforms.get(handKey),grip=handGrip(doc,view,hand);if(!handT||!grip)return;
 const height=handSize(doc,view,hand)*spec.handRatio,width=height*spec.aspect,angle=(grip.angle+spec.angle)*Math.PI/180;
 const local=combine(combine(combine(affine(1,0,0,1,grip.x,grip.y),affine(Math.cos(angle),Math.sin(angle),-Math.sin(angle),Math.cos(angle),0,0)),affine(width,0,0,height,0,0)),affine(1,0,0,1,-spec.grip.x,-spec.grip.y));
 const matrix={...combine(handT,local),opacity:handT.opacity};
 return {matrix,view:propViewFor(view),handKey,handGrip:applyPoint(handT,grip.x,grip.y),propGrip:applyPoint(matrix,spec.grip.x,spec.grip.y),width,height};
}
/** Piirtää esineen kontekstin nykyiseen (hahmon dokumentti-) tilaan. */
export function drawHeldProp(ctx:CanvasRenderingContext2D,spec:HeldPropSpec,placement:{matrix:Transform;view:PropView}){
 ctx.save();const m=placement.matrix;ctx.globalAlpha*=m.opacity;ctx.transform(m.a,m.b,m.c,m.d,m.e,m.f);
 for(const s of spec.views[placement.view]){ctx.fillStyle=s.fill;if(s.rect)ctx.fillRect(s.rect[0],s.rect[1],s.rect[2],s.rect[3]);else if(s.ellipse){ctx.beginPath();ctx.ellipse(s.ellipse[0],s.ellipse[1],s.ellipse[2],s.ellipse[3],0,0,Math.PI*2);ctx.fill();}else if(s.points){ctx.beginPath();s.points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();}}
 ctx.restore();
}
/** Esineen SVG-esikatselu kirjastoon (kaikki kolme näkymää). */
export function heldPropSvg(id:string,view:PropView='front'){const spec=heldProp(id);if(!spec)throw Error('Esine puuttuu: '+id);return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1" width="128" height="128">${spec.views[view].map(s=>s.rect?`<rect fill="${s.fill}" x="${s.rect[0]}" y="${s.rect[1]}" width="${s.rect[2]}" height="${s.rect[3]}"/>`:s.ellipse?`<ellipse fill="${s.fill}" cx="${s.ellipse[0]}" cy="${s.ellipse[1]}" rx="${s.ellipse[2]}" ry="${s.ellipse[3]}"/>`:`<polygon fill="${s.fill}" points="${s.points!.map(v=>v.join(',')).join(' ')}"/>`).join('')}</svg>`;}
