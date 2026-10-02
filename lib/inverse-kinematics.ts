import {sampleTrack,putKeyframe,type Animation,type Keyframe} from './animation-model.ts';
import {animationTransforms,type Transform} from './animation-transform.ts';import type {Point} from './rig-model.ts';
export function inversePoint(t:Transform,p:Point):Point{const determinant=t.a*t.d-t.b*t.c;if(Math.abs(determinant)<1e-12)throw new Error('Liitosketjun koko on liian pieni niveltaivutukseen.');const x=p.x-t.e,y=p.y-t.f;return {x:(t.d*x-t.c*y)/determinant,y:(-t.b*x+t.a*y)/determinant};}
export function solveTwoBone(root:Point,target:Point,first:number,second:number,bend:1|-1){
 if(![root.x,root.y,target.x,target.y,first,second].every(Number.isFinite)||first<.001||second<.001)throw new Error('Nivelten pitää olla eri kohdissa.');
 const dx=target.x-root.x,dy=target.y-root.y,raw=Math.hypot(dx,dy),distance=Math.max(Math.abs(first-second)+1e-6,Math.min(first+second-1e-6,raw)),direction=raw>1e-9?Math.atan2(dy,dx):0;
 const angle=direction-bend*Math.acos(Math.max(-1,Math.min(1,(distance*distance+first*first-second*second)/(2*distance*first))));
 const elbow={x:root.x+Math.cos(angle)*first,y:root.y+Math.sin(angle)*first},reached={x:root.x+Math.cos(direction)*distance,y:root.y+Math.sin(direction)*distance};
 return {firstAngle:angle,secondAngle:Math.atan2(reached.y-elbow.y,reached.x-elbow.x),elbow,reached,clamped:Math.abs(distance-raw)>1e-5};
}
export function keyframeLimb(animation:Animation,upperKey:string,lowerKey:string,frame:number,target:Point,bend:1|-1,easing:Keyframe['easing']='smooth'):{animation:Animation;clamped:boolean}{
 const upper=animation.rig.parts.find(p=>p.key===upperKey),lower=animation.rig.parts.find(p=>p.key===lowerKey);if(!upper||!lower||lower.parentKey!==upper.key||!lower.joints[0])throw new Error('Liitä alaosa yläosaan ja lisää alaosan ensimmäinen nivel raajan päähän.');
 const u=sampleTrack(animation.tracks.find(t=>t.key===upperKey),frame),l=sampleTrack(animation.tracks.find(t=>t.key===lowerKey),frame);
 const parent=upper.parentKey?animationTransforms(animation,frame).get(upper.parentKey):undefined,goal=parent?inversePoint(parent,target):target;
 const root={x:upper.pivot.x+u.x,y:upper.pivot.y+u.y},vx=lower.pivot.x+l.x-upper.pivot.x,vy=lower.pivot.y+l.y-upper.pivot.y,wx=lower.joints[0].x-lower.pivot.x,wy=lower.joints[0].y-lower.pivot.y;
 const solved=solveTwoBone(root,goal,Math.hypot(vx,vy)*u.scale,Math.hypot(wx,wy)*u.scale*l.scale,bend),rotation=(solved.firstAngle-Math.atan2(vy,vx))*180/Math.PI,lowerRotation=(solved.secondAngle-Math.atan2(wy,wx))*180/Math.PI-rotation;
 let next=putKeyframe(animation,upperKey,{...u,rotation,frame,easing});next=putKeyframe(next,lowerKey,{...l,rotation:lowerRotation,frame,easing});return {animation:next,clamped:solved.clamped};
}
