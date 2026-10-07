const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('hahmostudio',Object.freeze({
 revisionsList:project=>ipcRenderer.invoke('studio:revisions-list',project),revisionsSave:data=>ipcRenderer.invoke('studio:revisions-save',data),revisionsRead:(project,id)=>ipcRenderer.invoke('studio:revisions-read',project,id),revisionsRemove:(project,id)=>ipcRenderer.invoke('studio:revisions-remove',project,id),
 recoveryResources:refs=>ipcRenderer.invoke('studio:recovery-resources',refs),recoveryTransaction:request=>ipcRenderer.invoke('studio:recovery-transaction',request),recoveryImport:request=>ipcRenderer.invoke('studio:recovery-import',request),
 recoveryRead:reference=>ipcRenderer.invoke('studio:recovery-read',reference),
 recoverySave:snapshot=>ipcRenderer.invoke('studio:recovery-save',snapshot),recoveryLatest:()=>ipcRenderer.invoke('studio:recovery-latest'),recoveryClear:()=>ipcRenderer.invoke('studio:recovery-clear'),
 exportPreferences:()=>ipcRenderer.invoke('studio:export-preferences'),exportSetPreferences:data=>ipcRenderer.invoke('studio:export-set-preferences',data),
 exportEnqueue:request=>ipcRenderer.invoke('studio:export-enqueue',request),exportList:()=>ipcRenderer.invoke('studio:export-list'),exportCancel:id=>ipcRenderer.invoke('studio:export-cancel',id),exportRemove:id=>ipcRenderer.invoke('studio:export-remove',id),exportRetry:id=>ipcRenderer.invoke('studio:export-retry',id),exportFinder:id=>ipcRenderer.invoke('studio:export-finder',id),onExports:callback=>{const listener=(_e,jobs)=>callback(jobs);ipcRenderer.on('studio:export-jobs',listener);return()=>ipcRenderer.removeListener('studio:export-jobs',listener);},
 confirmReplace:()=>ipcRenderer.invoke('studio:confirm-replace'),
 openFile:kind=>ipcRenderer.invoke('studio:open',kind),openRecent:id=>ipcRenderer.invoke('studio:recent',id),adoptFile:id=>ipcRenderer.invoke('studio:adopt',id),
 saveFile:request=>ipcRenderer.invoke('studio:save',request),preferences:()=>ipcRenderer.invoke('studio:preferences'),contextMenu:scope=>ipcRenderer.invoke('studio:context-menu',scope),setUi:value=>ipcRenderer.invoke('studio:ui-settings',value),setAccessibility:value=>ipcRenderer.invoke('studio:accessibility',value),setTheme:theme=>ipcRenderer.invoke('studio:theme',theme),
 audioDownload:()=>ipcRenderer.invoke('studio:audio-download'),
 audioModel:()=>ipcRenderer.invoke('studio:audio-model'),transcribe:(bytes,language)=>ipcRenderer.invoke('studio:transcribe',bytes,language),
 kokoroStatus:()=>ipcRenderer.invoke('studio:kokoro-status'),kokoroDownload:()=>ipcRenderer.invoke('studio:kokoro-download'),kokoroRemove:()=>ipcRenderer.invoke('studio:kokoro-remove'),kokoroSynthesize:request=>ipcRenderer.invoke('studio:kokoro-synthesize',request),kokoroCancel:()=>ipcRenderer.invoke('studio:kokoro-cancel'),onKokoroProgress:callback=>{const listener=(_e,p)=>callback(p);ipcRenderer.on('studio:kokoro-progress',listener);return()=>ipcRenderer.removeListener('studio:kokoro-progress',listener);},
 speech:(bytes,language)=>ipcRenderer.invoke('studio:speech',bytes,language),cancelSpeech:()=>ipcRenderer.invoke('studio:cancel-speech'),
 reportState:state=>ipcRenderer.send('studio:state',state),completeClose:(id,saved)=>ipcRenderer.send('studio:close-result',id,saved),nativeEdit:action=>ipcRenderer.invoke('studio:edit',action),
 onAction:callback=>{const listener=(_event,payload)=>callback(payload);ipcRenderer.on('studio:action',listener);return()=>ipcRenderer.removeListener('studio:action',listener);}
}));
