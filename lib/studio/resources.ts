import type {ProductionState} from './commands.ts';
import type {PresentationAssets} from '../presentation-compile.ts';
import type {PresentationAudio} from '../presentation-audio.ts';
import {sha256} from './hash.ts';
export function productionResources(state:ProductionState,assets:PresentationAssets){
 const p=state.model;
 return [...p.bindings.map(b=>({id:'character:'+b.speaker,kind:'character' as const,target:b.speaker,asset:b.asset,available:!!assets[b.asset]?.doc.quick,detail:'Hahmopaketti ja pikaanimoinnin sidokset'})),...p.events.filter(e=>e.kind==='dialogue').map(e=>{const clip=p.audioClips.find(c=>c.dialogue===e.id);return{id:'audio:'+e.id,kind:'audio' as const,target:e.id,asset:clip?.asset??'',available:!!clip&&!!state.voices[clip.asset]?.blob?.size,detail:e.target+': '+(e.text??e.value)};})];
}
/** Exact content-addressed restoration, never guessing from the file name. */
export async function verifyAudioRelink(asset:string,voice:PresentationAudio){
 if(!/^audio-[a-f0-9]{64}$/.test(asset))throw Error('Vanhan äänen tarkkaa SHA-256-tunnistetta ei ole. Tuo ääni repliikin tavallisella vaihtotoiminnolla.');
 if(!voice.blob.size||voice.blob.size>128*1024*1024)throw Error('Palautettava äänitiedosto on tyhjä tai liian suuri.');
 if('audio-'+await sha256(new Uint8Array(await voice.blob.arrayBuffer()))!==asset)throw Error('Valittu tiedosto ei ole alkuperäinen ääni. Käytä repliikin äänen vaihtoa, jos haluat muuttaa sisältöä.');
 return voice;
}
