export type FileKind='project'|'character'|'audio'|'rig'|'animation'|'series';
export type NativeFile={id:string;name:string;bytes:Uint8Array};
export type DesktopAction={action:'open'|'import'|'audio'|'save'|'saveAs'|'export'|'undo'|'redo'|'play'|'save-for-close'|'help'|'fit'|'library'|'inspector'|'timeline'|'focus-stage'|'reset-layout';id?:string};
export type DesktopBridge={
 openFile:(kind:FileKind)=>Promise<NativeFile|null>;openRecent:(id:string)=>Promise<NativeFile|null>;adoptFile:(id:string|null)=>Promise<void>;
 saveFile:(request:{name:string;bytes:Uint8Array;kind:'project'|'export';saveAs:boolean})=>Promise<{saved:boolean;name?:string}>;
 preferences:()=>Promise<{theme:'system'|'light'|'dark';recent:{id:string;name:string}[]}>;setTheme:(theme:'system'|'light'|'dark')=>Promise<void>;
 confirmReplace:()=>Promise<'save'|'discard'|'cancel'>;
 reportState:(state:{dirty:boolean;ready:boolean})=>void;completeClose:(id:string,saved:boolean)=>void;nativeEdit:(action:'undo'|'redo')=>Promise<void>;
 speech:(bytes:Uint8Array,language:string)=>Promise<unknown>;cancelSpeech:()=>Promise<void>;onAction:(callback:(payload:DesktopAction)=>void)=>()=>void;
};
declare global{interface Window{hahmostudio?:DesktopBridge;}}
export function desktop():DesktopBridge|undefined{return typeof window==='undefined'?undefined:window.hahmostudio;}
export function nativeFile(value:NativeFile):File{const type:Record<string,string>={png:'image/png',psd:'application/octet-stream',hahmo:'application/octet-stream',wav:'audio/wav',mp3:'audio/mpeg',ogg:'audio/ogg',m4a:'audio/mp4'};return new File([new Uint8Array(value.bytes)],value.name,{type:type[value.name.split('.').at(-1)!.toLowerCase()]??'application/octet-stream'});}
export async function saveFile(blob:Blob,name:string,options:{kind?:'project'|'export';saveAs?:boolean}={}):Promise<boolean>{
 const bridge=desktop();if(bridge)return (await bridge.saveFile({name,bytes:new Uint8Array(await blob.arrayBuffer()),kind:options.kind??'export',saveAs:options.saveAs??false})).saved;
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);return true;
}
