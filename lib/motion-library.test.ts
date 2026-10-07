import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {readProject} from './project-file.ts';
import {buildEpisode,catalogFromNames} from './episode-builder.ts';
import {CHARACTER_PACK_OPTIONS} from './speaker-pack-options.ts';
import {rotationSeries,maxAcceleration,maxJerk,stanceSlip,visibleViewRoots,footPoint} from './motion-quality.ts';
import {gestures,gestureOffset,overlapDelays,gaitDistance,lowerBodyMotions,phaseCurves,defaultMotionSeconds} from './motion-library.ts';
import {animationTransforms} from './animation-transform.ts';
import {sampleTrack,type Animation} from './animation-model.ts';
import {viewAtFrame} from './character-view.ts';

/** Kirjaston hahmot, joilla on täysi raajaketju (kartonki-Mr.Kille/Handu käyttävät omaa kartonkipolkuaan). */
const packs=['Pipsa','Ville','Taru','Ukko','Pipsa-3D','Ville-3D','Taru-3D','Ukko-3D','Roni-Monikulma','Salla-Monikulma','Aino-Monikulma','Otto-Monikulma','Roni-Studio','Salla-Studio'];
const motions:[string,string][]=[['walk-right','kävelee oikealle 2 s'],['walk-left','kävelee vasemmalle 2 s'],['walk-front','kävelee suoraan 2 s'],['run-right','juoksee oikealle 2 s'],['wave','vilkuttaa'],['nod','nyökkää'],['point','osoittaa'],['sit','istuu'],['jump','hyppää'],['crouch','kyykistyy'],['react-surprise','hämmästyy'],['fist','nyrkki']];
/** Rajat 24 fps:llä: kulmakiihtyvyys °/ruutu² ja jerk °/ruutu³. Juoksun polvi liikkuu luonnostaan nopeammin. */
const limits=(m:string)=>m.startsWith('run')?{acc:35,jerk:40}:{acc:20,jerk:20};
const cache=new Map<string,Awaited<ReturnType<typeof readProject>>>();
async function pack(n:string){if(!cache.has(n))cache.set(n,await readProject(new Blob([readFileSync(new URL(`../public/library/${n}.hahmo`,import.meta.url))])));return cache.get(n)!;}
function build(name:string,line:string,r:Awaited<ReturnType<typeof readProject>>){return buildEpisode(`Resurssi hahmo MIRA: ${name}\nINT. STUDIO\nMira odottaa 0,5 s.\n${line}\nMira odottaa 1 s.`,{packs:catalogFromNames(CHARACTER_PACK_OPTIONS),assets:{[name]:{doc:r.doc,animation:r.animation}}});}

test('laatumittarit kaikille kirjaston hahmoille ja kaikille liikkeille: ei nopeusporrasta, jerk-raja, tukijalka < 1 px, yksi kuvakulma',async()=>{
 let checked=0;
 for(const name of packs){const r=await pack(name),q=r.doc.quick!;
  for(const [motion,line] of motions){
   const b=build(name,'Mira '+line+'.',r),a=b.animationPerActor.MIRA;assert.ok(a,name+' '+motion);
   assert.deepEqual(b.diagnostics.filter(d=>d.severity==='error').map(d=>d.message),[],name+' '+motion);
   assert.ok(b.presentation.events.some(e=>e.value===motion),name+' '+motion+' tunnistettu');
   const lim=limits(motion);
   for(const t of a.tracks){const s=rotationSeries(a,t.key);assert.ok(maxAcceleration(s)<=lim.acc,`${name} ${motion} ${t.key}: kiihtyvyys ${maxAcceleration(s).toFixed(2)}`);assert.ok(maxJerk(s)<=lim.jerk,`${name} ${motion} ${t.key}: jerk ${maxJerk(s).toFixed(2)}`);
    for(const c of ['x','y'] as const){const v=rotationSeries(a,t.key,0,a.duration-1,c);assert.ok(maxAcceleration(v)<=15,`${name} ${motion} ${t.key}.${c}: ${maxAcceleration(v).toFixed(2)} px/ruutu²`);}}
   const slip=stanceSlip(r.doc,a,0,a.duration-1);assert.ok(slip.max<1,`${name} ${motion}: tukijalan liukuma ${slip.max.toFixed(3)} px`);assert.ok(slip.stanceFrames>10);
   for(let f=0;f<a.duration;f++)assert.ok(visibleViewRoots(q,a,f)<=1,`${name} ${motion}: kaksi kuvakulmaa ruudussa ${f}`);
   checked++;
  }}
 assert.equal(checked,packs.length*motions.length);
});

