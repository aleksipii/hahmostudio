import {useMemo,useRef,useState,type KeyboardEvent,type PointerEvent as ReactPointerEvent,type DragEvent} from 'react';
import {presentationBlocks,blockLibrary,blockKindNames,motionNames,expressionNames,displayName,type Block,type BlockParams} from '../lib/blocks';
import type {Presentation} from '../lib/presentation-model';
import {characterStateMachine,characterSpans} from '../lib/character-states';

export type BlockCommand=
 |{kind:'move';id:string;time:number}
 |{kind:'stretch';id:string;seconds:number}
 |{kind:'delete';id:string}
 |{kind:'duplicate';id:string}
 |{kind:'update';id:string;change:{value?:string;params?:Partial<BlockParams>}}
 |{kind:'insert';item:number;lane:string;time:number};

const fmt=(n:number)=>(Math.round(n*100)/100).toString().replace('.',',');
const laneName=(lane:string)=>lane==='kamera'?'Kamera':lane==='näyttämö'?'Näyttämö':lane==='ääni'?'Ääni':displayName(lane);
/** Ruudunlukijan nimi: hahmo · tyyppi: nimi · alku · kesto. */
export const blockAria=(b:Block)=>`${b.lane} · ${blockKindNames[b.kind]}: ${b.label} · alkaa ${fmt(b.start)} s · kesto ${fmt(b.duration)} s`;

/**
 * Palikka-aikajana (Rive-tyyliin): raidat hahmoittain sekä kamera, näyttämö ja ääni. Palikan voi vetää (ajoitus),
 * venyttää oikeasta reunasta (kesto), kopioida ja poistaa. Näppäimistö: ←/→ siirtää edellisen/seuraavan palikan
 * kohdalle, Vaihto+←/→ lyhentää/pidentää 0,5 s, Delete poistaa, Ctrl/⌘+D kopioi, Enter avaa ominaisuudet.
 * Kirjaston palikan voi vetää raidalle tai lisätä Enterillä toistopisteeseen.
 */
