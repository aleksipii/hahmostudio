// Same source/notice comparisons as scripts/verify-mac-bundle.mjs, minus codesign and Kokoro runtime (Mac-only).
import {createRequire} from 'node:module';import {readFile} from 'node:fs/promises';import {join} from 'node:path';import assert from 'node:assert/strict';
const req=createRequire(process.cwd()+'/package.json');const asar=req('@electron/asar');const archive=join(process.argv[2],'Contents/Resources/app.asar');
const list=asar.listPackage(archive);
for(const p of ['licenses/kokoro/THIRD_PARTY.txt','THIRD_PARTY_NOTICES.md','desktop/main.mjs','desktop/kokoro-worker.mjs','desktop/workflow-diagnostic.mjs','desktop/block-diagnostic.mjs','desktop/kokoro-export-diagnostic.mjs','dist-desktop/index.html','desktop/runtime-smoke.mjs'])
 assert.deepEqual(asar.extractFile(archive,p),await readFile(p),`differs/missing: ${p}`);
const tests=list.filter(p=>/\.test\.(mjs|ts)$/.test(p)||p.includes('test-fixtures'));const mods=list.filter(p=>p.includes('node_modules'));
const plist=await readFile(join(process.argv[2],'Contents/Info.plist'),'utf8');
console.log(JSON.stringify({entries:list.length,testsBundled:tests,nodeModules:mods.length,devDocs:list.filter(p=>/^.DEVELOPMENT-/.test(p)).length,version:plist.match(/CFBundleShortVersionString<\/key>\s*<string>([^<]+)/)[1]},null,1));
