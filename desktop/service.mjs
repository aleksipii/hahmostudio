import {createTranscriber} from '../server/transcriber.mjs';
import {createPrivateServer} from '../server/private-server.mjs';import {createSpeechRecognizer} from '../server/speech-recognizer.mjs';
let server,controller=new AbortController();
const stop=async()=>{controller.abort();if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}process.exit(0);};
process.parentPort.on('message',async({data})=>{
 if(data.type==='stop'){await stop();return;}
 if(data.type!=='start'||server)return;
 try{const recognize=createSpeechRecognizer(data.rhubarb);server=await createPrivateServer({transcriber:createTranscriber(data.transcriber),distDir:data.distDir,desktopToken:data.token,speechRecognizer:(bytes,language,signal)=>recognize(bytes,language,AbortSignal.any([signal,controller.signal]))});await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});process.parentPort.postMessage({type:'ready',port:server.address().port});}catch(e){process.parentPort.postMessage({type:'error',message:e.message});await stop();}
});process.on('SIGTERM',()=>void stop());
