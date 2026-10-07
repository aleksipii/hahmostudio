/**
 * Hahmon tilakone esityksestä (vaihe F): lepo, puhe, kävely, juoksu, ele, reaktio ja istuminen sekä siirtymät
 * tapahtumaehdoilla, kuten Riven state machinessa. Johdettu näkymä: tilat ja ehdot lasketaan palikoista eikä niitä
 * tallenneta erikseen (yksi totuuslähde: käsikirjoitus). Deterministinen tunnisteistus.
 */
import {stateId,transitionId,parameterId,type StateMachine,type StateId} from './state-machine-model.ts';
import type {Presentation} from './presentation-model.ts';

export type CharacterStateName='Lepo'|'Puhe'|'Kävely'|'Juoksu'|'Ele'|'Reaktio'|'Istuu';
export type StateSpan={state:CharacterStateName;start:number;end:number;event?:string;value?:string};
const stateFor=(kind:string,value:string):CharacterStateName|undefined=>kind==='dialogue'?'Puhe':kind!=='action'?undefined:value.startsWith('walk')?'Kävely':value.startsWith('run')?'Juoksu':value==='sit'?'Istuu':value.startsWith('react')||value==='jump'||value==='crouch'?'Reaktio':value==='stop'?undefined:'Ele';

/** Hahmon tilat aikajanalla: tapahtumien väliin jää lepo; istuminen jatkuu seuraavaan vartalon liikkeeseen. */
export function characterSpans(p:Presentation,speaker:string):StateSpan[]{
 const out:StateSpan[]=[];let cursor=0,seated=false;
 const events=p.events.filter(e=>e.target===speaker&&stateFor(e.kind,e.value)).sort((a,b)=>(a.at??0)-(b.at??0));
 for(const e of events){const s=stateFor(e.kind,e.value)!,at=e.at??0,end=at+(e.duration??0);
  if(at>cursor+1e-6)out.push({state:seated?'Istuu':'Lepo',start:cursor,end:at});
  out.push({state:s,start:at,end:Math.max(at,end),event:e.id,value:e.value});cursor=Math.max(cursor,end);
  if(s==='Istuu')seated=true;else if(s==='Kävely'||s==='Juoksu'||e.value==='jump')seated=false;}
 if(cursor<p.seconds-1e-6)out.push({state:seated?'Istuu':'Lepo',start:cursor,end:p.seconds});
 return out;
}

/** Tilakone: tilat, parametri `tapahtuma` ja siirtymät havaituista tilavaihdoksista ehtoineen. */
export function characterStateMachine(p:Presentation,speaker:string):StateMachine{
 const spans=characterSpans(p,speaker),names:CharacterStateName[]=['Lepo',...(['Puhe','Kävely','Juoksu','Ele','Reaktio','Istuu'] as CharacterStateName[]).filter(n=>spans.some(s=>s.state===n))];
 const id=(n:string)=>stateId('tila-'+n.toLocaleLowerCase('fi-FI')),param=parameterId('tapahtuma'),seen=new Set<string>();
 const m:StateMachine={format:'hahmostudio-state-machine',version:1,states:names.map((n,i)=>({id:id(n),name:n,trackKey:speaker,timeOffset:0,speed:1,metadata:{x:i}})),transitions:[],parameters:[{id:param,name:'Tapahtuma',type:'enum',defaultValue:'lepo'}],entryState:id('Lepo') as StateId};
 for(let i=1;i<spans.length;i++){const a=spans[i-1].state,b=spans[i].state;if(a===b)continue;const value=spans[i].value??'loppu',key=a+'>'+b+'>'+value;if(seen.has(key))continue;seen.add(key);
  m.transitions.push({id:transitionId('siirto-'+m.transitions.length),fromState:id(a) as StateId,toState:id(b) as StateId,conditions:[{paramId:param,op:'eq',value:b==='Lepo'||b==='Istuu'&&!spans[i].value?'loppu':value}],duration:b==='Puhe'?0:.2,canInterruptSelf:false});}
 return m;
}
