import {useState,useEffect} from 'react';
import type {Shot} from '../lib/studio/domain';
import type {ShotTask,TaskCommand} from '../lib/studio/shot-tasks';
export default function ShotTaskEditor({shot,task,disabled,save}:{shot:Shot;task?:ShotTask;disabled:boolean;save:(c:TaskCommand)=>boolean|Promise<boolean>}){
 const [owner,setOwner]=useState(task?.owner??''),[dueDate,setDueDate]=useState(task?.dueDate??''),[savedValues,setSavedValues]=useState<{owner:string;dueDate:string}|null>(null);
 useEffect(()=>{setOwner(task?.owner??'');setDueDate(task?.dueDate??'');},[task?.owner,task?.dueDate]);
 const saved=!!savedValues&&savedValues.owner===(task?.owner??'')&&savedValues.dueDate===(task?.dueDate??'');
 return <details className="studio-task-editor"><summary>{shot.name} · vastuuhenkilö ja määräaika</summary><p>Paikalliset työjonotiedot eivät muuta kuvan hyväksyntää, lukitusta tai animaatiota.</p><form onSubmit={async e=>{e.preventDefault();setSavedValues(await save({shotId:shot.id,owner,dueDate})?{owner:owner.trim(),dueDate}:null);}}><label>Vastuuhenkilö<input value={owner} maxLength={120} disabled={disabled} placeholder="Esim. oma nimi" onChange={e=>{setOwner(e.target.value);setSavedValues(null);}}/></label><label>Määräaika<input type="date" value={dueDate} min="1000-01-01" max="9999-12-31" disabled={disabled} onChange={e=>{setDueDate(e.target.value);setSavedValues(null);}}/></label><button disabled={disabled}>Tallenna työjonotiedot</button><button type="button" disabled={disabled||!task} onClick={async()=>{if(await save({shotId:shot.id,owner:'',dueDate:''})){setOwner('');setDueDate('');setSavedValues({owner:'',dueDate:''});}}}>Poista vastuu ja määräaika</button><p role="status">{saved?'Työjonotiedot tallennettu valmisteluun.':''}</p></form></details>;
}