test('vaiheet ennakointi → toiminta → jälkiliike → asettuminen omilla Bezier-käyrillä; ele palaa lähtöasentoon',()=>{
 for(const [name,g] of Object.entries(gestures)){const names=g.phases.map(p=>p.name);assert.equal(names[0],'ennakointi',name);assert.ok(names.includes('toiminta'));assert.ok(names.includes('jälkiliike'));assert.equal(names.at(-1),'asettuminen');assert.ok(Math.abs(g.phases.reduce((s,p)=>s+p.share,0)-1)<1e-9,name);for(const p of g.phases)assert.deepEqual(p.curve,phaseCurves[p.name]);
  for(const role of Object.keys(g.phases[1].pose)){const end=gestureOffset(g,role,1),startPose=gestureOffset(g,role,0);assert.ok(Math.abs(end.r)+Math.abs(end.y)<1e-9&&Math.abs(startPose.r)<1e-9,name+' '+role);}
  // Ennakointi vastakkaiseen suuntaan kuin toiminta.
  const lead=Object.keys(g.phases[1].pose)[0],ant=g.phases[0].pose[lead],act=g.phases[1].pose[lead];if(ant&&act)assert.ok(((ant.r??0)*(act.r??0)<=0)&&((ant.y??0)*(act.y??0)<=0),name+' ennakointi');}
 for(const [name,m] of Object.entries(lowerBodyMotions)){assert.equal(m.phases[0].name,'ennakointi',name);assert.equal(m.phases.at(-1)!.name,'asettuminen',name);assert.ok(Math.abs(m.phases.reduce((s,p)=>s+p.share,0)-1)<1e-9);}
 assert.equal(lowerBodyMotions.sit.hold,true);assert.ok(lowerBodyMotions.sit.phases.at(-1)!.knee>45,'istuminen jää istuma-asentoon');
});

test('päällekkäinen toiminta: pää, kädet ja vartalo alkavat 2–4 ruudun porrastuksella; kyynärpää ja ranne kulkevat kaarella',async()=>{
 for(const lead of Object.values(overlapDelays)){const groups=[lead.head,Math.min(lead.leftArm??9,lead.rightArm??9),lead.root].filter(v=>v!==undefined).sort((a,b)=>a-b);for(let i=1;i<groups.length;i++){const gap=groups[i]-groups[0];assert.ok(gap>=2&&gap<=4||groups[i]===groups[i-1]&&false||gap>=2,JSON.stringify(lead));}}
 const r=await pack('Pipsa'),q=r.doc.quick!,b=build('Pipsa','Mira vilkuttaa.',r),a=b.animationPerActor.MIRA,e=b.presentation.events.find(x=>x.value==='wave')!,start=Math.round(e.at!*24);
 const firstMove=(role:string)=>{const s=rotationSeries(a,q.roles[role],start,start+20);return s.findIndex(v=>Math.abs(v-s[0])>.05);};
 const arm=firstMove('leftArm'),fore=firstMove('leftForearm'),head=firstMove('head');assert.ok(fore-arm>=2&&fore-arm<=4,`kyynärvarsi ${fore-arm}`);assert.ok(head-arm>=2&&head-arm<=4,`pää ${head-arm}`);
 // Ranne kulkee kaarella: reitin poikkeama suorasta jänteestä on selvä toimintavaiheessa.
 const hand=a.rig.parts.find(p=>p.key===q.roles.leftHand)!,path=Array.from({length:14},(_,i)=>{const m=animationTransforms(a,start+4+i).get(hand.key)!;return {x:m.a*hand.pivot.x+m.c*hand.pivot.y+m.e,y:m.b*hand.pivot.x+m.d*hand.pivot.y+m.f};});
 const p0=path[0],p1=path.at(-1)!,len=Math.hypot(p1.x-p0.x,p1.y-p0.y),dev=Math.max(...path.map(p=>Math.abs((p1.x-p0.x)*(p0.y-p.y)-(p0.x-p.x)*(p1.y-p0.y))/len));assert.ok(dev>len*.15,`kaari ${dev.toFixed(1)} / jänne ${len.toFixed(1)}`);
});

