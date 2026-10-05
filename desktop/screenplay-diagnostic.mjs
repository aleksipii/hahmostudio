import {writeFile} from 'node:fs/promises';import {join} from 'node:path';
const MARKER='GUI-PILOTTI-037';
const SCRIPT=`#!kilsat\nHahmo: Pilotti\nKohtaus: Testi\n${MARKER}\n`;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const jsClick=text=>`(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent?.trim()===${JSON.stringify(text)});if(!b)throw new Error('Painike puuttuu: ${text}');b.click();return true;})()`;
const jsSetText=`(()=>{const ta=document.querySelector('#dialogue-script');if(!ta)throw new Error('Käsikirjoituskenttä puuttuu');const set=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value')?.set;if(!set)throw new Error('Textarea setter puuttuu');set.call(ta,${JSON.stringify(SCRIPT)});ta.dispatchEvent(new Event('input',{bubbles:true}));return ta.value.includes(${JSON.stringify(MARKER)});})()`;
const jsReadText=`(()=>document.querySelector('#dialogue-script')?.value??'')()`;
async function waitFor(fn,{timeoutMs=45000,stepMs=150}={}){const end=Date.now()+timeoutMs;while(Date.now()<end){try{if(await fn())return;}catch{}await sleep(stepMs);}throw new Error('Aikakatkaisu odottaessa ehtoa.');}
/** Headless Electron checklist: empty project script page → text → back → reopen → undo. */
export async function screenplayDiagnostic(window,{undo,reportPath}){
 window.showInactive();
 const errors=[],reactDepth=/Maximum update depth/i;
 window.webContents.on('console-message',(_event,details,message)=>{const level=typeof details==='object'?details.level:details;const text=typeof details==='object'?details.message:message;if(level==='error'||level>=3)errors.push(text);if(reactDepth.test(text))errors.push('REACT_DEPTH:'+text);});
 await waitFor(()=>window.webContents.executeJavaScript("!!document.querySelector('.header-actions button')?.textContent?.includes('Käsikirjoitus')"));
 await window.webContents.executeJavaScript(jsClick('Käsikirjoitus'));
 await waitFor(()=>window.webContents.executeJavaScript("!document.querySelector('.screenplay-page')?.hidden && !!document.querySelector('#dialogue-script')"));
 await window.webContents.executeJavaScript(jsSetText);
 await window.webContents.executeJavaScript(jsClick('Takaisin editoriin'));
 await waitFor(()=>window.webContents.executeJavaScript(`(()=>{const page=document.querySelector('.screenplay-page');const err=document.querySelector('.error-bar')?.textContent??'';const busy=document.querySelector('.header-actions .primary')?.textContent?.includes('Odota');return !!page?.hidden&&!err.includes('ei tallennettu')&&!busy;})()`),{timeoutMs:90000});
 await window.webContents.executeJavaScript(jsClick('Käsikirjoitus'));
 await waitFor(()=>window.webContents.executeJavaScript(`(${jsReadText}).includes(${JSON.stringify(MARKER)})`));
 const afterSave=await window.webContents.executeJavaScript(jsReadText);
 await window.webContents.executeJavaScript(jsClick('Takaisin editoriin'));
 await waitFor(()=>window.webContents.executeJavaScript("document.querySelector('.screenplay-page')?.hidden"));
 await undo();
 await waitFor(()=>window.webContents.executeJavaScript("!document.querySelector('.header-actions .primary')?.textContent?.includes('Odota')"),{timeoutMs:60000});
 await window.webContents.executeJavaScript(jsClick('Käsikirjoitus'));
 await waitFor(()=>window.webContents.executeJavaScript('!!document.querySelector("#dialogue-script")'));
 const afterUndo=await window.webContents.executeJavaScript(jsReadText);
 const report={ok:afterSave.includes(MARKER)&&!afterUndo.includes(MARKER),marker:MARKER,afterSave,afterUndo,errors:errors.filter((v,i,a)=>a.indexOf(v)===i),gui:true,devices:false,checklist:['open-script','type','back-commit','reopen','undo','reopen-empty']};
 if(!report.ok)throw new Error('Käsikirjoitus-GUI epäonnistui: '+JSON.stringify(report));
 if(reportPath)await writeFile(reportPath,JSON.stringify(report,null,2));
 return report;
}
