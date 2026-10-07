import {sampleBezierCurve,type BezierCurve} from '../easing-model.ts';
import {sampleTrack,neutral,type Animation,type Keyframe,type Pose} from '../animation-model.ts';

export const ease=(c:BezierCurve,t:number)=>sampleBezierCurve(c,Math.max(0,Math.min(1,t)));
export const smooth=(t:number)=>{const u=Math.max(0,Math.min(1,t));return u*u*u*(u*(u*6-15)+10);};
/* ───────────────────────── Tiheät avaimet ───────────────────────── */

export type Writer={set(role:string,frame:number,pose:Partial<Pose>):void;flush():Animation;base(role:string,frame:number):Pose};
export function writer(a:Animation,roles:Record<string,string>):Writer{
 const pending=new Map<string,Map<number,Keyframe>>();
 return {
  base:(role,frame)=>{const key=roles[role];return key?sampleTrack(a.tracks.find(t=>t.key===key),frame):{...neutral};},
  set(role,frame,pose){const key=roles[role];if(!key||frame<0||frame>=a.duration)return;let m=pending.get(key);if(!m)pending.set(key,m=new Map());const prev=m.get(frame)??{...sampleTrack(a.tracks.find(t=>t.key===key),frame),frame,easing:'linear' as const};m.set(frame,{...prev,...pose,frame,easing:'linear'});},
  flush(){if(!pending.size)return a;return {...a,tracks:[...a.tracks.filter(t=>!pending.has(t.key)),...[...pending].map(([key,frames])=>{const old=a.tracks.find(t=>t.key===key)?.frames??[];return {key,frames:[...old.filter(k=>!frames.has(k.frame)),...frames.values()].sort((x,y)=>x.frame-y.frame)};})]};},
 };
}
