import {useEffect,useRef,useState} from 'react';
import {EASING_PRESETS,cloneBezierCurve,sampleBezierCurve,type BezierCurve} from '../lib/easing-model';
export interface EasingEditorProps {curve:BezierCurve; disabled?:boolean; onChange:(curve:BezierCurve)=>void|Promise<unknown>}
export default function EasingEditor({curve,disabled=false,onChange}:EasingEditorProps){
 const [draft,setDraft]=useState(curve),[time,setTime]=useState(.5);
 const pending=useRef(curve),drag=useRef<'cp1'|'cp2'|null>(null);
 useEffect(()=>{setDraft(curve);pending.current=curve;},[curve]);
 const update=(next:BezierCurve)=>{pending.current=next;setDraft(next);};
 const commit=(next:BezierCurve)=>{update(next);void onChange(cloneBezierCurve(next));};
 const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
 return <section className="easing-editor" aria-label="Avainruudun siirtymäkäyrä"><p>Käyrä määrää siirtymän tästä avainruudusta seuraavaan. Vedä CP1/CP2-pisteitä tai käytä nuolinäppäimiä.</p>
 <div className="easing-presets">{(['linear','easeIn','easeOut','easeInOut'] as const).map(id=><button className="button" key={id} disabled={disabled} aria-pressed={JSON.stringify(draft)===JSON.stringify(EASING_PRESETS[id].curve)} onClick={()=>commit(EASING_PRESETS[id].curve)}>{EASING_PRESETS[id].name}</button>)}</div>
 <svg className="easing-curve" viewBox="-20 -70 240 340" aria-label="Bézier-käyrä: vaaka-akseli aika, pystyakseli liike" onPointerMove={e=>{if(!drag.current||disabled)return;const rect=e.currentTarget.getBoundingClientRect();const x=clamp(((e.clientX-rect.left)/rect.width*240-20)/200,0,1),y=clamp(1-((e.clientY-rect.top)/rect.height*340-70)/200,-.25,1.25);update({...pending.current,[drag.current]:{x,y}});}} onPointerUp={e=>{if(drag.current){drag.current=null;e.currentTarget.releasePointerCapture(e.pointerId);commit(pending.current);}}} onPointerCancel={()=>{drag.current=null;update(curve);}}>
 <path className="curve-grid" d="M0 0H200V200H0Z M0 100H200 M100 0V200"/>
 <path className="curve-handle" d={`M0 200L${draft.cp1.x*200} ${200-draft.cp1.y*200} M200 0L${draft.cp2.x*200} ${200-draft.cp2.y*200}`}/>
 <path className="curve-line" d={`M0 200 C${draft.cp1.x*200} ${200-draft.cp1.y*200},${draft.cp2.x*200} ${200-draft.cp2.y*200},200 0`}/>
 <circle className="curve-preview" cx={time*200} cy={200-sampleBezierCurve(draft,time)*200} r="5"/>
 {(['cp1','cp2'] as const).map(point=><g key={point}><circle className="curve-control" cx={draft[point].x*200} cy={200-draft[point].y*200} r="8" role="button" tabIndex={disabled?-1:0} aria-disabled={disabled} aria-label={`${point.toUpperCase()}: X ${draft[point].x.toFixed(2)}, Y ${draft[point].y.toFixed(2)}`} onPointerDown={e=>{if(disabled)return;drag.current=point;e.currentTarget.ownerSVGElement!.setPointerCapture(e.pointerId);}} onKeyDown={e=>{if(disabled||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();e.stopPropagation();const step=e.shiftKey?.1:.01;commit({...draft,[point]:{x:clamp(draft[point].x+(e.key==='ArrowRight'?step:e.key==='ArrowLeft'?-step:0),0,1),y:clamp(draft[point].y+(e.key==='ArrowUp'?step:e.key==='ArrowDown'?-step:0),-.25,1.25)}});}}/><text x={draft[point].x*200} y={185-draft[point].y*200}>{point.toUpperCase()}</text></g>)}
 </svg><label>Esikatselun aika<input type="range" min="0" max="1" step=".01" value={time} onChange={e=>setTime(Number(e.target.value))}/></label><output>Liike {Math.round(sampleBezierCurve(draft,time)*100)} %</output>
 </section>;
}
