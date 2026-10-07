/**
 * Yhden painalluksen jaksonrakentaja: käsikirjoitus → tunnistin → esitysmalli → roolitus → animaatio.
 *
 * Rakentaja on puhdas ja deterministinen: sama syöte ja sama kirjasto tuottavat saman tuloksen tavu tavulta
 * (ei kelloa, satunnaisuutta tai verkkoa). Jokainen rivi saa tasan yhden lopputuloksen: tunnistettu tapahtuma,
 * kommentti tai näkyvä tarkistusmerkintä. Tunnistamatonta ohjetta ei arvata eikä käsikirjoituksen tekstiä suoriteta.
 *
 * Moduulit: episode/source (jaksojako), environment (miljöö), cast (roolitus), music (musiikkirivit), spoken-props
 * (puhesynteesin soveltuvuus ja käteen otettavat esineet), recognize (tunnistetut ja tiukat rivit → esitys).
 * Tämä tiedosto kokoaa rakennusvaiheet ja re-exporttaa moduulien rajapinnan, joten tuojat eivät muutu.
 */
import {type RecognizedLine} from './script-recognizer.ts';
import {applySpeakerHandlesToScript,parseSpeakerHandleAliases,speakerHandlesToPresentationAliases} from './speaker-handle-aliases.ts';
import {parseScriptResourceManifest,validateScriptResources} from './script-resource-manifest.ts';
import {compilePresentation,type PresentationAssets} from './presentation-compile.ts';
import {environmentId} from './presentation-direction.ts';
import {functions,stableId,normalizeSpeaker,validatePresentation,type Presentation,type Diagnostic,type Binding} from './presentation-model.ts';
import type {Animation} from './animation-model.ts';
import {composeBinding,screenDirectionDiagnostics,measureCharacter} from './stage-composition.ts';
import {defaultSafeArea} from './stage-bounds.ts';
import {autoSoundCues,musicCues as planMusicCues} from './soundtrack.ts';
import {sampleTrack} from './animation-model.ts';
import {stageActor,stageState} from './presentation-stage.ts';
import {viewAtFrame} from './character-view.ts';
import {animationTransforms} from './animation-transform.ts';
export * from './episode/source.ts';
import {splitEpisodes,type EpisodeSource} from './episode/source.ts';
export * from './episode/environment.ts';
export * from './episode/cast.ts';
import {planCast,type CastPack,type CastChoice} from './episode/cast.ts';
export * from './episode/music.ts';
import {type MusicCue} from './episode/music.ts';
import {recognizedPresentation,strictPresentation} from './episode/recognize.ts';
export * from './episode/spoken-props.ts';
import {kokoroDefaultVoice,synthPossibility,packFunctions} from './episode/spoken-props.ts';

