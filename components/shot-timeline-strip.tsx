import {useEffect,useMemo,useRef,useState} from 'react';
import {adaptPresentation,seconds,type Shot} from '../lib/studio/domain';
import {SHOT_TIMELINE_GAP,shotTimelinePlayhead,shotTimelineSegments,visibleShotSegments} from '../lib/shot-timeline-layout';
import {loadPresentationVoiceEnvelopes,shotWaveformRail,type DecodedVoiceEnvelope} from '../lib/shot-audio-envelope';
import type {PresentationAudio} from '../lib/presentation-audio';
import ShotThumb from './shot-thumb';
import type {Presentation} from '../lib/presentation-model';
import type {PresentationAssets} from '../lib/presentation-compile';

export default function ShotTimelineStrip({presentation,assets,voices,fps,frame,disabled,selectedEvent,onChoose}:{presentation:Presentation;assets?:PresentationAssets;voices?:Record<string,PresentationAudio>;fps:number;frame:number;disabled:boolean;selectedEvent?:string;onChoose:(shot:Shot,eventId?:string)=>void}){
 const episode=useMemo(()=>adaptPresentation(presentation),[presentation]);
 const layout=useMemo(()=>shotTimelineSegments(episode.shots),[episode.shots]);
 const totalSeconds=Math.max(presentation.seconds,.001);
 const playhead=frame/fps;
 const scrollRef=useRef<HTMLDivElement>(null);
 const [scroll,setScroll]=useState(0);
 const [viewport,setViewport]=useState(640);
 const [envelopes,setEnvelopes]=useState<Map<string,DecodedVoiceEnvelope>>(new Map());
 useEffect(()=>{const node=scrollRef.current;if(!node)return;const ro=new ResizeObserver(()=>setViewport(node.clientWidth||640));ro.observe(node);setViewport(node.clientWidth||640);return()=>ro.disconnect();},[]);
 useEffect(()=>{
  if(!voices||!Object.values(voices).some(v=>v?.blob?.size)){setEnvelopes(new Map());return;}
  let cancelled=false;
  void loadPresentationVoiceEnvelopes(voices).then(map=>{if(!cancelled)setEnvelopes(map);}).catch(()=>{if(!cancelled)setEnvelopes(new Map());});
  return()=>{cancelled=true;};
 },[voices]);
 const rails=useMemo(()=>new Map(episode.shots.map(s=>[s.id,shotWaveformRail(presentation,s,envelopes)])),[presentation,episode.shots,envelopes]);
 const visible=visibleShotSegments(layout.segments,scroll,viewport);
 const active=episode.shots.find(s=>s.sourceEventId===selectedEvent||s.eventIds.includes(selectedEvent??''));
 const statusLabel=(s:Shot['status'])=>s==='locked'?'Lukittu':s==='approved'?'Hyväksytty':'';
 const playheadLeft=shotTimelinePlayhead(layout.segments,totalSeconds,playhead);
 return <section className="shot-timeline-strip" aria-label="Jakson kuvat aikajanalla"><div className="shot-timeline-scroll" ref={scrollRef} onScroll={e=>setScroll(e.currentTarget.scrollLeft)}><div className="shot-timeline-track" style={{width:layout.trackWidth}}>{visible.map(seg=>{const shot=episode.shots[seg.index];if(!shot)return null;const event=presentation.events.find(e=>e.id===shot.sourceEventId)??presentation.events.find(e=>shot.eventIds.includes(e.id));const rail=rails.get(shot.id)!;return <button key={shot.id} className={active?.id===shot.id?'active':''} disabled={disabled} aria-pressed={active?.id===shot.id} style={{left:seg.left,width:Math.max(4,seg.width-SHOT_TIMELINE_GAP),minWidth:Math.max(4,seg.width-SHOT_TIMELINE_GAP)}} title={`${shot.name} · ${seconds(shot.at).toFixed(2)} s · ${seg.duration.toFixed(2)} s`} onClick={()=>onChoose(shot)}>{assets&&event&&<ShotThumb presentation={presentation} assets={assets} event={{...event,at:seconds(shot.at)}} width={Math.min(120,Math.max(48,seg.width-12))} height={40}/>}<span>{shot.name.replace(/^Kuva /,'')}</span>{statusLabel(shot.status)&&<small>{statusLabel(shot.status)}</small>}<svg className="shot-mini-waveform" viewBox={`0 0 ${rail.levels.length} 4`} preserveAspectRatio="none" aria-hidden>{rail.levels.map((v,j)=><rect key={j} x={j} y={4-v*4} width=".9" height={v*4} fill={rail.hasDialogue?(rail.decoded?'#0a7a3d':'#1266cc'):'#8a9bab'} opacity={v?1:.25}/>)}</svg></button>;})}<div className="shot-timeline-playhead" style={{left:playheadLeft}} aria-hidden/></div></div><p className="panel-note">Kuvat · {episode.shots.length} kpl · keston mukainen kisko · yhteinen toistopää {playhead.toFixed(2)} s{envelopes.size?` · ${envelopes.size} äänidekoodattu`:''}.</p></section>;
}