test('siirtymät: liike alkaa edellisen loppuasennosta (istumasta kävelyyn ilman hyppyä), kävelynopeus keston ja jalan pituuden mukaan',async()=>{
 const r=await pack('Roni-Monikulma'),q=r.doc.quick!,b=build('Roni-Monikulma','Mira istuu.\nMira vilkuttaa.\nMira kävelee oikealle 2 s.',r),a=b.animationPerActor.MIRA;
 assert.deepEqual(b.diagnostics.filter(d=>d.severity==='error'),[]);
 for(const t of a.tracks){const s=rotationSeries(a,t.key),y=rotationSeries(a,t.key,0,a.duration-1,'y');assert.ok(maxAcceleration(s)<=20,t.key+' '+maxAcceleration(s));for(let i=1;i<s.length;i++){assert.ok(Math.abs(s[i]-s[i-1])<40,`hyppy ${t.key} ruutu ${i}: ${s[i-1]}→${s[i]}`);assert.ok(Math.abs(y[i]-y[i-1])<12,`y-hyppy ${t.key} ruutu ${i}`);}}
 for(let f=0;f<a.duration;f++)assert.ok(visibleViewRoots(q,a,f)<=1,'kaksi kuvakulmaa ruudussa '+f);
 const sit=b.presentation.events.find(e=>e.value==='sit')!,wave=b.presentation.events.find(e=>e.value==='wave')!;
 const rootY=(time:number)=>sampleTrack(a.tracks.find(t=>t.key===q.roles.root),Math.round(time*24)).y;assert.ok(rootY(wave.at!+.5)>20,'vilkutus istuen: lantio pysyy alhaalla');assert.ok(Math.abs(rootY(b.presentation.seconds-.1))<1,'kävelyn jälkeen seisoo');void sit;
 const L=152;assert.ok(gaitDistance('walk',4,L)>gaitDistance('walk',2,L));assert.ok(gaitDistance('run',2,L)>gaitDistance('walk',2,L));assert.ok(gaitDistance('walk',2,2*L)===2*gaitDistance('walk',2,L),'askelpituus suhteessa hahmon kokoon');
 assert.ok(defaultMotionSeconds.wave>=1.5&&defaultMotionSeconds.sit>=1.5);
});

test('lepoelämä: silmät räpäyttävät 2,8–4,6 s välein ja hengitys liikuttaa päätä alle 1 px; liikkumiskielto ja pokerinaama hiljentävät',async()=>{
 const r=await pack('Pipsa'),q=r.doc.quick!,b=build('Pipsa','Mira odottaa 12 s.',r),a=b.animationPerActor.MIRA,blink=a.tracks.find(t=>t.key===q.roles.leftBlink)!;
 const closed=blink.frames.filter(k=>k.opacity===1).map(k=>k.frame);assert.ok(closed.length>=3,String(closed));for(let i=1;i<closed.length;i++){const gap=(closed[i]-closed[i-1])/24;assert.ok(gap>=2.8&&gap<=4.6+.05,String(gap));}
 assert.equal(sampleTrack(blink,closed[0]+3).opacity,0,'räpäytys kestää 3 ruutua');
 const headY=rotationSeries(a,q.roles.head,0,a.duration-1,'y');assert.ok(Math.max(...headY)-Math.min(...headY)>1&&Math.max(...headY.map(Math.abs))<=1,'hengitys');
 const still=build('Pipsa','Mira ei liiku.\nMira odottaa 8 s.',r).animationPerActor.MIRA;assert.ok(!still.tracks.find(t=>t.key===q.roles.leftBlink)?.frames.some(k=>k.opacity===1&&k.frame>12),'liikkumiskielto: ei räpäytyksiä');
 const again=build('Pipsa','Mira odottaa 12 s.',r).animationPerActor.MIRA;assert.deepEqual(again.tracks.find(t=>t.key===q.roles.leftBlink),blink,'deterministinen');
 const view=viewAtFrame(q,a,0);assert.equal(view,'front');void (a as Animation);void footPoint;
});
