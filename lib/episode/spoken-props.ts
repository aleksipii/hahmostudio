import {functions} from '../presentation-model.ts';
import {heldPropFromWord} from '../held-props.ts';
import {parseSpokenText,isEnglishLine,KOKORO_MAX_LINE} from '../kokoro.ts';

/** Oletusäänet vuorotellen nainen/mies, jotta kaksi hahmoa ei kuulosta samalta. */
export const kokoroDefaultVoices=['af_heart','am_adam','af_bella','am_michael'];
export const kokoroDefaultVoice=(index:number)=>kokoroDefaultVoices[index%kokoroDefaultVoices.length];
export function synthPossibility(text:string):'possible'|'unsupported-language'|'empty'{const spoken=parseSpokenText(text);return !spoken.text?'empty':spoken.text.length>KOKORO_MAX_LINE||!isEnglishLine(spoken.text)?'unsupported-language':'possible';}
/** Sidosfunktio on tuettu vain, jos paketissa on sen tarvitsemat osat (samat vaatimukset kuin kääntäjässä). */
export function packFunctions(roles:Record<string,string|undefined>|undefined,hand:'leftHand'|'rightHand'):Record<string,string>{const need:Record<string,string[]>={neutral_talk:['mouthNeutral','mouthOpen'],worried:['leftBrow','rightBrow'],confused:['leftBrow','rightBrow'],mildly_hurt:['leftBrow','rightBrow'],angry:['leftBrow','rightBrow'],look_at_phone:['leftPupil','rightPupil'],look_at_other_character:['leftPupil','rightPupil'],show_phone:[hand==='leftHand'?'leftArm':'rightArm',hand==='leftHand'?'leftForearm':'rightForearm',hand],eyebrow_raise:['leftBrow'],dead_stare:['root','head']};return Object.fromEntries(functions.map(f=>[f,roles&&(need[f]??[]).every(k=>roles[k])?'supported':'none']));}
const holdVerb=/^(pitää|pitelee|piteli|pitävät|kantaa|kantoi|kantavat|ottaa|otti|ottavat|nostaa|nosti|nappaa|nappasi|nappaavat|lukee|luki|lukevat|tarttuu|tarttui|kädessä|kädessään|käteensä|holds|held|holding|carries|carried|carrying|takes|took|grabs|grabbed|picks|picked|reads|read|reading|with)$/u;
const dropVerb=/^(laskee|laski|laskevat|jättää|jätti|pudottaa|pudotti|panee|pani|asettaa|asetti|puts|put|sets|set|drops|dropped|leaves|left)$/u;
/** “Mira pitää kahvikuppia” → hold:mug-prop-v1, “Mira laskee kirjan pöydälle” → drop:book-prop-v1. Puhelin kulkee omaa reittiään. */
export function heldPropClause(text:string):{verb:'hold'|'drop';id:string;hand?:'leftHand'|'rightHand'}|undefined{
 const words=text.toLocaleLowerCase('fi-FI').match(/[\p{L}]+/gu)??[];
 const prop=words.map(w=>heldPropFromWord(w)).find(h=>h&&h.id!=='phone-v1');if(!prop)return;
 const drop=words.some(w=>dropVerb.test(w))&&!/\bleft hand\b/i.test(text),hold=words.some(w=>holdVerb.test(w));if(!drop&&!hold)return;
 const hand=/vasem\p{L}*\s+kä|left hand/iu.test(text)?'leftHand':/oike\p{L}*\s+kä|right hand/iu.test(text)?'rightHand':undefined;
 return {verb:drop?'drop':'hold',id:prop.id,...(hand?{hand}:{})};
}