export default function BlockTimeline({presentation,selected,onSelect,onCommand,disabled,playhead=0,pixelsPerSecond=48}:{presentation:Presentation;selected?:string;onSelect:(id:string|undefined)=>void;onCommand:(c:BlockCommand)=>void;disabled:boolean;playhead?:number;pixelsPerSecond?:number}){
 const blocks=useMemo(()=>presentationBlocks(presentation),[presentation]);
 const lanes=useMemo(()=>[...presentation.characters,'kamera','näyttämö','ääni'],[presentation.characters]);
 const [drag,setDrag]=useState<{id:string;mode:'move'|'stretch';x:number;dx:number}|undefined>();
 const [libraryLane,setLibraryLane]=useState(presentation.characters[0]??'');
 const width=Math.max(320,(presentation.seconds+1)*pixelsPerSecond);
 const ordered=blocks.filter(b=>b.editable);
 const neighbour=(b:Block,dir:-1|1)=>{const i=ordered.findIndex(x=>x.id===b.id);return ordered[i+dir];};
 const onKey=(e:KeyboardEvent,b:Block)=>{if(disabled)return;
  if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(b.id);return;}
  if(!b.editable)return;
  if((e.key==='ArrowLeft'||e.key==='ArrowRight')&&e.shiftKey){e.preventDefault();if(b.params.seconds!==undefined)onCommand({kind:'stretch',id:b.id,seconds:b.params.seconds+(e.key==='ArrowRight'?.5:-.5)});return;}
  if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();const n=neighbour(b,e.key==='ArrowLeft'?-1:1);if(n)onCommand({kind:'move',id:b.id,time:e.key==='ArrowLeft'?n.start:n.start+n.duration+.001});return;}
  if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();onCommand({kind:'delete',id:b.id});return;}
  if((e.key==='d'||e.key==='D')&&(e.metaKey||e.ctrlKey)){e.preventDefault();onCommand({kind:'duplicate',id:b.id});}
 };
 const down=(e:ReactPointerEvent,b:Block,mode:'move'|'stretch')=>{if(disabled||!b.editable)return;e.stopPropagation();(e.currentTarget as Element).setPointerCapture?.(e.pointerId);setDrag({id:b.id,mode,x:e.clientX,dx:0});onSelect(b.id);};
 const move=(e:ReactPointerEvent)=>{if(drag)setDrag({...drag,dx:e.clientX-drag.x});};
 const up=()=>{if(!drag)return;const b=blocks.find(x=>x.id===drag.id),d=drag;setDrag(undefined);if(!b||Math.abs(d.dx)<3)return;
  if(d.mode==='move')onCommand({kind:'move',id:b.id,time:Math.max(0,b.start+d.dx/pixelsPerSecond)});else if(b.params.seconds!==undefined)onCommand({kind:'stretch',id:b.id,seconds:b.params.seconds+d.dx/pixelsPerSecond});};
 const drop=(e:DragEvent,lane:string)=>{const item=Number(e.dataTransfer.getData('application/x-hahmo-block'));if(!Number.isInteger(item)||disabled)return;e.preventDefault();const rect=(e.currentTarget as HTMLElement).getBoundingClientRect();onCommand({kind:'insert',item,lane:blockLibrary[item].kind==='kamera'?'kamera':lane,time:Math.max(0,(e.clientX-rect.left)/pixelsPerSecond)});};
 const current=blocks.find(b=>b.id===selected);
 return <section className="block-editor" aria-label="Palikkaeditori">
  <div className="block-library" role="toolbar" aria-label="Palikkakirjasto: vedä raidalle tai paina Enter lisätäksesi toistopisteeseen">
   <label>Hahmolle<select value={libraryLane} disabled={disabled} onChange={e=>setLibraryLane(e.target.value)}>{presentation.characters.map(c=><option key={c} value={c}>{displayName(c)}</option>)}</select></label>
   {blockLibrary.map((item,i)=><button type="button" key={item.label} className={`block-chip block-chip--${item.kind}`} draggable={!disabled} disabled={disabled||!libraryLane} onDragStart={e=>{e.dataTransfer.setData('application/x-hahmo-block',String(i));e.dataTransfer.effectAllowed='copy';}} onClick={()=>onCommand({kind:'insert',item:i,lane:item.kind==='kamera'?'kamera':libraryLane,time:playhead})} aria-label={`Lisää ${item.label} hahmolle ${displayName(libraryLane)} kohtaan ${fmt(playhead)} s`}>{item.label}</button>)}
  </div>
  <div className="block-timeline" role="application" aria-label="Palikka-aikajana" aria-roledescription="aikajana" onPointerMove={move} onPointerUp={up} onPointerCancel={()=>setDrag(undefined)}>
   <div className="block-ruler" style={{width}} aria-hidden="true">{Array.from({length:Math.ceil(presentation.seconds)+1},(_,s)=><span key={s} style={{left:s*pixelsPerSecond}}>{s} s</span>)}<i className="block-playhead" style={{left:playhead*pixelsPerSecond}}/></div>
   {lanes.map(lane=><div key={lane} className="block-lane" data-lane={lane} role="group" aria-label={'Raita: '+laneName(lane)} onDragOver={e=>{if(e.dataTransfer.types.includes('application/x-hahmo-block')){e.preventDefault();e.dataTransfer.dropEffect='copy';}}} onDrop={e=>drop(e,lane)}>
    <span className="block-lane__name">{laneName(lane)}</span>
    <div className="block-lane__track" style={{width}}>
     {blocks.filter(b=>b.lane===lane).map(b=>{const d=drag?.id===b.id?drag:undefined,left=b.start*pixelsPerSecond+(d?.mode==='move'?d.dx:0),w=Math.max(18,(b.duration||.3)*pixelsPerSecond+(d?.mode==='stretch'?d.dx:0));
      return <div key={b.id} className={`block block--${b.kind}${b.id===selected?' is-selected':''}${b.editable?'':' is-derived'}`} style={{left,width:w}} role="button" tabIndex={0} aria-pressed={b.id===selected} aria-label={blockAria(b)} aria-keyshortcuts="Enter ArrowLeft ArrowRight Shift+ArrowLeft Shift+ArrowRight Delete Control+D Meta+D" title={b.editable?b.lineText.trim():'Johdettu palikka (automaattinen kuva tai tehoste)'} onKeyDown={e=>onKey(e,b)} onClick={()=>onSelect(b.id)} onPointerDown={e=>down(e,b,'move')}>
       <span className="block__label">{b.label}</span>{b.editable&&b.params.seconds!==undefined&&<span className="block__handle" aria-hidden="true" onPointerDown={e=>down(e,b,'stretch')}/>}
      </div>;})}
    </div>
   </div>)}
  </div>
  {current&&<BlockInspector block={current} characters={presentation.characters} disabled={disabled||!current.editable} onCommand={onCommand}/>}
  <details className="block-states"><summary>Hahmojen tilat (tilakone)</summary>{presentation.characters.map(c=>{const m=characterStateMachine(presentation,c),spans=characterSpans(presentation,c);return <div key={c} className="block-states__row"><strong>{displayName(c)}</strong><ol aria-label={'Tilat: '+displayName(c)}>{spans.map((s,i)=><li key={i} className={'state-'+s.state.toLocaleLowerCase('fi-FI')}>{s.state} {fmt(s.start)}–{fmt(s.end)} s</li>)}</ol><p className="panel-note">{m.states.length} tilaa · {m.transitions.length} siirtymää: {m.transitions.map(t=>`${m.states.find(s=>s.id===t.fromState)?.name} → ${m.states.find(s=>s.id===t.toState)?.name} (${t.conditions[0]?.value})`).join(', ')}</p></div>;})}</details>
 </section>;
}

