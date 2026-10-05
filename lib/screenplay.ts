import {boundedWalk,stageLimits,characterBox} from './stage-bounds.ts';
import {defaultPhone,type PhoneView} from './phone-prop.ts';
import {sideLegPose} from './locomotion.ts';
import {currentView,type CharacterView} from './character-view.ts';
import {neutral,sampleTrack,type Animation,type Pose,type Track} from './animation-model.ts';
import {appendTake,type QuickProfile} from './quick-animation.ts';
import {backgrounds,type BackgroundId} from './backgrounds.ts';
import type {Scene} from './scene-model.ts';
export type Motion='wait'|'walk-left'|'walk-right'|'walk-front'|'run-left'|'run-right'|'run-front'|'wave'|'jump'|'crouch'|'nod';
export type Beat={text:string;motion:Motion;seconds:number;design?:BackgroundId;view?:CharacterView;phone?:PhoneView|'hidden'};
export type ScriptPlan={beats:Beat[];warnings:string[];seconds:number;text:string};
const aliases:Record<string,BackgroundId>={'studio':'studio-v1','studio valoisa':'studio-premium-v1','olohuone':'apartment-v1','kaupunki ilta':'city-evening-v1','auto moderni':'car-interior-v2','puhelin edestä':'phone-front-v1','phone front':'phone-front-v1','puhelin sivuviisto':'phone-angle-v1','phone angle':'phone-angle-v1','auto kuljettaja':'car-driver-v1','car driver':'car-driver-v1','auto matkustaja':'car-passenger-v1','car passenger':'car-passenger-v1','auto takapenkki':'car-back-v1','car back':'car-back-v1'};
function motion(text:string):Motion|undefined{if(/\b(ei|en|älä|don.t|not)\b/i.test(text))return;const t=text.toLocaleLowerCase('fi');if(/juoks|juokse|run/.test(t))return /vasem|left/.test(t)?'run-left':/suoraan|kohti|front|forward/.test(t)?'run-front':'run-right';if(/kävel|kävele|walk/.test(t))return /vasem|left/.test(t)?'walk-left':/suoraan|kohti|front|forward/.test(t)?'walk-front':'walk-right';if(/vilkut|vilkuta|heilut|wave/.test(t))return 'wave';if(/hypp|jump/.test(t))return 'jump';if(/kyyk|crouch/.test(t))return 'crouch';if(/nyökk|nyökä|nod/.test(t))return 'nod';if(/odot|tauko|wait|pause/.test(t))return 'wait';}
export function parseScreenplay(text:string):ScriptPlan{
 if(!text.trim())throw new Error('Kirjoita ensin käsikirjoitus.');if(text.length>12000)throw new Error('Käsikirjoituksen enimmäispituus on 12 000 merkkiä.');
 const beats:Beat[]=[],warnings:string[]=[];let pending:BackgroundId|undefined,pendingView:CharacterView|undefined,pendingPhone:PhoneView|'hidden'|undefined;
 for(const raw of text.split('\n').map(s=>s.trim()).filter(Boolean)){
  const tags=[...raw.matchAll(/\[([^\]]+)\]/g)].map(m=>m[1].trim());let action:Motion|undefined,seconds:number|undefined;
  for(const tag of tags){const phone=tag.match(/^(?:esine\s+)?puhelin\s+(edestä|takaa|sivulta|pois)$/i);if(phone){pendingPhone=({edestä:'front',takaa:'back',sivulta:'side',pois:'hidden'} as const)[phone[1].toLowerCase() as 'edestä'];continue;}const facing=tag.match(/^(?:hahmo|suunta|view)\s*:?\s*(edestä|vasen|vasemmalle|oikea|oikealle|front|left|right)$/i);if(facing){pendingView=/edestä|front/i.test(facing[1])?'front':/vasen|vasem|left/i.test(facing[1])?'left':'right';continue;}const bg=tag.match(/^(?:tausta|kuvakulma|background)\s*:?\s*(.+)$/i);if(bg){const id=aliases[bg[1].toLocaleLowerCase('fi')];if(!id)throw new Error(`Tuntematon kuvausympäristö: ${bg[1]}. Valitse ohjeessa mainittu nimi.`);pending=id;continue;}
   const duration=tag.match(/(\d+(?:[.,]\d+)?)\s*(?:s|sek|seconds)\b/i);if(duration)seconds=Number(duration[1].replace(',','.'));
   const found=motion(tag);if(!found)throw new Error(`Tuntematon liikeohje: [${tag}]. Käytä esimerkiksi [vilkuta 2s].`);if(action)throw new Error('Kirjoita eri liikkeet omille riveilleen.');action=found;
  }
  const spoken=raw.replace(/\[[^\]]+\]/g,'').trim();if(!spoken&&!action)continue;
  action??=motion(spoken)??'wait';if(action==='wait'&&spoken&&!motion(spoken))warnings.push(`Pelkkä puhe / tauko: ”${spoken.slice(0,80)}”. Lisää liike hakasulkeisiin tarvittaessa.`);
  seconds??=action==='jump'?1.2:spoken?Math.max(2,spoken.split(/\s+/).length/2.5):2;
  if(!Number.isFinite(seconds)||seconds<.5||seconds>20)throw new Error('Yhden rivin kesto on 0,5–20 sekuntia.');
  beats.push({text:spoken,motion:action,seconds,...(pending?{design:pending}:{}),...(pendingView?{view:pendingView}:{}),...(pendingPhone?{phone:pendingPhone}:{})});pending=undefined;pendingView=undefined;pendingPhone=undefined;
 }
 if(pending||pendingView||pendingPhone)throw new Error('Lisää kuvakulmaohjeen jälkeen puhetta tai liike.');if(!beats.length)throw new Error('Käsikirjoituksesta ei löytynyt animaation rivejä.');const seconds=beats.reduce((n,b)=>n+b.seconds,0);if(seconds>60)throw new Error('Lyhytanimaatio voi kestää enintään 60 sekuntia. Lyhennä käsikirjoitusta.');return {beats,warnings,seconds,text};
}
export function buildScreenplay(animation:Animation,q:QuickProfile,scene:Scene,plan:ScriptPlan,box=characterBox({width:animation.rig.source.width,height:animation.rig.source.height})){
 plan=parseScreenplay(plan.text);
 let roles=q.roles;const rig=animation.rig,start=animation.duration,base=(role:string)=>sampleTrack(animation.tracks.find(t=>t.key===(role==='root'?q.roles.root:roles[role])),start-1);
 const tracks=new Map<string,Track>(),cuts=[...(scene.cuts??[]).filter(c=>c.frame<start)],phoneCues=[...(scene.phoneCues??[]).filter(c=>c.frame<start)],fps=animation.fps,step=Math.max(1,Math.ceil(plan.seconds*fps*15/8000));let offset=0,travel=0,depth=1,depthY=0,view=currentView(q);
 const write=(role:string,frame:number,change:Partial<Pose>)=>{const key=roles[role];if(!key)return;let t=tracks.get(key);if(!t){t={key,frames:[]};tracks.set(key,t);}const pose={...base(role),...change};for(const k of ['x','y','rotation','scale','opacity'] as const)if(Object.is(pose[k],-0))pose[k]=0;if(Math.abs(pose.x)>rig.source.width*4||Math.abs(pose.y)>rig.source.height*4||pose.scale<.01||pose.scale>10||Math.abs(pose.rotation)>3600)throw new Error('Liike ylittää sallitun alueen. Pienennä hahmon lähtöasentoa tai lyhennä liikettä.');const at=t.frames.findIndex(k=>k.frame===frame),k={...pose,frame,easing:'linear' as const};if(at>=0)t.frames[at]=k;else t.frames.push(k);};
 const boundaryMessages:string[]=[];const limits=stageLimits({...scene,box,docWidth:rig.source.width,docHeight:rig.source.height});
 for(const beat of plan.beats){const moving=/^(walk|run)-/.test(beat.motion),running=beat.motion.startsWith('run'),wanted=beat.view??(moving?(beat.motion.endsWith('left')?'left':beat.motion.endsWith('front')?'front':'right'):view);if(q.views){if(!q.views[wanted])throw new Error('Valittua kuvakulmaa ei ole hahmossa.');view=wanted;roles=q.views[view]!;}else if(beat.view&&beat.view!=='front')throw new Error('Valitse monikulmahahmo, jotta voit käyttää profiileja.');let count=Math.max(2,Math.round(beat.seconds*fps)),end=offset+count-1;
  if(start+end+2>Math.min(1800,60*fps))throw new Error('Nykyinen aikajana ja käsikirjoitus ylittävät 60 sekuntia. Aloita uusi jakso tai lyhennä tekstiä.');
  if(beat.phone)phoneCues.push({frame:start+offset,view:beat.phone});
  if(beat.design){if(!backgrounds.some(b=>b.id===beat.design))throw new Error('Tuntematon tausta.');cuts.push({frame:start+offset,design:beat.design});}
  if((moving||beat.motion==='crouch')&&!['leftThigh','rightThigh','leftShin','rightShin'].every(r=>roles[r]))throw new Error('Kävely tarvitsee kokovartalohahmon. Valitse Aino tai Otto.');
  for(const role of ['head','leftArm','rightArm','leftForearm','rightForearm','leftThigh','rightThigh','leftShin','rightShin','leftFoot','rightFoot'])if(roles[role]&&!rig.parts.find(p=>p.key===roles[role])?.parentKey)throw new Error('Liitä hahmon osat toisiinsa ennen käsikirjoituksen animointia.');
  const times=new Set<number>([offset,end]);for(let f=offset;f<=end;f+=step)times.add(f);
  const frontal=moving&&beat.motion.endsWith('front'),distance=moving&&!frontal?(beat.motion.endsWith('left')?-1:1)*rig.source.width*(running?.32:.11)*beat.seconds:0,period=running?.62:1.1,rootBase=sampleTrack(animation.tracks.find(t=>t.key===q.roles.root),start-1);
  const worldStart=scene.x+(rootBase.x+travel)*scene.scale,walk=boundedWalk(worldStart,distance*scene.scale,limits.left,limits.right,scene.edgeBehavior??'stop');
  if(moving&&!frontal&&walk.crossed){boundaryMessages.push('Hahmo ylittäisi reunan, kävely lyhennetty');if(scene.edgeBehavior==='shorten'){count=Math.max(2,Math.round(count*walk.fraction));end=offset+count-1;}}
  const travelAt=(t:number)=>(walk.position(t*(scene.edgeBehavior==='shorten'?walk.fraction:1))-scene.x)/scene.scale-rootBase.x;
  const growth=frontal?(running?.055:.025)*beat.seconds:0,advance=frontal?rig.source.height*.018*beat.seconds:0;
  for(const f of [...times].sort((a,b)=>a-b)){const t=(f-offset)/(count-1),sec=t*beat.seconds*(scene.edgeBehavior==='shorten'&&walk.crossed?walk.fraction:1),phase=sec*2*Math.PI/period,envelope=Math.sin(Math.PI*t)**2,poseRoot=rootBase;
   if(moving&&!frontal&&scene.edgeBehavior==='turn'&&q.views){const facing=walk.position(t)>=walk.position(Math.max(0,t-1/count))?'right':'left';if(q.views[facing]){roles=q.views[facing]!;view=facing;}}
   for(const r of ['head','leftArm','rightArm','leftForearm','rightForearm','leftThigh','rightThigh','leftShin','rightShin','leftFoot','rightFoot'])write(r,f,{});
   for(const map of Object.values(q.views??{}))if(map){const key=map.root;let track=tracks.get(key);if(!track){track={key,frames:[]};tracks.set(key,track);}track.frames.push({...poseRoot,x:poseRoot.x+(moving&&!frontal?travelAt(t):travel),y:poseRoot.y+depthY+advance*t,scale:poseRoot.scale*(depth+growth*t),opacity:key===roles.root?1:0,frame:f,easing:'linear'});}
   if(!q.views)write('root',f,{x:poseRoot.x+(moving&&!frontal?travelAt(t):travel),y:poseRoot.y+depthY+advance*t,scale:poseRoot.scale*(depth+growth*t)});
   if(moving&&walk.moving(t*(scene.edgeBehavior==='shorten'?walk.fraction:1))){const bob=-(1-Math.cos(phase*2))/2*(running?rig.source.height*.005:rig.source.height*.003),root={x:poseRoot.x+(moving&&!frontal?travelAt(t):travel),y:poseRoot.y+depthY+advance*t+bob,scale:poseRoot.scale*(depth+growth*t)};write('root',f,root);for(const [side,sign] of [['left',1],['right',-1]] as const){if(frontal){write(side+'Thigh',f,{rotation:Math.sin(phase)*sign*7,scale:1-Math.max(0,Math.sin(phase)*sign)*.055});write(side+'Shin',f,{rotation:-Math.sin(phase)*sign*7});}else{const leg=sideLegPose(rig,roles,side,sec,period,distance/beat.seconds,bob,running);write(side+'Thigh',f,{rotation:leg.thigh});write(side+'Shin',f,{rotation:leg.shin});write(side+'Foot',f,{rotation:leg.foot});}write(side+'Arm',f,{rotation:Math.sin(phase)*-sign*(running?45:22)});if(running)write(side+'Forearm',f,{rotation:side==='left'?-70:70});}}
   if(beat.motion==='wave'){write('leftArm',f,{rotation:base('leftArm').rotation-100*envelope});write('leftForearm',f,{rotation:base('leftForearm').rotation+(Math.sin(sec*Math.PI*4)*25-25)*envelope});}
   if(beat.motion==='jump')write('root',f,{x:poseRoot.x+travel,y:poseRoot.y+depthY-Math.sin(Math.PI*t)*rig.source.height*.12,scale:poseRoot.scale*depth});
   if(beat.motion==='crouch'){write('root',f,{x:poseRoot.x+travel,y:poseRoot.y+depthY+rig.source.height*.035*envelope,scale:poseRoot.scale*depth});for(const side of ['left','right']){write(side+'Thigh',f,{rotation:base(side+'Thigh').rotation-25*envelope});write(side+'Shin',f,{rotation:base(side+'Shin').rotation+50*envelope});write(side+'Foot',f,{rotation:base(side+'Foot').rotation-25*envelope});}}
   if(beat.motion==='nod')write('head',f,{rotation:base('head').rotation+Math.sin(sec*Math.PI*3)*12*envelope});
  }travel=moving&&!frontal?travelAt(1):travel+distance;depth+=growth;depthY+=advance;if(depth>3)throw new Error('Kohti katsojaa liikettä on liikaa. Lyhennä käsikirjoitusta.');if(Math.abs(base('root').x+travel)>rig.source.width*4)throw new Error('Hahmo kävelee liian kauas. Lyhennä kävelyä.');offset+=count;
 }
 const appended=appendTake(animation,[...tracks.values()]);return {...appended,boundaryMessages,scene:{...scene,cuts,phoneCues,...(scene.phone?{phone:scene.phone}:phoneCues.length?{phone:defaultPhone()}:{}),screenplay:plan.text}};
}
export const motionNames:Record<Motion,string>={wait:'Puhe / tauko', 'walk-front':'Kävely kohti katsojaa','run-left':'Juoksu vasemmalle','run-right':'Juoksu oikealle','run-front':'Juoksu kohti katsojaa','walk-left':'Kävely vasemmalle','walk-right':'Kävely oikealle',wave:'Vilkutus',jump:'Hyppy',crouch:'Kyykistys',nod:'Nyökkäys'};
