import {neutral,type Pose} from './animation-model.ts';
export type FaceSample={x:number;y:number;roll:number;width:number;blinkLeft:number;blinkRight:number;jaw:number};
export function faceSample(landmarks:{x:number;y:number}[],shapes:{categoryName:string;score:number}[]):FaceExpression|undefined{if(landmarks.length<264)return;const nose=landmarks[1],left=landmarks[33],right=landmarks[263];if(![nose.x,nose.y,left.x,left.y,right.x,right.y].every(Number.isFinite))return;const score=(name:string)=>{const value=shapes.find(s=>s.categoryName===name)?.score??0;return Number.isFinite(value)?Math.max(0,Math.min(1,value)):0;};return {x:nose.x,y:nose.y,roll:Math.atan2(right.y-left.y,right.x-left.x),width:Math.hypot(right.x-left.x,right.y-left.y),blinkLeft:score('eyeBlinkLeft'),blinkRight:score('eyeBlinkRight'),jaw:score('jawOpen'),smile:(score('mouthSmileLeft')+score('mouthSmileRight'))/2,browUp:Math.max(score('browInnerUp'),(score('browOuterUpLeft')+score('browOuterUpRight'))/2),browDown:(score('browDownLeft')+score('browDownRight'))/2,lookX:(score('eyeLookOutLeft')+score('eyeLookInRight')-score('eyeLookInLeft')-score('eyeLookOutRight'))/2,lookY:(score('eyeLookDownLeft')+score('eyeLookDownRight')-score('eyeLookUpLeft')-score('eyeLookUpRight'))/2};}
export function headPose(sample:FaceSample,baseline:FaceSample,width:number,height:number):Pose{const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));let angle=sample.roll-baseline.roll;while(angle>Math.PI)angle-=Math.PI*2;while(angle<-Math.PI)angle+=Math.PI*2;return {...neutral,x:clamp(-(sample.x-baseline.x)*width*1.5,-width,width),y:clamp((sample.y-baseline.y)*height*1.5,-height,height),rotation:clamp(-angle*180/Math.PI,-60,60),scale:clamp(sample.width/Math.max(baseline.width,.001),.5,2)};}

/** Attached heads turn at their neck; camera distance must not tear the head off. */
export function attachedHeadPose(pose:Pose,attached:boolean):Pose{return attached?{...pose,x:0,y:0,scale:1,rotation:Math.max(-25,Math.min(25,pose.rotation))}:{...pose};}

export type FaceExpression=FaceSample&{smile?:number;browUp?:number;browDown?:number;lookX?:number;lookY?:number};
export type FaceFilter={time:number;sample?:FaceExpression;leftClosed:boolean;rightClosed:boolean;mouthOpen:boolean};
export function initialFaceFilter():FaceFilter{return {time:0,leftClosed:false,rightClosed:false,mouthOpen:false};}
/** Short time-based filters retain a sustained expression; blink hysteresis avoids chatter. */
export function facePoses(sample:FaceExpression,baseline:FaceSample,roles:Record<string,string>,rig:import('./rig-model.ts').Rig,state:FaceFilter,time:number):Record<string,Pose>{
 const dt=state.sample?Math.max(0,Math.min(.15,time-state.time)):1;state.time=time;const alpha=1-Math.exp(-dt/0.055),previous=state.sample;
 const current={...sample};for(const key of ['x','y','roll','width','jaw','smile','browUp','browDown','lookX','lookY'] as const)if(previous)current[key]=(previous[key]??0)+((sample[key]??0)-(previous[key]??0))*alpha;state.sample=current;
 const toggle=(closed:boolean,value:number)=>value>(closed?.30:.48);state.leftClosed=toggle(state.leftClosed,sample.blinkLeft);state.rightClosed=toggle(state.rightClosed,sample.blinkRight);state.mouthOpen=current.jaw>(state.mouthOpen?.075:.13);
 const poses:Record<string,Pose>={};const put=(role:string,pose:Partial<Pose>)=>{if(roles[role]&&rig.parts.some(p=>p.key===roles[role]))poses[roles[role]]={...neutral,...pose};};
 put('head',attachedHeadPose(headPose(current,baseline,rig.source.width,rig.source.height),!!rig.parts.find(p=>p.key===roles.head)?.parentKey));
 for(const [side,closed] of [['left',state.leftClosed],['right',state.rightClosed]] as const){put(side+'Blink',{opacity:closed?1:0});put(side+'Pupil',{opacity:closed?0:1,x:(current.lookX??0)*8,y:(current.lookY??0)*5});put(side+'Brow',{y:-(current.browUp??0)*12+(current.browDown??0)*7,rotation:(side==='left'?-1:1)*(current.smile??0)*10});}
 const smile=!state.mouthOpen&&!!roles.mouthSmile&&(current.smile??0)>.35,round=state.mouthOpen&&current.jaw>.65;
 put('mouthNeutral',{opacity:state.mouthOpen||smile?0:1});put('mouthSmile',{opacity:smile?1:0});put('mouthOpen',{opacity:state.mouthOpen&&!round?1:0,scale:1+Math.min(.4,current.jaw*.4)});put('mouthRound',{opacity:round?1:0,scale:1+Math.min(.3,current.jaw*.3)});
 return poses;
}