function BlockInspector({block,characters,disabled,onCommand}:{block:Block;characters:string[];disabled:boolean;onCommand:(c:BlockCommand)=>void}){
 const motionOptions=Object.entries(motionNames).filter(([k])=>!k.startsWith('react-nod')&&k!=='react-wave');
 return <fieldset className="block-inspector" disabled={disabled}><legend>{blockKindNames[block.kind]} · {displayName(block.lane)}</legend>
  {block.kind==='liike'&&<label>Liike<select value={block.value.replace(/-(left|right|front)$/,(m)=>m)} onChange={e=>onCommand({kind:'update',id:block.id,change:{value:e.target.value}})}>{motionOptions.map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>}
  {block.kind==='liike'&&/^(walk|run)-/.test(block.value)&&<label>Suunta<select value={block.params.direction} onChange={e=>onCommand({kind:'update',id:block.id,change:{params:{direction:e.target.value as 'left'}}})}><option value="left">Vasemmalle</option><option value="right">Oikealle</option><option value="front">Kohti kameraa</option></select></label>}
  {block.kind==='ilme'&&<label>Ilme<select value={block.value} onChange={e=>onCommand({kind:'update',id:block.id,change:{value:e.target.value}})}>{Object.entries(expressionNames).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>}
  {block.kind==='katse'&&<label>Kohde<select value={block.value} onChange={e=>onCommand({kind:'update',id:block.id,change:{params:{target:e.target.value}}})}><option value="camera">Kameraan</option><option value="phone">Puhelimeen</option>{characters.filter(c=>c!==block.lane).map(c=><option key={c} value={c}>{displayName(c)}</option>)}</select></label>}
  {block.kind==='kamera'&&<label>Kuvakoko<select value={block.value} onChange={e=>onCommand({kind:'update',id:block.id,change:{params:{size:e.target.value}}})}><option value="wide">Laaja</option><option value="medium">Puolikuva</option><option value="close">Lähikuva</option></select></label>}
  {block.params.seconds!==undefined&&<label>Kesto (s)<input type="number" min={block.kind==='liike'?.5:.1} max={block.kind==='liike'?20:60} step={.1} defaultValue={block.params.seconds} key={block.id+block.params.seconds} onBlur={e=>{const v=Number(e.target.value);if(Number.isFinite(v)&&v!==block.params.seconds)onCommand({kind:'stretch',id:block.id,seconds:v});}}/></label>}
  <p className="panel-note">Lähde rivillä {block.line}: <code>{block.lineText.trim()}</code></p>
  <div className="row"><button type="button" className="secondary" onClick={()=>onCommand({kind:'duplicate',id:block.id})}>Kopioi</button><button type="button" className="secondary" onClick={()=>onCommand({kind:'delete',id:block.id})}>Poista</button></div>
 </fieldset>;
}
