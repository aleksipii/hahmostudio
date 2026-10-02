import {sampleTrack,type Animation,type Pose} from './animation-model.ts';
export type Transform={a:number;b:number;c:number;d:number;e:number;f:number;opacity:number};
const identity:Transform={a:1,b:0,c:0,d:1,e:0,f:0,opacity:1};
export function combine(p:Transform,q:Transform):Transform{return {a:p.a*q.a+p.c*q.b,b:p.b*q.a+p.d*q.b,c:p.a*q.c+p.c*q.d,d:p.b*q.c+p.d*q.d,e:p.a*q.e+p.c*q.f+p.e,f:p.b*q.e+p.d*q.f+p.f,opacity:p.opacity*q.opacity};}
export function animationTransforms(animation:Animation,frame:number,draft?:{key:string;pose:Pose}):Map<string,Transform>{
 const parts=new Map(animation.rig.parts.map(p=>[p.key,p])), tracks=new Map(animation.tracks.map(t=>[t.key,t])), result=new Map<string,Transform>(), visiting=new Set<string>();
 const resolve=(key:string):Transform=>{
  const cached=result.get(key);if(cached)return cached;
  if(visiting.has(key))throw new Error('Osien liitoksissa on kehä.');visiting.add(key);
  const part=parts.get(key);if(!part)throw new Error('Liitettyä osaa ei löydy.');
  const pose=draft?.key===key?draft.pose:sampleTrack(tracks.get(key),frame), angle=pose.rotation*Math.PI/180,a=Math.cos(angle)*pose.scale,b=Math.sin(angle)*pose.scale,c=-b,d=a;
  const local={a,b,c,d,e:part.pivot.x+pose.x-a*part.pivot.x-c*part.pivot.y,f:part.pivot.y+pose.y-b*part.pivot.x-d*part.pivot.y,opacity:pose.opacity};
  const value=combine(part.parentKey?resolve(part.parentKey):identity,local);visiting.delete(key);result.set(key,value);return value;
 };
 for(const part of animation.rig.parts)resolve(part.key);
 return result;
}
