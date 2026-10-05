/** Development-only conversion of original SVG layers into compatible editor packs. */
import {readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {writePsdBuffer,readPsd,initializeCanvas} from 'ag-psd';
import {validateRig,type Rig} from '../lib/cutout/model.ts';
import {saveProject,readProject} from '../lib/project-file.ts';
import type {PsdDocument,LayerNode} from '../lib/psd-model.ts';
import type {Animation} from '../lib/animation-model.ts';
import type {QuickProfile} from '../lib/quick-animation.ts';
const sharpPath=process.argv[2];if(!sharpPath)throw Error('Anna sharp-moduulin polku resurssien rakentamista varten.');
const sharp=(await import(pathToFileURL(sharpPath).href)).default;
initializeCanvas(()=>{throw Error('Canvas not used');},(width,height)=>({width,height,colorSpace:'srgb' as const,data:new Uint8ClampedArray(width*height*4)}));
for(const name of ['Mr.Kille','Mr.Handu'] as const){
 const rig=validateRig(JSON.parse(readFileSync('public/library/cutout/'+name+'.rig.json','utf8')) as Rig),art=JSON.parse(readFileSync('public/library/cutout/'+name+'.art.json','utf8'));
 const prefix='<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600" viewBox="0 0 400 600"><g stroke="#000" stroke-width="3" stroke-linejoin="round">';
 const rasters=new Map<string,{png:Buffer;rgba:Uint8ClampedArray}>();
 const layers:LayerNode[]=[],parts:Animation['rig']['parts']=[];
 for(const [i,l] of [...rig.layers].sort((a,b)=>a.z-b.z).entries()){
  const svg=prefix+art.layers[l.id]+'</g></svg>',png=await sharp(Buffer.from(svg)).png().toBuffer(),rgba=new Uint8ClampedArray(await sharp(png).ensureAlpha().raw().toBuffer());rasters.set(l.id,{png,rgba});
  layers.push({key:l.id,psdId:9000+i,name:l.id,path:l.id,kind:'layer',left:0,top:0,width:400,height:600,opacity:1,visible:true,blendMode:'normal',warnings:[],children:[],png:new Blob([new Uint8Array(png)],{type:'image/png'})});
  const role=l.id==='HEAD_GROUP'?'head':l.id==='TORSO'?'body':l.id.includes('ARM_')&&l.id.endsWith('UPPER')?'arm':l.id.includes('HAND_')?'hand':l.id.startsWith('LEG_')?'leg':l.id.startsWith('MOUTH_')?'mouth':l.id.startsWith('EYES_')||l.id.startsWith('PUPIL_')?'eye':'none';
  const pivotRect=l.pivotFrame??l.bounds;parts.push({key:l.id,psdId:9000+i,path:l.id,role,pivot:{x:pivotRect[0]+pivotRect[2]*l.pivot[0],y:pivotRect[1]+pivotRect[3]*l.pivot[1]},joints:[],...(l.parent?{parentKey:l.parent}:{})});
 }
 const neutral={frame:0,x:0,y:0,rotation:0,scale:1,opacity:1,easing:'hold' as const};
 const tracks=rig.layers.filter(l=>l.switch).map(l=>({key:l.id,frames:[{...neutral,opacity:l.default?1:0}]}));
 const animation:Animation={format:'hahmostudio-animation',version:1,fps:24,duration:2,rig:{format:'hahmostudio-rig',version:1,source:{name:name+'.psd',width:400,height:600},parts},tracks};
 // Anatomical left is on the viewer's right in the front view.
 const roles={root:'ROOT',body:'TORSO',head:'HEAD_GROUP',leftArm:'ARM_RIGHT_UPPER',rightArm:'ARM_LEFT_UPPER',leftHand:'HAND_RIGHT_DEFAULT',rightHand:'HAND_LEFT_DEFAULT',leftLeg:'LEG_RIGHT',rightLeg:'LEG_LEFT',leftPupil:'PUPIL_RIGHT',rightPupil:'PUPIL_LEFT',leftBrow:'BROW_RIGHT',rightBrow:'BROW_LEFT',leftBlink:'LID_RIGHT',rightBlink:'LID_LEFT',mouthNeutral:'MOUTH_REST',mouthOpen:'MOUTH_AI',mouthRound:'MOUTH_O',mouthE:'MOUTH_E',mouthU:'MOUTH_U',mouthMBP:'MOUTH_MBP',mouthFV:'MOUTH_FV',mouthConsonants:'MOUTH_CDGKNRSThYZ',mouthL:'MOUTH_L_WQ'};
 const quick:QuickProfile={switchDefaults:Object.fromEntries(rig.layers.filter(l=>l.switch).map(l=>[l.id,l.default?1:0])),version:1,asset:name==='Mr.Kille'?'kilsat-mr-kille-cutout-v1':'kilsat-mr-handu-cutout-v1',roles,bindings:{left:'KeyA',right:'KeyD',jump:'KeyW',neutral:'Digit1',happy:'Digit2',surprise:'Digit3',blink:'KeyB',record:'KeyR',play:'Space'},strength:1,speed:1,gate:.015,sensitivity:10,smoothing:.6,idle:true};
 const visible=rig.layers.filter(l=>!l.switch||l.default).filter(l=>art.layers[l.id]);
 const composite=await sharp(Buffer.from(prefix+visible.sort((a,b)=>a.z-b.z).map(l=>art.layers[l.id]).join('')+'</g></svg>')).png().toBuffer();
 const node=(id:string):any=>{const l=rig.layers.find(l=>l.id===id)!,r=rasters.get(id)!,children=rig.layers.filter(c=>c.parent===id).sort((a,b)=>a.z-b.z).map(c=>node(c.id));return {name:id,blendMode:'pass through',children:[{name:id+' · grafiikka',id:parts.find(p=>p.key===id)!.psdId,left:0,top:0,right:400,bottom:600,hidden:!!l.switch&&!l.default,imageData:{width:400,height:600,data:r.rgba}},...children]};};
 const psd=writePsdBuffer({width:400,height:600,imageData:{width:400,height:600,data:new Uint8ClampedArray(await sharp(composite).ensureAlpha().raw().toBuffer())},children:[node('ROOT')]},{generateThumbnail:false});
 readPsd(psd,{skipLayerImageData:true,skipCompositeImageData:true,skipThumbnail:true});
 const doc:PsdDocument={name:name+'.psd',width:400,height:600,size:psd.length,layers,quick,sourcePsd:new Blob([new Uint8Array(psd)]),composite:new Blob([new Uint8Array(composite)],{type:'image/png'}),warnings:[]};
 const packed=await saveProject(doc,animation,undefined,{width:1080,height:1920,background:'#e8e3d9',design:'cutout-studio-v1',x:540,y:1140,scale:1.7,guides:true});
 const reopened=await readProject(packed);if(reopened.animation.rig.parts.length!==rig.layers.length)throw Error('Hahmopaketin kerrosmäärä muuttui.');
 writeFileSync('public/library/'+name+'.hahmo',new Uint8Array(await packed.arrayBuffer()));writeFileSync('public/library/'+name+'.psd',psd);writeFileSync('public/library/'+name+'.png',composite);
 console.log(name,rig.layers.length,'layers; PSD + hahmo roundtrip',packed.size);
}
