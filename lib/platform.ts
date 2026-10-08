import {trackAi} from './ai-status.ts';
export type UiSettings={panels?:{library:number;inspector:number;timeline:number};workspace?:'character'|'performance'|'animation';layout?:{library:boolean;inspector:boolean;timeline:boolean};accordions?:Record<string,boolean>;window?:{x:number;y:number;width:number;height:number}};
export type FileKind='project'|'character'|'audio'|'rig'|'animation'|'series';
export type NativeFile={id:string;name:string;bytes:Uint8Array};
export type DesktopAction={action:'open'|'import'|'audio'|'save'|'saveAs'|'export'|'undo'|'redo'|'play'|'save-for-close'|'help'|'fit'|'library'|'inspector'|'timeline'|'focus-stage'|'reset-layout'|'zoom-in'|'zoom-out'|'guides'|'center'|'settings'|'advanced'|'panels'|'ai';id?:string};
export type ProjectRevision={id:string;projectId:string;name:string;label:string;hash:string;createdAt:string};
export type DesktopBridge={
 revisionsList:(projectId:string)=>Promise<ProjectRevision[]>;revisionsSave:(data:{projectId:string;name:string;label:string;bytes:Uint8Array})=>Promise<ProjectRevision>;revisionsRead:(projectId:string,id:string)=>Promise<ProjectRevision&{bytes:Uint8Array}>;revisionsRemove:(projectId:string,id:string)=>Promise<void>;
 recoveryResources:(refs:{hash:string;size:number}[])=>Promise<string[]>;recoveryTransaction:(request:import('./studio/delta-protocol').DeltaRequest)=>Promise<unknown>;recoveryImport:(request:import('./studio/delta-protocol').RecoveryImport)=>Promise<import('./studio/delta-protocol').ImportedHistory>;
 recoveryRead:(reference:import('./studio/project-history').HistoryReference)=>Promise<import('./studio/recovery').RecoverySnapshot>;
 recoverySave:(snapshot:{name:string;bytes:Uint8Array;command?:import('./studio/durable-command').DurableCommandReceipt})=>Promise<unknown>;recoveryLatest:()=>Promise<import('./studio/recovery').RecoverySnapshot|null>;recoveryClear:()=>Promise<void>;
 exportPreferences:()=>Promise<{presets:import('./export-presets').ExportPreset[];last:import('./export-presets').ExportPreset|null}>;exportSetPreferences:(v:{presets:import('./export-presets').ExportPreset[];last:import('./export-presets').ExportPreset|null})=>Promise<void>;
 exportEnqueue:(request:{name:string;bytes:Uint8Array;preset:import('./export-presets').ExportPreset;quick:boolean;manifest?:import('./studio/render-contract').RenderManifest})=>Promise<string|null>;exportList:()=>Promise<import('./export-presets').ExportJob[]>;exportCancel:(id:string)=>Promise<void>;exportRemove:(id:string)=>Promise<void>;exportRetry:(id:string)=>Promise<void>;exportFinder:(id:string)=>Promise<void>;onExports:(cb:(jobs:import('./export-presets').ExportJob[])=>void)=>()=>void;
 openFile:(kind:FileKind)=>Promise<NativeFile|null>;openRecent:(id:string)=>Promise<NativeFile|null>;adoptFile:(id:string|null)=>Promise<void>;
 saveFile:(request:{name:string;bytes:Uint8Array;kind:'project'|'export';saveAs:boolean})=>Promise<{saved:boolean;name?:string}>;
 contextMenu:(scope:'stage'|'timeline')=>Promise<void>;setUi:(value:UiSettings)=>Promise<void>;preferences:()=>Promise<{ui?:UiSettings;theme:'system'|'light'|'dark';recent:{id:string;name:string}[];accessibility?:Record<string,boolean>}>;setAccessibility:(v:Record<string,boolean>)=>Promise<void>;setTheme:(theme:'system'|'light'|'dark')=>Promise<void>;
 confirmReplace:()=>Promise<'save'|'discard'|'cancel'>;
 reportState:(state:{dirty:boolean;ready:boolean;name?:string})=>void;completeClose:(id:string,saved:boolean)=>void;nativeEdit:(action:'undo'|'redo')=>Promise<void>;
 audioDownload:()=>Promise<{model:boolean;binary:boolean;modelName:string}>;
 audioModel:()=>Promise<{backend:string;model:boolean;binary:boolean;modelName:string;offline:boolean}>;transcribe:(bytes:Uint8Array,language:string)=>Promise<unknown>;
 cloudStatus:()=>Promise<CloudStatus>;cloudEnable:()=>Promise<CloudStatus>;cloudDisable:()=>Promise<CloudStatus>;cloudDeclareFree:(kind:'colab'|'notebook',value:boolean)=>Promise<CloudStatus>;cloudCall:(op:CloudOp,args?:Record<string,unknown>)=>Promise<{status:number;body:Record<string,any>}>;cloudPinsImport:()=>Promise<CloudStatus>;cloudPinsClear:()=>Promise<CloudStatus>;cloudSecretPaste:(key:CloudSecretKey)=>Promise<{saved:CloudSecretKey[]}>;cloudSecretImport:()=>Promise<{saved:CloudSecretKey[];ignored:string[]}>;cloudSecretClear:(key:CloudSecretKey|'all')=>Promise<CloudStatus>;
 kokoroStatus:()=>Promise<KokoroStatus>;kokoroDownload:()=>Promise<KokoroStatus|{cancelled:true}>;kokoroRemove:()=>Promise<KokoroStatus>;kokoroSynthesize:(request:{text:string;voice:string;speed:number})=>Promise<{samples:Float32Array;sampleRate:number;modelVersion:string}>;kokoroCancel:()=>Promise<void>;onKokoroProgress:(callback:(p:{file:string;received:number;total:number|null})=>void)=>()=>void;
 speech:(bytes:Uint8Array,language:string)=>Promise<unknown>;cancelSpeech:()=>Promise<void>;onAction:(callback:(payload:DesktopAction)=>void)=>()=>void;
};
declare global{interface Window{hahmostudio?:DesktopBridge;}}
const tracked=new WeakMap<DesktopBridge,DesktopBridge>();
/** Tekoälykutsujen tulos kirjataan istunnon muistiin Tekoäly-paneelia varten; kutsut ja tulokset pysyvät ennallaan. */
function withAiActivity(bridge:DesktopBridge):DesktopBridge{
 let out=tracked.get(bridge);if(out)return out;
 out=Object.freeze({...bridge,
  speech:(bytes:Uint8Array,language:string)=>trackAi('rhubarb',bridge.speech(bytes,language),v=>Array.isArray(v)?`${v.length} suun asentoa`:'Valmis'),
  transcribe:(bytes:Uint8Array,language:string)=>trackAi('whisper',bridge.transcribe(bytes,language),()=>'Litterointi valmis ('+language+')'),
  kokoroSynthesize:(request:{text:string;voice:string;speed:number})=>trackAi('kokoro',bridge.kokoroSynthesize(request),v=>`${(v.samples.length/v.sampleRate).toFixed(1)} s puhetta (${request.voice})`)});
 tracked.set(bridge,out);return out;
}
export function desktop():DesktopBridge|undefined{const bridge=typeof window==='undefined'?undefined:window.hahmostudio;return bridge&&withAiActivity(bridge);}
/** Dialogit kuuluvat editorin kuoreen, jotta teema ja painikkeet periytyvät. */
export function studioPortalHost():HTMLElement{return document.querySelector('main.studio')??document.body;}
export function nativeFile(value:NativeFile):File{const type:Record<string,string>={png:'image/png',psd:'application/octet-stream',hahmo:'application/octet-stream',wav:'audio/wav',mp3:'audio/mpeg',ogg:'audio/ogg',m4a:'audio/mp4'};return new File([new Uint8Array(value.bytes)],value.name,{type:type[value.name.split('.').at(-1)!.toLowerCase()]??'application/octet-stream'});}
export async function saveFile(blob:Blob,name:string,options:{kind?:'project'|'export';saveAs?:boolean}={}):Promise<boolean>{
 const bridge=desktop();if(bridge)return (await bridge.saveFile({name,bytes:new Uint8Array(await blob.arrayBuffer()),kind:options.kind??'export',saveAs:options.saveAs??false})).saved;
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);return true;
}
export type CloudSecretKey='HAHMOSTUDIO_COLAB_COMFYUI_URL'|'HAHMOSTUDIO_COMFYUI_BEARER'|'GOOGLE_OAUTH_CLIENT_ID'|'GOOGLE_OAUTH_CLIENT_SECRET'|'GOOGLE_OAUTH_REFRESH_TOKEN';
/** Työpöydän pilvitila rendererille: ei koskaan salaisuuksien arvoja. */
export type CloudOp='health'|'backends'|'sync'|'lock'|'direct'|'reference'|'preflight'|'render'|'job'|'cancel'|'smoke'|'notebook-save'|'import';
export type CloudJobEntry={id:string;state:string;sceneId:string;workflowId:string;at:string;jobId?:string};
export type CloudStatus={available:boolean;enabled:boolean;running:boolean;storage:string|null;modelPins:boolean;settings:{enabled:boolean;colabClassifiedFree:boolean;notebookClassifiedFree:boolean};jobs:CloudJobEntry[];policy:{mode:'zero-cost';allowPaidCompute:false;maxCostEur:0;allowPaidFallback:false;allowUnknownCost:false;allowedBackendClasses:string[]};secrets:{encryption:boolean;keys:Record<CloudSecretKey,{label:string;set:boolean}>}};
export type KokoroStatus={installed:boolean;modelVersion:string;license:string;bytes:number;error?:string};