export type EpisodeAudioPlan={
 dialogue:{event:string;speaker:string;text:string;line:number;status:'linked'|'missing';/** Kokoro voi tuottaa rivin (englanti, Mac-sovellus); muuten tuo tai äänitä. */synth:'possible'|'unsupported-language'|'empty'|'linked'}[];
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
 const {p,lineOut,musicCues:musicCuesIn,sfxLines}=built,musicCues=musicCuesIn,characters=p.characters;
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
  // Yhteinen mittakaava (aikuinen 1,0 · lapsi 0,72 · robotti 0,9) ja jalkapohjat taustan lattiaviivalle; käyttäjän sijoitus säilyy.
  if(old?.y!==undefined||old?.scale!==undefined){binding.x=old.x;binding.y=old.y;binding.scale=old.scale;}
  else Object.assign(binding,composeBinding(binding,library.assets[c.pack].doc,p.world.width,p.world.height,p.world.design??environmentId(p.events.find(e=>e.kind==='environment')?.value??'')??undefined,binding.x,undefined,library.assets[c.pack].animation.rig));
  // Kokoro-oletusääni (vain valinta; ääntä ei tuoteta ennen kuin käyttäjä käynnistää synteesin). Aiempi valinta säilyy.
  binding.kokoroVoice=old?.kokoroVoice??kokoroDefaultVoice(i);
  p.bindings.push(binding);
 }
 // Säilytä aiemmat äänileikkeet, jos sama repliikki (sama tunniste) on edelleen olemassa.
 if(options.previous)p.audioClips=structuredClone(options.previous.audioClips.filter(a=>p.events.some(e=>e.id===a.dialogue&&e.kind==='dialogue')));
 onStage?.('motion');
 const validated=validatePresentation(p);
 let compiled=compilePresentation(validated,library.assets,fps);
 // Kävelyt pysyvät näyttämöllä: lähtöpaikka valitaan niin, että juuren koko liikerata mahtuu turva-alueen sisään.
 // “Kävelee sisään vasemmalta/oikealta” päättyy hahmon omalle paikalle. Käyttäjän asettama sijainti säilyy.
 {let moved=false;for(const b of validated.bindings){const a=compiled.actorAnimations?.[b.speaker],asset=library.assets[b.asset],q=asset?.doc.quick;if(!a||!q||options.previous?.bindings.find(x=>x.speaker===b.speaker)?.x!==undefined)continue;
  const roots=[...new Set([q.roles.root,...Object.values(q.views??{}).map(m=>m?.root)].filter((k):k is string=>!!k))],xs:number[]=[];for(let f=0;f<a.duration;f+=2){for(const k of roots){const t=a.tracks.find(x=>x.key===k);if(t)xs.push(sampleTrack(t,f).x);}}
  if(!xs.length)continue;const dMin=Math.min(...xs),dMax=Math.max(...xs);if(dMax-dMin<1)continue;
  const scale=b.scale??1,half=measureCharacter(asset.doc,asset.animation.rig).width/2*scale,left=defaultSafeArea.left+half,right=validated.world.width-defaultSafeArea.right-half,mark=b.x??validated.world.width*(b.side==='left'?.28:.72);
  const entrance=validated.events.find(e=>e.kind==='action'&&e.target===b.speaker&&/^(walk|run)-/.test(e.value)&&/sisään|enters?|comes in|walks in/i.test(e.sourceRef.text));
  let x=entrance?mark-(e2x(entrance.value)>0?dMax:dMin)*scale:mark;x=Math.max(left-dMin*scale,Math.min(right-dMax*scale,x));
  if((dMax-dMin)*scale>right-left)diagnostics.push({code:'walk-off-stage',severity:'warning',message:`${b.speaker}: kävelyt eivät mahdu näyttämölle (${Math.round((dMax-dMin)*scale)} px). Hahmo pysähtyy reunaan; lyhennä kävelyä tai vaihda suuntaa.`});
  if(Math.abs(x-mark)>.5){b.x=x;moved=true;}}
  if(moved)compiled=compilePresentation(validated,library.assets,fps);}
 // Resurssirivin pöytä ilman sijaintia sijoitetaan laskevan käden ulottuville laskuhetkellä (kaksi käännöstä, deterministinen).
 const table=validated.production?.props?.find(v=>v.asset==='table-prop-v1'&&v.id.startsWith('res-manifest-')),dropper=compiled.events.find(e=>(e.kind==='action'&&e.value==='phone_down')||(e.kind==='prop'&&e.value.startsWith('drop:')));
 if(table&&dropper){const b=compiled.bindings.find(x=>x.speaker===dropper.target),asset=b?library.assets[b.asset]:undefined,a=b?compiled.actorAnimations?.[b.speaker]:undefined,q=asset?.doc.quick;
  if(b&&asset&&a&&q){const t=dropper.at??0,frame=Math.max(0,Math.min(a.duration-1,Math.round(t*fps))),world=stageState(compiled,t),hand=dropper.kind==='action'?world.phone.hand:world.held.find(h=>h.carrier===b.speaker&&h.id===dropper.value.slice(5))?.hand??'rightHand',roles=q.views?.[viewAtFrame(q,a,frame)]??q.roles,part=a.rig.parts.find(x=>x.key===roles[hand]),m=part?animationTransforms(a,frame).get(part.key):undefined;
   if(part&&m){const r=stageActor(compiled,b,t),size=Math.min(compiled.world.width,compiled.world.height)*table.scale,hx=m.a*part.pivot.x+m.c*part.pivot.y+m.e,hy=m.b*part.pivot.x+m.d*part.pivot.y+m.f,target={x:hx+(hx>asset.doc.width/2?25:-25),y:hy-15};
    table.x=Math.max(.05,Math.min(.95,(r.x+(target.x-asset.doc.width/2)*r.scale)/compiled.world.width));table.y=Math.max(.05,Math.min(.98,(r.y+(target.y-asset.doc.height/2)*r.scale+size*.25+20*r.scale)/compiled.world.height));
    compiled=compilePresentation(validated,library.assets,fps);diagnostics.push({code:'table-placed',severity:'warning',message:`Pöytä sijoitettiin hahmon ${b.speaker} ulottuville laskuhetkellä. Siirrä pöytää tarvittaessa näyttämöllä.`});}}}
 compiled.diagnostics.push(...screenDirectionDiagnostics(compiled));
 onStage?.('audio');
 // Ääniraita: automaattiset tehosteet liikkeistä, käsikirjoituksen tehosterivit ja musiikki; vanhat käsin tehdyt merkinnät säilyvät.
 {const ordered=[...compiled.events].sort((a,b)=>a.sourceRef.line-b.sourceRef.line),explicit=sfxLines.flatMap(x=>{const anchor=ordered.find(e=>e.sourceRef.line>x.line)??ordered.at(-1);return anchor?[{id:'sfx-line-'+x.line,kind:'sfx' as const,sound:x.sound,event:anchor.id,offset:0,gain:.8,source:'generated' as const,line:x.line}]:[];});
  const music=planMusicCues(compiled,musicCuesIn);diagnostics.push(...music.diagnostics);
  const kept=(options.previous?.soundCues??[]).filter(c=>!c.auto&&!c.line&&compiled.events.some(e=>e.id===c.event));
  compiled.soundCues=[...autoSoundCues(compiled,library.assets,fps),...explicit,...music.cues,...kept];}
 const dialogueLines=compiled.events.filter(e=>e.kind==='dialogue');
 let at=0;const music=musicCues.map(m=>{const next=compiled.events.find(e=>e.sourceRef.line>m.line);at=next?.at??compiled.seconds;return {...m,at,status:(m.off?'stopped':m.file?'imported':m.mood?'generated':'unknown') as EpisodeAudioPlan['music'][number]['status']};});
 const audioPlan:EpisodeAudioPlan={dialogue:dialogueLines.map(e=>({event:e.id,speaker:e.target,text:e.text??'',line:e.sourceRef.line,status:compiled.audioClips.some(a=>a.dialogue===e.id)?'linked':'missing',synth:compiled.audioClips.some(a=>a.dialogue===e.id)?'linked':synthPossibility(e.text??'')})),music};
 const missingLines=audioPlan.dialogue.filter(d=>d.status==='missing'),canSynth=missingLines.filter(d=>d.synth==='possible').length,needOwn=missingLines.length-canSynth;
 if(canSynth)diagnostics.push({code:'voices-synth',severity:'warning',message:`${canSynth} englanninkieliselle repliikille voi luoda äänen Kokorolla (Mac-sovellus, merkitään synteettiseksi). Äänittämäsi tai tuomasi ääni on aina etusijalla.`});
 if(needOwn)diagnostics.push({code:'voices-own',severity:'warning',message:`${needOwn} repliikille ei voi luoda ääntä automaattisesti (suomi tai tyhjä rivi): äänitä tai tuo ääni.`});
 for(const m of music)if(m.status==='imported')diagnostics.push({code:'music-file',severity:'warning',message:`Rivi ${m.line}: tuo musiikkitiedosto ${m.file} jakson ääniin.`});
 const audioMissing=compiled.diagnostics.some(d=>d.code==='missing-audio');
 for(const d of compiled.diagnostics)if(d.code==='target-underrun'&&audioMissing){d.severity='warning';d.message+=' (Arvio: repliikkiäänet puuttuvat, todellinen kesto selviää äänistä.)';}
 const own=compiled.diagnostics.filter(d=>!(d.code==='requirement-missing'&&d.event&&compiled.diagnostics.some(x=>x!==d&&x.event===d.event&&x.code==='missing-audio')));
 compiled.diagnostics=[...diagnostics.map(d=>({...d})),...own.filter(d=>!diagnostics.some(x=>x.code===d.code&&x.message===d.message))];
 onStage?.('done');
 return {presentation:compiled,assets:[...new Set(compiled.bindings.map(b=>b.asset))],cast,animationPerActor:compiled.actorAnimations??{},audioPlan,diagnostics:compiled.diagnostics,lines:lineOut};
}

/** Koko sarja: jokainen jakso rakennetaan erikseen samalla kirjastolla. */
export function buildSeries(scriptText:string,library:EpisodeLibrary,options:BuildOptions={},onStage?:(episode:number,stage:BuildStage)=>void):(EpisodeBuild&{source:EpisodeSource})[]{
 return splitEpisodes(scriptText).map(source=>({...buildEpisode(source.text,library,{...options,title:source.title,episode:source.index,firstLine:source.firstLine},s=>onStage?.(source.index,s)),source}));
}

const e2x=(value:string)=>value.endsWith('left')?-1:value.endsWith('right')?1:0;
