/** Refresh bundled public/library/*.hahmo provenance (v2) and resource-manifest via saveProject roundtrip. */
import {readdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {readProject,saveProject} from '../lib/project-file.ts';

const dir=new URL('../public/library/',import.meta.url).pathname;

for(const name of readdirSync(dir).filter(f=>f.endsWith('.hahmo'))){
 const path=join(dir,name);
 try{
  const loaded=await readProject(new Blob([readFileSync(path)]));
  const pack=await saveProject(loaded.doc,loaded.animation,undefined,loaded.scene);
  writeFileSync(path,new Uint8Array(await pack.arrayBuffer()));
  console.log('ok',name);
 }catch(error){
  console.error('fail',name,error instanceof Error?error.message:String(error));
  process.exitCode=1;
 }
}
