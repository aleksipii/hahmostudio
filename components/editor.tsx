'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Layers, Upload, ChevronRight, ChevronDown, Eye, EyeOff, Folder, Image as ImageIcon, Download, X, ZoomIn, ZoomOut, Scan, AlertTriangle, Check, FileImage, Square, LoaderCircle, Package, Info } from 'lucide-react';
import { flatten, releaseDocument, safeName, type LayerNode, type PsdDocument } from '@/lib/psd-model';
import { renderLayers } from '@/lib/psd-render';
import { createRig, readRig, rigChain, type Rig, type RigPart } from '@/lib/rig-model';
import RigPanel, { type RigTool } from './rig-panel';
import AnimationPanel from './animation-panel';
import PhoneticPanel from './phonetic-panel';
import CameraPanel from './camera-panel';
import {keyframeLimb} from '../lib/inverse-kinematics';
import UserGuide from './user-guide';
import {speechFrames,applySpeech} from '../lib/speech-animation';
import {exportVideo} from '../lib/video-export';
import {saveProject,readProject,type ProjectAudio} from '../lib/project-file';
import { createAnimation, readAnimation, sampleTrack, putKeyframe, removeKeyframe, type Animation, type Pose, type Keyframe } from '@/lib/animation-model';
import { exportFrames } from '@/lib/animation-export';

