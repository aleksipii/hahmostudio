/**
 * Hahmon grafiikan tunniste vertailukuvia varten (tekoäly-paneelin vaihe 6).
 * Vertailukuva hyväksytään aina tiettyä hahmon grafiikkaa vasten: tunniste on hahmopaketin tiedoston SHA-256.
 * Jos grafiikka muuttuu, tunniste muuttuu ja vanha vertailukuva vanhenee (pilvirenderöinti estää syyllä reference-stale).
 * Ehdotus ei koskaan hyväksy itseään: hyväksyntä on aina käyttäjän erillinen toiminto sovelluksessa.
 */
import type {Presentation} from './presentation-model.ts';
import {sha256} from './studio/hash.ts';

/**
 * Kirjaston hahmopaketit, joille sovellus saa ehdottaa paketin omaa esikatselukuvaa vertailukuvaksi.
 * Tyhjä, kunnes hahmon grafiikka on hyväksytty valmiiksi; nimen lisääminen on tietoinen muutos.
 */
export const REFERENCE_READY_PACKS:readonly string[]=[];

const CAST=/^cast-sha256-([0-9a-f]{64})$/,PACK=/^[A-Za-z0-9][A-Za-z0-9 ._-]{0,80}$/;
/** Tunnistettu lähde: tuotu hahmo sisältää tiivisteen tunnisteessaan; kirjastopaketin tavut luetaan. */
export type SourceReader=(pack:string)=>Promise<Uint8Array|undefined>;

/** Puhujakohtaiset grafiikan tiivisteet. Puhuja, jonka lähdettä ei voi lukea, jää pois (ei arvata). */
export async function characterSources(p:Presentation,read:SourceReader):Promise<Record<string,string>>{
 const out:Record<string,string>={},cache=new Map<string,Promise<string|undefined>>();
 for(const b of p.bindings){
  if(!p.characters.includes(b.speaker))continue;
  const cast=CAST.exec(b.asset);if(cast){out[b.speaker]=cast[1];continue;}
  if(!PACK.test(b.asset)||b.asset.includes('..'))continue;
  if(!cache.has(b.asset))cache.set(b.asset,read(b.asset).then(bytes=>bytes?.length?sha256(bytes):undefined).catch(()=>undefined));
  const hash=await cache.get(b.asset);if(hash)out[b.speaker]=hash;
 }
 return out;
}

export type ReferenceProposal={speaker:string;pack:string;image:string;sourceSha256:string};
/** Ehdotus: kirjastopaketin oma esikatselukuva (sama generointi kuin paketin grafiikka). Vain valmiiksi hyväksytyille paketeille. */
export function referenceProposal(p:Presentation,speaker:string,sources:Record<string,string>,ready:readonly string[]=REFERENCE_READY_PACKS):ReferenceProposal|undefined{
 const b=p.bindings.find(x=>x.speaker===speaker),source=sources[speaker];
 if(!b||!source||!ready.includes(b.asset)||CAST.test(b.asset)||!PACK.test(b.asset))return;
 return {speaker,pack:b.asset,image:`library/${b.asset}.png`,sourceSha256:source};
}

/** Kirjastopaketin lukija selaimessa (respektoi BASE_URL:ia). */
export function libraryReader(base:string,fetcher:typeof fetch=fetch):SourceReader{
 return async pack=>{const r=await fetcher(`${base}library/${encodeURIComponent(pack)}.hahmo`);if(!r.ok)return undefined;return new Uint8Array(await r.arrayBuffer());};
}
