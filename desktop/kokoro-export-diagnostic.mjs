// Isolated local English synthesis → durable linked voice → MP4. No hardware or listening approval.
import {readFile,writeFile,stat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {readZip} from './stored-zip.mjs';
import {inspectMp4} from './export-e2e-diagnostic.mjs';
export async function kokoroExportDiagnostic(window,directory,{packaged=false}={}){
 const js=s=>window.webContents.executeJavaScript(s,true),sleep=ms=>new Promise(r=>setTimeout(r,ms));
 const wait=async(s,label,seconds=30)=>{for(let i=0;i<seconds*10;i++){if(await js(s))return;await sleep(100);}throw Error('Kokoro export timeout: '+label);};
 const click=async text=>{console.log("KOKORO STEP "+text);await wait(`[...document.querySelectorAll('button')].some(b=>b.textContent.trim().startsWith(${JSON.stringify(text)})&&!b.disabled)`,text);await js(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim().startsWith(${JSON.stringify(text)})&&!b.disabled);b.click();})()`);await sleep(300);};
 const text='This is a local voice test. The animation keeps the original timing.';
 const script='Pipsa: '+text;
 const archive=async()=>{const r=await js('window.hahmostudio.recoveryLatest()');if(!r?.bytes)throw Error('No recovery snapshot');const files=readZip(r.bytes);return {files,meta:JSON.parse(files['project.json'].toString())};};
 let report={ok:false,realInference:false,packaged,physicalDevices:false,humanListening:false};
 try{
  await click('Aloita tyhjästä');
  await wait("!!document.querySelector('textarea.script-line-field,textarea.script-editor-field,#dialogue-script')",'script field');
  await js(`(()=>{const t=document.querySelector('textarea.script-line-field,textarea.script-editor-field,#dialogue-script');if(!t)throw Error('Script missing');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(t,${JSON.stringify(script)});t.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await sleep(2000);await click('Rakenna jakso');await wait("document.body.innerText.includes('Jakso rakennettu')",'English episode');
  await wait("!!document.querySelector('.tarina-review-toggle')",'review toggle');await js("document.querySelector('.tarina-review-toggle').click()");
  await wait("!!document.querySelector('.kokoro-voices select')",'voice selector');
  await js("(()=>{const e=document.querySelector('.kokoro-voices select');e.value='af_heart';e.dispatchEvent(new Event('change',{bubbles:true}));})()");await sleep(1000);
  await click('Tuota ääninauha');await wait("document.querySelector('.kokoro-panel').innerText.includes('1 riviä tuotettu')",'real voice committed',180);
  const saved=await archive(),p=saved.meta.scene.presentationDraft,clip=p.audioClips.find(c=>c.synthetic?.engine==='kokoro'),voice=clip&&saved.meta.presentationAudio[clip.asset];
  if(!clip||!voice||!clip.mouth.some(m=>m.shape!=='rest')||clip.duration<1)throw Error('Missing synthetic PCM or mouth timing');
  const original=join(directory,'kokoro-english-original.wav');await writeFile(original,saved.files[voice.path]);
  report={...report,realInference:true,text,voice:clip.synthetic.voice,clip:{duration:clip.duration,mouthKeys:clip.mouth.length,source:clip.source,synthetic:clip.synthetic}};
  await click('Rakenna jakso');await sleep(1500);
  await js("(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim().startsWith('Olen tarkis')&&!b.disabled);b?.click();})()");await sleep(500);
  await click('Rakenna muokattava jakso projektiin');await wait("document.body.innerText.includes('Kohtaus lisätty')||document.body.innerText.includes('Dialogikohtaus lisätty')",'scene installed',60);
  const built=await archive(),compiled=built.meta.scene.presentations?.find(p=>p.audioClips.some(c=>c.asset===clip.asset));
  if(!compiled)throw Error('Synthetic dialogue not installed in scene');
  const event=compiled.events.find(e=>e.id===clip.dialogue),at=event.at??0,start=(compiled.startFrame??0)/(built.meta.animation.fps||24)+at;
  const binding=compiled.bindings.find(b=>b.speaker===event.target),cast=readZip(built.files[built.meta.presentationResources[binding.asset]]),roles=JSON.parse(cast['project.json'].toString()).document.quick.roles,actor=compiled.actorAnimations[event.target],fps=built.meta.animation.fps;
  let matchedMouthKeys=0;
  for(const m of clip.mouth.filter(m=>m.time<clip.duration-.05)){
   const role=m.shape==='rest'?'mouthNeutral':m.shape==='round'?'mouthRound':'mouthOpen',track=actor.tracks.find(t=>t.key===roles[role]),frame=Math.round((at+m.time)*fps);
   if(track?.frames.some(f=>f.frame===frame&&f.opacity===1))matchedMouthKeys++;
  }
  if(matchedMouthKeys<2)throw Error('Compiled mouth frames do not match linked voice timing');
  report.compiledMouthKeysMatched=matchedMouthKeys;
  await click('Vie…');await wait("!!document.querySelector('.export-dialog')",'export dialog');await click('Pikavienti');
  let job;for(let i=0;i<420;i++){job=(await js('window.hahmostudio.exportList()')).at(-1);if(job&&['done','error','canceled'].includes(job.state))break;await sleep(1000);}if(job?.state!=='done')throw Error('Export failed: '+JSON.stringify(job));
  const dest=process.env.HAHMOSTUDIO_KOKORO_EXPORT_DESTINATION,binary=packaged?join(process.resourcesPath,'native/bin/ffmpeg'):resolve('.private-runtime/native/bin/ffmpeg');
  const mp4=inspectMp4(binary,dest),bytes=(await stat(dest)).size;
  const decode=path=>{const r=spawnSync(binary,['-v','error','-i',path,'-vn','-ac','1','-ar','8000','-f','f32le','-'],{maxBuffer:32*1024*1024});if(r.status!==0)throw Error(r.stderr.toString());return new Float32Array(r.stdout.buffer.slice(r.stdout.byteOffset,r.stdout.byteOffset+r.stdout.length));};
  const source=decode(original),output=decode(dest);let best={correlation:-1,offsetSamples:0};
  // Codec delay may shift audio by a few milliseconds; compare real decoded PCM within ±250 ms of the compiled event.
  for(let offset=Math.max(0,Math.round(start*8000)-2000);offset<=Math.round(start*8000)+2000;offset+=8){let xy=0,xx=0,yy=0;for(let i=0;i<source.length&&i+offset<output.length;i+=4){const x=source[i],y=output[i+offset];xy+=x*y;xx+=x*x;yy+=y*y;}const correlation=xy/Math.sqrt(xx*yy);if(correlation>best.correlation)best={correlation,offsetSamples:offset};}
  const deltaSeconds=best.offsetSamples/8000-start;
  report={...report,ok:mp4.video?.codec==='h264'&&!!mp4.audio&&best.correlation>.9&&Math.abs(deltaSeconds)<=1/30,mp4,bytes,eventStartSeconds:start,audioAlignment:{...best,deltaSeconds,toleranceSeconds:1/30},job:{state:job.state,encoder:job.encoder},mouth:'linked analyzed timing and compiled actor tracks checked; rendered visual/human lip-sync approval remains open'};
  if(!report.ok)throw Error('PCM alignment or MP4 check failed');
 }catch(error){report={...report,ok:false,error:error.message};await writeFile(join(directory,'kokoro-export-failed.html'),await js('document.documentElement.outerHTML'));await writeFile(join(directory,'kokoro-export-failed.png'),(await window.webContents.capturePage()).toPNG());}
 await writeFile(join(directory,'kokoro-export-report.json'),JSON.stringify(report,null,2));if(!report.ok)throw Error(report.error);return report;
}
