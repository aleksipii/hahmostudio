import {useEffect,useRef,useState} from 'react';import {createPortal} from 'react-dom';
import {desktop} from '../lib/platform';
import {aiActivity,aiStatusRows,LOCATION_FI,onAiActivity,type AiStatusInput,type AiStatusRow} from '../lib/ai-status';

/** Tekoäly-paneelin sisältö: vain todelliset tilat. Ei toimintopainikkeita; ulkoasu ja sijainti viimeistellään UI/UX:ssä. */
export function AiPanelView({rows,loading}:{rows:AiStatusRow[];loading:boolean}){
 return <div className="ai-status">
  <p className="panel-note">Tekoäly ehdottaa ja avustaa. Säännöt ja sinun hyväksyntäsi ratkaisevat, mitä projektiin tulee. Kaikki alla oleva toimii tällä koneella; mitään ei lähetetä pilveen.</p>
  {loading&&<p className="panel-note">Luetaan tiloja…</p>}
  {rows.map(r=><section key={r.id} aria-label={r.name} data-ai-feature={r.id}><h3>{r.name}</h3><dl>
   <dt>Missä</dt><dd>{LOCATION_FI[r.location]}{r.available?'':' · ei käytössä'}</dd>
   <dt>Lupa</dt><dd>{r.permissionText}</dd>
   <dt>Mitä dataa lähtee ja minne</dt><dd>{r.data}</dd>
   <dt>Kustannus</dt><dd>{r.cost}</dd>
   <dt>Viimeisin tulos</dt><dd>{r.last?`${r.last.ok?'✓':'✗'} ${new Date(r.last.at).toLocaleTimeString('fi-FI')} · ${r.last.text}`:'— (ei tässä istunnossa)'}</dd>
  </dl>{r.note&&<p className="panel-note">{r.note}</p>}</section>)}
  <p className="panel-note">Käsikirjoituksen tulkinta on sääntöpohjainen, ei tekoälyä: se ei arvaa, ja tunnistamaton rivi jää näkyviin.</p>
 </div>;
}

async function cameraPermission():Promise<AiStatusInput['camera']>{
 try{const s=await navigator.permissions.query({name:'camera' as PermissionName});return s.state;}catch{return 'unknown';}
}

export default function AiPanel({onClose}:{onClose:()=>void}){
 const [input,setInput]=useState<AiStatusInput>({cloud:{available:false}}),[loading,setLoading]=useState(true),[tick,setTick]=useState(0);
 const box=useRef<HTMLDivElement>(null);
 useEffect(()=>{box.current?.focus();const key=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose();};document.addEventListener('keydown',key);return()=>document.removeEventListener('keydown',key);},[]);
 useEffect(()=>onAiActivity(()=>setTick(n=>n+1)),[]);
 useEffect(()=>{let live=true;const bridge=desktop();void(async()=>{
  const [audioModel,kokoro,camera]=await Promise.all([bridge?bridge.audioModel().catch(()=>null):Promise.resolve(undefined),bridge?bridge.kokoroStatus().catch(e=>({installed:false,error:e instanceof Error?e.message:'Tila ei luettavissa'})):Promise.resolve(undefined),cameraPermission()]);
  if(live){setInput({audioModel,kokoro,camera,cloud:{available:false}});setLoading(false);}
 })();return()=>{live=false;};},[]);
 const rows=aiStatusRows({...input,activity:aiActivity()});void tick;
 return createPortal(<div className="export-backdrop studio-export"><div role="dialog" aria-modal="true" aria-labelledby="ai-title" className="export-dialog" ref={box} tabIndex={-1}>
  <header><h2 id="ai-title">Tekoäly</h2><button className="secondary" onClick={onClose}>Sulje</button></header>
  <AiPanelView rows={rows} loading={loading}/>
 </div></div>,document.body);
}
