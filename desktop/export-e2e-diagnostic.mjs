import {writeFile,stat} from 'node:fs/promises';import {spawnSync} from 'node:child_process';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const click=text=>`(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent?.trim().startsWith(${JSON.stringify(text)})&&!x.disabled);if(!b)throw new Error('Painike puuttuu: ${text}');b.click();return true;})()`;
async function waitFor(fn,{timeoutMs=90000,stepMs=250,label='ehto'}={}){const end=Date.now()+timeoutMs;while(Date.now()<end){try{if(await fn())return;}catch{}await sleep(stepMs);}throw new Error('Aikakatkaisu: '+label);}
/** Mittaa ffmpegin `-i` ja `volumedetect` -tulosteista videon ja äänen todelliset ominaisuudet. */
export function inspectMp4(binary,file){
 const info=spawnSync(binary,['-hide_banner','-i',file],{encoding:'utf8'}).stderr||'',vol=spawnSync(binary,['-hide_banner','-i',file,'-vn','-af','volumedetect','-f','null','-'],{encoding:'utf8'}).stderr||'';
 const video=info.match(/Stream #\d+:\d+[^\n]*Video: (\w+)[^\n]*?(\d{3,4})x(\d{3,4})[^\n]*?(\d+(?:\.\d+)?) fps/),audio=info.match(/Stream #\d+:\d+[^\n]*Audio: (\w+)[^\n]*?(\d+) Hz/),dur=info.match(/Duration: (\d+):(\d+):(\d+\.\d+)/),mean=vol.match(/mean_volume: (-?[\d.]+|-inf) dB/),max=vol.match(/max_volume: (-?[\d.]+|-inf) dB/);
 return {video:video?{codec:video[1],width:+video[2],height:+video[3],fps:+video[4]}:null,audio:audio?{codec:audio[1],hz:+audio[2]}:null,seconds:dur?+dur[1]*3600+ +dur[2]*60+ +dur[3]:0,meanVolumeDb:mean?Number(mean[1]):null,maxVolumeDb:max?Number(max[1]):null};
}
/** Käsikirjoitus (musiikki + askeleet) → Rakenna jakso → Vie… → Pikavienti (esiasetettu kohde) → odota valmis → tarkista MP4:n videon ja äänen sisältö. */
export async function exportE2eDiagnostic(window,{reportPath,destination,binary}){
 window.showInactive();
 const errors=[];window.webContents.on('console-message',(_e,details,message)=>{const level=typeof details==='object'?details.level:details;const text=typeof details==='object'?details.message:message;if(level==='error'||level>=3)errors.push(text);});
 await waitFor(()=>window.webContents.executeJavaScript("!!document.querySelector('.library-tabs')"),{label:'käyttöliittymä'});
 // Jakso käsikirjoituksesta: musiikki ja askeleet (tehosteet) ovat ohjelmallista ääntä, joten MP4:ssä pitää olla äänivirta.
 const script='Musiikki: rauhallinen\nTausta: keittiö\n\nMira kävelee oikealle 2 s.\nNiko kävelee vasemmalle 2 s.\nMira nyökkää.\nNiko hymyilee.\n';
 await window.webContents.executeJavaScript(click('Käsikirjoitus'));
 await waitFor(()=>window.webContents.executeJavaScript("!!document.querySelector('#dialogue-script')"),{label:'käsikirjoituskenttä'});
 await window.webContents.executeJavaScript(`(()=>{const ta=document.querySelector('#dialogue-script');const set=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set;set.call(ta,${JSON.stringify(script)});ta.dispatchEvent(new Event('input',{bubbles:true}));return true;})()`);
 await sleep(2500);
 for(let attempt=0;attempt<4;attempt++){
  await window.webContents.executeJavaScript(click('Rakenna jakso'));
  try{await waitFor(()=>window.webContents.executeJavaScript("document.body.innerText.includes('Jakso rakennettu')"),{timeoutMs:20000,label:'jakso rakennettu'});break;}catch(e){if(attempt===3)throw e;await sleep(2500);}
 }
 // Tuotantopolku: kohtaus liitetään projektiin (miksattu ääni syntyy tässä vaiheessa) ennen vientiä.
 await window.webContents.executeJavaScript("(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent?.trim().startsWith('Olen tarkis')&&!x.disabled);b?.click();return !!b;})()");
 await sleep(1500);
 await waitFor(()=>window.webContents.executeJavaScript("[...document.querySelectorAll('button')].some(x=>/^(Rakenna muokattava jakso projektiin|Päivitä kohtaus)/.test(x.textContent?.trim())&&!x.disabled)"),{timeoutMs:30000,label:'kohtaus-painike käytettävissä'});
 await window.webContents.executeJavaScript(click('Rakenna muokattava jakso projektiin'));
 await waitFor(()=>window.webContents.executeJavaScript("document.body.innerText.includes('Kohtaus lisätty')||document.body.innerText.includes('Dialogikohtaus lisätty')"),{timeoutMs:60000,label:'kohtaus lisätty'});
 await window.webContents.executeJavaScript("(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent?.trim().startsWith('Takaisin editoriin'));b?.click();return !!b;})()");
 await sleep(2500);
 await window.webContents.executeJavaScript(click('Vie…'));
 await waitFor(()=>window.webContents.executeJavaScript("!!document.querySelector('.export-dialog')"),{label:'vientidialogi'});
 const format=await window.webContents.executeJavaScript("(()=>{const s=[...document.querySelectorAll('.export-dialog select')].find(x=>[...x.options].some(o=>/mp4/i.test(o.value)));return s?s.value:null;})()");
 if(format&&!/mp4/i.test(format))await window.webContents.executeJavaScript("(()=>{const s=[...document.querySelectorAll('.export-dialog select')].find(x=>[...x.options].some(o=>/mp4/i.test(o.value)));const set=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set;set.call(s,[...s.options].find(o=>/mp4/i.test(o.value)).value);s.dispatchEvent(new Event('change',{bubbles:true}));})()");
 await window.webContents.executeJavaScript(click('Pikavienti'));
 let job;
 await waitFor(async()=>{const jobs=await window.webContents.executeJavaScript('window.hahmostudio.exportList()');job=jobs.at(-1);return job&&['done','error','canceled','interrupted'].includes(job.state);},{timeoutMs:420000,stepMs:1000,label:'vienti valmis'});
 const file=await stat(destination).catch(()=>null);
 const mp4=file?inspectMp4(binary,destination):null;
 const report={ok:job.state==='done'&&!!file&&file.size>10000&&mp4?.video?.codec==='h264'&&!!mp4.audio&&mp4.audio.hz>=44100&&mp4.seconds>1&&mp4.meanVolumeDb!==null&&mp4.meanVolumeDb>-60,job:{state:job.state,error:job.error,encoder:job.encoder??null,preset:job.preset?{name:job.preset.name,audio:job.preset.audio,format:job.preset.format,fps:job.preset.fps}:null},bytes:file?.size??0,mp4,format,errors:errors.filter((v,i,a)=>a.indexOf(v)===i),gui:true,devices:false};
 if(reportPath)await writeFile(reportPath,JSON.stringify(report,null,2));
 if(!report.ok)throw new Error('Vienti-e2e epäonnistui: '+JSON.stringify(report));
 return report;
}
