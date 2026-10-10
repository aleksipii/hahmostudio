import {spawnSync} from 'node:child_process';
const notices=spawnSync(process.execPath,['scripts/desktop-notices.mjs'],{stdio:'inherit'});if(notices.status!==0)process.exit(notices.status??1);
const result=spawnSync('npm',['run','build','--','--outDir','dist-desktop','--configLoader','runner'],{stdio:'inherit',env:{...process.env,VITE_BASE_PATH:'/',VITE_PRIVATE_SERVER:'false'}});process.exit(result.status??1);
