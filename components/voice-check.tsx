import {useEffect,useRef,useState} from 'react';
import {readAudioAnalysis} from '../lib/audio-analysis';
import {createAudioContext} from '../lib/browser-audio';
import {isEnglishLine} from '../lib/kokoro';
import {encodeSpeechWav} from '../lib/phonetic-speech';
import {desktop} from '../lib/platform';
import type {AudioClip} from '../lib/presentation-model';
import type {PresentationAudio} from '../lib/presentation-audio';
import {checkSummary,compareTranscript,type TranscriptCheck} from '../lib/voice-sources';

type Model={model:boolean;binary:boolean};
/**
 * Tarkista äänitys: litteroi rivin oman äänen paikallisesti (whisper.cpp) ja näyttää sanaeron repliikin tekstiin.
 * Ei kirjoita mitään käsikirjoitukseen eikä projektiin. Ääni ei lähde koneelta.
 */
export default function VoiceCheck({clip,audio,text,disabled}:{clip?:AudioClip;audio?:PresentationAudio;text:string;disabled:boolean}){
 const [model,setModel]=useState<Model|null>(),[working,setWorking]=useState(false),[result,setResult]=useState<{check:TranscriptCheck;heard:string}>(),[message,setMessage]=useState('');
 const abort=useRef<AbortController|null>(null),key=clip?`${clip.asset}:${clip.start}:${clip.end}:${text}`:'';
 useEffect(()=>{const c=new AbortController(),bridge=desktop();void (bridge?bridge.audioModel():fetch('/api/audio/model',{signal:c.signal}).then(r=>r.ok?r.json():null)).then(m=>setModel(m&&typeof m==='object'?m as Model:null)).catch(()=>setModel(null));return()=>c.abort();},[]);
 useEffect(()=>{abort.current?.abort();setResult(undefined);setMessage('');},[key]);
 useEffect(()=>()=>abort.current?.abort(),[]);
 if(!clip||clip.synthetic||!audio)return null;
 if(model===undefined)return null;
 if(!model?.model||!model.binary)return <p className="panel-note">Äänityksen tarkistus vaatii paikallisen puhemallin (Ääni-paneeli → Lataa paikallinen puhemalli).</p>;
 const run=async()=>{const c=new AbortController();abort.current=c;setWorking(true);setMessage('Litteroidaan paikallisesti…');setResult(undefined);let ctx:AudioContext|undefined;try{
  ctx=createAudioContext();const d=await ctx.decodeAudioData(await audio.blob.arrayBuffer()),first=Math.round(clip.start*d.sampleRate),last=Math.min(d.length,Math.round(clip.end*d.sampleRate));
  if(last<=first)throw Error('Repliikin ääniväli on tyhjä.');
  const wav=encodeSpeechWav(Array.from({length:d.numberOfChannels},(_,i)=>d.getChannelData(i).slice(first,last)),d.sampleRate),language=isEnglishLine(text)?'en':'fi',bridge=desktop();
  let data:unknown;
  if(bridge){const cancel=()=>void bridge.cancelSpeech();c.signal.addEventListener('abort',cancel,{once:true});try{data=await bridge.transcribe(wav,language);}finally{c.signal.removeEventListener('abort',cancel);}}
  else{const r=await fetch('/api/audio/transcribe?language='+language,{method:'POST',headers:{'Content-Type':'audio/wav'},body:new Blob([new Uint8Array(wav)]),signal:c.signal});data=await r.json();if(!r.ok)throw Error((data as {error?:string}).error??'Litterointi epäonnistui.');}
  if(c.signal.aborted)return;
  const heard=(readAudioAnalysis(data)?.segments??[]).map(s=>s.text).join(' ').trim(),check=compareTranscript(text,heard);
  setResult({check,heard});setMessage('');
 }catch(e){setMessage(c.signal.aborted?'Tarkistus peruttu.':e instanceof Error?e.message:'Tarkistus epäonnistui.');}finally{await ctx?.close().catch(()=>undefined);if(abort.current===c)abort.current=null;setWorking(false);}};
 return <div className="voice-check" aria-label="Äänityksen tarkistus">
  <button type="button" className="secondary" disabled={disabled||working} onClick={()=>void run()}>Tarkista äänitys</button>{working&&<> <button type="button" className="secondary" onClick={()=>abort.current?.abort()}>Peruuta</button></>}
  {message&&<p role="status">{message}</p>}
  {result&&<><p role="status">{checkSummary(result.check)}</p>
   <p className="voice-check-words">{result.check.words.map((w,i)=>w.kind==='same'?<span key={i}>{w.text} </span>:w.kind==='missing'?<del key={i} title="Repliikissä, ei kuulunut litteraatissa">{w.text} </del>:<ins key={i} title="Kuului litteraatissa, ei repliikissä">{w.text} </ins>)}</p>
   <p className="panel-note">Kuultu: “{result.heard||'—'}”. Litterointi on paikallisen mallin tulos ja voi erehtyä. Se ei muuta repliikkiä eikä ääntä.</p></>}
 </div>;
}
