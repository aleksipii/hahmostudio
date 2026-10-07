/**
 * Yhden painalluksen jaksonrakentaja: käsikirjoitus → tunnistin → esitysmalli → roolitus → animaatio.
 *
 * Rakentaja on puhdas ja deterministinen: sama syöte ja sama kirjasto tuottavat saman tuloksen tavu tavulta
 * (ei kelloa, satunnaisuutta tai verkkoa). Jokainen rivi saa tasan yhden lopputuloksen: tunnistettu tapahtuma,
 * kommentti tai näkyvä tarkistusmerkintä. Tunnistamatonta ohjetta ei arvata eikä käsikirjoituksen tekstiä suoriteta.
 */
import {recognizeScript,cleanLine,type Clause,type RecognizedLine} from './script-recognizer.ts';
import {applySpeakerHandlesToScript,parseSpeakerHandleAliases,speakerHandlesToPresentationAliases} from './speaker-handle-aliases.ts';
import {parseScriptResourceManifest,validateScriptResources,resolveManifestProp} from './script-resource-manifest.ts';
import {mergeScriptResourceManifest} from './cutout/presentation-ir.ts';
import {initProduction} from './production-model.ts';
import {compilePresentation,type PresentationAssets} from './presentation-compile.ts';
import {parsePresentation} from './presentation-parser.ts';
import {environmentId,requirementCategories,type Requirement,type Category} from './presentation-direction.ts';
import {environmentLibrary} from './environment-library.ts';
import {backgrounds} from './backgrounds.ts';
import {propLibrary} from './prop-library.ts';
import {phoneActions} from './phone-actions.ts';
import {functions,stableId,normalizeSpeaker,validatePresentation,type Presentation,type Event,type Ref,type Diagnostic,type Binding} from './presentation-model.ts';
import type {Animation} from './animation-model.ts';
import {heldPropFromWord} from './held-props.ts';
import {stageActor,stageState} from './presentation-stage.ts';
import {viewAtFrame} from './character-view.ts';
import {animationTransforms} from './animation-transform.ts';

/* ───────────────────────── Jaksojako ───────────────────────── */

