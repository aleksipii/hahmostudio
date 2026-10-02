import {zipSync,unzipSync,strToU8,strFromU8} from 'fflate';
import {flatten,type PsdDocument,type LayerNode} from './psd-model.ts';
import {readAnimation,type Animation} from './animation-model.ts';
import {readScene,type Scene} from './scene-model.ts';
const limit=128*1024*1024;
export type ProjectAudio={name:string;blob:Blob};
export async function saveProject(doc:PsdDocument,animation:Animation,audio?:ProjectAudio,scene?:Scene):Promise<Blob>{
 const clone=(nodes:LayerNode[]):LayerNode[]=>nodes.map(n=>({...n,children:clone(n.children)}));doc={...doc,layers:clone(doc.layers)};animation=structuredClone(animation);
 const files:Record<string,Uint8Array>={},refs=new Map<LayerNode,string>();let bytes=0;
 for(const [i,n] of flatten(doc.layers).entries())if(n.png){const path=`images/${i}.png`;refs.set(n,path);files[path]=new Uint8Array(await n.png.arrayBuffer());bytes+=files[path].length;if(bytes>limit)throw new Error('Projektin kuvat ovat yli 128 Mt.');}
 if(doc.composite){files['images/original.png']=new Uint8Array(await doc.composite.arrayBuffer());bytes+=files['images/original.png'].length;}
 const layers=(nodes:LayerNode[]):unknown[]=>nodes.map(n=>({key:n.key,psdId:n.psdId,name:n.name,path:n.path,kind:n.kind,left:n.left,top:n.top,width:n.width,height:n.height,opacity:n.opacity,visible:n.visible,blendMode:n.blendMode,warnings:n.warnings,image:refs.get(n),children:layers(n.children)}));
 if(audio){if(audio.blob.size>25*1024*1024)throw new Error('Äänitiedosto on yli 25 Mt.');files['audio/sound']=new Uint8Array(await audio.blob.arrayBuffer());bytes+=files['audio/sound'].length;}
 files['project.json']=strToU8(JSON.stringify({format:'hahmostudio-project',version:1,scene:scene?readScene(scene,doc):undefined,document:{name:doc.name,width:doc.width,height:doc.height,size:doc.size,warnings:doc.warnings,layers:layers(doc.layers),composite:doc.composite?'images/original.png':undefined},animation,audio:audio?{name:audio.name,type:audio.blob.type,path:'audio/sound'}:undefined}));
 bytes+=files['project.json'].length;if(bytes>limit)throw new Error('Projekti on yli 128 Mt.');
 return new Blob([new Uint8Array(zipSync(files,{level:0}))],{type:'application/octet-stream'});
}
export async function readProject(file:Blob):Promise<{doc:PsdDocument;animation:Animation;audio?:ProjectAudio;scene:Scene}>{
 if(file.size>limit)throw new Error('Projekti on yli 128 Mt.');let total=0,count=0;
 const files=unzipSync(new Uint8Array(await file.arrayBuffer()),{filter:entry=>{total+=entry.originalSize;count++;if(total>limit||count>1005||entry.originalSize>limit)throw new Error('Projektin purettu koko on liian suuri.');return true;}});
 if(!files['project.json']||files['project.json'].length>10*1024*1024)throw new Error('Projektin tiedot puuttuvat tai ovat liian suuret.');
 const data=JSON.parse(strFromU8(files['project.json']));if(data?.format!=='hahmostudio-project'||data.version!==1)throw new Error('Tuntematon projektimuoto.');
 const d=data.document;if(!d||!Number.isInteger(d.width)||!Number.isInteger(d.height)||d.width<1||d.height<1||d.width*d.height>16000000||typeof d.name!=='string'||d.name.length>256)throw new Error('Projektin kuvatiedot ovat virheelliset.');
 const strings=(v:unknown):string[]=>{if(!Array.isArray(v)||v.length>1000||v.some(x=>typeof x!=='string'||x.length>2000))throw new Error('Projektin tekstit ovat virheelliset.');return v;};
 let pixels=0,nodes=0;const keys=new Set<string>();
 const png=(path:unknown,w:number,h:number)=>{if(typeof path!=='string'||!files[path])throw new Error('Projektin tasokuva puuttuu.');const b=files[path];if(b.length<24||[137,80,78,71,13,10,26,10].some((v,i)=>b[i]!==v)||String.fromCharCode(...b.slice(12,16))!=='IHDR')throw new Error('Projektin kuva ei ole PNG.');const view=new DataView(b.buffer,b.byteOffset,b.byteLength);if(view.getUint32(16)!==w||view.getUint32(20)!==h)throw new Error('Projektin tasokuvan koko ei täsmää.');pixels+=w*h;if(pixels>48000000)throw new Error('Projektin tasokuvia on liikaa.');return new Blob([new Uint8Array(b)],{type:'image/png'});};
 const layers=(items:unknown,depth=0):LayerNode[]=>{if(!Array.isArray(items)||depth>64)throw new Error('Projektin tasorakenne on virheellinen.');return items.map(n=>{if(++nodes>1000||!n||typeof n.key!=='string'||n.key.length>2000||keys.has(n.key)||!['group','layer'].includes(n.kind)||!['name','path','blendMode'].every(k=>typeof n[k]==='string'&&n[k].length<2000)||!['left','top','width','height','opacity'].every(k=>typeof n[k]==='number'&&Number.isFinite(n[k]))||Math.abs(n.left)>100000||Math.abs(n.top)>100000||!Number.isInteger(n.width)||!Number.isInteger(n.height)||n.width<0||n.height<0||n.width*n.height>16000000||n.opacity<0||n.opacity>1||typeof n.visible!=='boolean'||(n.psdId!==undefined&&!Number.isInteger(n.psdId)))throw new Error('Projektin tason tiedot ovat virheelliset.');keys.add(n.key);return {key:n.key,psdId:n.psdId,name:n.name,path:n.path,kind:n.kind,left:n.left,top:n.top,width:n.width,height:n.height,opacity:n.opacity,visible:n.visible,blendMode:n.blendMode,warnings:strings(n.warnings),children:layers(n.children,depth+1),png:n.image?png(n.image,n.width,n.height):undefined};});};
 const doc:PsdDocument={name:d.name,width:d.width,height:d.height,size:0,warnings:strings(d.warnings),layers:layers(d.layers)};if(d.composite)doc.composite=png(d.composite,d.width,d.height);
 const animation=readAnimation(JSON.stringify(data.animation),doc);let audio:ProjectAudio|undefined;if(data.audio){const a=data.audio;if(typeof a.name!=='string'||a.name.length>256||!['audio/mpeg','audio/wav','audio/x-wav','audio/ogg','audio/mp4'].includes(a.type)||a.path!=='audio/sound'||!files[a.path]||files[a.path].length>25*1024*1024)throw new Error('Projektin äänitiedosto on virheellinen.');audio={name:a.name,blob:new Blob([new Uint8Array(files[a.path])],{type:a.type})};}return {doc,animation,audio,scene:readScene(data.scene,doc)};
}
