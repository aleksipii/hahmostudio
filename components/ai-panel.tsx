import {useEffect,useRef,useState} from 'react';import {createPortal} from 'react-dom';
import {desktop,type CloudSecretKey,type CloudStatus} from '../lib/platform';
import {aiActivity,aiStatusRows,LOCATION_FI,onAiActivity,type AiStatusInput,type AiStatusRow} from '../lib/ai-status';

/** Tekoäly-paneelin sisältö: vain todelliset tilat. Ei toimintopainikkeita; ulkoasu ja sijainti viimeistellään UI/UX:ssä. */
export function AiPanelView({rows,loading}:{rows:AiStatusRow[];loading:boolean}){
 return <div className="ai-status" aria-busy={loading}>
  <p className="panel-note">Tekoäly ehdottaa ja avustaa. Säännöt ja sinun hyväksyntäsi ratkaisevat, mitä projektiin tulee. Paikalliset ominaisuudet toimivat tällä koneella. Pilveen ei lähetetä mitään ilman käyttöönottoa ja erillistä lupaa jokaiselle lähetykselle.</p>
  {loading&&<p className="panel-note" role="status">Luetaan tiloja…</p>}
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

/** Pilven todelliset toiminnot pääprosessin kautta. Jokainen muutos vahvistetaan natiivissa dialogissa; arvot eivät tule tähän ikkunaan. */
export function CloudControls({status,busy,act,onOpenCloud}:{status:CloudStatus;busy:boolean;act:(name:'enable'|'disable'|'paste-url'|'paste-bearer'|'import'|'clear'|'free-colab'|'free-notebook'|'unfree-colab'|'unfree-notebook'|'pins-import'|'pins-clear')=>void;onOpenCloud?:()=>void}){
 if(!status.available)return null;
 const keys=Object.entries(status.secrets.keys) as [CloudSecretKey,{label:string;set:boolean}][];
 return <section aria-label="Pilvirenderöinnin asetukset" className="ai-cloud-controls"><h3>Pilvirenderöinnin asetukset</h3>
  {!status.enabled?<><p className="panel-note">Pilvirenderöinti on pois päältä. Mitään ei lähetetä koneelta, ennen kuin otat sen käyttöön ja hyväksyt kunkin lähetyksen erikseen.</p><button type="button" className="secondary" disabled={busy} onClick={()=>act('enable')}>Ota pilvirenderöinti käyttöön…</button></>:<>
   <ul>{keys.map(([k,v])=><li key={k}>{v.label}: {v.set?'asetettu':'ei asetettu'}</li>)}<li>Tallennus: {status.storage==='google-drive'?'Google Drive':status.storage?'tämä kone':'selviää ensimmäisellä käytöllä'}</li></ul>
   <p className="panel-note">Asetukset luetaan leikepöydältä tai tiedostosta suoraan sovelluksen taustalle; ne eivät näy tässä ikkunassa.</p>
   <button type="button" className="secondary" disabled={busy||!status.secrets.encryption} onClick={()=>act('paste-url')}>Liitä tunnelin osoite leikepöydältä…</button> <button type="button" className="secondary" disabled={busy||!status.secrets.encryption} onClick={()=>act('paste-bearer')}>Liitä tunnelin tunnus leikepöydältä…</button> <button type="button" className="secondary" disabled={busy||!status.secrets.encryption} onClick={()=>act('import')}>Tuo asetustiedosto…</button> <button type="button" className="secondary" disabled={busy||!keys.some(([,v])=>v.set)} onClick={()=>act('clear')}>Poista tallennetut asetukset</button>
   <p>Ilmaiseksi vahvistetut ajoympäristöt: ComfyUI-tunneli {status.settings.colabClassifiedFree?'vahvistettu':'ei vahvistettu'} · Kaggle-muistikirja {status.settings.notebookClassifiedFree?'vahvistettu':'ei vahvistettu'}</p>
   <button type="button" className="secondary" disabled={busy} onClick={()=>act(status.settings.notebookClassifiedFree?'unfree-notebook':'free-notebook')}>{status.settings.notebookClassifiedFree?'Peru Kaggle-vahvistus':'Vahvista Kaggle-muistikirja ilmaiseksi…'}</button> <button type="button" className="secondary" disabled={busy} onClick={()=>act(status.settings.colabClassifiedFree?'unfree-colab':'free-colab')}>{status.settings.colabClassifiedFree?'Peru tunnelivahvistus':'Vahvista ComfyUI-tunneli ilmaiseksi…'}</button>
   <p>Mallien lukitus (revisio ja SHA-256): {status.modelPins?'tuotu':'ei tuotu; renderöinti on estetty ilman lukittua mallia'}</p>
   <button type="button" className="secondary" disabled={busy} onClick={()=>act('pins-import')}>Tuo mallien lukitus…</button>{status.modelPins&&<> <button type="button" className="secondary" disabled={busy} onClick={()=>act('pins-clear')}>Poista mallien lukitus</button></>}
   <p>{onOpenCloud&&<button type="button" className="primary" disabled={busy} onClick={onOpenCloud}>Avaa pilvirenderöinti…</button>} <button type="button" className="secondary" disabled={busy} onClick={()=>act('disable')}>Poista pilvirenderöinti käytöstä</button></p>
  </>}
 </section>;
}

async function cameraPermission():Promise<AiStatusInput['camera']>{
 try{const s=await navigator.permissions.query({name:'camera' as PermissionName});return s.state;}catch{return 'unknown';}
}

export default function AiPanel({onClose,onOpenCloud}:{onClose:()=>void;onOpenCloud?:()=>void}){
 const [input,setInput]=useState<AiStatusInput>({}),[loading,setLoading]=useState(true),[tick,setTick]=useState(0),[cloud,setCloud]=useState<CloudStatus|null|undefined>(undefined),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const box=useRef<HTMLDivElement>(null);
 useEffect(()=>{box.current?.focus();const key=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose();};document.addEventListener('keydown',key);return()=>document.removeEventListener('keydown',key);},[]);
 useEffect(()=>onAiActivity(()=>setTick(n=>n+1)),[]);
 useEffect(()=>{let live=true;const bridge=desktop();void(async()=>{
  const [audioModel,kokoro,camera,cloudState]=await Promise.all([bridge?bridge.audioModel().catch(()=>null):Promise.resolve(undefined),bridge?bridge.kokoroStatus().catch(e=>({installed:false,error:e instanceof Error?e.message:'Tila ei luettavissa'})):Promise.resolve(undefined),cameraPermission(),bridge?bridge.cloudStatus().catch(()=>null):Promise.resolve(null)]);
  if(live){setInput({audioModel,kokoro,camera});setCloud(cloudState);setLoading(false);}
 })();return()=>{live=false;};},[]);
 const act=async(name:Parameters<typeof CloudControls>[0]['act'] extends (n:infer N)=>void?N:never)=>{const bridge=desktop();if(!bridge)return;setBusy(true);setMessage('');try{
  const key:Record<string,CloudSecretKey>={'paste-url':'HAHMOSTUDIO_COLAB_COMFYUI_URL','paste-bearer':'HAHMOSTUDIO_COMFYUI_BEARER'};
  if(name==='enable')setCloud(await bridge.cloudEnable());else if(name==='disable')setCloud(await bridge.cloudDisable());
  else if(name in key){const r=await bridge.cloudSecretPaste(key[name]);setMessage(r.saved.length?'Tallennettu.':'Ei tallennettu.');setCloud(await bridge.cloudStatus());}
  else if(name==='import'){const r=await bridge.cloudSecretImport();setMessage(r.saved.length?`Tallennettu ${r.saved.length} asetusta.`+(r.ignored.length?` Ohitettu: ${r.ignored.join(', ')}.`:''):'Ei tallennettu.');setCloud(await bridge.cloudStatus());}
  else if(name==='clear')setCloud(await bridge.cloudSecretClear('all'));
  else if(name==='pins-import')setCloud(await bridge.cloudPinsImport());else if(name==='pins-clear')setCloud(await bridge.cloudPinsClear());
  else{const [, kind]=name.split('-') as [string,'colab'|'notebook'];setCloud(await bridge.cloudDeclareFree(kind,!name.startsWith('unfree')));}
 }catch(e){setMessage(e instanceof Error?e.message:'Toiminto epäonnistui.');}finally{setBusy(false);}};
 // Pilvirivi näytetään vasta, kun tila on luettu; jos luku epäonnistui, rivi kertoo ettei pilvi ole saatavilla.
 const rows=aiStatusRows({...input,cloud:cloud===undefined?undefined:cloud??{available:false},activity:aiActivity()});void tick;
 return createPortal(<div className="export-backdrop studio-export"><div role="dialog" aria-modal="true" aria-labelledby="ai-title" className="export-dialog" ref={box} tabIndex={-1}>
  <header><h2 id="ai-title">Tekoäly</h2><button className="secondary" onClick={onClose}>Sulje</button></header>
  <AiPanelView rows={rows} loading={loading}/>
  {cloud&&<CloudControls status={cloud} busy={busy} act={n=>void act(n)} onOpenCloud={onOpenCloud}/>}
  {message&&<p role="status">{message}</p>}
 </div></div>,document.body);
}
