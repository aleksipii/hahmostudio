/**
 * Liikkeen laatumittarit (vaihe C). Mittarit lasketaan valmiista animaatiosta ruutu ruudulta:
 *  - kulmanopeuden jatkuvuus: toinen differenssi (°/ruutu²) — porras nopeudessa näkyy piikkinä
 *  - jerk: kolmas differenssi (°/ruutu³)
 *  - jalan tukivaiheen liukuma dokumentin pikseleinä (jalka maassa ja paikallaan pystysuunnassa)
 *  - näkyvien kuvakulmajuurten määrä ruudussa (enintään yksi)
 */
import {sampleTrack,type Animation} from './animation-model.ts';
import {animationTransforms} from './animation-transform.ts';
import type {QuickProfile} from './quick-animation.ts';
import {viewAtFrame} from './character-view.ts';
import {flatten,type PsdDocument} from './psd-model.ts';

export type Series=number[];
export function rotationSeries(a:Animation,key:string,from=0,to=a.duration-1,channel:'rotation'|'x'|'y'='rotation'):Series{const out:number[]=[];const track=a.tracks.find(t=>t.key===key);for(let f=from;f<=to;f++)out.push(sampleTrack(track,f)[channel]);return out;}
const diff=(s:Series)=>s.slice(1).map((v,i)=>v-s[i]);
/** Suurin |toinen differenssi| eli nopeuden muutos ruutujen välillä. */
export function maxAcceleration(s:Series){return Math.max(0,...diff(diff(s)).map(Math.abs));}
/** Suurin |kolmas differenssi|. */
export function maxJerk(s:Series){return Math.max(0,...diff(diff(diff(s))).map(Math.abs));}
export function maxVelocity(s:Series){return Math.max(0,...diff(s).map(Math.abs));}

/** Jalkapohjan piste (jalkakerroksen alareunan keskikohta) maailmankoordinaateissa ruudussa. */
export function footPoint(doc:PsdDocument,a:Animation,frame:number,side:'left'|'right'){
 const q=doc.quick;if(!q)return;const roles=q.views?.[viewAtFrame(q,a,frame)]??q.roles,key=roles[side+'Foot'];if(!key)return;
 const layer=flatten(doc.layers).find(l=>l.key===key),m=animationTransforms(a,frame).get(key);if(!layer||!m)return;
 const x=layer.left+layer.width/2,y=layer.top+layer.height;return {x:m.a*x+m.c*y+m.e,y:m.b*x+m.d*y+m.f};
}
/**
 * Tukivaiheen liukuma: ruudut, joissa jalka on maassa (alle `ground` px alimmasta kohdastaan) eikä nouse,
 * ja niiden välinen vaakasiirtymä. Palauttaa suurimman liukuman ruutujen välillä.
 */
export function stanceSlip(doc:PsdDocument,a:Animation,from:number,to:number,ground=1.5):{max:number;stanceFrames:number}{
 let max=0,stanceFrames=0;
 for(const side of ['left','right'] as const){
  const pts:{x:number;y:number;view:string}[]=[];for(let f=from;f<=to;f++){const p=footPoint(doc,a,f,side);if(p)pts.push({...p,view:doc.quick?viewAtFrame(doc.quick,a,f):'front'});}
  if(!pts.length)continue;const floor=Math.max(...pts.map(p=>p.y));
  // Kuvakulman vaihto on piirroksen leikkaus (eri taide), ei liukumaa: verrataan vain saman kuvakulman ruutuja.
  for(let i=1;i<pts.length;i++){if(pts[i].view===pts[i-1].view&&floor-pts[i].y<ground&&floor-pts[i-1].y<ground){stanceFrames++;max=Math.max(max,Math.abs(pts[i].x-pts[i-1].x));}}
 }
 return {max,stanceFrames};
}
/** Montako kuvakulmajuurta on näkyvissä (peittävyys > 0,01) ruudussa. */
export function visibleViewRoots(q:QuickProfile,a:Animation,frame:number){return Object.values(q.views??{}).filter(m=>m&&sampleTrack(a.tracks.find(t=>t.key===m.root),frame).opacity>.01).length;}
