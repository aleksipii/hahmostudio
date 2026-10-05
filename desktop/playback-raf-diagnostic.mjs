import {writeFile} from 'node:fs/promises';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const click=text=>`(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent?.trim()===${JSON.stringify(text)});if(!b)throw new Error('Painike puuttuu: ${text}');b.click();return true;})()`;
async function waitFor(fn,{timeoutMs=90000,stepMs=200}={}){const end=Date.now()+timeoutMs;while(Date.now()<end){try{if(await fn())return;}catch{}await sleep(stepMs);}throw new Error('Aikakatkaisu.');}
function parseMetrics(){
 return `(()=>{const fpsEl=document.querySelector('[data-testid="playback-fps"]');const transport=document.querySelector('.transport-metrics span')?.textContent??'';const m=fpsEl?.textContent?.match(/([\\d.]+)\\s*fps/)??transport.match(/([\\d.]+)\\s*fps/);const p95=fpsEl?.title?.match(/p95\\s+([\\d.]+)/)?.[1]??transport.match(/p95\\s+([\\d.]+)/)?.[1];return {fps:m?Number(m[1]):0,p95Ms:p95?Number(p95):0,transport,footer:fpsEl?.textContent??''};})()`;
}
/** Kille–Handu studio example → playback → read editor rAF metrics at multiple window sizes. */
export async function playbackRafDiagnostic(window,{reportPath,viewports=[[1440,900],[1280,720]]}){
 window.showInactive();
 const errors=[],reactDepth=/Maximum update depth/i;
 window.webContents.on('console-message',(_event,details,message)=>{const level=typeof details==='object'?details.level:details;const text=typeof details==='object'?details.message:message;if(level==='error'||level>=3)errors.push(text);if(reactDepth.test(text))errors.push('REACT_DEPTH:'+text);});
 await waitFor(()=>window.webContents.executeJavaScript("!!document.querySelector('.library-tabs')"));
 await window.webContents.executeJavaScript(click('Käsikirjoitus'));
 await waitFor(()=>window.webContents.executeJavaScript("document.querySelector('.library-tab')||document.querySelector('.library-tabs button[aria-pressed=\"true\"]')?.textContent?.includes('Käsikirjoitus')"));
  await window.webContents.executeJavaScript(click('Kokeile esimerkkianimaatiota'));
 await waitFor(()=>window.webContents.executeJavaScript("!document.querySelector('.header-actions .primary')?.textContent?.includes('Odota')"),{timeoutMs:120000});
 await waitFor(()=>window.webContents.executeJavaScript("!!document.querySelector('.artboard canvas')"));
 await waitFor(()=>window.webContents.executeJavaScript("document.querySelector('.transport-controls')?.textContent?.includes('Toistetaan')||document.querySelector('.transport-controls')?.textContent?.includes('Tauolla')"),{timeoutMs:30000});
 const sizes=[];
 for(const [width,height] of viewports){
  window.setContentSize(width,height);
  await sleep(600);
  await window.webContents.executeJavaScript(`(()=>{const s=document.querySelector('.transport-controls [role="status"]')?.textContent??'';if(!s.includes('Toistetaan'))document.querySelector('.transport-controls button.secondary')?.click();return true;})()`);
  let metrics={fps:0,p95Ms:0,transport:'',footer:''};
  for(let i=0;i<30;i++){await sleep(250);metrics=await window.webContents.executeJavaScript(parseMetrics());if(metrics.fps>0)break;}
  if(metrics.fps<=0){await sleep(4000);metrics=await window.webContents.executeJavaScript(parseMetrics());}
  await window.webContents.executeJavaScript(`(()=>{document.querySelector('.transport-controls button.secondary')?.click();return true;})()`);
  sizes.push({width,height,...metrics});
 }
 const report={ok:sizes.some(s=>s.fps>0),example:'Kille-Handu-studio',sizes,errors:[...new Set(errors)],gui:true,devices:false,scope:'Electron Chromium requestAnimationFrame during presentation playback'};
 if(!report.ok)throw new Error('rAF-profiili epäonnistui: '+JSON.stringify(report));
 if(reportPath)await writeFile(reportPath,JSON.stringify(report,null,2));
 return report;
}
