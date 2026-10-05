import {incrementalZip} from './studio/incremental-zip.ts';
import {semanticDelta,applySemanticDelta} from './studio/semantic-delta.ts';
import {canonicalJson,sha256} from './studio/hash.ts';
import {addResourceManifest,verifyResourceManifest} from './studio/resource-manifest.ts';
import {readAudioAnalysis,type AudioAnalysis} from './audio-analysis.ts';
import {readLayerEdit} from './layer-edit.ts';
import {zipSync,unzipSync,strToU8,strFromU8} from 'fflate';
import {flatten,type PsdDocument,type LayerNode} from './psd-model.ts';
import {readAnimation,validateAnimation,type Animation} from './animation-model.ts';
import {readScene,type Scene} from './scene-model.ts';
import {characterProvenance} from './character-provenance.ts';
import {readQuick} from './quick-animation.ts';
const limit=128*1024*1024;
// Blobs are immutable. Reuse unchanged resource bytes across command snapshots.
const resourceBytes=new WeakMap<Blob,Promise<Uint8Array>>();
export function serializedResource(blob:Blob):Promise<Uint8Array>{let bytes=resourceBytes.get(blob);if(!bytes){bytes=blob.arrayBuffer().then(b=>new Uint8Array(b));resourceBytes.set(blob,bytes);}return bytes;}

