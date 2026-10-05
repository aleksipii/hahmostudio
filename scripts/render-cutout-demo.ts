/** Real original-voice cutout demo. SVG -> PNG frames -> local FFmpeg, 24 fps. */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {parseScript,compileScript} from '../lib/cutout/parser.ts';
import {visemeFrames} from '../lib/cutout/lip-sync.ts';
import {renderFrameSvg,type CutoutArt} from '../lib/cutout/svg-renderer.ts';
import {serializeFrames} from '../lib/cutout/renderer.ts';
import type {Actor,Viseme} from '../lib/cutout/model.ts';
import {backgroundSvg} from '../lib/backgrounds.ts';
const [input,out,sharpPath,ffmpeg]=process.argv.slice(2);if(!ffmpeg)throw Error('Anna äänikansio, tuloskansio, sharp-moduuli ja FFmpeg.');
const sharp=(await import(pathToFileURL(sharpPath).href)).default;sharp.concurrency(2);
const rows=JSON.parse(readFileSync(input+'/sequence-cues.json','utf8'));
const actors:Actor[]=[{id:'Kille',asset:'Mr.Kille',x:25,y:790,scale:1.4,rig:JSON.parse(readFileSync('public/library/cutout/Mr.Kille.rig.json','utf8'))},{id:'Mr.Handu',asset:'Mr.Handu',x:495,y:790,scale:1.4,rig:JSON.parse(readFileSync('public/library/cutout/Mr.Handu.rig.json','utf8'))}];
const art:Record<string,CutoutArt>=Object.fromEntries(actors.map(a=>[a.asset,JSON.parse(readFileSync('public/library/cutout/'+a.asset+'.art.json','utf8'))]));
const lines=['[SCENE: STUDIO]','[CAMERA: MEDIUM_TWO_SHOT]','[HOLD: 0.5]'];
for(let i=0;i<rows.length;i++){const row=rows[i],actor=row.speaker==='KILLE'?'Kille':'Mr.Handu';lines.push(actor+': "'+row.text.replaceAll('"','')+'"');lines.push('[HOLD: 0.25]');}
lines.push('[HOLD: 0.5]');const source=lines.join('\n'),dialogue=parseScript(source).filter(e=>e.kind==='dialogue');
const durations:Record<string,number>={},voices:Record<string,Viseme[]>={};dialogue.forEach((e,i)=>{durations[e.id]=rows[i].duration;voices[e.id]=visemeFrames(rows[i].cues,rows[i].duration);});
const timeline=compileScript(source,actors,durations,'three-two');
// Explicit editorial gestures overlap their own dialogue; no text interpretation or guessed action.
const gestures=[{index:0,value:'POINT'},{index:5,value:'HAND_WAVE'},{index:10,value:'POINT'}];
for(const g of gestures){const e=timeline.events.find(e=>e.id===dialogue[g.index].id)!;timeline.events.push({id:'demo-gesture-'+g.index,kind:'action',actor:e.actor,value:g.value,line:e.line,start:e.start,end:e.end});}
const angry=timeline.events.find(e=>e.id===dialogue[9].id)!;timeline.events.push({id:'demo-angry',kind:'emotion',actor:angry.actor,value:'ANGRY',line:angry.line,start:angry.start,end:angry.start});const clear=timeline.events.find(e=>e.id===dialogue[11].id)!;timeline.events.push({id:'demo-clear',kind:'emotion',actor:angry.actor,value:'NORMAL',line:clear.line,start:clear.start,end:clear.start});
mkdirSync(out+'/frames',{recursive:true});
writeFileSync(out+'/KILSAT-kartonkidemo.kilsat.json',JSON.stringify({timeline,voices}));writeFileSync(out+'/KILSAT-kartonkidemo-ruudut.json',JSON.stringify(serializeFrames(timeline,voices)));writeFileSync(out+'/KILSAT-kartonkidemo.txt',source);
for(const id of ['cutout-studio-v1','cutout-street-v1','cutout-car-v1'] as const){const svg=backgroundSvg(id,1080,1920);writeFileSync('public/library/'+id+'.svg',svg);writeFileSync('public/library/'+id+'.png',await sharp(Buffer.from(svg)).png().toBuffer());}
const pngCache=new Map<string,Buffer>();
for(let f=0;f<timeline.duration;f++){
 const svg=renderFrameSvg(timeline,f,art,voices);let png=pngCache.get(svg);if(!png){png=Buffer.from(await sharp(Buffer.from(svg)).png().toBuffer());if(pngCache.size>=128)pngCache.clear();pngCache.set(svg,png);}writeFileSync(out+'/frames/'+String(f).padStart(5,'0')+'.png',png);if(f%120===0)console.log('Rendered',f,'/',timeline.duration);
}
const inputs:string[]=['-y','-v','error','-framerate','24','-i',out+'/frames/%05d.png'];for(const row of rows)inputs.push('-i',row.original??row.wav);
const filters=dialogue.map((e,i)=>{const event=timeline.events.find(ev=>ev.id===e.id)!;return `[${i+1}:a]adelay=${Math.round(event.start/24*1000)}:all=1[a${i}]`;});filters.push(dialogue.map((_,i)=>`[a${i}]`).join('')+`amix=inputs=${rows.length}:duration=longest:normalize=0,apad,atrim=duration=${timeline.duration/24}[audio]`);
const args=[...inputs,'-filter_complex',filters.join(';'),'-map','0:v','-map','[audio]','-c:v','libopenh264','-b:v','5M','-pix_fmt','yuv420p','-c:a','aac','-ar','48000','-b:a','192k','-t',String(timeline.duration/24),'-movflags','+faststart',out+'/KILSAT-kartonkidemo-1080x1920.mp4'];
const result=spawnSync(ffmpeg,args,{encoding:'utf8',maxBuffer:4*1024*1024});if(result.status!==0)throw Error(result.stderr);
writeFileSync(out+'/demo-tarkistukset.json',JSON.stringify({fps:24,frames:timeline.duration,duration:timeline.duration/24,voices:rows.length,visemes:'actual local Rhubarb phonetic analysis; explicit requested mapping',originalVoiceOrder:rows.map((r:any)=>r.name),art:'original procedural SVG',referenceVideo:'Not viewed; no verified match',manualEditorialGestures:gestures},null,2));console.log('Created actual MP4',timeline.duration/24,'seconds');
