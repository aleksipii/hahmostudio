import {spawn,spawnSync} from 'node:child_process';import {existsSync} from 'node:fs';import {createRequire} from 'node:module';
if(!existsSync('dist-desktop/index.html')){const result=spawnSync(process.execPath,['scripts/desktop-build.mjs'],{stdio:'inherit'});if(result.status!==0)process.exit(result.status??1);}
const env={...process.env,VITE_BASE_PATH:'/',VITE_PRIVATE_SERVER:'false'};delete env.ELECTRON_RUN_AS_NODE;
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5179','--strictPort','--configLoader','runner'],{stdio:'inherit',env});
let electron;const stop=()=>{electron?.kill();vite.kill();};process.on('SIGINT',stop);process.on('SIGTERM',stop);
try{for(let attempt=0;attempt<100;attempt++){try{if((await fetch('http://127.0.0.1:5179')).ok)break;}catch{}if(attempt===99)throw new Error('Vite ei käynnistynyt.');await new Promise(r=>setTimeout(r,100));}electron=spawn(createRequire(import.meta.url)('electron'),['.'],{stdio:'inherit',env:{...env,HAHMOSTUDIO_DEV_URL:'http://127.0.0.1:5179'}});electron.on('exit',code=>{stop();process.exitCode=code??1;});}catch(error){stop();throw error;}
