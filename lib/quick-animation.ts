import {neutral,putKeyframe,sampleTrack,type Animation,type Pose,type Track} from './animation-model.ts';
import type {Rig} from './rig-model.ts';
export const actions={left:'Vasen käsi ylös',right:'Oikea käsi ylös',jump:'Hyppy',neutral:'Neutraali',happy:'Hymy',surprise:'Yllätys',blink:'Räpäytys',record:'Tallenna / lopeta otto',play:'Toista / pysäytä'} as const;
export type Action=keyof typeof actions;
export const defaultBindings:Record<Action,string>={left:'KeyA',right:'KeyD',jump:'KeyW',neutral:'Digit1',happy:'Digit2',surprise:'Digit3',blink:'KeyB',record:'KeyR',play:'Space'};
export type QuickProfile={mouthSource?:'auto'|'camera'|'microphone';version:1;asset:'hahmostudio-otto-robot-v1'|'hahmostudio-aino-human-v1'|'hahmostudio-leo-portrait-v1'|'hahmostudio-blank-v1'|'hahmostudio-aino-multiview-v1'|'hahmostudio-otto-multiview-v1'|'hahmostudio-roni-multiview-v1'|'hahmostudio-salla-multiview-v1';views?:Partial<Record<import('./character-view.ts').CharacterView,Record<string,string>>>;roles:Record<string,string>;bindings:Record<Action,string>;strength:number;speed:number;gate:number;sensitivity:number;smoothing:number;idle:boolean};
export function readQuick(v:unknown,rig:Rig):QuickProfile|undefined{
 if(v===undefined)return;const q=v as QuickProfile;
 const required=['root','head','leftArm','rightArm','leftPupil','rightPupil','leftBrow','rightBrow','leftBlink','rightBlink','mouthNeutral','mouthOpen','mouthRound'];
 if(!q||(q.mouthSource!==undefined&&!['auto','camera','microphone'].includes(q.mouthSource))||q.version!==1||!['hahmostudio-otto-robot-v1','hahmostudio-aino-human-v1','hahmostudio-leo-portrait-v1','hahmostudio-blank-v1','hahmostudio-aino-multiview-v1','hahmostudio-otto-multiview-v1','hahmostudio-roni-multiview-v1','hahmostudio-salla-multiview-v1'].includes(q.asset)||!q.roles||required.some(k=>!rig.parts.some(p=>p.key===q.roles[k]))||new Set(Object.values(q.roles)).size!==Object.values(q.roles).length||Object.values(q.roles).some(k=>typeof k!=='string'||!rig.parts.some(p=>p.key===k))||!q.bindings||Object.keys(actions).some(k=>! /^(Key[A-Z]|Digit[0-9]|Space)$/.test(q.bindings[k as Action]))||new Set(Object.values(q.bindings)).size!==Object.keys(actions).length||typeof q.idle!=='boolean'||!['strength','speed','gate','sensitivity','smoothing'].every(k=>Number.isFinite(q[k as keyof QuickProfile]))||q.strength<0||q.strength>1||q.speed<.5||q.speed>2||q.gate<0||q.gate>.1||q.sensitivity<1||q.sensitivity>20||q.smoothing<0||q.smoothing>1)throw new Error('Pikaanimoinnin sidokset tai asetukset ovat virheelliset.');
 if(q.views!==undefined){const entries=Object.entries(q.views),seen=new Set<string>();if(!entries.length||entries.length>4||entries.some(([view,map])=>!['front','left','right','back'].includes(view)||!map||typeof map!=='object'||required.some(r=>typeof map[r]!=='string')||Object.values(map).some(key=>{if(typeof key!=='string'||seen.has(key)||!rig.parts.some(p=>p.key===key))return true;seen.add(key);return false;}))||!entries.some(([,map])=>Object.keys(map!).length===Object.keys(q.roles).length&&Object.entries(q.roles).every(([r,key])=>map![r]===key)))throw new Error('Hahmon kuvakulmien sidokset ovat virheelliset.');}
 return structuredClone(q);
}
export function keyAction(e:{code:string;metaKey:boolean;ctrlKey:boolean;altKey:boolean;shiftKey:boolean},q:QuickProfile):Action|undefined{if(e.metaKey||e.ctrlKey||e.altKey||e.shiftKey)return;return (Object.keys(actions) as Action[]).find(a=>q.bindings[a]===e.code);}
export function typingTarget(target:EventTarget|null){return target instanceof HTMLElement&&!!target.closest('input,textarea,select,button,summary,[role="separator"],[contenteditable="true"],[role="textbox"]');}
export type QuickState={left:boolean;right:boolean;leftAmount:number;rightAmount:number;jumpAt:number;blinkAt:number;emotion:0|1|2;energy:number;time:number};
export function initialQuick():QuickState{return {left:false,right:false,leftAmount:0,rightAmount:0,jumpAt:-100,blinkAt:-100,emotion:0,energy:0,time:0};}
export function dispatchQuick(s:QuickState,a:Action,down:boolean,time:number,repeat=false){if(a==='left'||a==='right')s[a]=down;else if(down&&!repeat){if(a==='jump'&&time-s.jumpAt>1)s.jumpAt=time;if(a==='blink')s.blinkAt=time;if(a==='neutral')s.emotion=0;if(a==='happy')s.emotion=1;if(a==='surprise')s.emotion=2;}}
export function quickPoses(s:QuickState,q:QuickProfile,rig:Rig,time:number,rms=0):Record<string,Pose>{
 const dt=Math.max(0,Math.min(.1,time-s.time));s.time=time;const blend=1-Math.exp(-dt*12*q.speed);
 s.leftAmount+=(Number(s.left)-s.leftAmount)*blend;s.rightAmount+=(Number(s.right)-s.rightAmount)*blend;
 const target=Math.min(1,Math.max(0,rms-q.gate)*q.sensitivity);s.energy+=(target-s.energy)*(1-Math.exp(-dt/(target>s.energy?.018+q.smoothing*.025:.045+q.smoothing*.05)));if(target===0&&s.energy<.035)s.energy=0;
 const p:Record<string,Pose>=Object.fromEntries(rig.parts.map(r=>[r.key,{...neutral}]));const role=(r:string)=>p[q.roles[r]];
 role('leftArm').rotation=-135*s.leftAmount*q.strength||0;role('rightArm').rotation=135*s.rightAmount*q.strength;
 const jt=(time-s.jumpAt)*q.speed;role('root').y=jt>=0&&jt<.85?-Math.sin(jt/.85*Math.PI)*rig.source.height*.12*q.strength:0;
 role('head').rotation=q.idle?Math.sin(time*1.2)*1.5:0;
 const blink=time-s.blinkAt<.16||(q.idle&&time%4.7<.14);role('leftBlink').opacity=role('rightBlink').opacity=blink?1:0;
 role('leftPupil').opacity=role('rightPupil').opacity=blink?0:1;role('leftPupil').x=role('rightPupil').x=q.idle?Math.sin(time*.65)*3:0;
 role('leftBrow').y=role('rightBrow').y=s.emotion===2?-12:s.emotion===1?-5:0;role('leftBrow').rotation=s.emotion===1?-12:0;role('rightBrow').rotation=s.emotion===1?12:0;
 if(q.roles.mouthSmile&&p[q.roles.mouthSmile])p[q.roles.mouthSmile].opacity=s.emotion===1&&s.energy<=.04?1:0;
 const open=s.energy>.04,round=s.energy>.55||s.emotion===2;role('mouthNeutral').opacity=open||s.emotion===2||(s.emotion===1&&!!q.roles.mouthSmile)?0:1;role('mouthOpen').opacity=open&&!round?1:0;role('mouthRound').opacity=(open&&round)||(!open&&s.emotion===2)?1:0;
 return p;
}
// Append a take after the complete existing timeline. The existing keys are never replaced.
export function appendTake(animation:Animation,tracks:Track[]):{animation:Animation;start:number;end:number}{
 if(!tracks.length||tracks.every(t=>!t.frames.length))throw new Error('Otossa ei ole liikettä.');
 const start=animation.duration;
 const end=start+Math.max(...tracks.flatMap(t=>t.frames.map(k=>k.frame)));if(end+2>1800)throw new Error('Aikajana täyttyi. Tallenna projekti ja aloita uusi jakso.');
 if(animation.tracks.reduce((n,t)=>n+t.frames.length,0)+tracks.reduce((n,t)=>n+t.frames.length,0)>10000)throw new Error('Avainruuturaja täyttyi. Lyhennä ottoa.');
 let next={...animation,duration:Math.max(animation.duration,end+2)};for(const t of tracks){const old=animation.tracks.find(old=>old.key===t.key);const boundary=sampleTrack(old,start-1);if(!old?.frames.length)next=putKeyframe(next,t.key,{...neutral,frame:0,easing:'hold'});if(!old?.frames.some(k=>k.frame===start-1))next=putKeyframe(next,t.key,{...boundary,frame:start-1,easing:'hold'});for(const k of t.frames)next=putKeyframe(next,t.key,{...k,frame:start+k.frame});}if(next.tracks.reduce((n,t)=>n+t.frames.length,0)>10000)throw new Error('Avainruuturaja täyttyi. Lyhennä ottoa.');return {animation:next,start,end};
}
