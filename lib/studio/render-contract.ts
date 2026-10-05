import {STUDIO_APP_VERSION} from './app-version.ts';
import {unzipSync,strFromU8} from 'fflate';
import {saveProject,readProject,type ProjectAudio} from '../project-file.ts';
import type {PsdDocument} from '../psd-model.ts';
import type {Animation} from '../animation-model.ts';
import type {Scene} from '../scene-model.ts';
import {readExportPreset,type ExportPreset} from '../export-presets.ts';
import {compilePresentation} from '../presentation-compile.ts';
import {adaptPresentation} from './domain.ts';
import {canonicalJson,sha256} from './hash.ts';

export type RenderManifest={schemaVersion:1;appVersion:string;engineVersion:'studio-contract-1';snapshotHash:string;revisionId:string;preset:ExportPreset;expectedFrames:number;assets:{path:string;sha256:string}[];episodeIds:string[]};
async function archiveAssets(bytes:Uint8Array,prefix='',depth=0):Promise<{path:string;sha256:string}[]>{
 if(depth>1)throw Error('Sisäkkäinen tuotantoarkisto on liian syvä.');
 const files=unzipSync(bytes),result:{path:string;sha256:string}[]=[];
 for(const path of Object.keys(files).sort()){
  if(path==='resource-manifest.json')continue; // Archive byte checks are separate from semantic render identity.
  if(path.startsWith('cast/')&&path.endsWith('.hahmo'))result.push(...await archiveAssets(files[path],prefix+path+'/',depth+1));
  else{const data=path==='project.json'?new TextEncoder().encode(canonicalJson(JSON.parse(strFromU8(files[path])))):files[path];result.push({path:prefix+path,sha256:await sha256(data)});}
 }
 return result;
}
export async function inspectRenderSnapshot(bytes:Uint8Array,preset:ExportPreset):Promise<RenderManifest>{
 const profile=readExportPreset(preset),p=await readProject(new Blob([new Uint8Array(bytes)]));
 if(profile.end>p.animation.duration/p.animation.fps+.5/profile.fps)throw Error('Vientialue ylittää projektin keston.');
 const episodes=[];
 for(const source of p.scene.presentations??[]){
  const timed=compilePresentation(source,p.doc.presentationAssets??{},p.animation.fps);
  const error=timed.diagnostics.find(d=>d.severity==='error'&&(profile.audio||d.code!=='missing-audio'));if(error)throw Error('Viennin esitarkistus: '+error.message);
  const episode=adaptPresentation(timed);if(episode.shots.some(s=>s.duration<=0))throw Error('Viennin esitarkistus: kuvan kesto on nolla.');
  if(profile.audio&&timed.audioClips.length&&!p.audio)throw Error('Jakson miksattu ääni puuttuu. Rakenna jakso uudelleen ennen vientiä.');
  episodes.push(episode.id);
 }
 const assets=await archiveAssets(bytes),revisionId=await sha256(new TextEncoder().encode(canonicalJson({assets,preset:profile,engine:'studio-contract-1',appVersion:STUDIO_APP_VERSION})));
 return{schemaVersion:1,appVersion:STUDIO_APP_VERSION,engineVersion:'studio-contract-1',snapshotHash:await sha256(bytes),revisionId,preset:profile,expectedFrames:Math.ceil((profile.end-profile.start)*profile.fps),assets,episodeIds:episodes};
}
export async function freezeRender(doc:PsdDocument,animation:Animation,audio:ProjectAudio|undefined,scene:Scene,preset:ExportPreset){
 const bytes=new Uint8Array(await(await saveProject(doc,animation,audio,scene)).arrayBuffer());
 return{bytes,manifest:await inspectRenderSnapshot(bytes,preset)};
}
