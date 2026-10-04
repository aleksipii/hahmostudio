import {EventEmitter} from 'node:events';
export const app=new EventEmitter();app.requestSingleInstanceLock=()=>true;app.whenReady=()=>new Promise(()=>{});
export const BrowserWindow=class {};export const Menu={};export const dialog={};export const ipcMain={};export const session={};export const systemPreferences={};export const utilityProcess={};export const nativeTheme={};
export const shell={showItemInFolder(){}};
