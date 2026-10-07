import {useMemo,useState} from 'react';
import {X} from 'lucide-react';
import type {PsdDocument} from '../lib/psd-model';
import {roles,type Rig} from '../lib/rig-model';
import {suggestRig} from '../lib/rig-suggest';

/** Ohjattu hahmon luonti: näyttää nimistä lasketut roolit, liitokset, pivotit ja tartuntapisteet; vahvistus kirjoittaa rigin. */
export default function RigSuggestDialog({doc,rig,busy,onApply,onClose}:{doc:PsdDocument;rig:Rig;busy:boolean;onApply:(next:Rig)=>void;onClose:()=>void}){
 const [onlyUnassigned,setOnlyUnassigned]=useState(true);
 const result=useMemo(()=>suggestRig(doc,rig,{onlyUnassigned}),[doc,rig,onlyUnassigned]);
 const fmt=(n:number)=>Math.round(n);
 return <div className="modal-backdrop" onClick={onClose}><section className="help-modal rig-suggest" role="dialog" aria-modal="true" aria-labelledby="rig-suggest-title" onClick={e=>e.stopPropagation()} onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();onClose();}}}>
  <div className="modal-heading"><h2 id="rig-suggest-title">Ehdota nivelet tasojen nimistä</h2><button autoFocus className="secondary" onClick={onClose}><X size={16}/>Sulje</button></div>
  <p className="panel-note">Ehdotus perustuu tasojen nimiin (suomi tai englanti, esim. Pää, Vartalo, Käsi, Hand, Leg) ja tasojen sijaintiin. Se ei tunnista kuvaa: nimeämättömiä tasoja ei arvata. Tarkista lista ja hienosäädä pivotit rig-työkalulla.</p>
  <label className="check-row"><input type="checkbox" checked={onlyUnassigned} onChange={e=>setOnlyUnassigned(e.target.checked)}/> Koske vain osiin, joilla ei ole roolia (säilyttää käsin tehdyn työn)</label>
  {result.suggestions.length?<table className="rig-suggest__table"><caption className="visually-hidden">Ehdotetut roolit</caption><thead><tr><th scope="col">Taso</th><th scope="col">Rooli</th><th scope="col">Liitetty</th><th scope="col">Pivot</th><th scope="col">Nivel</th><th scope="col">Tartunta</th></tr></thead><tbody>{result.suggestions.map(s=><tr key={s.key}><th scope="row">{s.name}</th><td>{roles[s.role]}{s.side?(s.side==='left'?' (vasen)':' (oikea)'):''}</td><td>{s.parentName??'—'}</td><td>{fmt(s.pivot.x)}, {fmt(s.pivot.y)}</td><td>{s.joints.map(j=>`${fmt(j.x)}, ${fmt(j.y)}`).join(' · ')||'—'}</td><td>{s.grip?`${fmt(s.grip.x)}, ${fmt(s.grip.y)}`:'—'}</td></tr>)}</tbody></table>:<p role="status">Ehdotettavaa ei löytynyt.</p>}
  {result.unrecognized.length>0&&<details><summary>Ilman roolia jäävät tasot ({result.unrecognized.length})</summary><ul>{result.unrecognized.map(u=><li key={u.key}>{u.name}</li>)}</ul></details>}
  {result.notes.map(n=><p key={n} className="panel-note" role="note">{n}</p>)}
  <p className="panel-note">Tartuntapiste on kämmentason keskipiste; se näytetään tarkistusta varten eikä muuta pakettia. Muutos on yksi kumottava muokkaus.</p>
  <div className="row"><button type="button" disabled={busy||!result.suggestions.length} onClick={()=>onApply(result.rig)}>Käytä ehdotusta ({result.suggestions.length} osaa)</button><button type="button" className="secondary" onClick={onClose}>Peruuta</button></div>
 </section></div>;
}
