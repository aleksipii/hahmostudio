import {useState} from 'react';
import type {Shot} from '../lib/studio/domain';
import type {BatchTaskCommand} from '../lib/studio/shot-tasks';
type Mode='keep'|'set'|'clear';
export default function BatchShotTaskEditor({shots,disabled,save}:{shots:Shot[];disabled:boolean;save:(c:BatchTaskCommand)=>boolean|Promise<boolean>}){
 const [ownerMode,setOwnerMode]=useState<Mode>('keep'),[dateMode,setDateMode]=useState<Mode>('keep'),[owner,setOwner]=useState(''),[date,setDate]=useState('');
 const field=(name:string,mode:Mode,set:(v:Mode)=>void)=><label>{name}<select value={mode} disabled={disabled} onChange={e=>set(e.target.value as Mode)}><option value="keep">Säilytä nykyinen</option><option value="set">Aseta kaikille</option><option value="clear">Tyhjennä kaikilta</option></select></label>;
 return <details className="studio-task-editor"><summary>Muokkaa työjonoa yhdessä · {shots.length} suodatettua kuvaa</summary><p>Kohteena ovat kaikki nykyisen haun ja suodatuksen kuvat, myös muilla sivuilla. Hyväksynnät, lukitukset ja animaatio säilyvät. Yksi Kumoa palauttaa koko muutoksen.</p><form onSubmit={async e=>{e.preventDefault();const ids=shots.map(s=>s.id);if(window.confirm('Muuta '+ids.length+' kuvan työjonotietoja?\n'+(ownerMode==='keep'?'Vastuu säilyy':ownerMode==='clear'?'Vastuu tyhjennetään':'Vastuu: '+owner.trim())+'\n'+(dateMode==='keep'?'Määräaika säilyy':dateMode==='clear'?'Määräaika tyhjennetään':'Määräaika: '+date))&&await save({shotIds:ids,...(ownerMode==='keep'?{}:{owner:ownerMode==='clear'?'':owner}),...(dateMode==='keep'?{}:{dueDate:dateMode==='clear'?'':date})})){setOwnerMode('keep');setDateMode('keep');}}}>
 {field('Vastuuhenkilö',ownerMode,setOwnerMode)}{ownerMode==='set'&&<label>Uusi vastuuhenkilö<input required maxLength={120} value={owner} disabled={disabled} onChange={e=>setOwner(e.target.value)} pattern=".*\S.*"/></label>}
 {field('Määräaika',dateMode,setDateMode)}{dateMode==='set'&&<label>Uusi määräaika<input required type="date" min="1000-01-01" max="9999-12-31" value={date} disabled={disabled} onChange={e=>setDate(e.target.value)}/></label>}
 <button disabled={disabled||!shots.length||ownerMode==='keep'&&dateMode==='keep'}>Tarkista ja muuta {shots.length} kuvaa</button></form></details>;
}
