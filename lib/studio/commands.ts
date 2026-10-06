import {patchSpeakerBinding} from '../presentation-speaker-binding.ts';
import type {AudioClip,Presentation} from '../presentation-model.ts';
import {validatePresentation} from '../presentation-model.ts';
import {initProduction} from '../production-model.ts';
import {compilePresentation,type PresentationAssets} from '../presentation-compile.ts';
import type {PresentationAudio} from '../presentation-audio.ts';
import {adaptPresentation,revise,studioMetadata} from './domain.ts';

export type ProductionState={model:Presentation;voices:Record<string,PresentationAudio>;assets?:PresentationAssets};
export class TransactionHistory<T>{
 past:T[]=[];future:T[]=[];
 private readonly limit:number;
 private clone:(value:T)=>T;
 constructor(limit=30,clone:(value:T)=>T=structuredClone){this.limit=limit;this.clone=clone;}
 commit(previous:T){this.past=[...this.past,this.clone(previous)].slice(-this.limit);this.future=[];}
 undo(current:T){const state=this.past.pop();if(state)this.future.push(this.clone(current));return state?this.clone(state):undefined;}
 redo(current:T){const state=this.future.pop();if(state)this.past=[...this.past,this.clone(current)].slice(-this.limit);return state?this.clone(state):undefined;}
 clear(){this.past=[];this.future=[];}
}
/** Compile all affected timing/mouth tracks before publishing any part of the transaction. */
export function replaceDialogueVoice(state:ProductionState,clip:AudioClip,voice:PresentationAudio,assets:PresentationAssets,fps:number,expectedRevision:number):ProductionState{
 const p=state.model;if(studioMetadata(p).revision!==expectedRevision)throw Error('Tuotanto muuttui äänen käsittelyn aikana. Yritä uudelleen.');
 const event=p.events.find(e=>e.id===clip.dialogue&&e.kind==='dialogue');if(!event)throw Error('Repliikkiä ei löydy.');
 if(p.audioClips.find(c=>c.dialogue===clip.dialogue)?.locked)throw Error('Suun ajoitus on lukittu. Avaa lukitus ennen äänen vaihtamista.');
 const next=compilePresentation({...structuredClone(p),audioClips:[...p.audioClips.filter(c=>c.dialogue!==clip.dialogue),clip]},assets,fps);
 const conflict=next.diagnostics.find(d=>['locked-conflict','locked-window'].includes(d.code)&&d.severity==='error');if(conflict)throw Error(conflict.message);
 const production=next.production??initProduction(next);
 next.production={...production,studio:revise(compilePresentation(structuredClone(p),assets,fps),next,'Repliikkiäänen vaihto: '+event.id)};
 return{...state,model:validatePresentation(next),voices:{...state.voices,[clip.asset]:voice}};
}

/** Puhujan .hahmo-sidonta tuotantokomennon kautta (journal: bind-cast). */
export function bindCastSpeaker(before:Presentation,speaker:string,assetId:string,assets:PresentationAssets,fps:number,expectedRevision:number):Presentation{
 if(!before.characters.includes(speaker))throw Error('Puhujaa ei löydy: '+speaker+'.');
 if(!assets[assetId]?.doc.quick)throw Error('Hahmopaketissa puuttuu pikaanimoinnin sidokset.');
 return editProduction(before,patchSpeakerBinding(before,speaker,assetId),assets,fps,expectedRevision);
}

/** Central boundary for ordinary production edits; all derived tracks validate before commit. */
export function editProduction(before:Presentation,proposal:Presentation,assets:PresentationAssets,fps:number,expectedRevision:number):Presentation{
 if(studioMetadata(before).revision!==expectedRevision)throw Error('Tuotanto muuttui. Yritä uudelleen.');
 const next=compilePresentation(structuredClone(proposal),assets,fps);
 const conflict=next.diagnostics.find(d=>['locked-conflict','locked-window'].includes(d.code)&&d.severity==='error');if(conflict)throw Error(conflict.message);
 next.production={...(next.production??initProduction(next)),studio:revise(compilePresentation(structuredClone(before),assets,fps),next,'Ohjausmuutos')};return validatePresentation(next);
}
export type ReviewAction='approve'|'lock'|'unlock';
/** Local review metadata is separate from the immutable content revision. */
export function reviewShot(p:Presentation,shotId:string,action:ReviewAction,expectedRevision:number):Presentation{
 const meta=studioMetadata(p);if(meta.revision!==expectedRevision)throw Error('Tuotanto muuttui. Tarkista kuva uudelleen.');
 const shot=adaptPresentation(p).shots.find(s=>s.id===shotId);if(!shot)throw Error('Kuvaa ei löydy.');
 if(['approve','lock'].includes(action)&&meta.reviewComments?.some(c=>c.shotId===shotId&&c.status==='open'))throw Error('Käsittele kuvan avoimet tarkistuskommentit ennen hyväksyntää tai lukitsemista.');
 if(action==='approve'&&(shot.status!=='draft'||shot.errors.length||shot.audioStatus==='missing'))throw Error('Hyväksy vain tarkistettu luonnos, jonka virheet on korjattu ja repliikkiäänet liitetty.');
 if(action==='lock'&&shot.status!=='approved')throw Error('Hyväksy kuva ennen lukitsemista.');
 if(action==='unlock'&&shot.status!=='locked')throw Error('Kuva ei ole lukittu.');
 const next=structuredClone(p);next.production??=initProduction(next);
 const state=action==='unlock'?{status:'draft' as const}:{status:action==='lock'?'locked' as const:'approved' as const,approvedRevision:meta.revision};
 next.production.studio={...meta,shots:{...meta.shots,[shotId]:state},changes:[...meta.changes,{revision:meta.revision,reason:({approve:'Kuvan hyväksyntä',lock:'Kuvan lukitus',unlock:'Lukituksen avaus, hyväksyntä vanhenee'})[action]+': '+shot.name,createdAt:new Date().toISOString()}].slice(-100)};
 return validatePresentation(next);
}
