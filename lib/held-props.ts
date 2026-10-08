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
 {id:'tablet-prop-v1',name:'Tabletti',aliases:/^(tablet\p{L}*|ipad\p{L}*|tablets?)$/u,aspect:.74,handRatio:1.7,grip:{x:.5,y:.86},angle:0,views:{
  front:[r(ink,.03,.02,.94,.96),r(screen,.09,.07,.82,.8),p('#a3cde0',[.09,.07],[.5,.07],[.09,.45]),e('#bfd7e2',.5,.935,.035,.022)],
  side:[r(ink,.44,.02,.12,.96),r('#9dafbf',.5,.2,.06,.08)],
  back:[r('#5d6f86',.03,.02,.94,.96),r(ink,.08,.05,.18,.12),e('#111c2b',.17,.11,.05,.035),e('#8192a8',.5,.5,.1,.075)]}},
 {id:'keys-prop-v1',name:'Avaimet',aliases:/^(avaim\p{L}*|avain|avaimen|avainnip\p{L}*|keys?|keyring)$/u,aspect:1,handRatio:.7,grip:{x:.28,y:.28},angle:0,views:{
  front:[e('#8c949a',.28,.28,.2,.2),e(cream,.28,.28,.11,.11),p('#a8adb0',[.38,.4],[.46,.33],[.86,.76],[.78,.84]),r('#a8adb0',.62,.62,.15,.06),r('#a8adb0',.7,.72,.13,.06),r(orange,.06,.5,.2,.3),e(cream,.16,.62,.04,.04)],
  side:[e('#8c949a',.3,.28,.06,.2),r('#a8adb0',.27,.42,.06,.44),r(orange,.2,.5,.08,.3)],
  back:[e('#8c949a',.28,.28,.2,.2),e(cream,.28,.28,.11,.11),p('#979ca0',[.38,.4],[.46,.33],[.86,.76],[.78,.84]),r('#9b604b',.06,.5,.2,.3)]}},
 {id:'bottle-prop-v1',name:'Juomapullo',aliases:/^(pullo\p{L}*|juomapullo\p{L}*|vesipullo\p{L}*|bottles?)$/u,aspect:.4,handRatio:1.5,grip:{x:.5,y:.62},angle:0,views:{
  front:[r(ink,.3,.0,.4,.1),r('#9dc3cf',.34,.1,.32,.08),p(screen,[.32,.18],[.68,.18],[.92,.32],[.92,.96],[.08,.96],[.08,.32]),r(cream,.08,.46,.84,.24),r('#c8372d',.08,.54,.84,.06),r('#b9dbe6',.18,.3,.08,.6)],
  side:[r(ink,.3,.0,.4,.1),p(screen,[.32,.18],[.68,.18],[.92,.32],[.92,.96],[.08,.96],[.08,.32]),r(cream,.08,.46,.84,.24)],
  back:[r(ink,.3,.0,.4,.1),p('#6a9fb4',[.32,.18],[.68,.18],[.92,.32],[.92,.96],[.08,.96],[.08,.32]),r('#d9d2c0',.08,.46,.84,.24)]}},
 {id:'pen-prop-v1',name:'Kynä',aliases:/^(kynä\p{L}*|lyijykynä\p{L}*|kuulakärkikynä\p{L}*|pens?|pencils?)$/u,aspect:.14,handRatio:1,grip:{x:.5,y:.62},angle:0,views:{
  front:[p(ink,[.1,.0],[.9,.0],[.9,.84],[.5,1],[.1,.84]),r(orange,.18,.12,.64,.62),r(cream,.1,.06,.8,.03),r('#9dafbf',.62,.02,.18,.3)],
  side:[p(ink,[.2,.0],[.8,.0],[.8,.84],[.5,1],[.2,.84]),r(orange,.26,.12,.48,.62)],
  back:[p(ink,[.1,.0],[.9,.0],[.9,.84],[.5,1],[.1,.84]),r('#9c624e',.18,.12,.64,.62)]}},
 {id:'paper-prop-v1',name:'Paperi',aliases:/^(paper\p{L}*|paperi\p{L}*|lomake\p{L}*|lomakke\p{L}*|asiakirja\p{L}*|papers?|document|documents|form)$/u,aspect:.72,handRatio:1.45,grip:{x:.5,y:.88},angle:0,views:{
  front:[p(cream,[.04,.02],[.74,.02],[.96,.2],[.96,.98],[.04,.98]),p('#c9c2ae',[.74,.02],[.74,.2],[.96,.2]),...Array.from({length:7},(_,i)=>r(screen,.14,.26+i*.09,.66-(i%3)*.14,.025))],
  side:[r(cream,.47,.02,.06,.96)],
  back:[p('#e2dbc8',[.04,.02],[.96,.02],[.96,.98],[.04,.98])]}},
 {id:'folder-prop-v1',name:'Kansio',aliases:/^(kansio\p{L}*|kansion|mappi\p{L}*|mapi\p{L}*|folders?|binder)$/u,aspect:.82,handRatio:1.75,grip:{x:.5,y:.9},angle:0,views:{
  front:[p(orange,[.02,.14],[.02,.02],[.36,.02],[.44,.14],[.98,.14],[.98,.98],[.02,.98]),r('#d3a07e',.06,.22,.88,.72),r(cream,.24,.42,.52,.16),r('#9c5f4d',.3,.48,.4,.03)],
  side:[r(orange,.42,.02,.16,.96),r(cream,.46,.08,.08,.88)],
  back:[p('#9c5f4d',[.02,.14],[.02,.02],[.36,.02],[.44,.14],[.98,.14],[.98,.98],[.02,.98])]}},
 {id:'letter-prop-v1',name:'Kirje',aliases:/^(kirje|kirjeen|kirjettä|kirjeet\p{L}*|kirjekuor\p{L}*|letters?|envelopes?)$/u,aspect:1.45,handRatio:1.15,grip:{x:.22,y:.6},angle:0,views:{
  front:[r(cream,.02,.08,.96,.84),p('#d8cfb8',[.02,.08],[.98,.08],[.5,.56]),p('#e6dfcb',[.02,.92],[.42,.5],[.58,.5],[.98,.92]),r('#c8372d',.78,.14,.14,.2)],
  side:[r(cream,.47,.08,.06,.84)],
  back:[r('#e6dfcb',.02,.08,.96,.84),r(screen,.3,.44,.4,.04),r(screen,.3,.54,.3,.04),r(screen,.3,.64,.34,.04)]}},
 {id:'icecream-prop-v1',name:'Jäätelö',aliases:/^(jäätelö\p{L}*|tötterö\p{L}*|tuutti\p{L}*|tuuti\p{L}*|icecream|ice-cream|cone)$/u,aspect:.52,handRatio:1.25,grip:{x:.5,y:.8},angle:0,views:{
  front:[p('#d9a35b',[.14,.46],[.86,.46],[.5,1]),p('#b9823f',[.3,.46],[.38,.46],[.52,.76]),p('#b9823f',[.62,.46],[.7,.46],[.5,.66]),e('#f3b6c4',.5,.42,.4,.16),e('#fbf2dc',.5,.24,.32,.2),e('#c8372d',.56,.06,.07,.06)],
  side:[p('#d9a35b',[.14,.46],[.86,.46],[.5,1]),e('#f3b6c4',.5,.42,.4,.16),e('#fbf2dc',.5,.24,.32,.2),e('#c8372d',.5,.06,.07,.06)],
  back:[p('#c99551',[.14,.46],[.86,.46],[.5,1]),e('#eaa7b6',.5,.42,.4,.16),e('#f1e8d2',.5,.24,.32,.2)]}},
 {id:'flower-prop-v1',name:'Kukka',aliases:/^(kukka|kukan|kukkaa|kukkia|kukat|kukkien|kukkaset|kukkakimp\p{L}*|ruusu\p{L}*|flowers?|bouquet|rose|roses)$/u,aspect:.5,handRatio:1.7,grip:{x:.5,y:.84},angle:0,views:{
  front:[r('#5f8f4f',.46,.36,.08,.64),p('#6fa35c',[.5,.62],[.86,.48],[.62,.7]),p('#6fa35c',[.5,.74],[.14,.6],[.4,.82]),e('#e8607a',.5,.12,.17,.11),e('#e8607a',.28,.24,.17,.11),e('#e8607a',.72,.24,.17,.11),e('#e8607a',.36,.36,.17,.1),e('#e8607a',.64,.36,.17,.1),e('#f2c230',.5,.26,.13,.09)],
  side:[r('#5f8f4f',.46,.36,.08,.64),p('#6fa35c',[.5,.62],[.86,.48],[.62,.7]),e('#e8607a',.5,.22,.28,.12),e('#d24b66',.5,.3,.18,.07)],
  back:[r('#4f7a41',.46,.36,.08,.64),e('#d24b66',.5,.12,.17,.11),e('#d24b66',.28,.24,.17,.11),e('#d24b66',.72,.24,.17,.11),e('#d24b66',.36,.36,.17,.1),e('#d24b66',.64,.36,.17,.1),e('#5f8f4f',.5,.26,.1,.07)]}},
 {id:'microphone-prop-v1',name:'Mikrofoni',aliases:/^(mikrofon\p{L}*|mikki|mikkiä|mikin|microphones?|mic)$/u,aspect:.3,handRatio:1.35,grip:{x:.5,y:.66},angle:0,views:{
  front:[e('#6b7480',.5,.18,.46,.18),r('#8e98a3',.06,.14,.88,.03),r('#8e98a3',.06,.21,.88,.03),r('#3e4955',.24,.34,.52,.06),p(ink,[.26,.38],[.74,.38],[.62,1],[.38,1]),r('#c8372d',.42,.5,.16,.06)],
  side:[e('#6b7480',.5,.18,.46,.18),r('#3e4955',.24,.34,.52,.06),p(ink,[.3,.38],[.7,.38],[.6,1],[.4,1])],
  back:[e('#59616c',.5,.18,.46,.18),r('#3e4955',.24,.34,.52,.06),p(ink,[.26,.38],[.74,.38],[.62,1],[.38,1])]}},
 {id:'flashlight-prop-v1',name:'Taskulamppu',aliases:/^(taskulamp\p{L}*|otsalamp\p{L}*|flashlights?|torch|torches)$/u,aspect:.32,handRatio:1.5,grip:{x:.5,y:.68},angle:0,views:{
  front:[p('#3e4955',[.02,.0],[.98,.0],[.82,.26],[.18,.26]),e('#fff2b0',.5,.06,.4,.05),r(teal,.2,.26,.6,.74),r('#3a6869',.2,.4,.6,.04),r('#f2c230',.4,.5,.2,.1)],
  side:[p('#3e4955',[.1,.0],[.9,.0],[.78,.26],[.22,.26]),r(teal,.24,.26,.52,.74),r('#f2c230',.66,.5,.1,.1)],
  back:[p('#3e4955',[.02,.0],[.98,.0],[.82,.26],[.18,.26]),r('#3a6869',.2,.26,.6,.74)]}},
 {id:'ball-prop-v1',name:'Pallo',aliases:/^(pallo\p{L}*|jalkapallo\p{L}*|rantapallo\p{L}*|balls?|football)$/u,aspect:1,handRatio:1.3,grip:{x:.5,y:.62},angle:0,views:{
  front:[e('#c8372d',.5,.5,.48,.48),p('#f4f0e6',[.1,.36],[.5,.3],[.9,.36],[.94,.48],[.5,.42],[.06,.48]),p('#2f6f8f',[.08,.62],[.5,.58],[.92,.62],[.86,.74],[.5,.7],[.14,.74])],
  side:[e('#c8372d',.5,.5,.48,.48),p('#f4f0e6',[.1,.36],[.5,.3],[.9,.36],[.94,.48],[.5,.42],[.06,.48])],
  back:[e('#a92e25',.5,.5,.48,.48),p('#e3ddd0',[.1,.36],[.5,.3],[.9,.36],[.94,.48],[.5,.42],[.06,.48])]}},
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
export const heldPropFragment=(spec:HeldPropSpec,view:PropView='front')=>spec.views[view].map(s=>s.rect?`<rect fill="${s.fill}" x="${s.rect[0]}" y="${s.rect[1]}" width="${s.rect[2]}" height="${s.rect[3]}"/>`:s.ellipse?`<ellipse fill="${s.fill}" cx="${s.ellipse[0]}" cy="${s.ellipse[1]}" rx="${s.ellipse[2]}" ry="${s.ellipse[3]}"/>`:`<polygon fill="${s.fill}" points="${s.points!.map(v=>v.join(',')).join(' ')}"/>`).join('');
export function heldPropSvg(id:string,view:PropView='front'){const spec=heldProp(id);if(!spec)throw Error('Esine puuttuu: '+id);return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1" width="128" height="128">${spec.views[view].map(s=>s.rect?`<rect fill="${s.fill}" x="${s.rect[0]}" y="${s.rect[1]}" width="${s.rect[2]}" height="${s.rect[3]}"/>`:s.ellipse?`<ellipse fill="${s.fill}" cx="${s.ellipse[0]}" cy="${s.ellipse[1]}" rx="${s.ellipse[2]}" ry="${s.ellipse[3]}"/>`:`<polygon fill="${s.fill}" points="${s.points!.map(v=>v.join(',')).join(' ')}"/>`).join('')}</svg>`;}
