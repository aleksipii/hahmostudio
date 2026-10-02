import {sampleTrack,type Animation,type Keyframe,type Pose} from './animation-model.ts';
export type WalkSettings={leftLeg:string;rightLeg:string;leftArm?:string;rightArm?:string;body?:string;start:number;end:number;period:number;legAngle:number;armAngle:number;bounce:number;distance:number};
export function createWalk(animation:Animation,settings:WalkSettings):Animation{
 const s=settings,limbs=[s.leftLeg,s.rightLeg,s.leftArm,s.rightArm].filter((k):k is string=>!!k),keys=[...limbs,...(s.body?[s.body]:[])];
 if(!s.leftLeg||!s.rightLeg||new Set(keys).size!==keys.length||keys.some(k=>!animation.rig.parts.some(p=>p.key===k)))throw new Error('Valitse eri kuvatasot vasemmalle ja oikealle jalalle sekä muille osille.');
 if(!Number.isInteger(s.start)||!Number.isInteger(s.end)||s.start<0||s.end>=animation.duration||s.end<=s.start||![s.period,s.legAngle,s.armAngle,s.bounce,s.distance].every(Number.isFinite)||s.period<.4||s.period>4||s.legAngle<0||s.legAngle>65||s.armAngle<0||s.armAngle>65||s.bounce<0||s.bounce>animation.rig.source.height*.1||Math.abs(s.distance)>animation.rig.source.width*2)throw new Error('Kävelyn kesto tai liikeasetukset ovat virheelliset.');
 if(!s.body&&(s.bounce!==0||s.distance!==0))throw new Error('Valitse vartalo pomppua tai etenemistä varten.');
 const ancestors=(key:string)=>{const found=new Set<string>();let p=animation.rig.parts.find(p=>p.key===key);while(p?.parentKey){if(found.has(p.parentKey))throw new Error('Nivelten liitosketjussa on silmukka.');found.add(p.parentKey);p=animation.rig.parts.find(p=>p.key===p!.parentKey);}return found;};
 if(limbs.some(k=>limbs.some(other=>other!==k&&ancestors(k).has(other))))throw new Error('Valitse raajojen yläosat. Valitut raajat eivät saa olla liitettyinä toisiinsa.');
 if(s.body&&limbs.some(k=>!ancestors(k).has(s.body!)))throw new Error('Liitä valitut raajat vartaloon Nivelet-vaiheessa ennen vartalon animointia.');
 const step=Math.max(1,Math.floor(animation.fps/12)),times=new Set<number>([s.start,s.end]);for(let f=s.start;f<=s.end;f+=step)times.add(f);
 const tracks=keys.map(key=>{const old=animation.tracks.find(t=>t.key===key),base=sampleTrack(old,s.start),frames:Keyframe[]=(old?.frames??[]).filter(f=>f.frame<s.start||f.frame>s.end).map(f=>({...f}));
  const add=(frame:number,pose:Pose)=>{const previous=frames.findIndex(f=>f.frame===frame);if(previous>=0)frames.splice(previous,1);frames.push({...pose,frame,easing:'linear'});};
  if(s.start>0&&!frames.some(f=>f.frame===s.start-1))add(s.start-1,sampleTrack(old,s.start-1));if(s.end<animation.duration-1&&!frames.some(f=>f.frame===s.end+1))add(s.end+1,sampleTrack(old,s.end+1));
  for(const frame of times){const phase=(frame-s.start)/animation.fps/s.period*2*Math.PI,pose={...base};if(key===s.body){pose.x+=s.distance*(frame-s.start)/(s.end-s.start);pose.y-=s.bounce*(1-Math.cos(phase*2))/2;}else{const amplitude=key===s.leftLeg||key===s.rightLeg?s.legAngle:s.armAngle,direction=key===s.leftLeg||key===s.rightArm?1:-1;pose.rotation+=Math.sin(phase)*amplitude*direction;}
   if(Math.abs(pose.x)>animation.rig.source.width*4||Math.abs(pose.y)>animation.rig.source.height*4||Math.abs(pose.rotation)>3600)throw new Error('Kävelyn liike ylittää sallitun alueen. Pienennä liikettä tai nollaa lähtöasento.');add(frame,pose);
  }return {key,frames:frames.sort((a,b)=>a.frame-b.frame)};
 });
 const result={...animation,tracks:[...animation.tracks.filter(t=>!keys.includes(t.key)),...tracks]};if(result.tracks.reduce((n,t)=>n+t.frames.length,0)>10000)throw new Error('Kävely tuottaisi yli 10 000 avainruutua. Lyhennä valittua aikaväliä.');return result;
}
