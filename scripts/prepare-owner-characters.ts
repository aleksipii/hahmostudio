/** Explicit adapter for the two owner-provided PSDs. Originals are never modified. */
import {readFileSync,writeFileSync} from 'node:fs';
import {readPsd,initializeCanvas,writePsdBuffer,type Layer} from 'ag-psd';
import {pathToFileURL} from 'node:url';
import {saveProject,readProject} from '../lib/project-file.ts';
import {defaultBindings,type QuickProfile} from '../lib/quick-animation.ts';
import {neutral,type Animation} from '../lib/animation-model.ts';
import type {LayerNode,PsdDocument} from '../lib/psd-model.ts';
const sharp=(await import(pathToFileURL(process.argv[2]).href)).default;
initializeCanvas(()=>{throw Error('No canvas');},(width,height)=>({width,height,colorSpace:'srgb' as const,data:new Uint8ClampedArray(width*height*4)}));
for(const [name,file,isKille] of [['Kille-Oma','Mr.Kille.psd',true],['Handu-Oma','mrhandu.psd',false]] as const){
 const bytes=readFileSync(process.argv[isKille?3:4]??'/Users/Aleksi/Desktop/Photoshop/'+file),psd=readPsd(bytes,{useImageData:true,skipThumbnail:true});
 const w=psd.width,h=psd.height,top=psd.children!.find(l=>l.name===(isKille?'+Character':'Standing'))!;
 if(!top)throw Error('PSD:n odotettu etunäkymä puuttuu.');
 const children=top.children!,head=children.find(l=>l.name==='Head')!,body=children.find(l=>l.name==='Body')!;
 head.hidden=false;body.hidden=false;
 const nodes:LayerNode[]=[],parts:Animation['rig']['parts']=[],roles:Record<string,string>={},defaults:Record<string,0|1>={};let id=0;
 const add=async(key:string,title:string,png:Buffer,x:number,y:number,width:number,height:number,parent?:string,pivot={x:x+width/2,y:y+height/2},role:Animation['rig']['parts'][number]['role']='none')=>{
  const psdId=60000+id++;nodes.push({key,psdId,name:title,path:title,kind:'layer',left:x,top:y,width,height,opacity:1,visible:true,blendMode:'normal',warnings:[],children:[],png:new Blob([new Uint8Array(png)],{type:'image/png'})});parts.push({key,psdId,path:title,role,pivot,joints:[],...(parent?{parentKey:parent}:{})});return key;
 };
 const transparent=await sharp({create:{width:1,height:1,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).png().toBuffer();
 const anchor=async(role:string,x:number,y:number,parent?:string)=>{roles[role]=await add(role,role,transparent,Math.floor(x),Math.floor(y),1,1,parent,{x,y});};
 await anchor('root',w/2,h/2);await anchor('body',w/2,isKille?1100:1220,'root');await anchor('head',w/2,isKille?925:1020,'body');
 const headParent='head';let serial=0;
 const raster=async(l:Layer,parent:string)=>{if(l.children){for(const c of l.children)await raster(c,parent);return;}if(!l.imageData)return;const d=l.imageData,png=await sharp(Buffer.from(d.data),{raw:{width:d.width,height:d.height,channels:4}}).png().toBuffer();const key='psd-'+serial++;await add(key,l.name??key,png,l.left??0,l.top??0,d.width,d.height,parent);return key;};
 // Mouth switch group: merge each original shape, preserving actual artwork and exact offsets.
 const talk=head.children!.find(l=>l.name==='Talking')!,mouth=talk.children!.find(l=>l.name==='+Mouth')!;
 const drawGroup=async(l:Layer)=>{const leaves:Layer[]=[];const collect=(v:Layer)=>v.children?v.children.forEach(collect):v.imageData&&leaves.push(v);collect(l);const left=Math.min(...leaves.map(v=>v.left!)),top=Math.min(...leaves.map(v=>v.top!)),right=Math.max(...leaves.map(v=>v.right!)),bottom=Math.max(...leaves.map(v=>v.bottom!));const overlays=[];for(const v of leaves){const d=v.imageData!;overlays.push({input:await sharp(Buffer.from(d.data),{raw:{width:d.width,height:d.height,channels:4}}).png().toBuffer(),left:v.left!-left,top:v.top!-top});}return {png:await sharp({create:{width:right-left,height:bottom-top,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(overlays).png().toBuffer(),left,top,width:right-left,height:bottom-top};};
 for(const l of head.children!)if(l!==talk)await raster(l,headParent);
 const byName=(n:string)=>nodes.find(l=>l.name===n||l.name==='+'+n);
 for(const [role,title] of [['leftPupil','Left Pupil'],['rightPupil','Right Pupil']] as const){const n=byName(title);if(!n)throw Error('Pupilli puuttuu: '+title);roles[role]=n.key;}
 for(const [side,title] of [['left','Left'],['right','Right']] as const){const eye=byName(title+' Eyeball')!;if(!eye)throw Error('Silmä puuttuu');const brow=byName(side+' Eyebrow');if(brow){roles[side+'Brow']=brow.key;}else{const png=await sharp(Buffer.from(`<svg width="${eye.width}" height="20"><path d="M5 15 Q${eye.width/2} 0 ${eye.width-5} 15" fill="none" stroke="#24212a" stroke-width="6"/></svg>`)).png().toBuffer();roles[side+'Brow']=await add(side+'Brow','Kulmakarva '+side,png,eye.left,eye.top-30,eye.width,20,'head');}
  // Closed lid covers the full eyeball; just adding a line would leave the eye open underneath.
  const blink=byName(title+' Blink');if(blink)defaults[blink.key]=0;
  const png=await sharp(Buffer.from(`<svg width="${eye.width}" height="${eye.height}"><ellipse cx="${eye.width/2}" cy="${eye.height/2}" rx="${eye.width/2}" ry="${eye.height/2}" fill="${isKille?'#e7ef9b':'#e4ee9f'}"/><path d="M8 ${eye.height/2} H${eye.width-8}" stroke="#24212a" stroke-width="5"/></svg>`)).png().toBuffer();roles[side+'Blink']=await add(side+'Blink','Suljettu silmä '+side,png,eye.left,eye.top,eye.width,eye.height,'head');defaults[roles[side+'Blink']]=0;
 }
 for(const [role,title] of [['mouthNeutral','Neutral'],['mouthOpen','Aa'],['mouthRound','Oh'],['mouthE','Ee'],['mouthU','Uh'],['mouthMBP','M'],['mouthFV','F'],['mouthConsonants','D'],['mouthL','L']] as const){const layer=mouth.children!.find(l=>l.name===title)!;const d=await drawGroup(layer);roles[role]=await add(role,'Suu '+title,d.png,d.left,d.top,d.width,d.height,'head',undefined,'mouth');defaults[role]=role==='mouthNeutral'?1:0;}
 for(const side of ['left','right'] as const){const group=body.children!.find(l=>l.name?.toLowerCase()==='+'+side+' arm')!;if(!group)throw Error('Käsiryhmä puuttuu');const upper=group.children!.find(l=>/upper arm|suorakulmio/i.test(l.name??''))!,hand=group.children!.find(l=>l!==upper)!;const d=await drawGroup(upper),p={x:d.left+d.width/2<w/2?d.left+d.width-12:d.left+12,y:d.top+d.height/2};roles[side+'Arm']=await add(side+'Arm',side+' olkavarsi',d.png,d.left,d.top,d.width,d.height,'body',p,'arm');const hd=await drawGroup(hand);roles[side+'Hand']=await add(side+'Hand',side+' käsi',hd.png,hd.left,hd.top,hd.width,hd.height,roles[side+'Arm'],undefined,'hand');}
 for(const l of body.children!)if(!/arm|leg/i.test(l.name??''))await raster(l,'body');
 // Kille has very short original legs; add articulated trouser legs and shoes in the working copy.
 // Handu's shoe layers sit under the opposite leg. Explicitly align each shoe to its own leg.
 for(const side of ['left','right'] as const){const x=isKille?(side==='left'?530:745):(side==='left'?751:600),y=isKille?1130:1196,width=isKille?150:101,length=isKille?340:194,knee=y+length*.52;
  await anchor(side+'Thigh',x+width/2,y,'body');await anchor(side+'Shin',x+width/2,knee,side+'Thigh');parts.find(p=>p.key===side+'Shin')!.joints=[{x:x+width/2,y:y+length}];
  for(const [part,py,ph] of [[side+'Thigh',y,Math.ceil(length*.52)+8],[side+'Shin',Math.floor(knee)-6,Math.ceil(length*.48)+6]] as const){const png=await sharp(Buffer.from(`<svg width="${width}" height="${ph}"><rect width="${width}" height="${ph}" rx="8" fill="${isKille?'#333855':'#4457e6'}"/></svg>`)).png().toBuffer();await add(part+'-art','Housut '+part,png,x,py,width,ph,part);}
  const png=await sharp(Buffer.from(`<svg width="${width+24}" height="38"><rect width="${width+24}" height="38" rx="7" fill="#202331"/></svg>`)).png().toBuffer();roles[side+'Foot']=await add(side+'Foot','Kenkä '+side,png,x-12,y+length-4,width+24,38,side+'Shin',undefined,'foot');
 }
 // PSD keeps all original layers; .hahmo holds the reviewed animation-ready front view.
 const quick:QuickProfile={version:1,asset:isKille?'kilsat-mr-kille-cutout-v1':'kilsat-mr-handu-cutout-v1',roles,bindings:defaultBindings,strength:1,speed:1,gate:.015,sensitivity:10,smoothing:.6,idle:false,switchDefaults:defaults};
 const animation:Animation={format:'hahmostudio-animation',version:1,fps:24,duration:2,rig:{format:'hahmostudio-rig',version:1,source:{name:name+'.psd',width:w,height:h},parts},tracks:Object.entries(defaults).map(([key,opacity])=>({key,frames:[{...neutral,frame:0,easing:'hold',opacity}]}))};
 const overlays=[];for(const n of nodes)if(defaults[n.key]!==0)overlays.push({input:Buffer.from(await n.png!.arrayBuffer()),left:n.left,top:n.top});
 const composite=await sharp({create:{width:w,height:h,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(overlays).png().toBuffer();
 const prepared=[];for(const n of nodes){const rgba=await sharp(Buffer.from(await n.png!.arrayBuffer())).ensureAlpha().raw().toBuffer();prepared.push({name:n.name,id:n.psdId,left:n.left,top:n.top,right:n.left+n.width,bottom:n.top+n.height,hidden:defaults[n.key]===0,imageData:{width:n.width,height:n.height,data:new Uint8ClampedArray(rgba)}});}for(const l of psd.children!)l.hidden=true;psd.children!.push({name:'KILSAT · animoitava etunäkymä',children:prepared});psd.imageData={width:w,height:h,data:new Uint8ClampedArray(await sharp(composite).ensureAlpha().raw().toBuffer())};const source=writePsdBuffer(psd,{generateThumbnail:false});const doc:PsdDocument={name:name+'.psd',width:w,height:h,size:source.length,layers:nodes,quick,sourcePsd:new Blob([new Uint8Array(source)]),composite:new Blob([new Uint8Array(composite)],{type:'image/png'}),warnings:['Oma PSD: animoitava etunäkymä. Alkuperäiset tasot säilyvät lähde-PSD:ssä; animoitava etunäkymä ja uudet housuosat ovat myös erillisessä PSD-ryhmässä.']};
 const pack=await saveProject(doc,animation,undefined,{width:1080,height:1920,background:'#efe9e2',design:'studio-v1',x:540,y:960,scale:.9,guides:true});await readProject(pack);
 writeFileSync('public/library/'+name+'.hahmo',new Uint8Array(await pack.arrayBuffer()));writeFileSync('public/library/'+name+'.png',composite);writeFileSync('public/library/'+name+'.psd',source);console.log(name,nodes.length,'layers',pack.size);
}
