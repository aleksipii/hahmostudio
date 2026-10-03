import {neutral,sampleTrack,type Animation,type Pose} from './animation-model.ts';
import type {QuickProfile} from './quick-animation.ts';
/** Timeline is the baseline. Keyboard owns arms/root/expressions, camera owns its
 * mapped face channels, microphone has final priority for the three mouth images.
 * Device removal restores the next source on the following tick. */
export function mixPerformance(animation:Animation,frame:number,q:QuickProfile,quick:Record<string,Pose>|undefined,camera:Record<string,Pose>|undefined,microphone:boolean):Record<string,Pose>{
 const result:Record<string,Pose>=Object.fromEntries(animation.rig.parts.map(p=>[p.key,{...sampleTrack(animation.tracks.find(t=>t.key===p.key),frame)}]));
 const roles=['root','head','leftArm','rightArm','leftPupil','rightPupil','leftBrow','rightBrow','leftBlink','rightBlink','mouthNeutral','mouthOpen','mouthRound'];
 if(quick)for(const role of roles){const key=q.roles[role];if(quick[key])result[key]={...quick[key]};}
 if(quick&&q.views)for(const map of Object.values(q.views))if(map&&map.root!==q.roles.root&&result[map.root])result[map.root]={...result[map.root],opacity:0};
 if(camera)for(const [key,pose] of Object.entries(camera)){
  if(!result[key])continue;
  const base=result[key];
  if(key===q.roles.head)result[key]={...base,x:pose.x,y:pose.y,rotation:pose.rotation,scale:pose.scale};
  else if(key===q.roles.leftPupil||key===q.roles.rightPupil){result[key]={...base,opacity:pose.opacity};const blink=q.roles[key===q.roles.leftPupil?'leftBlink':'rightBlink'];if(result[blink])result[blink]={...result[blink],opacity:1-pose.opacity};}
  else if(!microphone&&[q.roles.mouthNeutral,q.roles.mouthOpen,q.roles.mouthRound].includes(key))result[key]={...base,scale:pose.scale};
  else if(![q.roles.root,q.roles.leftArm,q.roles.rightArm,q.roles.mouthNeutral,q.roles.mouthOpen,q.roles.mouthRound].includes(key))result[key]={...pose};
 }
 if(microphone&&quick)for(const role of ['mouthNeutral','mouthOpen','mouthRound']){const key=q.roles[role];result[key]={...(result[key]??neutral),opacity:quick[key].opacity,scale:quick[key].scale};}
 return result;
}
