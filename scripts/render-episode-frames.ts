// Jakson ruutukuvat oikean renderPresentation-polun kautta (SVG-canvas-sovite, ei selainta).
// Ajo: node --experimental-strip-types scripts/render-episode-frames.ts käsikirjoitus.md [--out kansio] [--png] [--frames 0,2.5,4]
// Huom: simuloitu piirto. Canvasin bittikarttaoperaatiot (suodattimet, eristetyt ryhmät) eivät ole mukana.
import {readFileSync,writeFileSync,mkdirSync,existsSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {readProject} from '../lib/project-file.ts';
import {flatten} from '../lib/psd-model.ts';
import {buildEpisode,catalogFromNames,packsNeeded} from '../lib/episode-builder.ts';
import {CHARACTER_PACK_OPTIONS} from '../lib/speaker-pack-options.ts';
import {renderPresentation} from '../lib/presentation-render.ts';

const args=process.argv.slice(2),file=args.find((a,i)=>!a.startsWith('--')&&args[i-1]!=='--out'&&args[i-1]!=='--frames')??'public/library/Esimerkki-pysakointisakko.md',outIndex=args.indexOf('--out'),out=outIndex>=0?args[outIndex+1]:'docs/episode-frames',png=args.includes('--png'),framesArg=args.indexOf('--frames');
const W=1080,H=1920;mkdirSync(out,{recursive:true});
type M=[number,number,number,number,number,number];
const mul=(p:M,q:M):M=>[p[0]*q[0]+p[2]*q[1],p[1]*q[0]+p[3]*q[1],p[0]*q[2]+p[2]*q[3],p[1]*q[2]+p[3]*q[3],p[0]*q[4]+p[2]*q[5]+p[4],p[1]*q[4]+p[3]*q[5]+p[5]];
function svgCanvas(){
 let m:M=[1,0,0,1,0,0],alpha=1,fill='#000',path='';const stack:{m:M;alpha:number;fill:string}[]=[],parts:string[]=[];
 const tf=()=>`matrix(${m.map(v=>+v.toFixed(5)).join(' ')})`,op=()=>alpha<1?` opacity="${alpha.toFixed(3)}"`:'';
 const ctx:Record<string,unknown>={
  save:()=>stack.push({m,alpha,fill}),restore:()=>{const s=stack.pop();if(s){m=s.m;alpha=s.alpha;fill=s.fill;}},
  translate:(x:number,y:number)=>{m=mul(m,[1,0,0,1,x,y]);},scale:(x:number,y:number)=>{m=mul(m,[x,0,0,y,0,0]);},rotate:(a:number)=>{m=mul(m,[Math.cos(a),Math.sin(a),-Math.sin(a),Math.cos(a),0,0]);},
  transform:(a:number,b:number,c:number,d:number,e:number,f:number)=>{m=mul(m,[a,b,c,d,e,f]);},setTransform:(a:number,b:number,c:number,d:number,e:number,f:number)=>{m=[a,b,c,d,e,f];},getTransform:()=>({a:m[0],b:m[1],c:m[2],d:m[3],e:m[4],f:m[5]}),
  fillRect:(x:number,y:number,w:number,h:number)=>parts.push(`<rect transform="${tf()}" x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"${op()}/>`),
  beginPath:()=>{path='';},moveTo:(x:number,y:number)=>{path+=`M${x} ${y}`;},lineTo:(x:number,y:number)=>{path+=`L${x} ${y}`;},closePath:()=>{path+='Z';},
  ellipse:(x:number,y:number,rx:number,ry:number)=>{path+=`M${x-rx} ${y}a${rx} ${ry} 0 1 0 ${2*rx} 0a${rx} ${ry} 0 1 0 ${-2*rx} 0`;},arc:(x:number,y:number,r:number)=>{path+=`M${x-r} ${y}a${r} ${r} 0 1 0 ${2*r} 0a${r} ${r} 0 1 0 ${-2*r} 0`;},
  roundRect:(x:number,y:number,w:number,h:number)=>{path+=`M${x} ${y}h${w}v${h}h${-w}Z`;},fill:()=>{if(path)parts.push(`<path transform="${tf()}" d="${path}" fill="${fill}"${op()}/>`);},
  drawImage:(img:{href?:string},x:number,y:number,w:number,h:number)=>{if(img?.href)parts.push(`<image transform="${tf()}" x="${x}" y="${y}" width="${w}" height="${h}" href="${img.href}"${op()}/>`);},
  fillText:(t:string,x:number,y:number)=>parts.push(`<text transform="${tf()}" x="${x}" y="${y}" font-size="110" text-anchor="middle" font-family="sans-serif" fill="${fill}"${op()}>${t}</text>`),
  measureText:()=>({width:10}),createLinearGradient:()=>({addColorStop:()=>{}}),createRadialGradient:()=>({addColorStop:()=>{}}),
 };
 const proxy=new Proxy(ctx,{get:(t,k)=>k in t?t[k as string]:k==='globalAlpha'?alpha:k==='canvas'?{width:W,height:H}:()=>{},set:(t,k,v)=>{if(k==='fillStyle')fill=typeof v==='string'?v:'#cccccc';else if(k==='globalAlpha')alpha=v;else t[k as string]=v;return true;}});
 return {canvas:{width:W,height:H,getContext:()=>proxy} as unknown as HTMLCanvasElement,svg:()=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W/3}" height="${H/3}"><rect width="${W}" height="${H}" fill="#ffffff"/>${parts.join('')}</svg>`};
}
const text=readFileSync(file,'utf8'),packs=catalogFromNames(CHARACTER_PACK_OPTIONS),assets:Record<string,any>={};
for(const n of packsNeeded(text,packs)){const r=await readProject(new Blob([readFileSync(new URL(`../public/library/${n}.hahmo`,import.meta.url))]));for(const l of flatten(r.doc.layers))if(l.png)(l as any).image={href:'data:image/png;base64,'+Buffer.from(await l.png.arrayBuffer()).toString('base64')};assets[n]={doc:r.doc,animation:r.animation};}
const b=buildEpisode(text,{packs,assets},{width:W,height:H}),p=b.presentation;
const times=framesArg>=0?args[framesArg+1].split(',').map(Number):[...new Set([0,...p.events.filter(e=>e.kind!=='environment').map(e=>(e.at??0)+Math.min(.6,(e.duration??0)*.6))])].sort((x,y)=>x-y).filter((t,i,a)=>i===0||t-a[i-1]>.4).slice(0,8);
const chromium=['/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell'].find(existsSync);
for(const [i,t] of times.entries()){const c=svgCanvas();renderPresentation(c.canvas,svgCanvas().canvas,p,assets,t,W,H);const name=`${out}/ruutu-${String(i).padStart(2,'0')}-${t.toFixed(2).replace('.','_')}s`;writeFileSync(name+'.svg',c.svg());
 if(png&&chromium){const html=name+'.html';writeFileSync(html,`<!doctype html><body style="margin:0"><img src="${name.split('/').pop()}.svg" width="${W/3}" height="${H/3}">`);execFileSync(chromium,['--headless','--no-sandbox','--hide-scrollbars','--force-device-scale-factor=1',`--screenshot=${name}.png`,`--window-size=${W/3},${H/3}`,'file://'+(html.startsWith('/')?html:process.cwd()+'/'+html)],{stdio:'ignore'});rmSync(html);rmSync(name+'.svg');}
 console.log(name,t.toFixed(2),p.events.filter(e=>(e.at??0)<=t&&t<(e.at??0)+Math.max(.01,e.duration??0)).map(e=>e.kind+':'+e.value).join(' '));}
console.log('virheet:',b.diagnostics.filter(d=>d.severity==='error').map(d=>d.code).join(', ')||'ei');
