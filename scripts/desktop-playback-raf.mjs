import {spawnSync} from 'node:child_process';import {createRequire} from 'node:module';import {mkdtemp,readFile,copyFile,mkdir} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {existsSync} from 'node:fs';
if(!existsSync('dist-desktop/index.html')){const build=spawnSync(process.execPath,['scripts/desktop-build.mjs'],{stdio:'inherit'});if(build.status)process.exit(build.status??1);}
const data=await mkdtemp(join(tmpdir(),'kilsat-playback-raf-'));
const env={...process.env,HAHMOSTUDIO_TEST_DATA_DIR:data};delete env.ELECTRON_RUN_AS_NODE;
const electron=createRequire(import.meta.url)('electron');
const result=spawnSync(electron,['.', '--playback-raf-profile'],{stdio:'inherit',env});
const report=join(data,'playback-raf.json');
if(existsSync(report)){
 const body=await readFile(report,'utf8');
 console.log(body);
 await mkdir('docs/benchmarks',{recursive:true});
 await copyFile(report,'docs/benchmarks/0.37-playback-raf-electron.json');
}
process.exit(result.status??1);
