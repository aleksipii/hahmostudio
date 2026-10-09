// Isolated visual fixture: real component and Canvas renderer, no user projects or cloud calls.
import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import ProductionBoard from '../../components/production-board';
import {AiPanelView} from '../../components/ai-panel';
import {aiStatusRows} from '../../lib/ai-status';
import {readProject} from '../../lib/project-file';
import {buildEpisode,catalogFromNames} from '../../lib/episode-builder';
import {CHARACTER_PACK_OPTIONS} from '../../lib/speaker-pack-options';
import {renderToonCast} from '../../lib/toon-render';
import {toonProfiles} from '../../lib/toon3d';
import type {Presentation} from '../../lib/presentation-model';
import type {PresentationAssets} from '../../lib/presentation-compile';
import '../../style.css';

const views=['front','quarter-right','profile-right','rear'] as const;
function Sample({name,view,style,assets}:{name:string;view:typeof views[number];style:'flat'|'cel';assets:PresentationAssets}){
 const canvas=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{
  const b=buildEpisode(`Resurssi hahmo MIRA: ${name}\nINT. STUDIO\nLAAJA KUVA\nMira odottaa 2 s.`,{packs:catalogFromNames(CHARACTER_PACK_OPTIONS),assets},{width:1080,height:1440});
  const p=b.presentation,shot=p.events.find(e=>e.kind==='shot')!;
  p.bindings[0]={...p.bindings[0],x:540,y:680,scale:1.4};
  p.production!.representations={MIRA:'toon3d'};
  p.production!.characterProfiles={MIRA:{...toonProfiles.find(t=>t.name===name)!,renderStyle:style}};
  p.production!.cameras[shot.id]={size:'wide',view,angle:'eye',motion:'still'};
  const ctx=canvas.current!.getContext('2d')!;
  ctx.clearRect(0,0,1080,1440);
  renderToonCast(ctx,p,assets,0,1080,1440);
 },[name,view,style,assets]);
 return <figure style={{margin:0,background:'#fff',color:'#222'}}><figcaption>{name} · {view} · {style}</figcaption><canvas width={1080} height={1440} ref={canvas} style={{width:'100%',height:'auto'}}/></figure>;
}
function Preview({assets,initial}:{assets:PresentationAssets;initial:Presentation}){
 const [p,setP]=useState(initial),[disabled,setDisabled]=useState(false);
 useEffect(()=>{(window as unknown as {teamPreviewReady:boolean}).teamPreviewReady=true;},[]);
 return <main style={{padding:16,color:'#222',background:'#eee'}}><h1>3D-hahmot: litteä ja aiempi tyyli</h1><p>Eristetty testiaineisto. Todellinen Canvas-renderer ja Ohjauspöytä-komponentti.</p>
  <button data-disable-board onClick={()=>setDisabled(v=>!v)}>Testi: lukitse muokkaus</button>
  <ProductionBoard disabled={disabled} model={p} compiled={p} assets={assets} frame={0} fps={24} seek={()=>{}} change={setP}/>
  <div data-selected-style={p.production?.characterProfiles?.MIRA?.renderStyle??'cel'}>Valittu tyyli: {p.production?.characterProfiles?.MIRA?.renderStyle??'cel'}</div>
  <div id="character-grid" style={{display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',gap:8}}>{toonProfiles.flatMap(t=>views.map(view=><Sample key={t.id+view} name={t.name} view={view} style="flat" assets={assets}/>))}</div>
  <h2>Aiempi tyyli vertailuun</h2><div style={{display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',gap:8}}>{toonProfiles.map(t=><Sample key={t.id} name={t.name} view="front" style="cel" assets={assets}/>)}</div>
 <section id="ai-fixture"><h2>Tekoälypaneelin estotila</h2><AiPanelView loading={false} rows={aiStatusRows({kokoro:{installed:false},cloud:{available:true,enabled:true,modelPins:false,storage:null,settings:{colabClassifiedFree:false,notebookClassifiedFree:true},secrets:{encryption:true,keys:{}},jobs:[]}})}/></section>
 </main>;
}
async function start(){
 const assets:PresentationAssets={};
 for(const t of toonProfiles){const res=await fetch('/library/'+t.name+'.hahmo');if(!res.ok)throw Error('Testihahmo puuttuu: '+t.name);const project=await readProject(await res.blob());assets[t.name]={doc:project.doc,animation:project.animation};}
 const initial=buildEpisode('Resurssi hahmo MIRA: Pipsa\nINT. STUDIO\nLAAJA KUVA\nMira odottaa 2 s.',{packs:catalogFromNames(CHARACTER_PACK_OPTIONS),assets}).presentation;
 initial.production!.representations={MIRA:'toon3d'};
 createRoot(document.getElementById('root')!).render(<Preview assets={assets} initial={initial}/>);
}
void start().catch(e=>{document.getElementById('root')!.textContent=String(e);throw e;});
