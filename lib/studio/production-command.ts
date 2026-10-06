import {bindCastSpeaker,editProduction,reviewShot,replaceDialogueVoice,type ProductionState} from './commands.ts';
import {assignShotTask,assignShotTasks,type TaskCommand,type BatchTaskCommand} from './shot-tasks.ts';
import {commentProduction,type CommentCommand} from './review.ts';
import {studioMetadata} from './domain.ts';
import {validatePresentation,type AudioClip,type Presentation} from '../presentation-model.ts';
import type {PresentationAssets} from '../presentation-compile.ts';
import type {PresentationAudio} from '../presentation-audio.ts';
import {initProduction} from '../production-model.ts';
import {productionResources} from './resources.ts';
export type ProductionCommand={kind:'edit';proposal:Presentation}|{kind:'bind-cast';speaker:string;assetId:string}|{kind:'review';shotId:string;action:'approve'|'lock'|'unlock'}|{kind:'task';command:TaskCommand}|{kind:'tasks';command:BatchTaskCommand}|{kind:'comment';command:CommentCommand}|{kind:'voice';clip:AudioClip;voice:PresentationAudio};
export function executeProductionCommand(state:ProductionState,command:ProductionCommand,assets:PresentationAssets,fps:number,revision:number):ProductionState{
 if(studioMetadata(state.model).revision!==revision)throw Error('Tuotanto muuttui. Yritä uudelleen.');let next=state;
 switch(command.kind){
 case 'edit':next={...state,model:editProduction(state.model,command.proposal,assets,fps,revision)};break;
 case 'bind-cast':next={...state,model:bindCastSpeaker(state.model,command.speaker,command.assetId,assets,fps,revision)};break;
 case 'review':if(command.action==='approve'||command.action==='lock'){const missing=productionResources(state,assets).find(r=>!r.available);if(missing)throw Error('Resurssi puuttuu: '+missing.detail+'. Tarkista Tuotannon resurssit.');}next={...state,model:reviewShot(state.model,command.shotId,command.action,revision)};break;
 case 'task':next={...state,model:assignShotTask(state.model,command.command,revision)};break;
 case 'tasks':next={...state,model:assignShotTasks(state.model,command.command,revision)};break;
 case 'comment':next={...state,model:commentProduction(state.model,command.command,revision)};break;
 case 'voice':next=replaceDialogueVoice(state,command.clip,command.voice,assets,fps,revision);break;
 }
 return journalProductionCommand(state,next,command.kind);
}
export function journalProductionCommand(before:ProductionState,next:ProductionState,kind:'relink-audio'|ProductionCommand['kind']):ProductionState{
 const model=structuredClone(next.model),meta=studioMetadata(model);
 model.production??=initProduction(model);model.production.studio={...meta,commandJournal:[...(studioMetadata(before.model).commandJournal??[]),{id:crypto.randomUUID(),kind,revisionBefore:studioMetadata(before.model).revision,revisionAfter:meta.revision,createdAt:new Date().toISOString()}].slice(-100)};
 return{...next,model:validatePresentation(model),voices:{...next.voices}};
}
