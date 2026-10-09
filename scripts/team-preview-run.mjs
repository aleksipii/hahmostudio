import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
const build=spawnSync(process.execPath,['node_modules/vite/bin/vite.js','build','--config','scripts/team-preview-vite.config.mjs','--configLoader','runner'],{stdio:'inherit'});
if(build.status!==0)process.exit(build.status??1);
const electron=createRequire(import.meta.url)('electron'),env={...process.env};
delete env.ELECTRON_RUN_AS_NODE;
const result=spawnSync(electron,['scripts/team-preview.mjs'],{stdio:'inherit',env});
process.exit(result.status??1);