const castArchives=new WeakMap<PsdDocument,WeakMap<Animation,Promise<Blob>>>();
async function serializedCast(doc:PsdDocument,animation:Animation){let byAnimation=castArchives.get(doc);if(!byAnimation){byAnimation=new WeakMap();castArchives.set(doc,byAnimation);}let archive=byAnimation.get(animation);if(!archive){archive=saveProject(doc,animation);byAnimation.set(animation,archive);archive.catch(()=>byAnimation!.delete(animation));}return archive;}
const layerMetadata=new WeakMap<LayerNode,{image?:string;children:unknown[];value:unknown;fields:unknown[]}>();
function metadataLayers(nodes:LayerNode[],refs:Map<LayerNode,string>):unknown[]{return nodes.map(n=>{const image=refs.get(n),children=metadataLayers(n.children,refs),known=layerMetadata.get(n),fields=[n.key,n.psdId,n.name,n.path,n.kind,n.left,n.top,n.width,n.height,n.opacity,n.visible,n.locked,n.edit,n.blendMode,n.warnings];if(known&&known.fields.every((v,i)=>v===fields[i])&&known.image===image&&known.children.length===children.length&&known.children.every((c,i)=>c===children[i]))return known.value;const value={key:n.key,psdId:n.psdId,name:n.name,path:n.path,kind:n.kind,left:n.left,top:n.top,width:n.width,height:n.height,opacity:n.opacity,visible:n.visible,locked:n.locked,edit:readLayerEdit(n.edit),blendMode:n.blendMode,warnings:n.warnings,image,children};layerMetadata.set(n,{image,children,value,fields});return value;});}
const sceneValidation=new WeakMap<Scene,WeakMap<PsdDocument,Scene>>();
export function validatedProjectScene(scene:Scene,doc:PsdDocument):Scene{let docs=sceneValidation.get(scene);if(!docs){docs=new WeakMap();sceneValidation.set(scene,docs);}let value=docs.get(doc);if(!value){value=readScene(scene,doc);docs.set(doc,value);let normalized=sceneValidation.get(value);if(!normalized){normalized=new WeakMap();sceneValidation.set(value,normalized);}normalized.set(doc,value);}return value;}
export type ProjectAudio={name:string;blob:Blob;analysis?:AudioAnalysis};
export async function prepareProject(doc:PsdDocument,animation:Animation,audio?:ProjectAudio,scene?:Scene){
 const quick=readQuick(doc.quick,animation.rig);

 const files:Record<string,Uint8Array>={},refs=new Map<LayerNode,string>();let bytes=0;
 for(const [i,n] of flatten(doc.layers).entries())if(n.png){const path=`images/${i}.png`;refs.set(n,path);files[path]=await serializedResource(n.png);bytes+=files[path].length;if(bytes>limit)throw new Error('Projektin kuvat ovat yli 128 Mt.');}
 if(doc.composite){files['images/original.png']=await serializedResource(doc.composite);bytes+=files['images/original.png'].length;}
 if(quick){
  const provenance=characterProvenance(quick,doc);
  const guide=provenance.origin==='user-import'
   ? 'Oma hahmopaketti: älä oleta lisenssiä provenance.json-tiedoston perusteella. Esitys ohjaa hahmoa; Käsikirjoitus luo muokattavia liikkeitä.'
   : 'Valmis hahmo: A/D kädet ylös, W hyppy, 1/2/3 ilmeet, B räpäytys, R otto. Suu perustuu paikalliseen äänenvoimakkuuteen. Esitys ohjaa hahmoa; Käsikirjoitus luo muokattavia liikkeitä. Otto ja käsikirjoitus lisätään aikajanan loppuun. Alkuperäinen Hahmostudio-grafiikka, CC0-1.0, 2026. Ei ulkoisia hahmoaineistoja.';
  files['KAYTTOOHJE.txt']=strToU8(guide);
  files['provenance.json']=strToU8(JSON.stringify(provenance));
 }
 if(doc.sourcePsd){files['source/character.psd']=await serializedResource(doc.sourcePsd);bytes+=files['source/character.psd'].length;}

 if(audio){if(audio.blob.size>116*1024*1024)throw new Error('Jakson miksattu äänitiedosto on yli 116 Mt.');files['audio/sound']=await serializedResource(audio.blob);bytes+=files['audio/sound'].length;}
 const stored=[...(scene?.presentations??[]),...(scene?.presentationDraft?[scene.presentationDraft]:[])],usedCast=new Set(stored.flatMap(p=>p.bindings.map(b=>b.asset))),usedVoice=new Set(stored.flatMap(p=>p.audioClips.map(a=>a.asset)));const presentationResources:Record<string,string>={};for(const [id,a] of Object.entries(doc.presentationAssets??{})){if(!usedCast.has(id))continue;if(a.doc.presentationAssets||a.doc.presentationAudio)throw Error('Sisäkkäisiä kohtausaineistoja ei tueta.');const blob=await serializedCast(a.doc,a.animation);const path='cast/'+id+'.hahmo';files[path]=await serializedResource(blob);bytes+=blob.size;presentationResources[id]=path;}
 const presentationAudio:Record<string,{path:string;name:string;type:string}>={};for(const [id,a] of Object.entries(doc.presentationAudio??{})){if(!usedVoice.has(id))continue;if(a.blob.size>25*1024*1024)throw Error('Repliikkiääni on liian suuri.');const path='voices/'+id;files[path]=await serializedResource(a.blob);bytes+=a.blob.size;presentationAudio[id]={path,name:a.name,type:a.blob.type};}
 const metadata={format:'hahmostudio-project',version:stored.some(p=>p.production)?5:audio?.analysis||flatten(doc.layers).some(n=>n.edit||n.locked)?4:usedCast.size?3:quick||doc.sourcePsd?2:1,presentationResources,presentationAudio,scene:scene?validatedProjectScene(scene,doc):undefined,document:{quick,sourcePsd:doc.sourcePsd?'source/character.psd':undefined,name:doc.name,width:doc.width,height:doc.height,size:doc.size,warnings:doc.warnings,layers:metadataLayers(doc.layers,refs),composite:doc.composite?'images/original.png':undefined},animation,audio:audio?{name:audio.name,type:audio.blob.type,path:'audio/sound',analysis:readAudioAnalysis(audio.analysis)}:undefined};
 if(bytes>limit)throw new Error('Projekti on yli 128 Mt.');return {files,metadata};
}
export async function saveProject(doc:PsdDocument,animation:Animation,audio?:ProjectAudio,scene?:Scene,base?:Blob):Promise<Blob>{
 const prepared=await prepareProject(doc,animation,audio,scene),files=prepared.files;files['project.json']=strToU8(JSON.stringify(prepared.metadata));let bytes=Object.values(files).reduce((n,b)=>n+b.length,0);
 if(base){const previous=unzipSync(new Uint8Array(await base.arrayBuffer()),{filter:e=>e.name==='project.json'});if(!previous['project.json'])throw Error('Komentodeltan lähtöprojekti puuttuu.');const a=JSON.parse(strFromU8(previous['project.json'])),b=JSON.parse(strFromU8(files['project.json'])),delta=semanticDelta(a,b);if(canonicalJson(applySemanticDelta(a,delta))!==canonicalJson(b))throw Error('Komentodeltan tulos ei täsmää.');files['command-delta.json']=strToU8(JSON.stringify({version:1,base:await sha256(previous['project.json']),result:await sha256(files['project.json']),delta}));bytes+=files['command-delta.json'].length;}
 bytes+=await addResourceManifest(files);if(bytes>limit)throw new Error('Projekti on yli 128 Mt.');
 return incrementalZip(files);
}
export async function readProject(file:Blob,nested=false):Promise<{doc:PsdDocument;animation:Animation;audio?:ProjectAudio;scene:Scene}>{
 if(file.size>limit)throw new Error('Projekti on yli 128 Mt.');let total=0,count=0;
 const files=unzipSync(new Uint8Array(await file.arrayBuffer()),{filter:entry=>{total+=entry.originalSize;count++;if(total>limit||count>10000||entry.originalSize>limit)throw new Error('Projektin purettu koko on liian suuri.');return true;}});
 if(!files['project.json']||files['project.json'].length>10*1024*1024)throw new Error('Projektin tiedot puuttuvat tai ovat liian suuret.');
 await verifyResourceManifest(files);
 const data=JSON.parse(strFromU8(files['project.json']));if(data?.format!=='hahmostudio-project'||![1,2,3,4,5].includes(data.version))throw new Error('Tuntematon projektimuoto.');
 const d=data.document;if(!d||!Number.isInteger(d.width)||!Number.isInteger(d.height)||d.width<1||d.height<1||d.width*d.height>16000000||typeof d.name!=='string'||d.name.length>256)throw new Error('Projektin kuvatiedot ovat virheelliset.');
 const strings=(v:unknown):string[]=>{if(!Array.isArray(v)||v.length>1000||v.some(x=>typeof x!=='string'||x.length>2000))throw new Error('Projektin tekstit ovat virheelliset.');return v;};
 let pixels=0,nodes=0;const keys=new Set<string>();
 const png=(path:unknown,w:number,h:number)=>{if(typeof path!=='string'||!files[path])throw new Error('Projektin tasokuva puuttuu.');const b=files[path];if(b.length<24||[137,80,78,71,13,10,26,10].some((v,i)=>b[i]!==v)||String.fromCharCode(...b.slice(12,16))!=='IHDR')throw new Error('Projektin kuva ei ole PNG.');const view=new DataView(b.buffer,b.byteOffset,b.byteLength);if(view.getUint32(16)!==w||view.getUint32(20)!==h)throw new Error('Projektin tasokuvan koko ei täsmää.');pixels+=w*h;if(pixels>48000000)throw new Error('Projektin tasokuvia on liikaa.');return new Blob([new Uint8Array(b)],{type:'image/png'});};
 const layers=(items:unknown,depth=0):LayerNode[]=>{if(!Array.isArray(items)||depth>64)throw new Error('Projektin tasorakenne on virheellinen.');return items.map(n=>{if(++nodes>1000||!n||typeof n.key!=='string'||n.key.length>2000||keys.has(n.key)||!['group','layer'].includes(n.kind)||!['name','path','blendMode'].every(k=>typeof n[k]==='string'&&n[k].length<2000)||!['left','top','width','height','opacity'].every(k=>typeof n[k]==='number'&&Number.isFinite(n[k]))||Math.abs(n.left)>100000||Math.abs(n.top)>100000||!Number.isInteger(n.width)||!Number.isInteger(n.height)||n.width<0||n.height<0||n.width*n.height>16000000||n.opacity<0||n.opacity>1||typeof n.visible!=='boolean'||(n.locked!==undefined&&typeof n.locked!=='boolean')||(n.psdId!==undefined&&!Number.isInteger(n.psdId)))throw new Error('Projektin tason tiedot ovat virheelliset.');keys.add(n.key);return {key:n.key,psdId:n.psdId,name:n.name,path:n.path,kind:n.kind,left:n.left,top:n.top,width:n.width,height:n.height,opacity:n.opacity,visible:n.visible,blendMode:n.blendMode,...(n.locked!==undefined?{locked:n.locked===true}:{}),...(n.edit!==undefined?{edit:readLayerEdit(n.edit)}:{}),warnings:strings(n.warnings),children:layers(n.children,depth+1),png:n.image?png(n.image,n.width,n.height):undefined};});};
 const doc:PsdDocument={name:d.name,width:d.width,height:d.height,size:0,warnings:strings(d.warnings),layers:layers(d.layers)};if(d.composite)doc.composite=png(d.composite,d.width,d.height);
 const animation=validateAnimation(data.animation,doc);doc.quick=readQuick(d.quick,animation.rig);if(d.sourcePsd){const b=files['source/character.psd'];if(d.sourcePsd!=='source/character.psd'||!b||b.length<26||b.length>16*1024*1024||String.fromCharCode(...b.slice(0,4))!=='8BPS')throw new Error('Alkuperäinen PSD on virheellinen.');doc.sourcePsd=new Blob([new Uint8Array(b)],{type:'image/vnd.adobe.photoshop'});}let audio:ProjectAudio|undefined;if(data.audio){const a=data.audio;if(typeof a.name!=='string'||a.name.length>256||!['audio/mpeg','audio/wav','audio/x-wav','audio/ogg','audio/mp4'].includes(a.type)||a.path!=='audio/sound'||!files[a.path]||files[a.path].length>116*1024*1024)throw new Error('Projektin äänitiedosto on virheellinen.');audio={name:a.name,...(a.analysis?{analysis:readAudioAnalysis(a.analysis)}:{}),blob:new Blob([new Uint8Array(files[a.path])],{type:a.type})};}const scene=readScene(data.scene,doc);
 if(nested&&(Object.keys(data.presentationResources??{}).length||Object.keys(data.presentationAudio??{}).length||(scene.presentations?.length||scene.presentationDraft)))throw Error('Sisäkkäinen kohtausaineisto on estetty.');
 const resources=data.presentationResources??{},voices=data.presentationAudio??{};
 if(typeof resources!=='object'||Array.isArray(resources)||Object.keys(resources).length>8||typeof voices!=='object'||Array.isArray(voices)||Object.keys(voices).length>1000)throw Error('Kohtauksen aineistot ovat virheelliset.');
 if(Object.keys(resources).length){doc.presentationAssets={};for(const [id,path] of Object.entries(resources)){if(['__proto__','prototype','constructor'].includes(id)||!/^[-a-zA-Z0-9_.]{1,100}$/.test(id)||path!=='cast/'+id+'.hahmo'||!files[path as string]||files[path as string].length>25*1024*1024)throw Error('Hahmon kohtausaineisto puuttuu.');const asset=await readProject(new Blob([new Uint8Array(files[path as string])]),true);doc.presentationAssets[id]={doc:asset.doc,animation:asset.animation};}}
 if(Object.keys(voices).length){doc.presentationAudio={};for(const [id,a] of Object.entries(voices) as [string,any][]){if(['__proto__','prototype','constructor'].includes(id)||!/^[-a-zA-Z0-9_.]{1,100}$/.test(id)||a.path!=='voices/'+id||!files[a.path]||files[a.path].length>25*1024*1024||typeof a.name!=='string'||!['audio/wav','audio/x-wav','audio/mpeg','audio/mp4','audio/ogg'].includes(a.type))throw Error('Kohtauksen alkuperäinen repliikkiääni puuttuu.');doc.presentationAudio[id]={name:a.name,blob:new Blob([new Uint8Array(files[a.path])],{type:a.type})};}}
 if(Object.values(doc.presentationAssets??{}).reduce((sum,a)=>sum+flatten(a.doc.layers).reduce((n,l)=>n+l.width*l.height,0),pixels)>48000000)throw Error('Kohtauksen kaikkien hahmojen tasokuvia on liikaa.');
 for(const p of [...(scene.presentations??[]),...(scene.presentationDraft?[scene.presentationDraft]:[])]){for(const b of p.bindings){const asset=doc.presentationAssets?.[b.asset];if(!asset){if(p===scene.presentationDraft)continue;throw Error('Kohtauksen hahmo puuttuu projektista.');}if(p.actorAnimations?.[b.speaker])p.actorAnimations[b.speaker]=readAnimation(JSON.stringify(p.actorAnimations[b.speaker]),asset.doc);}for(const c of p.audioClips)if(!doc.presentationAudio?.[c.asset]&&p!==scene.presentationDraft)throw Error('Kohtauksen ääni puuttuu projektista.');if(p!==scene.presentationDraft&&p.startFrame!==undefined&&p.startFrame+Math.ceil(p.seconds*animation.fps)>animation.duration)throw Error('Kohtauksen kesto ylittää projektin aikajanan.');}
 return {doc,animation,audio,scene};
}
