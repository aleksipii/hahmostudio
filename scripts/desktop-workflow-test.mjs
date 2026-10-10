// Launch the real Electron app with isolated data; never touches the installed bundle.
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {mkdtemp,readFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
const packaged=process.argv.includes('--packaged'),data=await mkdtemp(join(tmpdir(),'hahmostudio-workflow-'));
const output=resolve(process.env.HAHMOSTUDIO_WORKFLOW_OUTPUT??`docs/tiimi/todennus/mac-workflow-20261010/${packaged?'packaged':'source'}`);
await mkdir(output,{recursive:true});await rm(join(output,'workflow-report.json'),{force:true});
const binary=packaged?resolve(`release/KOETA-darwin-${process.arch}/KOETA.app/Contents/MacOS/KOETA`):createRequire(import.meta.url)('electron');
const env={...process.env,HAHMOSTUDIO_TEST_DATA_DIR:data,HAHMOSTUDIO_WORKFLOW_OUTPUT:output};delete env.ELECTRON_RUN_AS_NODE;
const result=spawnSync(binary,[...(packaged?[]:['.']),'--workflow-gui-test'],{stdio:'inherit',env,timeout:600000});
const report=await readFile(join(output,'workflow-report.json'),'utf8').then(JSON.parse).catch(()=>null);
console.log(JSON.stringify({data,output,exitCode:result.status,error:result.error?.message,report},null,2));
process.exit(result.status===0&&report?.ok===true&&report.packaged===packaged?0:1);
