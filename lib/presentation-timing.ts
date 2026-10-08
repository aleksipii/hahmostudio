import {phoneActions} from './phone-actions.ts';
import {heldProps,heldPropIds} from './held-props.ts';
import {reconcileProduction} from './production-model.ts';
import {productionMotions,requirementStatus} from './presentation-direction.ts';
import {validatePresentation,functions,type Presentation,type Diagnostic} from './presentation-model.ts';
/** Kuvasiirtymät: häivytys mustaan/mustasta, ristikuva ja kova leikkaus. */
/** Ilmeet, jotka kääntäjä toteuttaa mutta joita ei ole vanhassa sidosfunktiolistassa (vanhat sidokset aukeavat ennallaan). */
export const extraExpressions=['happy','sad','scared'];
export const transitionValues=['fade-in','fade-out','dissolve','cut'] as const;
/** Mustan peiton peittävyys 0–1 hetkellä `time`: häivytys mustaan pysyy mustana seuraavaan häivytykseen sisään tai seuraavan osion alkuun. */
export function transitionShade(p:Presentation,time:number):number{let shade=0;const list=p.events.filter(e=>e.kind==='transition'&&(e.value==='fade-out'||e.value==='fade-in')).sort((a,b)=>(a.at??0)-(b.at??0));for(const e of list){const at=e.at??0,d=Math.max(1e-6,e.duration??.7);if(time<at)break;const u=Math.min(1,(time-at)/d),s=u*u*(3-2*u);if(e.value==='fade-out'){shade=s;if(u>=1){const resume=p.events.find(x=>x.kind!=='transition'&&x.section!==e.section&&(x.at??0)>=at+d);if(resume&&time>=(resume.at??0))shade=0;}}else shade=1-s;}return shade;}
export function timePresentation(input:Presentation,fps:number):Presentation{
 const p=validatePresentation(input),old=new Map(p.events.map(e=>[e.id,{at:e.at,duration:e.duration,locked:e.locked}])),diagnostics:Diagnostic[]=p.diagnostics.filter(d=>!['missing-audio','missing-character','missing-function','window-overrun','target-overrun','locked-conflict','export-limit','pause-unverified','unknown-function','unknown-shot','missing-gaze-target','phone-missing','phone-carrier','recorded-missing','requirement-missing','target-underrun','locked-window','motion-conflict','environment-missing','unknown-target','unknown-placement','unknown-prop','unknown-constraint','unknown-transition'].includes(d.code));let cursor=0;
 for(const e of p.events){const section=p.sections.find(s=>s.id===e.section);if(section&&p.events.find(x=>x.section===e.section)?.id===e.id)cursor=Math.max(cursor,section.start);
  const before=old.get(e.id);e.at=cursor;e.duration=0;
  if(e.kind==='dialogue'){
   const clip=p.audioClips.find(c=>c.dialogue===e.id),b=p.bindings.find(b=>b.speaker===e.target);
   if(b&&b.functions.neutral_talk!=='supported')diagnostics.push({code:'missing-function',severity:'error',event:e.id,message:e.target+': puhetoiminnon vastaavuus puuttuu.'});if(!b)diagnostics.push({code:'missing-character',severity:'error',event:e.id,message:'Puhuja '+e.target+': valitse hahmo.'});
   if(!clip)diagnostics.push({code:'missing-audio',severity:'error',event:e.id,message:e.target+': repliikkiääni puuttuu — '+e.text});
   e.duration=clip?.duration??Math.max(.6,(e.text?.split(/\s+/).length??1)/2.8);e.basis=clip?'audio':'estimate';cursor+=e.duration;
  }else if(e.kind==='hold'){const clip=p.audioClips.find(c=>c.dialogue===e.after);e.duration=e.seconds??.25;if(clip?.pauseInside){if((clip.trailingSilence??0)+.001>=e.duration){e.at=cursor-e.duration;for(const before of p.events){if(before===e)break;if(before.kind!=='dialogue'&&before.at===cursor)before.at=e.at;}}else{diagnostics.push({code:'pause-unverified',severity:'error',event:e.id,message:'Ääniklippiin sisältyvää taukoa ei voida varmistaa. Tarkista rajat tai poista taukon sisältymisen valinta.'});cursor+=e.duration;}}else cursor+=e.duration;}
  else if(e.kind==='title'){e.duration=e.seconds??.7;cursor+=e.duration;}
  else if(e.kind==='transition'){e.duration=e.value==='cut'?0:e.seconds??(e.value==='dissolve'?.5:.7);if(e.value==='fade-out')cursor+=e.duration;if(!transitionValues.includes(e.value as typeof transitionValues[number]))diagnostics.push({code:'unknown-transition',severity:'error',event:e.id,message:'Tuntematon siirtymä: '+e.value});}
  else if(e.kind==='action'&&(productionMotions.includes(e.value as any)||phoneActions.includes(e.value as any))){e.duration=e.seconds??(e.value==='stop'?0:2);if(e.after){const dialogue=p.events.find(d=>d.id===e.after);e.at=dialogue?.at??cursor;cursor=Math.max(cursor,e.at+e.duration);}else cursor+=e.duration;}
  if(['expression','shot','gaze'].includes(e.kind)&&e.after){const d=p.events.find(d=>d.id===e.after);if(d?.at!==undefined)e.at=d.at;}
  if(p.original.trimStart().startsWith('#!kilsat') && before?.at!==undefined) {
   if(e.kind==='dialogue' && p.audioClips.some(c=>c.dialogue===e.id) && Math.abs(e.duration-(e.seconds??0))>1/fps) diagnostics.push({code:'strict-audio-timing',severity:'error',event:e.id,message:'Rivi '+e.sourceRef.line+': äänen kesto ei vastaa ilmoitettua kestoa. Korjaa kesto tai rajaa ääni.'});
   e.at=before.at;e.duration=e.seconds??e.duration;
   cursor=Math.max(...p.events.filter(v=>v===e || v.sourceRef.line<e.sourceRef.line).map(v=>(v.at??0)+(v.duration??0)),0);
  }
  if(['action','expression','gaze','placement'].includes(e.kind)&&!p.characters.includes(e.target))diagnostics.push({code:'unknown-target',severity:'error',event:e.id,message:'Ohjeen hahmo puuttuu: '+e.target});
  if(e.kind==='placement'&&!['left','right','center','custom'].includes(e.value))diagnostics.push({code:'unknown-placement',severity:'error',event:e.id,message:'Sijoittelun arvot: left, right, center, custom.'});
  if(e.kind==='prop'&&!['phone-on','phone-off'].includes(e.value)&&!(/^(hold|drop):/.test(e.value)&&heldPropIds.includes(e.value.slice(5))))diagnostics.push({code:'unknown-prop',severity:'error',event:e.id,message:'Tuettu rekvisiitta: '+heldProps.map(h=>h.name.toLocaleLowerCase('fi-FI')).join(', ')+'. Muu esine puuttuu.'});
  if(e.kind==='constraint'&&!['still','release-still','hard-cuts','no-extra-props','small-gestures','camera-still'].includes(e.value))diagnostics.push({code:'unknown-constraint',severity:'error',event:e.id,message:'Rajoituksen toteutus puuttuu.'});
  if(e.kind==='shot'&&!['wide','medium','close'].includes(e.value))diagnostics.push({code:'unknown-shot',severity:'error',event:e.id,message:'Tuntematon kuvakoko: '+e.value});
  if(['action','expression'].includes(e.kind)&&!functions.includes(e.value as any)&&!(e.kind==='expression'&&extraExpressions.includes(e.value))&&!productionMotions.includes(e.value as any)&&!phoneActions.includes(e.value as any))diagnostics.push({code:'unknown-function',severity:'error',event:e.id,message:'Tuntematon liike tai ilme: '+e.value});
  if(['action','expression','gaze'].includes(e.kind)){const b=p.bindings.find(b=>b.speaker===e.target),fn=e.kind==='gaze'?(e.value==='phone'?'look_at_phone':'look_at_other_character'):e.value;if(b&&functions.includes(fn as any)&&b.functions[fn]!=='supported')diagnostics.push({code:'missing-function',severity:'error',event:e.id,message:e.target+': toiminto '+fn+' ei ole yhdistetty.'});}
  const locks=p.production?.locks[e.id],override=p.production?.manualOverrides[e.id];if(locks?.duration&&override?.duration!==undefined&&Math.abs(override.duration-e.duration)>.5/fps)diagnostics.push({code:'locked-conflict',severity:'error',event:e.id,message:'Lukittu kesto ja äänen/tapahtuman uusi kesto ovat ristiriidassa.'});if(locks?.start&&override?.at!==undefined){if(e.at>override.at+.5/fps)diagnostics.push({code:'locked-conflict',severity:'error',event:e.id,message:'Lukittu absoluuttinen alku on uuden riippuvuuden edellä.'});e.at=override.at;cursor=Math.max(cursor,e.at+(e.duration??0));}
  if(before?.locked&&before.at!==undefined){if((['dialogue','hold'].includes(e.kind)&&before.at<e.at-.5/fps)||(['dialogue','hold','action','title'].includes(e.kind)&&Math.abs((before.duration??0)-e.duration)>.5/fps))diagnostics.push({code:'locked-conflict',severity:'error',event:e.id,message:'Lukittu tapahtuma ei sovi uuteen ajoitukseen: '+(e.text??e.value)});e.at=before.at;e.duration=before.duration??e.duration;cursor=Math.max(cursor,e.at+e.duration);}
 }
 // Explicit WIDE → quickly MEDIUM cuts during the opening line without cutting its audio.
 for(let i=1;i<p.events.length;i++){const e=p.events[i],before=p.events[i-1];if(e.kind==='shot'&&before.kind==='shot'&&before.value==='wide'&&e.sourceRef.line===before.sourceRef.line&&!e.locked)e.at=(before.at??0)+.3;}
 // A prescribed silent reaction encompasses its gaze sequence rather than adding another pause.
 for(let i=0;i<p.events.length;i++){const hold=p.events[i];if(hold.kind!=='hold'||hold.value!=='silence'||!hold.duration)continue;const gazes=[];for(let j=i-1;j>=0&&['gaze','action','note'].includes(p.events[j].kind);j--)if(p.events[j].kind==='gaze')gazes.unshift(p.events[j]);gazes.forEach((g,n)=>{if(!g.locked)g.at=hold.at!+n*hold.duration!/gazes.length;});}
 for(const s of p.sections){const es=p.events.filter(e=>e.section===s.id),end=Math.max(s.start,...es.map(e=>(e.at??0)+(e.duration??0)));if(end>s.end+.01)diagnostics.push({code:s.locked?'locked-window':'window-overrun',severity:s.locked?'error':'warning',message:s.name+': tavoite '+s.end.toFixed(2)+' s, toteutunut '+end.toFixed(2)+' s; '+es.filter(e=>e.kind==='dialogue').map(e=>e.target+': '+e.text).join(' / ')});}
 p.seconds=cursor;
 for(const r of p.direction?.requirements??[])if(requirementStatus({...p,diagnostics},r)==='missing')diagnostics.push({code:'requirement-missing',severity:'error',event:r.events[0],message:'Ohje ei toteudu (rivi '+r.sourceRef.line+'): '+r.detail+' Valitse tuettu toteutus tapahtumaeditorista tai korjaa lähdeteksti.'});
 if(p.direction&&cursor<p.direction.targetMin-.01)diagnostics.push({code:'target-underrun',severity:'error',message:'Jakso kestää '+cursor.toFixed(2)+' s, mutta tavoitteen alaraja on '+p.direction.targetMin+' s. Lisää käsikirjoitukseen perusteltu odotus tai muuta tavoiteväliä.'});
 if(cursor>p.metadata.target+.01)diagnostics.push({code:'target-overrun',severity:p.natural?'warning':'error',message:'Tavoite '+p.metadata.target+' s, toteutunut '+cursor.toFixed(2)+' s. Valitse luonnollinen pidempi kesto tai muokkaa ääniä ja tekstiä.'});
 if(Math.ceil(cursor*fps)>(p.production?.longForm?72000:1800)||cursor>(p.production?.longForm?1200:60))diagnostics.push({code:'export-limit',severity:'error',message:'Jakson vientiraja on '+(p.production?.longForm?'1200 s / 72000 ruutua':'60 s / 1800 ruutua')+'. Jaa liian pitkä käsikirjoitus.'});
 p.diagnostics=diagnostics;return p;
}
export function rebuildPresentation(parsed:Presentation,previous:Presentation):Presentation{
 const next=reconcileProduction(parsed,previous);return {...next,bindings:structuredClone(previous.bindings.filter(b=>parsed.characters.includes(b.speaker))),natural:previous.natural,source:previous.source,world:{...structuredClone(previous.world),phone:{...previous.world.phone,carrier:parsed.characters.includes(previous.world.phone.carrier)?previous.world.phone.carrier:parsed.world.phone.carrier}}};
}
