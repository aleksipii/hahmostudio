import {recognizeScript,type Clause} from '../script-recognizer.ts';
import {parseScriptResourceManifest,resolveManifestProp} from '../script-resource-manifest.ts';
import {mergeScriptResourceManifest} from '../cutout/presentation-ir.ts';
import {initProduction} from '../production-model.ts';
import {parsePresentation} from '../presentation-parser.ts';
import {environmentId,requirementCategories,type Requirement,type Category} from '../presentation-direction.ts';
import {propLibrary} from '../prop-library.ts';
import {phoneActions} from '../phone-actions.ts';
import {stableId,normalizeSpeaker,type Presentation,type Event,type Ref,type Diagnostic} from '../presentation-model.ts';
import {defaultMotionSeconds} from '../motion-library.ts';
import {sfxInstruction} from '../soundtrack.ts';
import {stemMatch,resolveEnvironment,caseTail} from './environment.ts';
import {parseMusicLine,type MusicCue} from './music.ts';
import {heldPropClause} from './spoken-props.ts';
import type {BuildOptions,EpisodeBuild} from '../episode-builder.ts';

/** Vapaa käsikirjoitus: jokainen tunnistimen rivi ja lause → tapahtuma, kommentti tai tarkistusmerkintä. */
export function recognizedPresentation(prepared:string,manifest:ReturnType<typeof parseScriptResourceManifest>,aliasMap:Record<string,string>,options:BuildOptions,diagnostics:Diagnostic[]):{p:Presentation;lineOut:EpisodeBuild['lines'];musicCues:MusicCue[];sfxLines:{line:number;sound:string}[]}{
 const resolveName=(n:string)=>{const k=normalizeSpeaker(n);return normalizeSpeaker(aliasMap[k]??k);};
 // `Resurssi hahmo X: paketti` esittelee hahmon X, vaikka se ei puhuisi.
 const declared=manifest.resources.filter(r=>r.kind==='character'&&r.speaker).map(r=>r.speaker!);
 const recognized=recognizeScript(prepared,declared,{discoverActors:true});
 const rawLines=prepared.replace(/\r\n?/g,'\n').split('\n');
 let characters=[...new Set(recognized.characters.map(resolveName))];
 // Vain hahmot, joilla on repliikki tai toimintaa, tulevat näyttämölle.
 const active=new Set<string>();for(const l of recognized.lines){if(l.speaker)active.add(resolveName(l.speaker));for(const c of l.clauses)if('actor' in c&&c.actor&&c.actor!=='*')active.add(resolveName(c.actor));for(const s of l.shot??[])if(s.target)active.add(resolveName(s.target));if(l.kind==='direction'||l.kind==='unknown'){const first=l.text.match(/^([\p{Lu}][\p{L}'-]*)/u)?.[1];if(first&&characters.includes(resolveName(first)))active.add(resolveName(first));}}
 characters=characters.filter(c=>active.has(c));
 if(characters.length>4){diagnostics.push({code:'too-many-characters',severity:'error',message:'Jaksossa voi olla enintään neljä hahmoa näyttämöllä. Mukana: '+characters.slice(0,4).join(', ')+'. Ohitettu: '+characters.slice(4).join(', ')+'. Jaa kohtaus tai jakso.'});characters=characters.slice(0,4);}
 const title=options.title??recognized.lines.find(l=>l.metadata&&['title','episode'].includes(l.metadata.key))?.metadata?.value??'Jakso';
 const p:Presentation={schemaVersion:1,id:'episode-'+stableId(prepared),original:prepared,metadata:{series:'Käsikirjoitus',season:1,episode:options.episode??1,title,target:60,purpose:'',environment:''},characters,assets:[],world:{width:options.width??1080,height:options.height??1920,background:'#ffffff',phone:{enabled:false,model:'phone-v1',carrier:characters[0]??'',hand:'leftHand',view:'front'}},sections:[],events:[],comments:[],bindings:[],audioClips:[],diagnostics:[],seconds:0,natural:true,source:'script'};
 const requirements:Requirement[]=[],lineOut:EpisodeBuild['lines']=[],musicCues:MusicCue[]=[],sfxLines:{line:number;sound:string}[]=[];
 const counts:Record<string,number>={};
 let section='intro',lastActor=characters[0]??'',speaker='',dialogue:Event|undefined,hasShot=false,durationSet=false,targetMin=0;
 const require=(category:Category,ref:Ref,status:Requirement['status'],events:string[])=>{const id='r-'+stableId(category+'|'+ref.line+'|'+ref.text);const old=requirements.find(r=>r.id===id);if(old){old.events.push(...events.filter(e=>!old.events.includes(e)));if(status==='missing'||(status==='estimated'&&old.status==='implemented'))old.status=status;}else requirements.push({id,category,detail:ref.text,sourceRef:ref,events:[...events],status});};
 // Tunniste rivin sisällöstä (ei rivinumerosta): rivien lisäys tai siirto ei vaihda muiden tapahtumien tunnisteita,
 // joten äänileikkeet, hyväksynnät ja lukitukset pysyvät kiinni.
 const add=(kind:Event['kind'],target:string,value:string,ref:Ref,extra:Partial<Event>={}):Event=>{const sig=[kind,target,value,ref.text.trim().replace(/\s+/g,' ')].join('|'),n=counts[sig]=(counts[sig]??0)+1;const e:Event={id:'e-'+stableId(sig+'|'+n),kind,target,value,sourceRef:ref,basis:'rule',section,...extra};p.events.push(e);return e;};
 const actorOf=(a:string|undefined)=>{if(!a)return lastActor;if(a==='*')return '*';const n=resolveName(a);return characters.includes(n)?n:'';};
 const warnUnknown=(ref:Ref,text:string,reason='Sääntö ei tunnista lausetta; sitä ei animoida eikä arvata.')=>diagnostics.push({code:'unrecognized-line',severity:'warning',message:`Rivi ${ref.line+(options.firstLine??1)-1}: ${reason} “${text}”`});
 const clauseEvents=(clauses:Clause[],ref:Ref,afterDialogue?:string):{events:string[];unknown:number}=>{
  const ids:string[]=[];let unknown=0;
  for(const c of clauses){
   const who=actorOf('actor' in c?c.actor:undefined),targets=who==='*'?characters:who?[who]:[];
   if(('actor' in c)&&!targets.length&&c.type!=='constraint'){unknown++;warnUnknown(ref,c.text,'Hahmoa ei tunnistettu tai se ei ole näyttämöllä.');continue;}
   if(targets.length===1)lastActor=targets[0];
   switch(c.type){
    case'motion':for(const t of targets){if(!motionNames.has(c.value)){unknown++;warnUnknown(ref,c.text);continue;}const first=!ids.some(id=>p.events.find(x=>x.id===id&&x.kind==='action'&&x.target===t&&motionNames.has(x.value)));const e=add('action',t,c.value,ref,{seconds:c.seconds??(c.value==='stop'?0:c.value.startsWith('walk')||c.value.startsWith('run')?2:defaultMotionSeconds[c.value]??1.2),basis:c.estimated?'estimate':'rule',after:first?afterDialogue:undefined});ids.push(e.id);require('action',ref,c.estimated?'estimated':'implemented',[e.id]);}break;
    case'expression':for(const t of targets){const e=add('expression',t,c.value,ref,{after:afterDialogue});ids.push(e.id);require('expression',ref,'implemented',[e.id]);}break;
    case'gaze':{const target=c.target==='phone'||c.target==='camera'?c.target:actorOf(c.target);if(!target||target==='*'){unknown++;warnUnknown(ref,c.text,'Katseen kohdetta ei tunnistettu.');break;}for(const t of targets){if(t===target)continue;if(target==='phone'&&!p.events.some(x=>x.kind==='prop'&&x.value==='phone-on')){const on=add('prop',t,'phone-on',ref,{text:'front',basis:'estimate'});ids.push(on.id);p.world.phone.enabled=true;p.world.phone.carrier=t;}const e=add('gaze',t,target,ref,{after:afterDialogue});ids.push(e.id);require('gaze',ref,'implemented',[e.id]);}break;}
    case'phone':for(const t of targets){
     if(c.value==='phone-on'||c.value==='phone-off'||c.value==='phone_hold'){const e=add('prop',t,c.value==='phone-off'?'phone-off':'phone-on',ref,{text:'front'});ids.push(e.id);if(c.value!=='phone-off'){p.world.phone.enabled=true;if(!p.events.some(x=>x.kind==='prop'&&x.id!==e.id))p.world.phone.carrier=t;}require('prop',ref,'implemented',[e.id]);if(c.value==='phone_hold'){const h=add('action',t,'phone_hold',ref,{seconds:.8});ids.push(h.id);require('prop',ref,'implemented',[h.id]);}}
     else if(c.value==='phone_look'){if(!p.events.some(x=>x.kind==='prop'&&x.value==='phone-on')){const on=add('prop',t,'phone-on',ref,{text:'front',basis:'estimate'});ids.push(on.id);p.world.phone.enabled=true;p.world.phone.carrier=t;}const e=add('gaze',t,'phone',ref);ids.push(e.id);require('gaze',ref,'implemented',[e.id]);}
     else if((phoneActions as readonly string[]).includes(c.value)){if(!p.events.some(x=>x.kind==='prop'&&x.value==='phone-on')){const on=add('prop',t,'phone-on',ref,{text:'front',basis:'estimate'});ids.push(on.id);p.world.phone.enabled=true;p.world.phone.carrier=t;}const e=add('action',t,c.value,ref,{seconds:.8,after:afterDialogue});ids.push(e.id);require('prop',ref,'implemented',[e.id]);}
    }break;
    case'hold':{const t=targets[0]??lastActor;const e=add('hold',t||'scene',c.value,ref,{seconds:c.seconds??.5,protected:c.seconds!==undefined,basis:c.seconds!==undefined?'rule':'estimate',after:afterDialogue});ids.push(e.id);require('timing',ref,c.seconds!==undefined?'implemented':'estimated',[e.id]);break;}
    case'constraint':{const named=c.actor?actorOf(c.actor):'';if(['no-dialogue','other'].includes(c.value)){const e=add('note',named||'scene',c.text,ref);ids.push(e.id);diagnostics.push({code:'constraint-info',severity:'warning',message:`Rivi ${ref.line}: rajoitus kirjattu, mutta sillä ei ole automaattista toteutusta: “${c.text}”`});break;}const camera=c.value==='camera-still'||c.value==='hard-cuts';const e=add('constraint',camera?'scene':(named&&named!=='*'?named:'scene'),c.value,ref);ids.push(e.id);require('restriction',ref,'implemented',[e.id]);break;}
    case'environment':{const id=resolveEnvironment(c.value);const e=add('environment','scene',id??c.value,ref);ids.push(e.id);require('environment',ref,id?'implemented':'missing',[e.id]);break;}
    case'title-card':{const e=add('title','scene',c.value,ref,{seconds:c.seconds??1.2,basis:c.seconds!==undefined?'rule':'estimate'});ids.push(e.id);require('ending',ref,'implemented',[e.id]);break;}
    case'editing':{diagnostics.push({code:'editing-info',severity:'warning',message:`Rivi ${ref.line}: leikkausrytmiä ei säädetä automaattisesti: “${c.text}”`});break;}
    case'unsupported':unknown++;warnUnknown(ref,c.text,c.reason);break;
    case'note':p.comments.push(ref);diagnostics.push({code:'note-line',severity:'warning',message:`Rivi ${ref.line+(options.firstLine??1)-1}: kirjattu huomioksi, ei animoida: “${c.text}”`});break;
    case'unknown':unknown++;warnUnknown(ref,c.text);break;
   }
  }
  return {events:ids,unknown};
 };
 for(const l of recognized.lines){
  const ref:Ref={line:l.line,text:rawLines[l.line-1]??l.raw};const before=p.events.length;let outcome:EpisodeBuild['lines'][number]['outcome']='structure';
  if(l.kind!=='dialogue'&&l.kind!=='empty'&&l.kind!=='parenthetical')dialogue=undefined;
  const music=parseMusicLine(l.text);
  if(music){musicCues.push({...music,line:l.line});if(!music.off&&!music.file&&!music.mood){warnUnknown(ref,l.text,'Musiikin tunnelmaa ei tunnistettu (iloinen, jännittävä, rauhallinen, surullinen tai tiedostonimi).');outcome='unrecognized';}lineOut.push({line:l.line,kind:'metadata',outcome,events:[]});continue;}
  const sfx=l.kind==='direction'||l.kind==='unknown'||l.kind==='metadata'||l.kind==='comment'?sfxInstruction(l.text):undefined;
  if(sfx&&!(l.clauses.some(c=>c.type!=='unknown'&&c.type!=='note')&&!/^(?:Ääni|Äänitehoste|Tehoste|SFX|Sound)/i.test(l.text))){sfxLines.push({line:l.line,sound:sfx});lineOut.push({line:l.line,kind:l.kind,outcome:'structure',events:[]});continue;}
  switch(l.kind){
   case'empty':lineOut.push({line:l.line,kind:l.kind,outcome:'empty',events:[]});continue;
   case'comment':case'strict-header':if(l.text)p.comments.push(ref);if(l.shot?.length||l.clauses.some(c=>c.type!=='note'))diagnostics.push({code:'notes-ignored',severity:'warning',message:`Rivi ${l.line}: tuotanto-ohjeosion rivi on kommentti eikä ohjaa animaatiota.`});lineOut.push({line:l.line,kind:l.kind,outcome:'comment',events:[]});continue;
   case'metadata':{const m=l.metadata;
    if(m?.key==='title'||m?.key==='episode'){if(!options.title)p.metadata.title=m.value.replace(/^S\d+E\d+\s*:?\s*/i,'')||p.metadata.title;}
    else if(m?.key==='series')p.metadata.series=m.value;
    else if(m?.key==='purpose'){p.metadata.purpose=m.value;require('purpose',ref,'estimated',[]);}
    else if(m?.key==='duration'){const pair=m.value.match(/(\d+(?:[.,]\d+)?)\s*[–—-]\s*(\d+(?:[.,]\d+)?)/),one=m.value.match(/(\d+(?:[.,]\d+)?)/);if(pair){targetMin=+pair[1].replace(',','.');p.metadata.target=+pair[2].replace(',','.');}else if(one)p.metadata.target=+one[1].replace(',','.');p.metadata.target=Math.min(1200,Math.max(1,p.metadata.target));durationSet=true;require('timing',ref,'implemented',[]);}
    else if(m?.key==='environment'){const id=resolveEnvironment(m.value);if(!p.metadata.environment)p.metadata.environment=m.value;const e=add('environment','scene',id??m.value,ref);require('environment',ref,id?'implemented':'missing',[e.id]);outcome='event';}
    else if(/^(?:Resurssi|Resource)\s/i.test(l.text)||/^(?:Tunnus\s+)?@/.test(l.text)){/* resurssi- ja tunnusrivit käsitellään erikseen */}
    else clauseEvents(l.clauses,ref);
    break;}
   case'scene-heading':case'timecode':{const s=l.scene!;section='section-'+p.sections.length;p.sections.push({id:section,name:s.name||'Kohtaus '+(p.sections.length+1),start:s.start??0,end:s.end??1200,sourceRef:ref});
    if(l.kind==='scene-heading'){const id=resolveEnvironment(s.name);const e=add('environment','scene',id??s.name,ref);require('environment',ref,id?'implemented':'missing',[e.id]);if(!p.metadata.environment)p.metadata.environment=s.name;}
    speaker='';break;}
   case'transition':{const v=transitionMap[l.transition??'cut']??'cut';const e=add('transition','scene',v,ref,{seconds:v==='cut'?0:v==='dissolve'?.5:.7});require('camera',ref,'implemented',[e.id]);break;}
   case'shot':{for(const s of l.shot??[]){const t=s.target?actorOf(s.target):'';const size=s.size??(s.move||s.angle?'medium':undefined);if(!size){diagnostics.push({code:'camera-info',severity:'warning',message:`Rivi ${l.line}: kameraliikettä ei animoida, rajaus säilyy.`});continue;}const target=size==='wide'&&!s.target?'scene':t||lastActor||'scene';if(target!=='scene'&&!characters.includes(target)){warnUnknown(ref,l.text,'Kuvan kohdehahmoa ei ole näyttämöllä.');continue;}const e=add('shot',target,size,ref);hasShot=true;require('camera',ref,'implemented',[e.id]);}if(l.clauses.length)clauseEvents(l.clauses,ref);break;}
   case'character-decl':break;
   case'cue':{speaker=actorOf(l.speaker);if(speaker==='*')speaker='';if(l.dialogue&&speaker){const e=add('dialogue',speaker,'neutral_talk',ref,{text:l.dialogue,basis:'estimate'});dialogue=e;lastActor=speaker;require('dialogue',ref,'estimated',[e.id]);}else if(!speaker&&l.speaker)warnUnknown(ref,l.text,'Puhujaa ei ole näyttämöllä.');if(l.parenthetical)clauseEvents(l.clauses,ref);break;}
   case'parenthetical':clauseEvents(l.clauses,ref,dialogue?.id);break;
   case'dialogue':{const who=l.speaker?actorOf(l.speaker):speaker;const text=(l.dialogue??l.text).replace(/^[“"„«]|[”"»]$/g,'').trim();if(!who||who==='*'){warnUnknown(ref,l.text,'Repliikin puhujaa ei tunnistettu.');outcome='unrecognized';break;}
    if(dialogue&&dialogue.target===who&&!/^[“"„«]/.test(l.text)){dialogue.text=(dialogue.text+' '+text).trim();lineOut.push({line:l.line,kind:l.kind,outcome:'event',events:[dialogue.id]});continue;}
    const e=add('dialogue',who,'neutral_talk',ref,{text,basis:'estimate'});dialogue=e;lastActor=who;require('dialogue',ref,'estimated',[e.id]);break;}
   case'direction':case'unknown':{
    // Käteen otettavat esineet (kahvikuppi, kirja, laukku, sateenvarjo): suljettu sanasto, ei osamerkkijonoja.
    const rest:Clause[]=[];let heldEvents=0;
    for(const c of l.clauses){const held=heldPropClause(c.text);if(!held||(c.type!=='unknown'&&c.type!=='note'&&!(c.type==='phone'&&held.id!=='phone-v1'))){rest.push(c);continue;}
     const named=('actor' in c&&c.actor?actorOf(c.actor):'')||characters.find(n=>(c.text.toLocaleLowerCase('fi-FI').match(/[\p{L}]+/gu)??[]).some(w=>stemMatch(w,n.toLocaleLowerCase('fi-FI'))))||(/^(hän|he|she)\b/i.test(c.text)?lastActor:'')||lastActor;
     if(!named||named==='*'){rest.push(c);continue;}lastActor=named;
     const e=add('prop',named,held.verb+':'+held.id,ref,held.hand?{text:held.hand}:{});heldEvents++;require('prop',ref,'implemented',[e.id]);}
    if(heldEvents&&!rest.length)break;
    const r=clauseEvents(rest,ref,/^(samalla|meanwhile)\b/i.test(l.text)?p.events.filter(e=>e.kind==='dialogue').at(-1)?.id:undefined);if(!l.clauses.length){warnUnknown(ref,l.text);outcome='unrecognized';}else if(r.unknown&&!r.events.length)outcome='unrecognized';break;}
  }
  const created=p.events.slice(before).map(e=>e.id);
  lineOut.push({line:l.line,kind:l.kind,outcome:created.length?'event':outcome,events:created});
 }
 // Resurssi-, tunnus- ja aliasrivit: roolitus ja taustat.
 for(const r of manifest.resources)if(r.kind==='prop'&&!resolveManifestProp(r.propId??r.label))diagnostics.push({code:'prop-missing',severity:'error',message:`Rivi ${r.sourceLine}: esinettä ei ole kirjastossa: ${r.label}`});
 // Esineet, jotka mainitaan mutta joita ei vielä kiinnitetä käteen (puhelin on erikseen).
 const mentioned=new Set<string>();for(const l of recognized.lines){if(l.kind!=='direction'&&l.kind!=='unknown')continue;if(p.events.some(e=>e.kind==='prop'&&e.sourceRef.line===l.line&&/^(hold|drop):/.test(e.value)))continue;const tokens=l.text.toLocaleLowerCase('fi-FI').match(/[\p{L}]+/gu)??[];for(const prop of propLibrary){if(prop.id==='phone-prop-v1')continue;const name=prop.name.toLocaleLowerCase('fi-FI');if(tokens.some(w=>w.startsWith(name)&&caseTail.test(w.slice(name.length))))mentioned.add(prop.name);}}
 for(const name of mentioned)diagnostics.push({code:'prop-mention',severity:'warning',message:'Esine “'+name+'” mainitaan ohjeessa. Lisää se tarvittaessa rivillä “Resurssi esine: '+name+'”.'});
 // Oletuskuvat: ilman yhtään kuvaohjetta yleiskuva alkuun ja puolikuva puhujanvaihdoissa (merkitty arvioiduiksi).
 if(!hasShot&&p.events.length){const ordered:Event[]=[];let current='';const first=p.events.find(e=>e.kind!=='environment')??p.events[0];for(const e of p.events){if(e===first){ordered.push({...e,id:'shot-wide-'+e.id,kind:'shot',target:'scene',value:'wide',text:undefined,seconds:undefined,after:undefined,basis:'estimate'});current='scene';}if(e.kind==='dialogue'&&current!==e.target&&characters.length>1){ordered.push({...e,id:'shot-'+e.id,kind:'shot',value:'medium',text:undefined,basis:'estimate'});current=e.target;}ordered.push(e);}p.events=ordered;}
 if(!p.events.some(e=>e.kind==='environment')){diagnostics.push({code:'environment-default',severity:'warning',message:'Miljöötä ei määritelty: käytetään neutraalia valkoista taustaa. Lisää esim. “Tausta: keittiö” tai kohtausotsikko “INT. KEITTIÖ”.'});}
 for(const e of p.events.filter(e=>e.kind==='environment'&&!resolveEnvironment(e.value)))diagnostics.push({code:'environment-unknown',severity:'error',event:e.id,message:`Rivi ${e.sourceRef.line}: taustaa “${e.value}” ei ole kirjastossa. Käytetään neutraalia taustaa. Valitse tausta (esim. keittiö, olohuone, katu, studio).`});
 const firstEnv=p.events.find(e=>e.kind==='environment');const firstDesign=firstEnv?environmentId(firstEnv.value):undefined;if(firstDesign&&firstDesign!=='white')p.world.design=firstDesign;
 if(!durationSet)p.metadata.target=60;
 if(!p.events.some(e=>['dialogue','action','title','hold','expression','gaze'].includes(e.kind)))diagnostics.push({code:'empty-episode',severity:'error',message:'Esitystapahtumia ei löytynyt. Kirjoita PUHUJA: ja repliikki tai nimetty hahmo ja tuettu verbi (esim. “Mira vilkuttaa”).'});
 for(const e of p.events)if(!requirements.some(r=>r.events.includes(e.id))&&e.kind!=='note')require(e.kind==='shot'?'camera':'action',e.sourceRef,e.basis==='estimate'?'estimated':'implemented',[e.id]);
 for(const r of requirements)if(r.status==='estimated')r.accepted=true;
 p.direction={targetMin,targetMax:p.metadata.target,profiles:characters.map(s=>({speaker:s,personality:'',relationship:'',delivery:'',intensity:1,still:false,sourceRefs:[]})),requirements:requirements.filter(r=>requirementCategories.includes(r.category)),noLargeGestures:false,noExtraProps:p.events.some(e=>e.value==='no-extra-props')};
 p.production=initProduction(p);
 mergeScriptResourceManifest(p,manifest);
 return {p,lineOut,musicCues,sfxLines};
}
/** `#!kilsat`-tila: olemassa oleva tarkka kielioppi ja sen ajoitus säilyvät sellaisenaan. */
export function strictPresentation(prepared:string,aliasMap:Record<string,string>,options:BuildOptions,diagnostics:Diagnostic[]):{p:Presentation;lineOut:EpisodeBuild['lines'];musicCues:MusicCue[];sfxLines:{line:number;sound:string}[]}{
 const p=parsePresentation(prepared,aliasMap);if(options.title)p.metadata.title=options.title;p.metadata.episode=options.episode??p.metadata.episode;
 const musicCues:MusicCue[]=[],lineOut:EpisodeBuild['lines']=[];
 prepared.replace(/\r\n?/g,'\n').split('\n').forEach((text,i)=>{const m=parseMusicLine(text);if(m)musicCues.push({...m,line:i+1});const events=p.events.filter(e=>e.sourceRef.line===i+1).map(e=>e.id);lineOut.push({line:i+1,kind:text.trim()?'direction':'empty',outcome:events.length?'event':text.trim()?'structure':'empty',events});});
 for(const r of p.direction?.requirements??[])r.accepted=true;
 return {p,lineOut,musicCues,sfxLines:[]};
}

const motionNames=new Set(['walk-left','walk-right','walk-front','run-left','run-right','run-front','wave','point','fist','sit','jump','crouch','nod','react-nod','react-surprise','react-wave','stop']);
const transitionMap:Record<string,string>={'fade-in':'fade-in','fade-out':'fade-out',dissolve:'dissolve',cut:'cut','smash-cut':'cut','match-cut':'cut'};
