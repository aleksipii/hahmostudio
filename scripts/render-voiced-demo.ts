/** Local private-voice short; existing cutout engine and measured viseme tracks. */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {renderFrameSvg,type CutoutArt} from '../lib/cutout/svg-renderer.ts';
import type {Actor,Timeline,Viseme} from '../lib/cutout/model.ts';
const [out,sharpPath,ffmpeg,voiceFolder]=process.argv.slice(2);
if(!ffmpeg)throw Error('Anna tuloskansio, sharp-moduulin absoluuttinen polku ja FFmpeg.');
const sharp=(await import(sharpPath)).default;sharp.concurrency(1);sharp.cache(false);
const actors:Actor[]=(['Mr.Kille','Mr.Handu'] as const).map((asset,i)=>({id:i?'Handu':'Kille',asset,x:i?570:20,y:850,scale:1.15,rig:JSON.parse(readFileSync(`public/library/cutout/${asset}.rig.json`,'utf8'))}));
const art:Record<string,CutoutArt>=Object.fromEntries(actors.map(a=>[a.asset,JSON.parse(readFileSync(`public/library/cutout/${a.asset}.art.json`,'utf8'))]));
const model=JSON.parse(readFileSync(voiceFolder+'/model.json','utf8'));const timeline:Timeline=model.timeline;const voices:Record<string,Viseme[]>=model.voices;const audio=JSON.parse(readFileSync(voiceFolder+'/audio.json','utf8'));
const subtitles=['En tarvitse kilometrikirjaa.','Miksi?','Muistan kyllä, missä ajan.','Missä kävit eilen?','Töissä.','Missä?','Jossain siellä päin.','Montako kilometriä ajoit?'];const dialogue=timeline.events.filter((e:any)=>e.kind==='dialogue');
mkdirSync(out,{recursive:true});writeFileSync(out+'/Kilometrikirja.kilsat.json',JSON.stringify({timeline,voices:{}},null,2));writeFileSync(out+'/Kilometrikirja-kasikirjoitus.txt',timeline.events.map(e=>`[${(e.start/24).toFixed(3)} s] ${e.kind} ${e.actor??''}: ${e.value}`).join('\n'));
const file=out+'/Kilometrikirja-1080x1920.mp4';
mkdirSync(out+'/frames',{recursive:true});
const rasterCache=new Map<string,Buffer>();
const escape=(s:string)=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
for(let f=0;f<timeline.duration;f++){
 const text=timeline.events.filter(e=>e.kind==='dialogue'&&e.start<=f).at(-1);
 const title=f<48?'KILOMETRIKIRJA':'KILLE & HANDU';
 const caption=text?subtitles[dialogue.findIndex((e:any)=>e.id===text.id)]??text.value:'';const words=caption.split(' '),lines:string[]=[''];for(const word of words){if((lines.at(-1)!+' '+word).length>31)lines.push(word);else lines[lines.length-1]+=(lines.at(-1)?' ':'')+word;}
 const overlay=`<rect x="60" y="100" width="960" height="180" rx="30" fill="#10293e"/><text x="540" y="173" text-anchor="middle" fill="#7de1e0" font-family="Helvetica,Arial,sans-serif" font-size="28" letter-spacing="7">KILSAT STUDIO</text><text x="540" y="237" text-anchor="middle" fill="white" font-family="Helvetica,Arial,sans-serif" font-size="48" font-weight="bold">${escape(title)}</text><rect x="65" y="1560" width="950" height="245" rx="28" fill="#10293e" fill-opacity=".94"/><text x="110" y="1613" fill="#7de1e0" font-family="Helvetica,Arial,sans-serif" font-size="26" font-weight="bold">${text?.actor??''}</text>${lines.map((l,i)=>`<text x="110" y="${1680+i*54}" fill="white" font-family="Helvetica,Arial,sans-serif" font-size="43">${escape(l)}</text>`).join('')}<text x="540" y="1860" text-anchor="middle" fill="#10293e" font-family="Helvetica,Arial,sans-serif" font-size="25">KILSAT · PIENI MUISTIVIRHE</text>`;
 const svg=renderFrameSvg(timeline,f,art,voices).replaceAll('filter="url(#paper)"','');const last=svg.lastIndexOf('</svg>');const fullSvg=svg.slice(0,last)+overlay+svg.slice(last);let image=rasterCache.get(fullSvg);if(!image){image=Buffer.from(await sharp(Buffer.from(fullSvg)).png().toBuffer());rasterCache.set(fullSvg,image);}
 if(f===100)writeFileSync(out+'/Kilometrikirja-esikatselu.png',image);
 writeFileSync(out+'/frames/'+String(f).padStart(5,'0')+'.png',image);if(f%96===0)console.log(f,timeline.duration);
}
const filters=audio.map((a:any,i:number)=>`[${i+1}:a]adelay=${Math.round(a.at*1000)}:all=1[a${i}]`);filters.push(audio.map((_:any,i:number)=>`[a${i}]`).join('')+`amix=inputs=${audio.length}:normalize=0,apad,atrim=duration=${timeline.duration/24}[audio]`);const encoder=spawn(ffmpeg,['-y','-v','error','-framerate','24','-i',out+'/frames/%05d.png',...audio.flatMap((a:any)=>['-i',a.file]),'-filter_complex',filters.join(';'),'-map','0:v','-map','[audio]','-c:v','libopenh264','-b:v','5M','-pix_fmt','yuv420p','-c:a','aac','-ar','48000','-b:a','192k','-t',String(timeline.duration/24),'-movflags','+faststart',file],{stdio:['ignore','ignore','pipe']});let errors='';encoder.stderr.on('data',b=>errors+=b);const [code]=await once(encoder,'close');if(code!==0)throw Error(errors);
writeFileSync(out+'/README.md',`# Kilometrikirja\n\n${timeline.duration/24} sekuntia, 1080×1920, 24 fps. Kahdeksan käyttäjän aiemmin toimittamaa englanninkielistä Kille/Handu-repliikkiä, suomennetut tekstitykset ja alkuperäisen äänen Rhubarb-suuliikkeet. Ei puhesynteesiä. Äänet ovat vain paikallisessa toimituksessa, eivät GitHubissa.\n`);console.log(file);
