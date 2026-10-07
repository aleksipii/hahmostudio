// Liikkeiden kuvasarjat visuaalista tarkistusta varten (vaihe C).
// Ajo: node --experimental-strip-types scripts/render-motion-sheets.ts [hahmopaketti ...] [--out kansio] [--png]
// Tuottaa jokaisesta liikkeestä SVG-kuvasarjan (8 ruutua + lattiaviiva + jalkaterän ja ranteen jälki).
// --png muuntaa SVG:t PNG:ksi paikallisella Chromiumilla (headless), jos se löytyy.
import {readFileSync,writeFileSync,mkdirSync,existsSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {readProject} from '../lib/project-file.ts';
import {flatten,type LayerNode} from '../lib/psd-model.ts';
import {buildEpisode,catalogFromNames} from '../lib/episode-builder.ts';
import {CHARACTER_PACK_OPTIONS} from '../lib/speaker-pack-options.ts';
import {animationTransforms} from '../lib/animation-transform.ts';
import {footPoint} from '../lib/motion-quality.ts';
import {viewAtFrame} from '../lib/character-view.ts';

const args=process.argv.slice(2),outIndex=args.indexOf('--out'),out=outIndex>=0?args[outIndex+1]:'docs/motion-sheets',png=args.includes('--png');
const names=args.filter((a,i)=>!a.startsWith('--')&&i!==outIndex+1);const packs=names.length?names:['Pipsa','Roni-Monikulma'];
const motions:[string,string][]=[['kavely-oikealle','kävelee oikealle 2 s'],['kavely-suoraan','kävelee suoraan 2 s'],['juoksu','juoksee oikealle 2 s'],['vilkutus','vilkuttaa'],['nyokkays','nyökkää'],['osoitus','osoittaa'],['istuminen','istuu'],['hyppy','hyppää'],['kyykky','kyykistyy'],['hammastys','hämmästyy'],['nyrkki','nyrkki']];
mkdirSync(out,{recursive:true});
const chromium=['/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell','/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(existsSync);
for(const name of packs){
 const r=await readProject(new Blob([readFileSync(new URL(`../public/library/${name}.hahmo`,import.meta.url))]));const doc=r.doc,q=doc.quick!;
 const layers=flatten(doc.layers).filter(l=>l.png&&l.width&&l.height);
 const defs=await Promise.all(layers.map(async(l:LayerNode,i)=>`<image id="l${i}" width="${l.width}" height="${l.height}" href="data:image/png;base64,${Buffer.from(await l.png!.arrayBuffer()).toString('base64')}"/>`));
 for(const [file,line] of motions){
  const b=buildEpisode(`Resurssi hahmo MIRA: ${name}\nINT. STUDIO\nMira odottaa 0,2 s.\nMira ${line}.\nMira odottaa 0,3 s.`,{packs:catalogFromNames(CHARACTER_PACK_OPTIONS),assets:{[name]:{doc,animation:r.animation}}});
  const a=b.animationPerActor.MIRA,e=b.presentation.events.find(x=>x.kind==='action'&&x.value!=='stop');if(!a||!e){console.log(name,file,'ohitettu');continue;}
  const s=Math.round(e.at!*a.fps),end=Math.min(a.duration-1,s+Math.round(e.duration!*a.fps)),frames=Array.from({length:8},(_,i)=>Math.round(s+(end-s)*i/7));
  const W=doc.width,H=doc.height,cell=W*.9,trail=Array.from({length:end-s+1},(_,i)=>s+i);
  const cells=frames.map((f,c)=>{const t=animationTransforms(a,f),visible=(l:LayerNode)=>{const m=t.get(l.key);return !m||m.opacity>.01;};
   const body=layers.map((l,i)=>{const m=t.get(l.key);if(!visible(l)||!l.visible)return '';return `<use href="#l${i}" x="${l.left}" y="${l.top}" opacity="${(m?.opacity??1)*l.opacity}"${m?` transform="matrix(${m.a} ${m.b} ${m.c} ${m.d} ${m.e} ${m.f})"`:''}/>`;}).join('');
   const rx=t.get(q.views?.[viewAtFrame(q,a,f)]?.root??q.roles.root)?.e??0;
   return `<g transform="translate(${c*cell-W*.05} 0)"><rect x="${W*.05}" y="0" width="${cell}" height="${H}" fill="${c%2?'#f4f1ea':'#faf8f3'}"/><g transform="translate(${-rx} 0)">${body}</g><text x="${W*.05+12}" y="34" font-size="26" font-family="sans-serif" fill="#4a5560">${f-s} · ${viewAtFrame(q,a,f)}</text></g>`;}).join('');
  const feet=(['left','right'] as const).map(side=>trail.map(f=>footPoint(doc,a,f,side)).filter(Boolean).map(p=>`${p!.x.toFixed(1)},${p!.y.toFixed(1)}`).join(' '));
  const hand=a.rig.parts.find(p=>p.key===q.roles.leftHand),wrist=hand?trail.map(f=>{const m=animationTransforms(a,f).get(hand.key)!;return `${(m.a*hand.pivot.x+m.c*hand.pivot.y+m.e).toFixed(1)},${(m.b*hand.pivot.x+m.d*hand.pivot.y+m.f).toFixed(1)}`;}).join(' '):'';
  const xs=[...feet,wrist].join(' ').split(/[ ]/).filter(Boolean).map(v=>+v.split(',')[0]),trailCenter=xs.length?(Math.min(...xs)+Math.max(...xs))/2:0;
  const floor=Math.max(...trail.flatMap(f=>(['left','right'] as const).map(side=>footPoint(doc,a,f,side)?.y??0)));
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${cell*8+cell} ${H}" width="${Math.round((cell*9)/3)}" height="${Math.round(H/3)}"><defs>${defs.join('')}</defs><rect width="100%" height="100%" fill="#ffffff"/>${cells}<line x1="0" x2="${cell*9}" y1="${floor}" y2="${floor}" stroke="#c0563b" stroke-width="2"/><g transform="translate(${cell*8-W*.05} 0)"><rect x="${W*.05}" width="${cell}" height="${H}" fill="#eef3f5"/><g transform="translate(${W*.05+cell/2-trailCenter} 0)"><polyline points="${feet[0]}" fill="none" stroke="#2f6f8f" stroke-width="3"/><polyline points="${feet[1]}" fill="none" stroke="#8f6a2f" stroke-width="3"/><polyline points="${wrist}" fill="none" stroke="#7a3f8f" stroke-width="3"/></g><text x="${W*.05+12}" y="34" font-size="24" font-family="sans-serif" fill="#4a5560">jäljet: jalat, ranne</text></g><text x="12" y="${H-16}" font-size="28" font-family="sans-serif" fill="#2a3138">${name} · ${line}</text></svg>`;
  const path=`${out}/${name}-${file}.svg`;writeFileSync(path,svg);
  if(png&&chromium){const w=Math.round((cell*9)/3),h=Math.round(H/3),html=path.replace(/\.svg$/,'.html');writeFileSync(html,`<!doctype html><html><body style="margin:0;overflow:hidden"><img src="${path.split('/').pop()}" width="${w}" height="${h}" style="display:block"></body></html>`);execFileSync(chromium,['--headless','--disable-gpu','--no-sandbox','--hide-scrollbars','--force-device-scale-factor=1',`--screenshot=${path.replace(/\.svg$/,'.png')}`,`--window-size=${w},${h}`,'file://'+(html.startsWith('/')?html:process.cwd()+'/'+html)],{stdio:'ignore'});rmSync(html);}
  console.log(path);
 }
}
