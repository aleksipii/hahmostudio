import {rename,rm,stat} from 'node:fs/promises';
import {join} from 'node:path';
/** Keep the previous successful pair available until both replacements succeed. */
export async function commitExport(output,manifest,destination,temp){
 const entries=[{source:output,target:destination,backup:join(temp,'old-video')},{source:manifest,target:destination+'.manifest.json',backup:join(temp,'old-manifest')}];
 try{
  for(const e of entries){try{if(!(await stat(e.target)).isFile())throw Error('Vientikohde ei ole tiedosto.');await rename(e.target,e.backup);e.saved=true;}catch(error){if(error.code!=='ENOENT')throw error;}}
  for(const e of entries){await rename(e.source,e.target);e.installed=true;}
 }catch(error){
  for(const e of entries.reverse()){if(e.installed)await rm(e.target,{force:true});if(e.saved)await rename(e.backup,e.target);}
  throw error;
 }
}
