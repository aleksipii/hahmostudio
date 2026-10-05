import {dirname,join} from 'node:path';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {spawn} from 'node:child_process';
export function validateManifest(value,bytes,preset){
 const m=value;if(!m||m.schemaVersion!==1||m.engineVersion!=='studio-contract-1'||!/^[a-f0-9]{64}$/.test(m.snapshotHash)||!/^[a-f0-9]{64}$/.test(m.revisionId)||m.expectedFrames!==Math.ceil((preset.end-preset.start)*preset.fps)||JSON.stringify(m.preset)!==JSON.stringify(preset)||!Array.isArray(m.assets)||m.assets.length>10000||!Array.isArray(m.episodeIds)||m.episodeIds.length>200||m.assets.some(a=>!a||typeof a.path!=='string'||a.path.length>1000||!/^[a-f0-9]{64}$/.test(a.sha256))||JSON.stringify(m).length>1024*1024)throw Error('Vientimanifesti on virheellinen.');
 if(createHash('sha256').update(bytes).digest('hex')!==m.snapshotHash)throw Error('Viennin jäädytetty projekti muuttui.');return structuredClone(m);
}
export async function fileChecksum(path){const hash=createHash('sha256');for await(const chunk of createReadStream(path))hash.update(chunk);return hash.digest('hex');}
/** Decode the produced file before replacing any previous successful export. */
export async function verifyEncodedOutput({binary,output,frames,audio,signal,width,height,fps}){
 const decoded=await new Promise((resolve,reject)=>{
  signal.throwIfAborted();const args=['-v','error','-i',output,'-map','0:v:0',...(audio?['-map','0:a:0']:['-an']),'-progress','pipe:1','-nostats','-f','null','-'];
  const child=spawn(binary,args,{stdio:['ignore','pipe','pipe']}),abort=()=>child.kill('SIGTERM');let data='',error='';signal.addEventListener('abort',abort,{once:true});
  child.stdout.on('data',b=>{data=(data+b.toString()).slice(-65536);});child.stderr.on('data',b=>{error=(error+b.toString()).slice(-4000);});
  child.on('error',e=>{signal.removeEventListener('abort',abort);reject(e);});child.on('close',code=>{signal.removeEventListener('abort',abort);if(signal.aborted)return reject(new DOMException('Vienti peruttu.','AbortError'));const counts=[...data.matchAll(/^frame=(\d+)$/gm)],count=Number(counts.at(-1)?.[1]);if(code!==0||count!==frames)return reject(Error('Valmiin videon tarkistus epäonnistui: '+(error||`ruutuja ${count}, odotettu ${frames}`)));resolve({decodedFrames:count,audioChecked:audio});});
 });
 const metadata=await new Promise((resolve,reject)=>{signal.throwIfAborted();const child=spawn(join(dirname(binary),'ffprobe'),['-v','error','-show_streams','-of','json',output],{stdio:['ignore','pipe','pipe']}),abort=()=>child.kill('SIGTERM');let data='',error='';signal.addEventListener('abort',abort,{once:true});child.stdout.on('data',b=>{data+=b.toString();if(data.length>1024*1024)child.kill('SIGTERM');});child.stderr.on('data',b=>{error=(error+b.toString()).slice(-4000);});child.on('error',e=>{signal.removeEventListener('abort',abort);reject(e);});child.on('close',code=>{signal.removeEventListener('abort',abort);if(signal.aborted)return reject(new DOMException('Vienti peruttu.','AbortError'));if(code!==0)return reject(Error('Videon metatietotarkistus epäonnistui: '+error));try{resolve(JSON.parse(data));}catch(e){reject(e);}});});
 const video=metadata.streams?.find(s=>s.codec_type==='video'),sound=metadata.streams?.find(s=>s.codec_type==='audio'),rate=video?.avg_frame_rate?.split('/').map(Number),actualFps=rate?.[0]/rate?.[1];
 if(!video||width!==undefined&&video.width!==width||height!==undefined&&video.height!==height||fps!==undefined&&(!Number.isFinite(actualFps)||Math.abs(actualFps-fps)>.001)||audio&&!sound)throw Error('Videon mitat, kuvataajuus tai ääniraita eivät vastaa vientisopimusta.');
 return{...decoded,width:video.width,height:video.height,fps:actualFps,...(sound?{sampleRate:Number(sound.sample_rate),channels:sound.channels}:{})};
}
