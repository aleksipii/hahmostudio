// Isolated Electron GUI acceptance. Generated audio is not a physical microphone test.
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
export async function workflowDiagnostic(window,directory,{packaged=false}={}){
 await mkdir(directory,{recursive:true});window.showInactive();const errors=[],checks=[],geometry=[];
 const js=code=>window.webContents.executeJavaScript(code,true);
 const check=(name,ok,detail)=>{console.log((ok?'PASS ':'FAIL ')+name);checks.push({name,ok:!!ok,...(detail===undefined?{}:{detail})});if(!ok)throw Error(name);};
 const wait=async(code,label)=>{for(let i=0;i<200;i++){if(await js(code))return;await sleep(100);}throw Error('Timeout: '+label);};
 const click=async name=>{await wait(`[...document.querySelectorAll('button')].some(e=>(e.getAttribute('aria-label')||e.textContent.trim())===${JSON.stringify(name)}&&!e.disabled&&!e.closest('[hidden],details:not([open]) > :not(summary)')&&e.getClientRects().length)`,'button '+name);await js(`(()=>{const e=[...document.querySelectorAll('button')].find(e=>(e.getAttribute('aria-label')||e.textContent.trim())===${JSON.stringify(name)}&&!e.disabled&&!e.closest('[hidden],details:not([open]) > :not(summary)')&&e.getClientRects().length);if(!e)throw Error('Missing button: '+${JSON.stringify(name)});e.click();})()`);await sleep(200);};
 const phase=async name=>{await js(`document.querySelector(${JSON.stringify(name==='workshop'?'.s2-workshop':`.s2-phase[data-studio-flow-step="${name}"]`)}).click()`);await sleep(250);};
 window.webContents.on('console-message',e=>{if(e.level==='error')errors.push(e.message);});
 let report;
 try{
  await wait("!!document.querySelector('.s2-project-menu')",'editor');
  await phase('characters');await click('Valitse Pipsa-3D');await wait("!!document.querySelector('.artboard canvas')",'character');
  await phase('script');await click('Kokeile esimerkkiä');await wait("[...document.querySelectorAll('textarea')].some(e=>e.value.length>200)",'sample');
  await click('Rakenna jakso');await wait("document.body.innerText.includes('Jakso rakennettu')",'episode');
  for(const [width,height] of [[1200,720],[1440,900]]){
   window.setContentSize(width,height);
   for(const step of ['script','characters','storyboard','shot','timeline','workshop']){
    await phase(step);const g=await js("({width:innerWidth,height:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth,canvas:!!document.querySelector('.artboard canvas')})");geometry.push({phase:step,...g});check(`${step} ${width}: no horizontal overflow`,!g.overflow);
    await writeFile(join(directory,`${step}-${width}.png`),(await window.webContents.capturePage()).toPNG());
   }
  }
  window.setContentSize(1440,900);await phase('script');
  await js("document.querySelector('.tarina-review-toggle').click()");await sleep(250);
  await js("(()=>{const e=document.querySelector('.production-audio-dock .performance-panel select');if(!e||e.options.length<2)throw Error('No dialogue');e.value=e.options[1].value;e.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('.production-audio-dock .performance-panel .dialogue-recorder').scrollIntoView({block:'center'});})()");await sleep(200);
  // Only this diagnostic overrides getUserMedia. No hardware permission is requested.
  await js(`(()=>{const context=new AudioContext(),source=context.createOscillator(),gain=context.createGain(),destination=context.createMediaStreamDestination();source.frequency.value=220;gain.gain.value=.03;source.connect(gain);gain.connect(destination);source.start();window.__workflowAudio={context,source,stream:destination.stream,calls:0};Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:async constraints=>{if(!constraints.audio||constraints.video)throw Error('Unexpected media request');window.__workflowAudio.calls++;await context.resume();return destination.stream;}});})()`);
  await click('Äänitä repliikki omalla äänellä');await wait("!!document.querySelector('.production-audio-dock.is-recording')&&document.querySelector('.production-audio-dock .performance-panel .dialogue-recorder').textContent.includes('Lopeta ja käytä')",'recording');
  await js("window.__workflowRecorder=document.querySelector('.production-audio-dock .performance-panel .dialogue-recorder');window.__workflowDock=document.querySelector('.production-audio-dock.is-recording')");
  for(const step of ['shot','storyboard','characters','timeline','workshop','script']){
   await phase(step);
   const state=await js(`(()=>{const recorder=document.querySelector('.production-audio-dock .performance-panel .dialogue-recorder'),dock=document.querySelector('.production-audio-dock.is-recording');recorder?.scrollIntoView({block:'center'});const b=recorder?.querySelector('button'),r=b?.getBoundingClientRect();return {sameRecorder:recorder===window.__workflowRecorder,sameDock:dock===window.__workflowDock,overlay:!!dock?.closest('.recording-tools-overlay-host'),live:window.__workflowAudio.stream.getAudioTracks().every(t=>t.readyState==='live'),calls:window.__workflowAudio.calls,status:document.querySelector('.device-status')?.textContent.includes('Mikrofoni: repliikin tallennus'),enabled:!!b&&!b.disabled,hit:!!r&&document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)?.closest('button')===b,visible:!!r&&r.width>0&&r.height>0&&r.top>=0&&r.bottom<=innerHeight&&!b.closest('[hidden],details:not([open]) > :not(summary)')};})()`);
   check(`recording survives ${step}`,state.sameRecorder&&state.sameDock&&state.overlay&&state.live&&state.calls===1&&state.status&&state.enabled&&state.visible&&state.hit,state);
  }
  await writeFile(join(directory,'recording-phase-switch.png'),(await window.webContents.capturePage()).toPNG());
  await click('Hylkää äänitys');await wait("!document.querySelector('.production-audio-dock.is-recording')",'cancel');
  check('cancel restores microphone status',await js("document.querySelector('.device-status')?.textContent.includes('Mikrofoni: pois')"));
  check('cancel releases audio track',await js("window.__workflowAudio.stream.getAudioTracks().every(t=>t.readyState==='ended')"));
  check('cancel preserves recorder and reports cancellation',await js("document.querySelector('.production-audio-dock .performance-panel .dialogue-recorder')===window.__workflowRecorder&&document.querySelector('.production-audio-dock .performance-panel .dialogue-recorder').textContent.includes('Äänitys peruttiin')"));
  await js("window.__workflowAudio.source.stop();window.__workflowAudio.context.close()");
  check('no renderer errors',errors.length===0,errors);
  report={ok:true,packaged,gui:true,physicalDevices:false,voiceOver:false,audio:'generated oscillator stream through real AudioWorklet; cancellation only; no microphone permission',checks,geometry,errors};
 }catch(error){const state=await js("({recorder:document.querySelector('.production-audio-dock .performance-panel .dialogue-recorder')?.textContent,recordingDock:document.querySelector('.production-audio-dock.is-recording')?.outerHTML.slice(0,500),audioCalls:window.__workflowAudio?.calls})").catch(()=>null);console.error(error.message,state);await writeFile(join(directory,'failed.png'),(await window.webContents.capturePage()).toPNG());report={ok:false,state,error:error.message,gui:true,physicalDevices:false,voiceOver:false,checks,geometry,errors};}
 await writeFile(join(directory,'workflow-report.json'),JSON.stringify(report,null,2));
 if(!report.ok)throw Error(report.error);return report;
}
