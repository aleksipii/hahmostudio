const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('hahmostudio',Object.freeze({
 confirmReplace:()=>ipcRenderer.invoke('studio:confirm-replace'),
 openFile:kind=>ipcRenderer.invoke('studio:open',kind),openRecent:id=>ipcRenderer.invoke('studio:recent',id),adoptFile:id=>ipcRenderer.invoke('studio:adopt',id),
 saveFile:request=>ipcRenderer.invoke('studio:save',request),preferences:()=>ipcRenderer.invoke('studio:preferences'),setTheme:theme=>ipcRenderer.invoke('studio:theme',theme),
 speech:(bytes,language)=>ipcRenderer.invoke('studio:speech',bytes,language),cancelSpeech:()=>ipcRenderer.invoke('studio:cancel-speech'),
 reportState:state=>ipcRenderer.send('studio:state',state),completeClose:(id,saved)=>ipcRenderer.send('studio:close-result',id,saved),nativeEdit:action=>ipcRenderer.invoke('studio:edit',action),
 onAction:callback=>{const listener=(_event,payload)=>callback(payload);ipcRenderer.on('studio:action',listener);return()=>ipcRenderer.removeListener('studio:action',listener);}
}));
