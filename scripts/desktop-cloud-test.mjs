import {spawnSync} from 'node:child_process';import {createRequire} from 'node:module';import {mkdtemp,readFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {existsSync} from 'node:fs';
if(process.argv.includes("--rebuild")||!existsSync("dist-desktop/index.html")){const build=spawnSync(process.execPath,['scripts/desktop-build.mjs'],{stdio:'inherit'});if(build.status)process.exit(build.status??1);}
const data=await mkdtemp(join(tmpdir(),'kilsat-cloud-test-'));
const electron=createRequire(import.meta.url)('electron');
const env={...process.env,HAHMOSTUDIO_TEST_DATA_DIR:data};delete env.ELECTRON_RUN_AS_NODE;
const result=spawnSync(electron,['.', '--cloud-test'],{stdio:'inherit',env});
const reportPath=join(data,'cloud-test.json');
const fallback=join(data,'self-test.json');
const path=existsSync(reportPath)?reportPath:existsSync(fallback)?fallback:null;
if(path)console.log('cloud-test:',await readFile(path,'utf8'));
else if(result.status)console.error('Electron exited',result.status,result.signal??'');
const report=path?JSON.parse(await readFile(path,"utf8")):null;process.exit(result.status||(report?.ok?0:1));