function save(blob: Blob, name: string) {
 const url = URL.createObjectURL(blob), a = document.createElement('a');
 a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
}
async function imageOf(blob: Blob) {
 const url = URL.createObjectURL(blob), image = new Image(); image.src = url;
 try { await image.decode(); return { url, image }; } catch (e) { URL.revokeObjectURL(url); throw e; }
}
export default function Editor() {
 const [cameraActive,setCameraActive]=useState(false),[limbLower,setLimbLower]=useState(''),[limbBend,setLimbBend]=useState<1|-1>(1),[limbTarget,setLimbTarget]=useState(false);
 const [closedMouth,setClosedMouth]=useState(''),[openMouth,setOpenMouth]=useState(''),[speechBusy,setSpeechBusy]=useState(false);
 const [audioAsset,setAudioAsset]=useState<ProjectAudio|undefined>(),[audioUrl,setAudioUrl]=useState('');const audioInput=useRef<HTMLInputElement>(null),audioPlayer=useRef<HTMLAudioElement>(null);
 const projectInput=useRef<HTMLInputElement>(null), [projectBusy,setProjectBusy]=useState(false);
 const [animation, setAnimation] = useState<Animation | null>(null), [animateMode,setAnimateMode] = useState(false), [frame,setFrame] = useState(0), [playing,setPlaying] = useState(false);
 const [draft,setDraft] = useState<{key:string;pose:Pose;poses?:Record<string,Pose>} | undefined>(), [easing,setEasing] = useState<Keyframe['easing']>('smooth');
 const animationInput = useRef<HTMLInputElement>(null), animationGeneration=useRef(0), exportAbort=useRef<AbortController | null>(null);
 const animationHistory=useRef<{past:Animation[];future:Animation[]}>({past:[],future:[]});
 const [frameExport,setFrameExport] = useState(false);
 const [rig, setRig] = useState<Rig | null>(null), [rigMode, setRigMode] = useState(false), [rigTool, setRigTool] = useState<RigTool>('select');
 const rigInput = useRef<HTMLInputElement>(null), rigGeneration = useRef(0);
 const [rigMessage, setRigMessage] = useState('');
 const [doc, setDoc] = useState<PsdDocument | null>(null), docRef = useRef<PsdDocument | null>(null);
 const [selected, setSelected] = useState<string | null>(null), [collapsed, setCollapsed] = useState<Set<string>>(new Set());
 const [revision, setRevision] = useState(0), [mode, setMode] = useState<'layers'|'original'|'solo'>('layers');
 const [zoom, setZoom] = useState<number | null>(null), [fit, setFit] = useState(1), [background, setBackground] = useState<'checker'|'dark'|'white'>('checker');
 const [busy, setBusy] = useState(false), [progress, setProgress] = useState(''), [error, setError] = useState('');
 const [drag, setDrag] = useState(false), [help, setHelp] = useState(false), [exporting, setExporting] = useState(false);
 const helpDialog = useRef<HTMLElement>(null), helpButton = useRef<HTMLButtonElement>(null);
 const worker = useRef<Worker | null>(null), generation = useRef(0), timer = useRef<ReturnType<typeof setTimeout> | null>(null);
 const input = useRef<HTMLInputElement>(null), stage = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null);
 useEffect(() => {
  if (!help) return;
  const keyboard = (e: KeyboardEvent) => {
   if (e.key === 'Escape') { setHelp(false); helpButton.current?.focus(); }
   if (e.key === 'Tab' && helpDialog.current) {
    const all = Array.from(helpDialog.current.querySelectorAll<HTMLElement>('button, a[href]'));
    const first = all[0], last = all.at(-1);
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
    if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
   }
  };
  document.addEventListener('keydown', keyboard); return () => document.removeEventListener('keydown', keyboard);
 }, [help]);
 const nodes = doc ? flatten(doc.layers) : [], current = nodes.find(n => n.key === selected);
 const cancel = useCallback(() => {
  generation.current++; worker.current?.terminate(); worker.current = null;
  if (timer.current) clearTimeout(timer.current); setBusy(false); setProgress('');
 }, []);
 useEffect(() => () => { exportAbort.current?.abort(); generation.current++; worker.current?.terminate(); if (timer.current) clearTimeout(timer.current); releaseDocument(docRef.current); }, []);
 const install = useCallback(async (incoming: PsdDocument, token: number, restored?: Animation, restoredAudio?: ProjectAudio) => {
  try {
   // Decode sequentially to limit peak memory for large layer sets.
   for (const n of flatten(incoming.layers)) if (n.png) { const img = await imageOf(n.png); n.url = img.url; n.image = img.image; }
   if (incoming.composite) { const img = await imageOf(incoming.composite); incoming.compositeUrl = img.url; incoming.compositeImage = img.image; }
   if (token !== generation.current) { releaseDocument(incoming); return; }
   releaseDocument(docRef.current); docRef.current = incoming; setDoc(incoming); rigGeneration.current++; const newRig=restored?.rig??createRig(incoming); setRig(newRig); setAnimation(restored??createAnimation(newRig));animationHistory.current={past:[],future:[]}; animationGeneration.current++; setFrame(0);setDraft(undefined);setPlaying(false); setRigTool('select'); setRigMessage(restored?'Projekti avattu: kuvat, nivelet, animaatio ja ääni palautettu.':'');
   setAnimateMode(!!restored);setRigMode(false);setAudioAsset(restoredAudio);setClosedMouth('');setOpenMouth('');setSelected(null); setCollapsed(new Set()); setMode('layers'); setZoom(null); setRevision(r => r + 1); setBusy(false); setProgress('');
  } catch (e) { releaseDocument(incoming); if (token === generation.current) { setError('Tasokuvan avaaminen epäonnistui. Kokeile tallentaa PSD uudelleen Photoshopissa.'); setBusy(false); } }
 }, []);
 const openFile = useCallback(async (file: File) => {
  cancel(); setError('');
  if (!/\.psd$/i.test(file.name)) { setError('Valitse .psd-tiedosto. PSB- ja kuvatiedostot eivät ole vielä tuettuja.'); return; }
  if (file.size > 100 * 1024 * 1024) { setError('Tiedosto on yli 100 Mt. Pienennä PSD:tä Photoshopissa.'); return; }
  if (typeof OffscreenCanvas === 'undefined' || typeof Worker === 'undefined') { setError('Selain ei tue tämän editorin kuvankäsittelyä. Avaa sovellus ajantasaisessa Chromessa tai Edgessä.'); return; }
  const token = generation.current; setBusy(true); setProgress('Luetaan tiedostoa…');
  try {
   const buffer = await file.arrayBuffer(); if (token !== generation.current) return;
   const w = new Worker(new URL('../lib/psd.worker.ts', import.meta.url), { type: 'module' }); worker.current = w;
   const fail = (message: string) => { if (token !== generation.current) return; cancel(); setError(message); };
   timer.current = setTimeout(() => fail('Avaaminen kesti liian kauan. Pienennä PSD:tä ja kokeile uudelleen.'), 90000);
   w.onerror = () => fail('PSD:n lukeminen epäonnistui. Tallenna tiedosto 8-bittisenä RGB-PSD:nä ja kokeile uudelleen.');
   w.onmessage = e => {
    if (token !== generation.current) return;
    if (e.data.type === 'progress') setProgress(`Puretaan tasoja ${e.data.done} / ${e.data.total}`);
    if (e.data.type === 'error') fail(e.data.message);
    if (e.data.type === 'done') {
     if (timer.current) clearTimeout(timer.current); w.terminate(); worker.current = null;
     setProgress('Valmistellaan esikatselua…'); void install(e.data.doc, token);
    }
   };
   w.postMessage({ buffer, name: file.name }, [buffer]);
  } catch (e) { if (token === generation.current) { cancel(); setError('Tiedoston avaaminen epäonnistui. Kokeile uudelleen.'); } }
 }, [cancel, install]);
 const demo = async () => {
  cancel(); setError(''); setBusy(true); setProgress('Avataan tasotestiä…'); const token = generation.current;
  try { const response = await fetch(`${import.meta.env.BASE_URL}tasotesti.psd`); if (!response.ok) throw new Error(); const blob = await response.blob(); if (token === generation.current) await openFile(new File([blob], 'Tasotesti.psd')); }
  catch { if (token === generation.current) { setBusy(false); setError('Tasotestin lataus epäonnistui. Voit silti avata oman PSD-tiedoston.'); } }
 };
 useEffect(() => {
  if (!stage.current) return;
  const observer = new ResizeObserver(([e]) => {
   if (doc) setFit(Math.min((e.contentRect.width - 8) / doc.width, (e.contentRect.height - 8) / doc.height, 1));
  }); observer.observe(stage.current); return () => observer.disconnect();
 }, [doc]);
 useEffect(() => {
  if (!canvas.current || !doc) return;
  if (mode === 'original' && doc.compositeImage) {
   const c = canvas.current, r = Math.min(1, 2048 / Math.max(doc.width, doc.height)); c.width = Math.round(doc.width * r); c.height = Math.round(doc.height * r);
   c.getContext('2d')!.drawImage(doc.compositeImage, 0, 0, c.width, c.height);
  } else renderLayers(canvas.current, doc, mode === 'solo' && selected ? selected : undefined, animateMode && animation && rig ? { ...animation, rig } : undefined, frame, draft);
 }, [doc, mode, selected, revision, animateMode, animation, rig, frame, draft]);
 const toggle = (n: LayerNode) => { n.visible = !n.visible; setRevision(r => r + 1); setMode('layers'); };
 const downloadAll = async () => {
  if (!doc) return; setExporting(true); setError('');
  try {
   const { zip, strToU8 } = await import('fflate'); const files: Record<string, Uint8Array> = {};
   const metadata = [];
   for (const [i, n] of nodes.entries()) {
    const filename = n.png ? `tasot/${String(i + 1).padStart(3, '0')}_${safeName(n.name)}.png` : null;
    if (filename && n.png) files[filename] = new Uint8Array(await n.png.arrayBuffer());
    metadata.push({ key: n.key, psdId: n.psdId, name: n.name, path: n.path, kind: n.kind, left: n.left, top: n.top, width: n.width, height: n.height, opacity: n.opacity, visible: n.visible, blendMode: n.blendMode, file: filename, warnings: n.warnings });
   }
   files['tasot.json'] = strToU8(JSON.stringify({ version: 1, source: doc.name, width: doc.width, height: doc.height, note: 'PNG:t ovat rajattuja tasokuvia. Sijainti on left/top. Rasterimaskit on yhdistetty PNG:n läpinäkyvyyteen. Tasotehosteet ja leikkausmaskit eivät sisälly PNG-kuviin.', layers: metadata }, null, 2));
   const data = await new Promise<Uint8Array>((resolve, reject) => zip(files, { level: 0 }, (err, data) => err ? reject(err) : resolve(data)));
   save(new Blob([new Uint8Array(data)], {type: 'application/zip'}), `${safeName(doc.name.replace(/\.psd$/i, ''))}_tasot.zip`);
  } catch { setError('Tasojen lataaminen epäonnistui. Kokeile ladata yksittäinen taso.'); } finally { setExporting(false); }
 };
 function tree(ls: LayerNode[], depth = 0, parentHidden = false): React.ReactNode {
  return [...ls].reverse().map(n => <div key={n.key}>
   <div className={`layer-row ${selected === n.key ? 'selected' : ''} ${(!n.visible || parentHidden) ? 'muted-layer' : ''}`} style={{paddingLeft: 12 + depth * 16}}>
    {n.kind === 'group' ? <button className="tiny" aria-label={`${collapsed.has(n.key) ? 'Avaa' : 'Sulje'} ryhmä ${n.name}`} aria-expanded={!collapsed.has(n.key)} onClick={() => setCollapsed(s => { const next = new Set(s); if (next.has(n.key)) next.delete(n.key); else next.add(n.key); return next; })}>{collapsed.has(n.key) ? <ChevronRight size={14}/> : <ChevronDown size={14}/>}</button> : <span className="tree-spacer"/>}
    <button className="layer-select" onClick={() => chooseLayer(n.key)} aria-pressed={selected === n.key} title={n.path}>
     <span className={`layer-thumb ${n.kind === 'group' ? 'folder-thumb' : 'checker'}`}>{n.kind === 'group' ? <Folder size={17}/> : n.url ? <img src={n.url} alt=""/> : <ImageIcon size={14}/>}</span>
     <span className="layer-name">{n.name}</span>{n.warnings.length > 0 && <span title={n.warnings.join(" · ")} aria-label="Esikatseluhuomio"><AlertTriangle className="warning-icon" size={13}/></span>}</button>
    <button className="tiny visibility" onClick={() => toggle(n)} aria-label={`${n.visible ? 'Piilota' : 'Näytä'} ${n.name}`} aria-pressed={n.visible}>{n.visible ? <Eye size={15}/> : <EyeOff size={15}/>}</button>
   </div>{n.kind === 'group' && !collapsed.has(n.key) && tree(n.children, depth + 1, parentHidden || !n.visible)}
  </div>);
 }
 const part = rig?.parts.find(p => p.key === selected);
 const updatePart = (next: RigPart) => { if(!rig)return;const updated={...rig,parts:rig.parts.map(p=>p.key===next.key?next:p)};try{rigChain(updated,next.key);setRig(updated);setRigMessage('Muutos tehty — tallenna animaatio tai nivelmääritys.');}catch(e){setError(e instanceof Error?e.message:'Liitoksen muuttaminen epäonnistui.');} };
 const importRig = async (file: File) => {
  if (!doc) return;
  const token = ++rigGeneration.current;
  try {
   if (file.size > 2 * 1024 * 1024) throw new Error('Nivelmääritystiedosto on yli 2 Mt.');
   const next = readRig(await file.text(), doc);
   if (token !== rigGeneration.current || docRef.current !== doc) return;
   setRig(next); setAnimateMode(false);setPlaying(false);setDraft(undefined); setRigMode(true); setMode('layers'); setRigTool('select'); setRigMessage('Nivelmääritys avattu.'); setError('');
  } catch (e) { if (token === rigGeneration.current) setError(e instanceof Error ? e.message : 'Nivelmäärityksen avaaminen epäonnistui.'); }
 };
 const commitAnimation=(next:Animation)=>{if(animation){animationHistory.current.past=[...animationHistory.current.past,animation].slice(-40);animationHistory.current.future=[];}setAnimation(next);};
 const undoAnimation=(redo=false)=>{const h=animationHistory.current,from=redo?h.future:h.past,to=redo?h.past:h.future;const next=from.pop();if(next&&animation){to.push(animation);setAnimation(next);setFrame(Math.min(frame,next.duration-1));setDraft(undefined);setPlaying(false);}};
 const seek = (next: number) => { setPlaying(false);setDraft(undefined);setFrame(next); };
 const chooseLayer = (key: string) => {setSelected(key);setDraft(undefined);setLimbLower('');setLimbTarget(false);};
 useEffect(() => {
  if (!playing || !animation || !animateMode) return;
  let request=0;const start=performance.now(), initial=frame;
  const tick=(now:number)=>{setFrame((initial+Math.floor((now-start)/1000*animation.fps))%animation.duration);request=requestAnimationFrame(tick);};
  request=requestAnimationFrame(tick);return()=>cancelAnimationFrame(request);
  // frame advances within this loop; restarting it on each frame would pause playback.
 },[playing,animateMode,animation?.fps,animation?.duration]);
 useEffect(()=>{setDraft(undefined);},[selected]);
 useEffect(()=>{const key=animation?.tracks.find(t=>t.key===selected)?.frames.find(k=>k.frame===frame);if(key)setEasing(key.easing);},[selected,frame,animation]);
 const pose = draft?.key === selected ? draft.pose : sampleTrack(animation?.tracks.find(t=>t.key===selected),frame);
 const importAnimation = async (file:File) => {
  if(!doc || frameExport)return;const token=++animationGeneration.current;
  try {if(file.size>10*1024*1024)throw new Error('Animaatiotiedosto on yli 10 Mt.');const next=readAnimation(await file.text(),doc);if(token!==animationGeneration.current||docRef.current!==doc)return;setAnimation(next);animationHistory.current={past:[],future:[]};setRig(next.rig);setFrame(0);setDraft(undefined);setPlaying(false);setAnimateMode(true);setRigMode(false);setMode('layers');setRigMessage('Animaatio avattu.');setError('');}
  catch(e){if(token===animationGeneration.current)setError(e instanceof Error?e.message:'Animaation avaaminen epäonnistui.');}
 };
 useEffect(()=>{if(!audioAsset){setAudioUrl('');return;}const url=URL.createObjectURL(audioAsset.blob);setAudioUrl(url);return()=>URL.revokeObjectURL(url);},[audioAsset]);
 useEffect(()=>{const player=audioPlayer.current;if(!player||!animation)return;if(playing&&animateMode){player.currentTime=frame/animation.fps;void player.play().catch(()=>setError('Äänen toisto ei onnistunut. Tarkista äänitiedosto.'));}else player.pause();return()=>player.pause();},[playing,animateMode,audioUrl,animation?.fps]);
 useEffect(()=>{const player=audioPlayer.current;if(player&&animation&&Number.isFinite(player.duration)){if(!playing)player.currentTime=Math.min(frame/animation.fps,player.duration);else if(Math.abs(player.currentTime-frame/animation.fps)>.25){player.currentTime=Math.min(frame/animation.fps,player.duration);if(player.paused&&frame/animation.fps<player.duration)void player.play().catch(()=>{});}}},[frame,playing,animation?.fps,audioUrl]);
 const createSpeech=async()=>{if(!audioAsset||!animation||!rig||speechBusy||closedMouth===openMouth||!closedMouth||!openMouth)return;const currentDoc=docRef.current;const asset=audioAsset;setSpeechBusy(true);setPlaying(false);setError('');const context=new AudioContext();try{const decoded=await context.decodeAudioData(await asset.blob.arrayBuffer());const samples=decoded.getChannelData(0);if(docRef.current!==currentDoc)return;const next=applySpeech({...animation,rig},closedMouth,openMouth,speechFrames(samples,decoded.sampleRate,animation.fps,animation.duration));commitAnimation(next);setDraft(undefined);setFrame(0);setAnimateMode(true);setRigMode(false);setMode('layers');setRigMessage('Suun avautuminen luotu äänen voimakkuudesta. Voit korjata avainruutuja ja kumota muutoksen.');}catch(e){setError(e instanceof Error?e.message:'Puheen analyysi epäonnistui.');}finally{await context.close();setSpeechBusy(false);}};
 const loadAudio=(file:File)=>{const extension=file.name.split('.').pop()?.toLowerCase();const types:Record<string,string>={mp3:'audio/mpeg',wav:'audio/wav',ogg:'audio/ogg',m4a:'audio/mp4'};if(!extension||!types[extension]||file.size>25*1024*1024){setError('Valitse MP3-, WAV-, OGG- tai M4A-tiedosto, enintään 25 Mt.');return;}setPlaying(false);setAudioAsset({name:file.name,blob:new Blob([file],{type:types[extension]})});setRigMessage('Ääni lisätty. Tallenna projekti säilyttääksesi sen.');};
 const downloadVideo=async()=>{if(frameExport){exportAbort.current?.abort();return;}if(!doc||!animation||!rig||busy)return;const controller=new AbortController();exportAbort.current=controller;setFrameExport(true);setPlaying(false);setError('');try{save(await exportVideo(doc,{...animation,rig},controller.signal,n=>setRigMessage(`Tallennetaan videota ${n}/${animation.duration}… Pidä välilehti aktiivisena.`),audioUrl||undefined),`${safeName(doc.name.replace(/\.psd$/i,''))}.webm`);setRigMessage('Video tallennettu WebM-tiedostona.');}catch(e){if(controller.signal.aborted)setRigMessage('Vienti peruttu.');else setError(e instanceof Error?e.message:'Videovienti epäonnistui.');}finally{setFrameExport(false);exportAbort.current=null;}};
 const exportAnimation = async () => {
  if(frameExport){exportAbort.current?.abort();return;}if(!doc||!animation||!rig||busy)return;
  const controller=new AbortController();exportAbort.current=controller;setFrameExport(true);setPlaying(false);setError('');
  try {const blob=await exportFrames(doc,{...animation,rig},controller.signal,n=>setRigMessage(`Viedään ruutua ${n}/${animation.duration}…`));save(blob,`${safeName(doc.name.replace(/\.psd$/i,''))}_animaatio.zip`);setRigMessage('PNG-kuvasarja ladattu.');}
  catch(e){if(controller.signal.aborted)setRigMessage('Vienti peruttu.');else setError(e instanceof Error?e.message:'Vienti epäonnistui.');}
  finally{setFrameExport(false);exportAbort.current=null;}
 };
 const openProject=async(file:File)=>{if(projectBusy||frameExport)return;cancel();const token=generation.current;setProjectBusy(true);setError('');try{const restored=await readProject(file);if(token===generation.current)await install(restored.doc,token,restored.animation,restored.audio);}catch(e){if(token===generation.current)setError(e instanceof Error?e.message:'Projektin avaaminen epäonnistui.');}finally{setProjectBusy(false);}};
 const downloadProject=async()=>{if(!doc||!animation||!rig||projectBusy||frameExport||busy)return;setProjectBusy(true);setPlaying(false);setError('');try{save(await saveProject(doc,{...animation,rig},audioAsset),`${safeName(doc.name.replace(/\.psd$/i,''))}.hahmo`);setRigMessage('Projekti tallennettu: kuvat, nivelet ja animaatio yhdessä tiedostossa.');}catch(e){setError(e instanceof Error?e.message:'Projektin tallennus epäonnistui.');}finally{setProjectBusy(false);}};
 const scale = Math.max(.01, zoom ?? fit);
 return <main className="studio" onDragOver={e => { e.preventDefault(); if (e.dataTransfer.types.includes('Files')) setDrag(true); }} onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDrag(false); }} onDrop={e => { e.preventDefault(); setDrag(false); const file = e.dataTransfer.files[0]; if (file && !frameExport && !projectBusy && !speechBusy && !cameraActive) {if(/\.hahmo$/i.test(file.name))void openProject(file);else void openFile(file);} }}>
  <input ref={audioInput} type="file" accept=".mp3,.wav,.ogg,.m4a" hidden onChange={e=>{const f=e.target.files?.[0];if(f)loadAudio(f);e.target.value='';}}/>
  <input ref={projectInput} type="file" accept=".hahmo" hidden onChange={e=>{const f=e.target.files?.[0];if(f)void openProject(f);e.target.value='';}}/>
  <input ref={input} type="file" accept=".psd" hidden onChange={e => { const file = e.target.files?.[0]; if (file) void openFile(file); e.target.value = ''; }}/>
  <input ref={rigInput} type="file" accept=".json,application/json" hidden onChange={e => { const file = e.target.files?.[0]; if (file) void importRig(file); e.target.value = ''; }}/>
  <input ref={animationInput} type="file" accept=".json,application/json" hidden onChange={e=>{const file=e.target.files?.[0];if(file)void importAnimation(file);e.target.value='';}}/>
  <header className="topbar"><div className="brand"><span className="brand-mark"><Layers size={21}/></span><h1>hahmostudio<span className="brand-dot">.</span></h1><span className="version">OMA STUDIO</span></div>
   <div className="header-actions"><button className="secondary" disabled={projectBusy||frameExport||speechBusy||cameraActive} onClick={()=>projectInput.current?.click()}>Avaa projekti</button><button className="primary" disabled={!doc||projectBusy||frameExport||busy||cameraActive} onClick={()=>void downloadProject()}>{projectBusy?'Odota…':'Tallenna projekti'}</button>{import.meta.env.VITE_PRIVATE_SERVER === 'true' && <button className="secondary" onClick={async()=>{await fetch('/api/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});location.assign('/login');}}>Kirjaudu ulos</button>}<details className="file-menu" onClick={e=>{if((e.target as HTMLElement).closest('button'))e.currentTarget.open=false;}}><summary>Erilliset tiedostot</summary><div><button className="secondary" disabled={!doc || frameExport} onClick={()=>animationInput.current?.click()}>Avaa animaatio</button><button className="secondary" disabled={!animation || !rig || frameExport} onClick={()=>{if(animation&&rig&&doc){save(new Blob([JSON.stringify({...animation,rig},null,2)],{type:'application/json'}),`${safeName(doc.name.replace(/\.psd$/i,''))}_animaatio.json`);setRigMessage('Animaatio tallennettu JSON-tiedostona.');}}}>Tallenna animaatio</button><button className="secondary" disabled={!doc || frameExport} onClick={() => rigInput.current?.click()}>Avaa nivelet</button><button className="secondary" disabled={!rig || !doc || frameExport} onClick={() => { if (rig && doc) { save(new Blob([JSON.stringify(rig, null, 2)], { type: 'application/json' }), `${safeName(doc.name.replace(/\.psd$/i, ''))}_nivelet.json`); setRigMessage('Nivelmääritys tallennettu JSON-tiedostona.'); } }}>Tallenna nivelet</button></div></details><button ref={helpButton} className="text-button" onClick={() => setHelp(true)}><Info size={16}/><span>Käyttöohje</span></button><button className="primary" disabled={frameExport||projectBusy||speechBusy||cameraActive} onClick={() => input.current?.click()}><Upload size={16}/><span>Avaa PSD</span></button></div></header>
  <div className="projectbar"><div className="project-title"><FileImage size={17}/><span>{doc?.name ?? 'Uusi hahmo'}</span>{doc && <span className="document-size">{doc.width} × {doc.height} px</span>}</div><span className="local-label"><span className="local-indicator"/>Tiedosto käsitellään selaimessa</span></div>
  {error && <div className="error-bar" role="alert"><AlertTriangle size={17}/><span>{error}</span><button className="tiny" aria-label="Sulje virheilmoitus" onClick={() => setError('')}><X size={16}/></button></div>}
  <div className="workspace">
   <aside className="layers-panel"><div className="panel-heading"><h2><Layers size={15}/>Tasot</h2><span>{nodes.filter(n => n.kind === 'layer').length}</span></div>
    {doc ? <><div className="layer-tree" aria-label="PSD-tasot">{tree(doc.layers)}</div><div className="layers-bottom"><span>{nodes.filter(n => n.kind === 'group').length} ryhmää · {nodes.filter(n => n.kind === 'layer').length} tasoa</span><button className="secondary full" disabled={exporting || !nodes.some(n => n.png)} onClick={() => void downloadAll()}>{exporting ? <LoaderCircle size={16} className="spin"/> : <Package size={16}/>}Lataa kaikki tasot</button></div></> : <div className="panel-empty"><Folder size={27}/><p>Tasosi tulevat tähän.</p><span>Avaa PSD, niin näet sen tasot ja ryhmät.</span></div>}
   </aside>
   <section className="preview-panel" aria-label="Kuvan esikatselu"><div className="preview-toolbar"><div className="view-tabs"><button className={mode !== 'original' && !rigMode && !animateMode ? 'active' : ''} onClick={() => {setMode('layers');setRigMode(false);setAnimateMode(false);setPlaying(false);setDraft(undefined);}}>1. Tasot</button><button className={rigMode ? 'active' : ''} disabled={!doc || frameExport} onClick={() => { setRigMode(!rigMode); setAnimateMode(false);setPlaying(false);setDraft(undefined); setMode('layers'); setRigTool('select'); }}>2. Nivelet</button><button className={animateMode ? 'active' : ''} disabled={!doc || frameExport} onClick={()=>{setAnimateMode(!animateMode);setRigMode(false);setMode('layers');setPlaying(false);setDraft(undefined);}}>3. Animoi</button><button disabled={!doc?.compositeImage} className={mode === 'original' ? 'active' : ''} onClick={() => { setMode('original'); setRigMode(false);setAnimateMode(false);setPlaying(false);setDraft(undefined); }}>Alkuperäinen PSD</button></div><div className="background-options" aria-label="Esikatselun tausta">{(['checker','dark','white'] as const).map(b => <button key={b} title={b === 'checker' ? 'Läpinäkyvyysruudukko' : b === 'dark' ? 'Tumma tausta' : 'Valkoinen tausta'} aria-label={b === 'checker' ? 'Läpinäkyvyysruudukko' : b === 'dark' ? 'Tumma tausta' : 'Valkoinen tausta'} aria-pressed={background === b} className={`swatch ${b} ${background === b ? 'chosen' : ''}`} onClick={() => setBackground(b)}/>)}</div></div>
    <div className={`stage ${drag ? 'dragging' : ''}`} ref={stage}>
     {doc ? <div className={`artboard ${background}`} style={{width: doc.width * scale, height: doc.height * scale}}><canvas ref={canvas}/>{rigMode && mode !== 'original' && <svg className={`rig-overlay ${part && rigTool !== 'select' ? 'placing' : ''}`} viewBox={`0 0 ${doc.width} ${doc.height}`} aria-label="Nivelmäärityksen pisteet" onPointerDown={e => {
       if (!part || rigTool === 'select' || busy) return;
       const bounds = e.currentTarget.getBoundingClientRect();
       const point = { x: Math.round(Math.max(0, Math.min(doc.width, (e.clientX - bounds.left) / bounds.width * doc.width))), y: Math.round(Math.max(0, Math.min(doc.height, (e.clientY - bounds.top) / bounds.height * doc.height))) };
       if (rigTool === 'pivot') updatePart({ ...part, pivot: point });
       else if (part.joints.length < 32) updatePart({ ...part, joints: [...part.joints, point] });
       else setError('Yhdellä tasolla voi olla enintään 32 niveltä.');
      }}>{rig?.parts.filter(p => p.role !== 'none' || p.key === selected || p.joints.length).map(p => <g key={p.key} opacity={p.key === selected ? 1 : .4}><circle cx={p.pivot.x} cy={p.pivot.y} r={7 / scale} className="pivot-marker"/><path d={`M ${p.pivot.x - 11 / scale} ${p.pivot.y} H ${p.pivot.x + 11 / scale} M ${p.pivot.x} ${p.pivot.y - 11 / scale} V ${p.pivot.y + 11 / scale}`} className="pivot-cross"/>{p.joints.map((j,i) => <g key={i}><line x1={p.pivot.x} y1={p.pivot.y} x2={j.x} y2={j.y} className="joint-link"/><circle cx={j.x} cy={j.y} r={5 / scale} className="joint-marker"/></g>)}</g>)}</svg>}{limbTarget&&animateMode&&rig&&animation&&<svg className="rig-overlay placing" viewBox={`0 0 ${doc.width} ${doc.height}`} aria-label="Raajan tavoitepiste" onPointerDown={e=>{if(!selected||cameraActive)return;const b=e.currentTarget.getBoundingClientRect();try{const result=keyframeLimb({...animation,rig},selected,limbLower,frame,{x:(e.clientX-b.left)/b.width*doc.width,y:(e.clientY-b.top)/b.height*doc.height},limbBend,easing);commitAnimation(result.animation);setDraft(undefined);setRigMessage(result.clamped?'Tavoite on ulottuman ulkopuolella. Raaja ojennettiin lähimpään mahdolliseen kohtaan.':'Raaja taivutettu ja molempien osien avainruudut tallennettu.');}catch(err){setError(err instanceof Error?err.message:'Raajan taivutus epäonnistui.');}}}/>}{current && !animateMode && mode !== 'original' && current.kind === 'layer' && <div className="selection-box" style={{left: `${current.left / doc.width * 100}%`, top: `${current.top / doc.height * 100}%`, width: `${current.width / doc.width * 100}%`, height: `${current.height / doc.height * 100}%`}}/>}</div> : <div className="import-card"><div className="import-symbol"><FileImage size={34} strokeWidth={1.4}/><span>.psd</span></div><span className="eyebrow">HAHMOSI ENSIMMÄINEN ASKEL</span><h2>Avaa hahmosi PSD.</h2><p>Jokainen taso omaksi osakseen.<br/>Ryhmät, sijainnit ja läpinäkyvyys mukana.</p><button className="primary large" onClick={() => input.current?.click()}><Upload size={17}/>Valitse PSD-tiedosto</button><span className="drop-hint">tai pudota tiedosto tähän</span><div className="import-divider"/><button className="text-button demo-button" onClick={() => void demo()}><Square size={15}/>Kokeile valmista tasotestiä</button><span className="format-note">RGB / harmaasävy · 8 bittiä · enintään 100 Mt</span></div>}
     {drag && <div className="drop-overlay"><Upload size={30}/><strong>Pudota PSD tähän</strong></div>}
     {busy && <div className="busy-overlay" role="status"><LoaderCircle className="spin" size={30}/><strong>{progress}</strong><button className="secondary" onClick={cancel}>Peruuta</button></div>}
    </div>
    <div className="preview-footer"><span>{mode === 'original' ? 'Photoshopin tallentama esikatselu' : mode === 'solo' ? 'Valittu taso eristettynä' : doc ? 'Näkyvät tasot' : 'Valmis avaamaan PSD:n'}</span><div className="zoom-controls"><button className="tiny" aria-label="Loitonna" disabled={!doc || frameExport} onClick={() => setZoom(Math.max(.05, scale / 1.25))}><ZoomOut size={16}/></button><span>{doc ? `${Math.round(scale * 100)} %` : '—'}</span><button className="tiny" aria-label="Lähennä" disabled={!doc || frameExport} onClick={() => setZoom(Math.min(4, scale * 1.25))}><ZoomIn size={16}/></button><button className="fit-button" disabled={!doc || frameExport} onClick={() => setZoom(null)} title="Sovita kuva"><Scan size={15}/>Sovita</button></div></div>
   </section>
   <aside className="details-panel"><div className="panel-heading"><h2>Tason tiedot</h2></div>{current ? <div className="details-content"><div className={`detail-preview checker`}>{current.url ? <img src={current.url} alt={current.name}/> : <Folder size={40}/>}</div><span className="eyebrow">{current.kind === 'group' ? 'TASORYHMÄ' : 'TASO'}</span><h3>{current.name}</h3><p className="layer-path">{current.path}</p>{rigMode && part && doc && <RigPanel part={part} rig={rig!} width={doc.width} height={doc.height} tool={rigTool} setTool={setRigTool} update={updatePart}/>}<dl className="properties"><div><dt>Leveys</dt><dd>{current.width} px</dd></div><div><dt>Korkeus</dt><dd>{current.height} px</dd></div><div><dt>X</dt><dd>{current.left} px</dd></div><div><dt>Y</dt><dd>{current.top} px</dd></div><div><dt>Peittävyys</dt><dd>{Math.round(current.opacity * 100)} %</dd></div><div><dt>Sekoitustila</dt><dd>{({normal:'Normaali',multiply:'Kertova',screen:'Rasteri',overlay:'Peittävä',darken:'Tummentava',lighten:'Vaalentava',passthrough:'Läpikulku'} as Record<string,string>)[current.blendMode] ?? 'Erikoissekoitus'}</dd></div><div><dt>PSD-ID</dt><dd>{current.psdId ?? 'Ei tunnistetta'}</dd></div></dl><button className="secondary full" onClick={() => setMode(mode === 'solo' ? 'layers' : 'solo')}><Eye size={16}/>{mode === 'solo' ? 'Näytä kaikki tasot' : 'Näytä vain tämä'}</button>{current.png && <button className="secondary full" onClick={() => save(current.png!, `${safeName(current.name)}.png`)}><Download size={16}/>Lataa taso PNG:nä</button>}{current.warnings.map(w => <p className="layer-warning" key={w}><AlertTriangle size={14}/>{w}</p>)}</div> : <div className="panel-empty"><Scan size={27}/><p>Valitse taso.</p><span>Näet kuvan, sijainnin ja koon. Voit myös ladata tason PNG:nä.</span></div>}
    <div className="file-summary"><span className="eyebrow">TYÖNKULKU</span><div className="workflow-step"><span>01</span><strong>PSD-tuonti & tasot</strong><Check size={14}/></div><p>Määritä tasojen kiertokeskukset ja avaa Animoi-välilehti.<br/>Luo avainruudut, toista ja vie PNG-kuvasarja. Tallenna animaatio jatkamista varten.</p></div></aside>
  </div>
  {doc&&rig&&animation&&<section className="performance-tools" aria-label="Liikkeen tallennus"><CameraPanel key={doc.name+generation.current} nodes={nodes} width={doc.width} height={doc.height} fps={animation.fps} duration={animation.duration} frame={frame} disabled={busy||projectBusy||frameExport||speechBusy} active={value=>{setCameraActive(value);if(value){setPlaying(false);setAnimateMode(true);setRigMode(false);setMode('layers');}else setDraft(undefined);}} live={(key,poses)=>{setDraft({key,pose:poses[key],poses});setAnimateMode(true);setRigMode(false);setMode('layers');}} record={tracks=>{let next={...animation,rig};for(const track of tracks)for(const keyframe of track.frames)next=putKeyframe(next,track.key,keyframe);commitAnimation(next);setDraft(undefined);setRigMessage('Kameraliike tallennettu. Tallenna projekti.');}}/><details className="performance-panel"><summary>Automaattinen niveltaivutus · kädet ja jalat</summary><div className="camera-controls"><p>Valitse tasoluettelosta raajan yläosa. Liitä alaosa yläosaan Nivelet-vaiheessa. Yläosan kiertokeskus on olkapää/lonkka, alaosan kiertokeskus kyynärpää/polvi. Lisää alaosaan ensimmäiseksi nivelpisteeksi ranne/nilkka.</p><label>Raajan alaosa<select aria-label="Raajan alaosa" value={limbLower} disabled={cameraActive||frameExport} onChange={e=>{setLimbLower(e.target.value);setLimbTarget(false);}}><option value="">Valitse liitetty alaosa</option>{rig.parts.filter(p=>selected&&p.parentKey===selected).map(p=><option key={p.key} value={p.key}>{p.path}</option>)}</select></label><label>Taivutussuunta<select aria-label="Taivutussuunta" value={limbBend} onChange={e=>setLimbBend(Number(e.target.value) as 1|-1)}><option value="1">Ensimmäinen suunta</option><option value="-1">Vastakkainen suunta</option></select></label><button className="secondary" disabled={!selected||!limbLower||!rig.parts.find(p=>p.key===limbLower)?.joints.length||cameraActive||frameExport} onClick={()=>{setAnimateMode(true);setRigMode(false);setMode('layers');setPlaying(false);setLimbTarget(!limbTarget);}}>{limbTarget?'Lopeta taivutus':'Taivuta raajaa'}</button><p>{limbTarget?'Napsauta kuvassa kohtaa, johon ranteen tai nilkan tulee ulottua. Avainruudut tallentuvat aikajanan nykyiseen ruutuun.':'Kaksi erillistä osaa kiertyvät nivelistään. Kuvapinnan jatkuvaa venytystä ei tehdä.'}</p></div></details>{audioAsset&&<PhoneticPanel key={audioAsset.name+generation.current} nodes={nodes} animation={{...animation,rig}} audio={audioAsset} disabled={busy||projectBusy||frameExport||cameraActive} busy={setSpeechBusy} apply={next=>{commitAnimation(next);setDraft(undefined);setFrame(0);setPlaying(false);setAnimateMode(true);setRigMode(false);setMode('layers');setRigMessage('Äänteistä luotu suun animaatio. Tallenna projekti.');}}/>}</section>}
  {doc && <section className="audio-bar" aria-label="Ääniraita"><button className="secondary" disabled={frameExport||projectBusy||speechBusy||cameraActive} onClick={()=>audioInput.current?.click()}>Lisää ääni</button>{audioAsset?<><span title={audioAsset.name}>{audioAsset.name}</span><audio ref={audioPlayer} src={audioUrl} preload="metadata" onError={()=>setError('Äänitiedostoa ei voida toistaa tässä selaimessa.')}/><button disabled={frameExport} className="text-button" onClick={()=>{setPlaying(false);setAudioAsset(undefined);}}>Poista ääni</button></>:<span>Ääni alkaa animaation alusta. MP3, WAV, OGG tai M4A.</span>}<button className="secondary" disabled={!animation||projectBusy||speechBusy} onClick={()=>void downloadVideo()}>{frameExport?'Peruuta vienti':'Vie video'}</button></section>}
  {doc&&audioAsset&&<section className="speech-bar" aria-label="Suun animaatio"><strong>Suun animaatio</strong><label>Suljettu suu<select aria-label="Suljettu suu" disabled={speechBusy||frameExport} value={closedMouth} onChange={e=>setClosedMouth(e.target.value)}><option value="">Valitse taso</option>{nodes.filter(n=>n.kind==='layer').map(n=><option key={n.key} value={n.key}>{n.path}</option>)}</select></label><label>Avoin suu<select aria-label="Avoin suu" disabled={speechBusy||frameExport} value={openMouth} onChange={e=>setOpenMouth(e.target.value)}><option value="">Valitse taso</option>{nodes.filter(n=>n.kind==='layer').map(n=><option key={n.key} value={n.key}>{n.path}</option>)}</select></label><button className="secondary" disabled={speechBusy||frameExport||!closedMouth||!openMouth||closedMouth===openMouth} onClick={()=>void createSpeech()}>{speechBusy?'Analysoidaan…':'Luo suun liike'}</button><span>Korvaa valittujen suutasojen avainruudut. Perustuu äänen voimakkuuteen, ei äänteisiin.</span></section>}
  {animateMode && animation && rig && <AnimationPanel animation={{...animation,rig}} nodes={nodes} selected={selected} select={chooseLayer} frame={frame} seek={seek} playing={playing} play={()=>{setDraft(undefined);setPlaying(!playing);}} pose={pose} setPose={p=>{if(selected){setDraft({key:selected,pose:p});setRigMessage('Asento muuttui — lisää tai päivitä avainruutu.');}}} easing={easing} setEasing={setEasing} add={()=>{if(selected){commitAnimation(putKeyframe(animation,selected,{...pose,frame,easing}));setDraft(undefined);setRigMessage('Avainruutu tallennettu. Tallenna animaatio JSON-tiedostoon.');}}} remove={()=>{if(selected){commitAnimation(removeKeyframe(animation,selected,frame));setDraft(undefined);}}} configure={(fps,duration)=>{commitAnimation({...animation,fps,duration,tracks:animation.tracks.map(t=>({...t,frames:t.frames.filter(k=>k.frame<duration)}))});setFrame(Math.min(frame,duration-1));setDraft(undefined);}} undo={()=>undoAnimation()} redo={()=>undoAnimation(true)} canUndo={animationHistory.current.past.length>0} canRedo={animationHistory.current.future.length>0} exporting={frameExport||cameraActive} exportFrames={()=>void exportAnimation()}/>}
  {doc?.warnings.length ? <details className="warnings"><summary><AlertTriangle size={15}/>Esikatseluhuomioita: {doc.warnings.length} — avaa lisätiedot (ei nimeämisvirhe)</summary><ul>{doc.warnings.map(w => <li key={w}>{w}</li>)}</ul><button className="secondary" onClick={()=>setHelp(true)}>Avaa käyttöohje: varoitusten korjaaminen</button></details> : null}
  <footer className="statusbar"><span><span className="status-dot"/>{doc ? 'PSD avattu' : 'Odottaa tiedostoa'}</span><span>{rigMessage || 'Tallenna animaatio ja nivelmääritys JSON-tiedostoihin. PSD säilyy omalla koneellasi.'}</span><span>ANIMAATIO / 03</span></footer>
  {help && <div className="modal-backdrop" onClick={() => setHelp(false)}><section ref={helpDialog} className="help-modal user-guide" role="dialog" aria-modal="true" aria-labelledby="help-title" onClick={e=>e.stopPropagation()}><div className="modal-heading"><h2 id="help-title">Hahmostudion käyttöohje</h2><button autoFocus className="secondary" aria-label="Sulje käyttöohje" onClick={()=>setHelp(false)}><X size={18}/>Takaisin studioon</button></div><UserGuide/></section></div>}
 </main>;
}
