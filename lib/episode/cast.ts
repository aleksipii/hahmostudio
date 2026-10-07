import {splitEpisodes} from './source.ts';
import {recognizeScript} from '../script-recognizer.ts';
import {applySpeakerHandlesToScript,parseSpeakerHandleAliases,speakerHandlesToPresentationAliases} from '../speaker-handle-aliases.ts';
import {parseScriptResourceManifest} from '../script-resource-manifest.ts';
import {normalizeSpeaker} from '../presentation-model.ts';

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
