import {spawnSync} from 'node:child_process';import {createRequire} from 'node:module';import {mkdtemp,readFile,writeFile,mkdir} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {existsSync} from 'node:fs';
if(!existsSync('dist-desktop/index.html')){const build=spawnSync(process.execPath,['scripts/desktop-build.mjs'],{stdio:'inherit'});if(build.status)process.exit(build.status??1);}
// Päästä päähän: Electron-ikkuna → esimerkki → Pikavienti (kohde esiasetettu) → oikea ExportQueue, FFmpeg ja VideoToolbox → MP4:n sisällön mittaus.
const data=await mkdtemp(join(tmpdir(),'kilsat-export-e2e-'));await mkdir(join(data,'export-out'),{recursive:true});
await writeFile(join(data,'export-preferences.json'),JSON.stringify({presets:[],last:null,destination:{path:join(data,'export-out','vienti.mp4'),format:'mp4'}}));
const electron=createRequire(import.meta.url)('electron');
const env={...process.env,HAHMOSTUDIO_TEST_DATA_DIR:data};delete env.ELECTRON_RUN_AS_NODE;
const result=spawnSync(electron,['.','--export-e2e-test'],{stdio:'inherit',env});
const reportPath=join(data,'export-e2e.json');
if(existsSync(reportPath))console.log('export-e2e:',await readFile(reportPath,'utf8'));else console.error('Ei raporttia; Electron poistui',result.status,result.signal??'');
console.log('data:',data);process.exit(result.status??1);
