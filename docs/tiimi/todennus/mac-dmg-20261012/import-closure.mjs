// Import closure of packaged entry points via TypeScript's preProcessFile (static + dynamic imports, require()).
import {createRequire,builtinModules} from 'node:module';import {readFileSync,existsSync} from 'node:fs';import {resolve,dirname,relative} from 'node:path';
const root=resolve(process.argv[2]);const ts=createRequire(root+'/package.json')('typescript');
const staged=r=>(/^(desktop|server|dist-desktop|licenses|lib\/cloud-render|cloud\/runtime)\//.test(r)&&!/\.test\.(ts|mjs)$/.test(r)&&!r.includes('test-fixtures'))||r==='lib/studio/hash.ts';
const queue=['desktop/main.mjs','desktop/kokoro-worker.mjs','desktop/runtime-smoke.mjs','desktop/cloud-service.mjs','desktop/preload.cjs','desktop/export-worker-preload.cjs'].map(f=>resolve(root,f)).filter(existsSync);
const seen=new Set,problems=[],bare=new Set;
while(queue.length){const f=queue.pop();if(seen.has(f))continue;seen.add(f);
 const info=ts.preProcessFile(readFileSync(f,'utf8'),true,true);
 for(const {fileName:s} of info.importedFiles){
  if(s.startsWith('.')){const t=resolve(dirname(f),s);if(!existsSync(t)){problems.push(`${relative(root,f)} -> ${s}: puuttuu`);continue;}
   if(!staged(relative(root,t)))problems.push(`${relative(root,f)} -> ${relative(root,t)}: ei paketoida`);else if(/\.(m?js|cjs|ts)$/.test(t))queue.push(t);}
  else{const b=s.replace(/^node:/,'').split('/')[0];if(!(s.startsWith('node:')||builtinModules.includes(b)||b==='electron'))bare.add(`${relative(root,f)} -> ${s}`);}}}
console.log(JSON.stringify({files:seen.size,problems,bareImports:[...bare]},null,1));
