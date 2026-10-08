import {EventEmitter} from 'node:events';
export const app=new EventEmitter();app.requestSingleInstanceLock=()=>true;app.whenReady=()=>new Promise(()=>{});
export const BrowserWindow=class {};export const Menu={};export const dialog={};export const ipcMain={};export const session={};export const systemPreferences={};export const utilityProcess={};export const nativeTheme={};
export const shell={showItemInFolder(){}};
let displayName='hahmostudio',dataPath='/isolated-test/hahmostudio';
app.getPath=()=>dataPath;app.setPath=(key,path)=>{dataPath=path;};app.setName=name=>{displayName=name;};app.getName=()=>displayName;

export const screen={getDisplayMatching:()=>({workArea:{x:0,y:0,width:1920,height:1080}})};
export const clipboard={readText:()=>''};export const safeStorage={isEncryptionAvailable:()=>false,encryptString(){throw Error('stub');},decryptString(){throw Error('stub');}};
