// Verify an existing build without installing it or reading owner application data.
import assert from 'node:assert/strict';
import {readdir,readFile,lstat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {extractFile} from '@electron/asar';
const bundle=resolve(process.argv[2]??`release/KOETA-darwin-${process.arch}/KOETA.app`);
const resources=join(bundle,'Contents/Resources'),runtime=join(resources,'kokoro'),archive=join(resources,'app.asar');
const signature=spawnSync('/usr/bin/codesign',['--verify','--deep','--strict',bundle],{encoding:'utf8'});
assert.equal(signature.status,0,signature.stderr||signature.error?.message);
let runtimeFiles=0;
async function walk(path){for(const entry of await readdir(path,{withFileTypes:true})){
 const child=join(path,entry.name),info=await lstat(child);
 assert.equal(info.isSymbolicLink(),false,`Kokoro runtime has a symbolic link: ${child}`);
 assert.notEqual(entry.name,'.cache',`Model cache bundled: ${child}`);
 assert.equal(/\.(?:onnx|safetensors|pt|pth)$/i.test(entry.name),false,`Model weights bundled: ${child}`);
 if(info.isDirectory())await walk(child);else runtimeFiles++;
}}
await walk(runtime);
const lock=JSON.parse(await readFile(join(runtime,'package-lock.json'),'utf8'));
const licenses=extractFile(archive,'licenses/kokoro/THIRD_PARTY.txt').toString();
assert.equal(licenses,await readFile('licenses/kokoro/THIRD_PARTY.txt','utf8'),'Packaged runtime licenses differ from source');
const notices=extractFile(archive,'THIRD_PARTY_NOTICES.md').toString();
assert.equal(notices,await readFile('THIRD_PARTY_NOTICES.md','utf8'),'Packaged notices differ from source');
const packages=[];
for(const [path,meta] of Object.entries(lock.packages??{})){
 if(!path||meta.link)continue;
 // npm's lock also lists optional packages for other operating systems.
 const installed=await readFile(join(runtime,path,'package.json'),'utf8').then(JSON.parse).catch(error=>{if(error.code==='ENOENT')return null;throw error;});
 if(!installed){assert.ok(meta.optional,`Required runtime package missing: ${path}`);continue;}
 assert.equal(installed.version,meta.version,`Runtime lock mismatch: ${path}`);
 assert.ok(licenses.includes(`${installed.name} ${installed.version} — `),`License entry missing: ${installed.name} ${installed.version}`);
 packages.push(`${installed.name}@${installed.version}`);
}
assert.ok(packages.some(name=>name==='kokoro-js@1.2.1'),'Expected Kokoro runtime missing');
for(const path of ['desktop/main.mjs','desktop/kokoro-worker.mjs','desktop/workflow-diagnostic.mjs','dist-desktop/index.html']){
 assert.deepEqual(extractFile(archive,path),await readFile(path),`Packaged source differs: ${path}`);
}
const appAsarSha256=createHash('sha256').update(await readFile(archive)).digest('hex');
console.log(JSON.stringify({ok:true,bundle,arch:process.arch,signatureVerified:true,signature:'ad hoc',notarized:false,runtimeFiles,runtimePackages:packages.length,kokoroWeightsBundled:false,runtimeSymlinks:false,licensesMatchSource:true,sourceMatches:true,appAsarSha256,installed:false,physicalDevices:false,voiceOver:false},null,2));
