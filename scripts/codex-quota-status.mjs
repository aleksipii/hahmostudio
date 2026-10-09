// Read-only official Codex app-server rate-limit query. No model calls or Git writes.
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {createInterface} from 'node:readline';
import {pathToFileURL} from 'node:url';

export function quotaStatus(result,{anyWindow=false}={}){
 const buckets=result?.rateLimitsByLimitId??{default:result?.rateLimits},windows=[];
 for(const [id,bucket] of Object.entries(buckets)){
  if(!bucket)continue;
  for(const name of ['primary','secondary']){
   const w=bucket[name];if(!w||!Number.isFinite(w.usedPercent)||w.usedPercent<0)continue;
   windows.push({limitId:bucket.limitId??id,window:name,usedPercent:w.usedPercent,remainingPercent:Math.max(0,100-w.usedPercent),windowDurationMins:w.windowDurationMins??null,resetsAt:w.resetsAt??null});
  }
 }
 return{available:windows.length>0,thresholdRemainingPercent:10,selection:anyWindow?'any':'primary-300-minutes',selectedWindowAvailable:windows.some(w=>anyWindow||w.window==='primary'&&w.windowDurationMins===300),checkpointRecommended:windows.some(w=>(anyWindow||w.window==='primary'&&w.windowDurationMins===300)&&w.remainingPercent<=10),windows};
}

export function readCodexQuota({binary,timeoutMs=15000,anyWindow=false}={}){
 const desktop='/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex';
 return new Promise(resolve=>{
  const child=spawn(binary??process.env.CODEX_BIN??(existsSync(desktop)?desktop:'codex'),['app-server'],{stdio:['pipe','pipe','ignore']});
  let finished=false,lines,timer;
  const finish=value=>{if(finished)return;finished=true;clearTimeout(timer);lines?.close();child.kill('SIGTERM');resolve(value);};
  const unavailable=()=>finish({available:false,checkpointRecommended:false,reason:'Codex rate limits unavailable; do not infer a quota percentage.'});
  child.on('error',unavailable);child.stdin.on('error',unavailable);child.on('close',unavailable);
  const send=value=>{if(!finished)child.stdin.write(JSON.stringify(value)+'\n');};
  lines=createInterface({input:child.stdout});
  lines.on('line',line=>{
   let msg;try{msg=JSON.parse(line);}catch{return;}
   if(msg.id===1){if(msg.error){unavailable();return;}send({method:'initialized'});send({id:2,method:'account/rateLimits/read'});}
   if(msg.id===2){if(msg.error){unavailable();return;}finish(quotaStatus(msg.result,{anyWindow}));}
  });
  timer=setTimeout(unavailable,timeoutMs);
  send({id:1,method:'initialize',params:{clientInfo:{name:'hahmostudio-quota-status',version:'1.0.0'}}});
 });
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 console.log(JSON.stringify(await readCodexQuota({anyWindow:process.argv.includes('--any-window')}),null,2));
}