export type EpisodeSource={index:number;title:string;text:string;firstLine:number};
const episodeHeading=/^(?:#{1,6}\s*)?(?:Jakso|Episode)\s+(\d{1,3})\s*[:.–—-]\s*(.*)$/iu;
/** `---`-rivi tai `Jakso N:` / `Episode N:` -otsikko aloittaa uuden jakson. Rivinumerot säilyvät `firstLine`-siirtymänä. */
export function splitEpisodes(text:string):EpisodeSource[]{
 const lines=text.replace(/\r\n?/g,'\n').split('\n'),out:EpisodeSource[]=[];let start=0,title='';
 const hasContent=(a:number,b:number)=>lines.slice(a,b).some(l=>l.trim()&&!/^-{3,}\s*$/.test(l.trim())&&!/^#(?:\s|$)/.test(l.trim()));
 const push=(end:number)=>{if(hasContent(start,end))out.push({index:out.length+1,title:title||'Jakso '+(out.length+1),text:lines.slice(start,end).join('\n'),firstLine:start+1});};
 for(let i=0;i<lines.length;i++){const t=lines[i].trim();
  if(/^-{3,}$/.test(t)){push(i);start=i+1;title='';continue;}
  if(t==='#!kilsat'){if(hasContent(start,i))push(i);start=i;title='';continue;}
  if(/^(?:Jakson nimi|Title)\s*:/i.test(t)&&!title)title=t.slice(t.indexOf(':')+1).trim();
  const m=t.replace(/\*\*/g,'').match(episodeHeading);
  if(m){if(hasContent(start,i)){push(i);start=i;}title=m[2].trim()||'Jakso '+m[1];}
 }
 push(lines.length);
 if(!out.length)out.push({index:1,title:'Jakso 1',text,firstLine:1});
 return out;
}

/* ───────────────────────── Miljöö ───────────────────────── */

/** Synonyymit → kirjaston tausta. Sanat tunnistetaan vartaloina (keittiö → keittiössä, keittiöön). Tarkemmat ensin. */
const environmentSynonyms:[string[],string][]=[
 [['kotitoimisto','työhuone','home office','study room'],'home-office-scene-v1'],
 [['neuvotteluhuone','kokoushuone','meeting room','conference room','palaverihuone'],'meeting-scene-v1'],
 [['bussipysäkki','pysäkki','bus stop','bus station'],'bus-stop-scene-v1'],
 [['parkkipaikka','parkkihalli','pysäköintipaikka','pysäköintialue','parking lot','parking garage','car park'],'parking-scene-v1'],
 [['autotalli','garage'],'garage-scene-v1'],
 [['kartonkistudio','cutout studio'],'cutout-studio-v1'],[['kartonkikatu','cutout street'],'cutout-street-v1'],[['kartonkiauto','cutout car'],'cutout-car-v1'],
 [['takapenki','back seat'],'car-back-v1'],[['kuljettaja','driver seat'],'car-driver-v1'],[['matkustaja','passenger seat'],'car-passenger-v1'],
 [['auto','car','taksi','taxi'],'car-interior-v2'],
 [['keittiö','kitchen','keittokomero'],'kitchen-scene-v1'],
 [['olohuone','living room','asunto','apartment','flat','koti','home','sali','lounge'],'apartment-v1'],
 [['toimisto','office','työpaikka','workplace'],'office-scene-v1'],
 [['eteinen','käytävä','hallway','hall','corridor','entrance','aula','lobby'],'hall-scene-v1'],
 [['kahvila','cafe','café','coffee shop','kahvio'],'cafe-scene-v1'],
 [['ravintola','restaurant','ruokala','diner','baari','bar'],'restaurant-scene-v1'],
 [['luokkahuone','luokka','koulu','classroom','school'],'classroom-scene-v1'],
 [['kirjasto','library'],'library-scene-v1'],
 [['palvelupiste','vastaanotto','kassa','reception','service desk','front desk'],'service-scene-v1'],
 [['kaupunki ilta','city evening','city night','yökaupunki'],'city-evening-v1'],
 [['tori','aukio','kaupunkiaukio','square','plaza','town square'],'square-scene-v1'],
 [['katu','jalkakäytävä','kaupunki','street','sidewalk','city','town','road','tie'],'street-scene-v1'],
 [['puisto','piha','puutarha','park','garden','yard','backyard'],'park-scene-v1'],
 [['metsä','metsäpolku','forest','woods','trail'],'forest-scene-v1'],
 [['ranta','uimaranta','beach','shore','seaside'],'beach-scene-v1'],
 [['valkoinen studio','white studio'],'white-studio-scene-v1'],[['tumma studio','dark studio'],'dark-studio-scene-v1'],[['väristudio','color studio'],'color-studio-scene-v1'],
 [['esittelytila','infographic'],'infographic-scene-v1'],
 [['studio'],'studio-v1'],
];
const caseTail=/^(?:n|a|ä|ta|tä|lle|lta|ltä|lla|llä|ssa|ssä|sta|stä|ksi|na|nä|on|ön|en|in|hin|seen|ssa|ihin|s|es|'s)?$/u;
/** Sana = vartalo + sijapääte; myös heikko aste (pysäkki → pysäkillä, laukku → laukun). */
export function stemMatch(word:string,stem:string){if(word.startsWith(stem)&&caseTail.test(word.slice(stem.length)))return true;const weak=stem.replace(/([kpt])\1([aeiouyäö])$/u,'$1$2');return weak!==stem&&word.startsWith(weak)&&caseTail.test(word.slice(weak.length));}
/** Ympäristön nimi → kirjaston taustan tunniste, tai `undefined` jos sääntöä ei ole (ei arvausta). */
export function resolveEnvironment(name:string):string|undefined{
 const text=name.toLocaleLowerCase('fi-FI').replace(/[–—-]/g,' ').replace(/[^\p{L}\d\s']/gu,' ').replace(/\s+/g,' ').trim();if(!text)return;
 if(backgrounds.some(b=>b.id===name.trim()))return name.trim();
 const words=text.split(' ');
 for(const [terms,id] of environmentSynonyms)for(const term of terms){
  const parts=term.split(' ');
  for(let i=0;i+parts.length<=words.length;i++){
   if(parts.every((p,j)=>j<parts.length-1?words[i+j]===p:stemMatch(words[i+j],p)))return id;
  }
 }
 const legacy=environmentId(name);return legacy&&legacy!=='white'?legacy:undefined;
}

/* ───────────────────────── Roolitus ───────────────────────── */

export type CastPack={id:string;name:string;aliases?:string[]};
export type CastChoice={speaker:string;pack:string|undefined;reason:'resource'|'handle'|'name'|'default'|'none'};
export const defaultCastPacks=['Pipsa','Ville','Taru','Ukko'];
/** Käsikirjoituksen hahmonimet ja tunnukset, joilla kirjaston kartonkipaketit löytyvät. */
export const castPackAliases:Record<string,string[]>={'Mr.Kille':['kille','mr kille'],'Mr.Handu':['handu','mr handu']};
/** Resurssirivin pakettiavain → kirjaston paketti (tarkka tunniste, alias tai nimi kirjainkoosta riippumatta). */
export function resolvePackKey(key:string,packs:CastPack[]):string|undefined{const exact=packs.find(p=>p.id===key);if(exact)return exact.id;const k=normalizeSpeaker(key.replace(/[-_.]/g,' '));return (packs.find(p=>(p.aliases??[]).some(a=>normalizeSpeaker(a)===k))??packs.find(p=>normalizeSpeaker(p.id.replace(/[-_.]/g,' '))===k||normalizeSpeaker(p.name.replace(/[-_.]/g,' '))===k))?.id;}
const packKey=(s:string)=>normalizeSpeaker(s.replace(/[-_]/g,' ').replace(/\b(3D|MONIKULMA|STUDIO|OMA)\b/gi,'').trim());
/**
 * Puhuja → hahmopaketti: 1) `Resurssi hahmo X: paketti`, 2) `@tunnus → HAHMO` jonka tunnus on paketin nimi,
 * 3) puhujan nimi = paketin nimi tai alias, 4) oletuspaketti järjestyksessä (merkitään tarkistukseen).
 */
export function planCast(characters:string[],packs:CastPack[],options:{resources?:Record<string,string>;handles?:Record<string,string>;defaults?:string[]}={}):CastChoice[]{
 const used=new Set<string>(),out:CastChoice[]=[];const has=(id:string)=>packs.some(p=>p.id===id);
 for(const speaker of characters){
  const res=options.resources?.[speaker]?resolvePackKey(options.resources[speaker],packs)??options.resources[speaker]:undefined;if(res){out.push({speaker,pack:res,reason:'resource'});used.add(res);continue;}
  const handle=Object.entries(options.handles??{}).find(([,s])=>normalizeSpeaker(s)===speaker)?.[0];
  const byHandle=handle?packs.find(p=>normalizeSpeaker(p.id)===normalizeSpeaker(handle))??packs.find(p=>packKey(p.id)===normalizeSpeaker(handle)||packKey(p.name)===normalizeSpeaker(handle)):undefined;
  if(byHandle&&!used.has(byHandle.id)){out.push({speaker,pack:byHandle.id,reason:'handle'});used.add(byHandle.id);continue;}
  const free=packs.filter(p=>!used.has(p.id)),byName=free.find(p=>normalizeSpeaker(p.id)===speaker)??free.find(p=>packKey(p.id)===speaker||packKey(p.name)===speaker||(p.aliases??[]).some(a=>normalizeSpeaker(a)===speaker));
  if(byName){out.push({speaker,pack:byName.id,reason:'name'});used.add(byName.id);continue;}
  out.push({speaker,pack:undefined,reason:'none'});
 }
 for(const c of out)if(!c.pack){const next=(options.defaults??defaultCastPacks).find(id=>has(id)&&!used.has(id))??packs.find(p=>!used.has(p.id))?.id;if(next){c.pack=next;c.reason='default';used.add(next);}}
 return out;
}

/* ───────────────────────── Ääni ───────────────────────── */

export const musicMoods=['iloinen','jännittävä','rauhallinen','surullinen'] as const;
export type MusicMood=typeof musicMoods[number];
const moodWords:[RegExp,MusicMood][]=[[/^(iloi\p{L}*|happy|cheerful|upbeat|reipas|pirteä)$/u,'iloinen'],[/^(jännit\p{L}*|tense|suspense\p{L}*|exciting|dramaattinen|dramatic)$/u,'jännittävä'],[/^(rauhalli\p{L}*|calm|peaceful|relaxed|chill|levollinen)$/u,'rauhallinen'],[/^(surulli\p{L}*|sad|melancholic|melankolinen|haikea)$/u,'surullinen']];
export type MusicCue={mood?:MusicMood;file?:string;off?:boolean;line:number;text:string};
/** `Musiikki: rauhallinen`, `Music: tense`, `Musiikki: tiedosto.wav`, `Musiikki: pois`. */
export function parseMusicLine(text:string):Omit<MusicCue,'line'>|undefined{
 const m=cleanLine(text).match(/^(?:Musiikki|Taustamusiikki|Music|Background music)\s*:\s*(.+)$/i);if(!m)return;const v=m[1].trim();
 if(/^(pois|ei|off|none|stop|loppuu)$/i.test(v))return{off:true,text:v};
 if(/^[\w.-]{1,100}\.(wav|mp3|m4a|aac|ogg|flac)$/i.test(v))return{file:v,text:v};
 const mood=v.toLocaleLowerCase('fi-FI').split(/[\s,]+/).map(w=>moodWords.find(([re])=>re.test(w))?.[1]).find(Boolean);
 return{mood,text:v};
}
export type EpisodeAudioPlan={
 dialogue:{event:string;speaker:string;text:string;line:number;status:'linked'|'missing'}[];
 music:(MusicCue&{at:number;status:'generated'|'imported'|'stopped'|'unknown'})[];
};

/* ───────────────────────── Rakennus ───────────────────────── */

export type BuildStage='recognize'|'cast'|'motion'|'audio'|'done';
export const buildStageNames:Record<BuildStage,string>={recognize:'Tunnistus',cast:'Roolitus',motion:'Liikkeet',audio:'Ääni',done:'Valmis'};
export type EpisodeLibrary={packs:CastPack[];assets:PresentationAssets;defaults?:string[]};
export type BuildOptions={fps?:number;width?:number;height?:number;title?:string;episode?:number;firstLine?:number;previous?:Presentation};
export type EpisodeBuild={
 presentation:Presentation;
 assets:string[];
 cast:CastChoice[];
 animationPerActor:Record<string,Animation>;
 audioPlan:EpisodeAudioPlan;
 diagnostics:Diagnostic[];
 lines:{line:number;kind:RecognizedLine['kind'];outcome:'event'|'structure'|'comment'|'unrecognized'|'empty';events:string[]}[];
};

const motionNames=new Set(['walk-left','walk-right','walk-front','run-left','run-right','run-front','wave','point','fist','sit','jump','crouch','nod','react-nod','react-surprise','react-wave','stop']);
const transitionMap:Record<string,string>={'fade-in':'fade-in','fade-out':'fade-out',dissolve:'dissolve',cut:'cut','smash-cut':'cut','match-cut':'cut'};

/** Käsikirjoitus (yksi jakso) → katsottava ja muokattava esitys. */
export function buildEpisode(scriptText:string,library:EpisodeLibrary,options:BuildOptions={},onStage?:(stage:BuildStage)=>void):EpisodeBuild{
 if(!scriptText.trim())return failedBuild(scriptText,options,'Käsikirjoitus on tyhjä. Kirjoita tai liitä käsikirjoitus, tai kokeile esimerkkiä.');
 if(scriptText.length>60000)return failedBuild(scriptText.slice(0,60000),options,'Käsikirjoitus on liian pitkä (enintään 60 000 merkkiä). Jaa se jaksoihin ---‑rivillä.');
 try{return buildEpisodeUnsafe(scriptText,library,options,onStage);}
 catch(error){return failedBuild(scriptText,options,'Jaksoa ei voitu rakentaa: '+(error instanceof Error?error.message:String(error)));}
}
/** Rakennus, joka ei onnistunut: tyhjä mutta kelvollinen esitys ja virhe tarkistuksessa. Teksti säilyy sellaisenaan. */
function failedBuild(text:string,options:BuildOptions,message:string):EpisodeBuild{
 const p:Presentation={schemaVersion:1,id:'episode-'+stableId(text),original:text,metadata:{series:'Käsikirjoitus',season:1,episode:options.episode??1,title:options.title??'Jakso',target:60,purpose:'',environment:''},characters:[],assets:[],world:{width:options.width??1080,height:options.height??1920,background:'#ffffff',phone:{enabled:false,model:'phone-v1',carrier:'',hand:'leftHand',view:'front'}},sections:[],events:[],comments:[],bindings:[],audioClips:[],diagnostics:[{code:'build-failed',severity:'error',message}],seconds:0,natural:true,source:'script'};
 return {presentation:p,assets:[],cast:[],animationPerActor:{},audioPlan:{dialogue:[],music:[]},diagnostics:p.diagnostics,lines:[]};
}
function buildEpisodeUnsafe(scriptText:string,library:EpisodeLibrary,options:BuildOptions,onStage?:(stage:BuildStage)=>void):EpisodeBuild{
 const fps=options.fps??24,diagnostics:Diagnostic[]=[];
 onStage?.('recognize');
 const handles=parseSpeakerHandleAliases(scriptText),prepared=applySpeakerHandlesToScript(scriptText,handles);
 const manifest=parseScriptResourceManifest(prepared);for(const problem of validateScriptResources(manifest))diagnostics.push({code:'resource-invalid',severity:'error',message:problem});
 const aliasMap=speakerHandlesToPresentationAliases(handles);
 const resolveName=(n:string)=>{const k=normalizeSpeaker(n);return normalizeSpeaker(aliasMap[k]??k);};
 const resources:Record<string,string>={};for(const r of manifest.resources)if(r.kind==='character'&&r.speaker&&r.assetKey)resources[resolveName(r.speaker)]=r.assetKey;
 const built=prepared.trimStart().startsWith('#!kilsat')?strictPresentation(prepared,aliasMap,options,diagnostics):recognizedPresentation(prepared,manifest,aliasMap,options,diagnostics);
 onStage?.('cast');
 const {p,lineOut,musicCues}=built,characters=p.characters;
 // Resurssiriveillä lisätyt kalusteet pysyvät näyttämöllä koko jakson (kesto ei ole vielä tiedossa jäsennyksessä).
 for(const prop of p.production?.props??[])if(prop.id.startsWith('res-manifest-'))prop.end=1200;
 if(options.width||options.height){p.world.width=options.width??p.world.width;p.world.height=options.height??p.world.height;}
 // Roolitus.
 const cast=planCast(characters,library.packs,{resources,handles,defaults:library.defaults});
 for(const [i,c] of cast.entries()){
  if(c.reason==='default')diagnostics.push({code:'default-cast',severity:'warning',message:`${c.speaker}: kirjastossa ei ole samannimistä hahmoa, käytetään pakettia ${c.pack}. Vaihda roolituksessa tai lisää “Resurssi hahmo ${c.speaker}: paketti”.`});
  if(!c.pack){diagnostics.push({code:'missing-character',severity:'error',message:c.speaker+': hahmopakettia ei ole saatavilla.'});continue;}
  if(!library.assets[c.pack]){diagnostics.push({code:'pack-not-loaded',severity:'error',message:c.speaker+': hahmopaketti '+c.pack+' ei ole ladattu.'});continue;}
  const old=options.previous?.bindings.find(b=>b.speaker===c.speaker);
  const binding:Binding={speaker:c.speaker,asset:old&&c.reason!=='resource'?old.asset:c.pack,voice:old?.voice??'Omat repliikkiäänet',side:old?.side??(i%2?'right':'left'),functions:packFunctions(library.assets[c.pack].doc.quick?.roles,p.world.phone.hand)};
  if(characters.length>2)binding.x=p.world.width*(characters.length===3?[.2,.5,.8][i]:[.14,.38,.62,.86][i]);
  p.bindings.push(binding);
 }
 // Säilytä aiemmat äänileikkeet, jos sama repliikki (sama tunniste) on edelleen olemassa.
 if(options.previous)p.audioClips=structuredClone(options.previous.audioClips.filter(a=>p.events.some(e=>e.id===a.dialogue&&e.kind==='dialogue')));
 onStage?.('motion');
 const validated=validatePresentation(p);
 let compiled=compilePresentation(validated,library.assets,fps);
 // Resurssirivin pöytä ilman sijaintia sijoitetaan laskevan käden ulottuville laskuhetkellä (kaksi käännöstä, deterministinen).
 const table=validated.production?.props?.find(v=>v.asset==='table-prop-v1'&&v.id.startsWith('res-manifest-')),dropper=compiled.events.find(e=>(e.kind==='action'&&e.value==='phone_down')||(e.kind==='prop'&&e.value.startsWith('drop:')));
 if(table&&dropper){const b=compiled.bindings.find(x=>x.speaker===dropper.target),asset=b?library.assets[b.asset]:undefined,a=b?compiled.actorAnimations?.[b.speaker]:undefined,q=asset?.doc.quick;
  if(b&&asset&&a&&q){const t=dropper.at??0,frame=Math.max(0,Math.min(a.duration-1,Math.round(t*fps))),world=stageState(compiled,t),hand=dropper.kind==='action'?world.phone.hand:world.held.find(h=>h.carrier===b.speaker&&h.id===dropper.value.slice(5))?.hand??'rightHand',roles=q.views?.[viewAtFrame(q,a,frame)]??q.roles,part=a.rig.parts.find(x=>x.key===roles[hand]),m=part?animationTransforms(a,frame).get(part.key):undefined;
   if(part&&m){const r=stageActor(compiled,b,t),size=Math.min(compiled.world.width,compiled.world.height)*table.scale,hx=m.a*part.pivot.x+m.c*part.pivot.y+m.e,hy=m.b*part.pivot.x+m.d*part.pivot.y+m.f,target={x:hx+(hx>asset.doc.width/2?25:-25),y:hy-15};
    table.x=Math.max(.05,Math.min(.95,(r.x+(target.x-asset.doc.width/2)*r.scale)/compiled.world.width));table.y=Math.max(.05,Math.min(.98,(r.y+(target.y-asset.doc.height/2)*r.scale+size*.25+20*r.scale)/compiled.world.height));
    compiled=compilePresentation(validated,library.assets,fps);diagnostics.push({code:'table-placed',severity:'warning',message:`Pöytä sijoitettiin hahmon ${b.speaker} ulottuville laskuhetkellä. Siirrä pöytää tarvittaessa näyttämöllä.`});}}}
 onStage?.('audio');
 const dialogueLines=compiled.events.filter(e=>e.kind==='dialogue');
 let at=0;const music=musicCues.map(m=>{const next=compiled.events.find(e=>e.sourceRef.line>m.line);at=next?.at??compiled.seconds;return {...m,at,status:(m.off?'stopped':m.file?'imported':m.mood?'generated':'unknown') as EpisodeAudioPlan['music'][number]['status']};});
 const audioPlan:EpisodeAudioPlan={dialogue:dialogueLines.map(e=>({event:e.id,speaker:e.target,text:e.text??'',line:e.sourceRef.line,status:compiled.audioClips.some(a=>a.dialogue===e.id)?'linked':'missing'})),music};
 for(const m of music)if(m.status==='imported')diagnostics.push({code:'music-file',severity:'warning',message:`Rivi ${m.line}: tuo musiikkitiedosto ${m.file} jakson ääniin.`});
 const audioMissing=compiled.diagnostics.some(d=>d.code==='missing-audio');
 for(const d of compiled.diagnostics)if(d.code==='target-underrun'&&audioMissing){d.severity='warning';d.message+=' (Arvio: repliikkiäänet puuttuvat, todellinen kesto selviää äänistä.)';}
 const own=compiled.diagnostics.filter(d=>!(d.code==='requirement-missing'&&d.event&&compiled.diagnostics.some(x=>x!==d&&x.event===d.event&&x.code==='missing-audio')));
 compiled.diagnostics=[...diagnostics.map(d=>({...d})),...own.filter(d=>!diagnostics.some(x=>x.code===d.code&&x.message===d.message))];
 onStage?.('done');
 return {presentation:compiled,assets:[...new Set(compiled.bindings.map(b=>b.asset))],cast,animationPerActor:compiled.actorAnimations??{},audioPlan,diagnostics:compiled.diagnostics,lines:lineOut};
 onStage?.('done');
 return {presentation:compiled,assets:[...new Set(compiled.bindings.map(b=>b.asset))],cast,animationPerActor:compiled.actorAnimations??{},audioPlan,diagnostics:compiled.diagnostics,lines:lineOut};
}

/** Vapaa käsikirjoitus: jokainen tunnistimen rivi ja lause → tapahtuma, kommentti tai tarkistusmerkintä. */
function recognizedPresentation(prepared:string,manifest:ReturnType<typeof parseScriptResourceManifest>,aliasMap:Record<string,string>,options:BuildOptions,diagnostics:Diagnostic[]):{p:Presentation;lineOut:EpisodeBuild['lines'];musicCues:MusicCue[]}{
 const resolveName=(n:string)=>{const k=normalizeSpeaker(n);return normalizeSpeaker(aliasMap[k]??k);};
 const recognized=recognizeScript(prepared,[],{discoverActors:true});
 const rawLines=prepared.replace(/\r\n?/g,'\n').split('\n');
 let characters=[...new Set(recognized.characters.map(resolveName))];
 // Vain hahmot, joilla on repliikki tai toimintaa, tulevat näyttämölle.
 const active=new Set<string>();for(const l of recognized.lines){if(l.speaker)active.add(resolveName(l.speaker));for(const c of l.clauses)if('actor' in c&&c.actor&&c.actor!=='*')active.add(resolveName(c.actor));for(const s of l.shot??[])if(s.target)active.add(resolveName(s.target));if(l.kind==='direction'||l.kind==='unknown'){const first=l.text.match(/^([\p{Lu}][\p{L}'-]*)/u)?.[1];if(first&&characters.includes(resolveName(first)))active.add(resolveName(first));}}
 characters=characters.filter(c=>active.has(c));
 if(characters.length>4){diagnostics.push({code:'too-many-characters',severity:'error',message:'Jaksossa voi olla enintään neljä hahmoa näyttämöllä. Mukana: '+characters.slice(0,4).join(', ')+'. Ohitettu: '+characters.slice(4).join(', ')+'. Jaa kohtaus tai jakso.'});characters=characters.slice(0,4);}
 const title=options.title??recognized.lines.find(l=>l.metadata&&['title','episode'].includes(l.metadata.key))?.metadata?.value??'Jakso';
 const p:Presentation={schemaVersion:1,id:'episode-'+stableId(prepared),original:prepared,metadata:{series:'Käsikirjoitus',season:1,episode:options.episode??1,title,target:60,purpose:'',environment:''},characters,assets:[],world:{width:options.width??1080,height:options.height??1920,background:'#ffffff',phone:{enabled:false,model:'phone-v1',carrier:characters[0]??'',hand:'leftHand',view:'front'}},sections:[],events:[],comments:[],bindings:[],audioClips:[],diagnostics:[],seconds:0,natural:true,source:'script'};
 const requirements:Requirement[]=[],lineOut:EpisodeBuild['lines']=[],musicCues:MusicCue[]=[];
 const counts:Record<string,number>={};
 let section='intro',lastActor=characters[0]??'',speaker='',dialogue:Event|undefined,hasShot=false,durationSet=false,targetMin=0;
 const require=(category:Category,ref:Ref,status:Requirement['status'],events:string[])=>{const id='r-'+stableId(category+'|'+ref.line+'|'+ref.text);const old=requirements.find(r=>r.id===id);if(old){old.events.push(...events.filter(e=>!old.events.includes(e)));if(status==='missing'||(status==='estimated'&&old.status==='implemented'))old.status=status;}else requirements.push({id,category,detail:ref.text,sourceRef:ref,events:[...events],status});};
 const add=(kind:Event['kind'],target:string,value:string,ref:Ref,extra:Partial<Event>={}):Event=>{const sig=[kind,target,value,ref.line].join('|'),n=counts[sig]=(counts[sig]??0)+1;const e:Event={id:'e-'+stableId(sig+'|'+n),kind,target,value,sourceRef:ref,basis:'rule',section,...extra};p.events.push(e);return e;};
 const actorOf=(a:string|undefined)=>{if(!a)return lastActor;if(a==='*')return '*';const n=resolveName(a);return characters.includes(n)?n:'';};
 const warnUnknown=(ref:Ref,text:string,reason='Sääntö ei tunnista lausetta; sitä ei animoida eikä arvata.')=>diagnostics.push({code:'unrecognized-line',severity:'warning',message:`Rivi ${ref.line+(options.firstLine??1)-1}: ${reason} “${text}”`});
 const clauseEvents=(clauses:Clause[],ref:Ref,afterDialogue?:string):{events:string[];unknown:number}=>{
  const ids:string[]=[];let unknown=0;
  for(const c of clauses){
   const who=actorOf('actor' in c?c.actor:undefined),targets=who==='*'?characters:who?[who]:[];
   if(('actor' in c)&&!targets.length&&c.type!=='constraint'){unknown++;warnUnknown(ref,c.text,'Hahmoa ei tunnistettu tai se ei ole näyttämöllä.');continue;}
   if(targets.length===1)lastActor=targets[0];
   switch(c.type){
    case'motion':for(const t of targets){if(!motionNames.has(c.value)){unknown++;warnUnknown(ref,c.text);continue;}const first=!ids.some(id=>p.events.find(x=>x.id===id&&x.kind==='action'&&x.target===t&&motionNames.has(x.value)));const e=add('action',t,c.value,ref,{seconds:c.seconds??(c.value==='stop'?0:c.value.startsWith('walk')||c.value.startsWith('run')?2:1),basis:c.estimated?'estimate':'rule',after:first?afterDialogue:undefined});ids.push(e.id);require('action',ref,c.estimated?'estimated':'implemented',[e.id]);}break;
    case'expression':for(const t of targets){const e=add('expression',t,c.value,ref,{after:afterDialogue});ids.push(e.id);require('expression',ref,'implemented',[e.id]);}break;
    case'gaze':{const target=c.target==='phone'||c.target==='camera'?c.target:actorOf(c.target);if(!target||target==='*'){unknown++;warnUnknown(ref,c.text,'Katseen kohdetta ei tunnistettu.');break;}for(const t of targets){if(t===target)continue;const e=add('gaze',t,target,ref,{after:afterDialogue});ids.push(e.id);require('gaze',ref,'implemented',[e.id]);}break;}
    case'phone':for(const t of targets){
     if(c.value==='phone-on'||c.value==='phone-off'||c.value==='phone_hold'){const e=add('prop',t,c.value==='phone-off'?'phone-off':'phone-on',ref,{text:'front'});ids.push(e.id);if(c.value!=='phone-off'){p.world.phone.enabled=true;if(!p.events.some(x=>x.kind==='prop'&&x.id!==e.id))p.world.phone.carrier=t;}require('prop',ref,'implemented',[e.id]);if(c.value==='phone_hold'){const h=add('action',t,'phone_hold',ref,{seconds:.8});ids.push(h.id);require('prop',ref,'implemented',[h.id]);}}
     else if(c.value==='phone_look'){const e=add('gaze',t,'phone',ref);ids.push(e.id);require('gaze',ref,'implemented',[e.id]);}
     else if((phoneActions as readonly string[]).includes(c.value)){if(!p.events.some(x=>x.kind==='prop'&&x.value==='phone-on')){const on=add('prop',t,'phone-on',ref,{text:'front',basis:'estimate'});ids.push(on.id);p.world.phone.enabled=true;p.world.phone.carrier=t;}const e=add('action',t,c.value,ref,{seconds:.8,after:afterDialogue});ids.push(e.id);require('prop',ref,'implemented',[e.id]);}
    }break;
    case'hold':{const t=targets[0]??lastActor;const e=add('hold',t||'scene',c.value,ref,{seconds:c.seconds??.5,protected:c.seconds!==undefined,basis:c.seconds!==undefined?'rule':'estimate',after:afterDialogue});ids.push(e.id);require('timing',ref,c.seconds!==undefined?'implemented':'estimated',[e.id]);break;}
    case'constraint':{const named=c.actor?actorOf(c.actor):'';if(['no-dialogue','other'].includes(c.value)){const e=add('note',named||'scene',c.text,ref);ids.push(e.id);diagnostics.push({code:'constraint-info',severity:'warning',message:`Rivi ${ref.line}: rajoitus kirjattu, mutta sillä ei ole automaattista toteutusta: “${c.text}”`});break;}const camera=c.value==='camera-still'||c.value==='hard-cuts';const e=add('constraint',camera?'scene':(named&&named!=='*'?named:'scene'),c.value,ref);ids.push(e.id);require('restriction',ref,'implemented',[e.id]);break;}
    case'environment':{const id=resolveEnvironment(c.value);const e=add('environment','scene',id??c.value,ref);ids.push(e.id);require('environment',ref,id?'implemented':'missing',[e.id]);break;}
    case'title-card':{const e=add('title','scene',c.value,ref,{seconds:c.seconds??1.2,basis:c.seconds!==undefined?'rule':'estimate'});ids.push(e.id);require('ending',ref,'implemented',[e.id]);break;}
    case'editing':{diagnostics.push({code:'editing-info',severity:'warning',message:`Rivi ${ref.line}: leikkausrytmiä ei säädetä automaattisesti: “${c.text}”`});break;}
    case'unsupported':unknown++;warnUnknown(ref,c.text,c.reason);break;
    case'note':p.comments.push(ref);break;
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
 return {p,lineOut,musicCues};
}
/** `#!kilsat`-tila: olemassa oleva tarkka kielioppi ja sen ajoitus säilyvät sellaisenaan. */
function strictPresentation(prepared:string,aliasMap:Record<string,string>,options:BuildOptions,diagnostics:Diagnostic[]):{p:Presentation;lineOut:EpisodeBuild['lines'];musicCues:MusicCue[]}{
 const p=parsePresentation(prepared,aliasMap);if(options.title)p.metadata.title=options.title;p.metadata.episode=options.episode??p.metadata.episode;
 const musicCues:MusicCue[]=[],lineOut:EpisodeBuild['lines']=[];
 prepared.replace(/\r\n?/g,'\n').split('\n').forEach((text,i)=>{const m=parseMusicLine(text);if(m)musicCues.push({...m,line:i+1});const events=p.events.filter(e=>e.sourceRef.line===i+1).map(e=>e.id);lineOut.push({line:i+1,kind:text.trim()?'direction':'empty',outcome:events.length?'event':text.trim()?'structure':'empty',events});});
 for(const r of p.direction?.requirements??[])r.accepted=true;
 return {p,lineOut,musicCues};
}

/** Koko sarja: jokainen jakso rakennetaan erikseen samalla kirjastolla. */
export function buildSeries(scriptText:string,library:EpisodeLibrary,options:BuildOptions={},onStage?:(episode:number,stage:BuildStage)=>void):(EpisodeBuild&{source:EpisodeSource})[]{
 return splitEpisodes(scriptText).map(source=>({...buildEpisode(source.text,library,{...options,title:source.title,episode:source.index,firstLine:source.firstLine},s=>onStage?.(source.index,s)),source}));
}

/** Sidosfunktio on tuettu vain, jos paketissa on sen tarvitsemat osat (samat vaatimukset kuin kääntäjässä). */
export function packFunctions(roles:Record<string,string|undefined>|undefined,hand:'leftHand'|'rightHand'):Record<string,string>{const need:Record<string,string[]>={neutral_talk:['mouthNeutral','mouthOpen'],worried:['leftBrow','rightBrow'],confused:['leftBrow','rightBrow'],mildly_hurt:['leftBrow','rightBrow'],angry:['leftBrow','rightBrow'],look_at_phone:['leftPupil','rightPupil'],look_at_other_character:['leftPupil','rightPupil'],show_phone:[hand==='leftHand'?'leftArm':'rightArm',hand==='leftHand'?'leftForearm':'rightForearm',hand],eyebrow_raise:['leftBrow'],dead_stare:['root','head']};return Object.fromEntries(functions.map(f=>[f,roles&&(need[f]??[]).every(k=>roles[k])?'supported':'none']));}
const holdVerb=/^(pitää|pitelee|piteli|pitävät|kantaa|kantoi|kantavat|ottaa|otti|ottavat|nostaa|nosti|tarttuu|tarttui|kädessä|kädessään|käteensä|holds|held|holding|carries|carried|carrying|takes|took|grabs|grabbed|picks|picked|with)$/u;
const dropVerb=/^(laskee|laski|laskevat|jättää|jätti|pudottaa|pudotti|panee|pani|asettaa|asetti|puts|put|sets|set|drops|dropped|leaves|left)$/u;
/** “Mira pitää kahvikuppia” → hold:mug-prop-v1, “Mira laskee kirjan pöydälle” → drop:book-prop-v1. Puhelin kulkee omaa reittiään. */
export function heldPropClause(text:string):{verb:'hold'|'drop';id:string;hand?:'leftHand'|'rightHand'}|undefined{
 const words=text.toLocaleLowerCase('fi-FI').match(/[\p{L}]+/gu)??[];
 const prop=words.map(w=>heldPropFromWord(w)).find(h=>h&&h.id!=='phone-v1');if(!prop)return;
 const drop=words.some(w=>dropVerb.test(w))&&!/\bleft hand\b/i.test(text),hold=words.some(w=>holdVerb.test(w));if(!drop&&!hold)return;
 const hand=/vasem\p{L}*\s+kä|left hand/iu.test(text)?'leftHand':/oike\p{L}*\s+kä|right hand/iu.test(text)?'rightHand':undefined;
 return {verb:drop?'drop':'hold',id:prop.id,...(hand?{hand}:{})};
}
/** Kirjaston hahmopaketit roolitusta varten (nimet ilman tiedostopäätettä). */
export function catalogFromNames(names:readonly string[]):CastPack[]{return [...new Set([...names,...Object.keys(castPackAliases)])].map(id=>({id,name:id.replace(/-(3D|Monikulma|Studio|Oma)$/i,''),aliases:castPackAliases[id]}));}
/** Ne paketit, jotka käsikirjoitus tarvitsee (UI lataa ne ennen rakennusta). */
export function packsNeeded(scriptText:string,packs:CastPack[],defaults?:string[]):string[]{
 const out=new Set<string>();
 for(const source of splitEpisodes(scriptText)){
  const handles=parseSpeakerHandleAliases(source.text),prepared=applySpeakerHandlesToScript(source.text,handles),aliases=speakerHandlesToPresentationAliases(handles);
  const r=recognizeScript(prepared,[],{discoverActors:true}),resolve=(n:string)=>{const k=normalizeSpeaker(n);return normalizeSpeaker(aliases[k]??k);};
  const resources:Record<string,string>={};for(const x of parseScriptResourceManifest(prepared).resources)if(x.kind==='character'&&x.speaker&&x.assetKey)resources[resolve(x.speaker)]=x.assetKey;
  const all=[...new Set(r.characters.map(resolve))],active=new Set<string>();for(const l of r.lines){if(l.speaker)active.add(resolve(l.speaker));for(const c of l.clauses)if('actor' in c&&c.actor&&c.actor!=='*')active.add(resolve(c.actor));for(const s of l.shot??[])if(s.target)active.add(resolve(s.target));if(l.kind==='direction'||l.kind==='unknown'){const first=l.text.match(/^([\p{Lu}][\p{L}'-]*)/u)?.[1];if(first&&all.includes(resolve(first)))active.add(resolve(first));}}
  for(const c of planCast([...new Set(r.characters.map(resolve))].filter(c=>active.has(c)).slice(0,4),packs,{resources,handles,defaults}))if(c.pack&&packs.some(p=>p.id===c.pack))out.add(c.pack);
 }
 return [...out].sort();
}
