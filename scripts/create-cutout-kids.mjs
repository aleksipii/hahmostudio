// Paketoi .cutout-kids-build-hahmot (scripts/create-cutout-kids.py) PSD- ja .hahmo-tiedostoiksi.
//  2D: <Nimi>.psd / .hahmo / .png  – etunäkymä, ryhmät Vartalo/Pää/Suut.
//  3D: <Nimi>-3D.psd / .hahmo / .png – kolme kuvakulmaa (edestä, oikea, vasen) omina ryhminään;
//      sama rakenne kuin Roni/Salla-monikulmahahmoilla, joten Cutout3D-kamera ja kuvakulmavalinta toimivat.
import fs from 'node:fs';
import {writePsdBuffer,readPsd,initializeCanvas} from 'ag-psd';
import {zipSync,strToU8} from 'fflate';
initializeCanvas(()=>{throw Error('Canvas unused');},(width,height)=>({width,height,data:new Uint8ClampedArray(width*height*4)}));

const W=600,H=900,build=new URL('../.cutout-kids-build/',import.meta.url),out=new URL('../public/library/',import.meta.url);
const cast={Pipsa:{id:14000,about:'keltainen sadetakki ja huppu, punaiset silmälasit, lapaset ja kumisaappaat'},Ville:{id:15000,about:'kihara kuparinen tukka, pisamat, ruskea neule ja valkoiset lapaset'},Taru:{id:16000,about:'hiusnutturat, violetit kuulokkeet, violetit lapaset ja oranssi huppari'},Ukko:{id:17000,about:'kalju, valkoiset viikset ja sivutukat, vihreä villatakki'}};
const labels={front:'Edestä',right:'Oikea profiili',left:'Vasen profiili'};
const bindings={left:'KeyA',right:'KeyD',jump:'KeyW',neutral:'Digit1',happy:'Digit2',surprise:'Digit3',blink:'KeyB',record:'KeyR',play:'Space'};
const pose={x:0,y:0,rotation:0,scale:1,opacity:1,frame:0,easing:'hold'};
const hiddenRoles=['leftBlink','rightBlink','mouthOpen','mouthRound','mouthSmile','mouthSad'];
const only=process.argv.slice(2).filter(a=>!a.startsWith('--'));

const read=(name,view)=>{const dir=new URL(`${name}/${view}/`,build);return {dir,meta:JSON.parse(fs.readFileSync(new URL('layers.json',dir)))};};
const pixels=(dir,key)=>new Uint8ClampedArray(fs.readFileSync(new URL(key+'.rgba',dir)));
const layerNode=(dir,n,id)=>({name:n.name,id,left:n.left,top:n.top,right:n.left+n.width,bottom:n.top+n.height,hidden:n.hidden,imageData:{width:n.width,height:n.height,data:pixels(dir,n.key)}});
const groupsOf=(dir,meta,nextId)=>['Vartalo','Pää','Suut'].map(group=>({name:group,blendMode:'pass through',children:meta.filter(n=>n.group===group).map(n=>layerNode(dir,n,nextId(n)))}));
const node=(key,name,path,kind,extra={})=>({key,name,path,kind,left:0,top:0,width:0,height:0,opacity:1,visible:true,blendMode:kind==='group'?'pass through':'normal',warnings:[],children:[],...extra});
const guide=(name,views)=>`${name}: Hahmostudion alkuperäistä grafiikkaa (CC0-1.0). ${views>1?'Kolme kuvakulmaa: valitse kulma Hahmon kuvakulma -valinnasta; Cutout3D-kamera kääntää paperitasoja.':'Etunäkymän 2D-hahmo.'} Tasot, liitokset, nivelpisteet ja lähde-PSD ovat mukana. Kädet A/D, hyppy W, ilmeet 1/2/3, räpäytys B. Suu reagoi ääneen; hymy- ja surusuu ovat mukana. Muokkaa PSD:tä yhdistämättä tasoja.`;

function pack(name,cfg,views){
 const three=views.length>1,outName=three?name+'-3D':name,entries=views.map(view=>({view,...read(name,view)}));
 let serial=0;const ids=new Map();const idFor=(view,n)=>{const k=view+'/'+n.key;if(!ids.has(k))ids.set(k,cfg.id+(three?0:500)+(++serial));return ids.get(k);};
 const children=three?entries.map(({view,dir,meta})=>({name:labels[view],hidden:view!=='front',blendMode:'pass through',children:groupsOf(dir,meta,n=>idFor(view,n))})):groupsOf(entries[0].dir,entries[0].meta,n=>idFor('front',n));
 const bytes=writePsdBuffer({width:W,height:H,imageData:{width:W,height:H,data:new Uint8ClampedArray(fs.readFileSync(new URL(`${name}/front/composite.rgba`,build)))},children},{generateThumbnail:false});
 const parsed=readPsd(bytes,{useRawData:true,skipThumbnail:true});
 const files={},parts=[],viewRoles={};
 const layerTree=(sub,prefix,pathPrefix,view,dir,meta)=>sub.children.map((l,li)=>{const n=meta.find(m=>m.name===l.name),key=`${prefix}/${li}`,path=`${pathPrefix}/${l.name}`;if(!n||l.left!==n.left||l.top!==n.top)throw Error(`PSD-tarkistus epäonnistui: ${name} ${view} ${l.name}`);viewRoles[view][n.key]=key;const image=`images/${three?view+'-':''}${n.key}.png`;files[image]=fs.readFileSync(new URL(n.key+'.png',dir));parts.push({key,psdId:l.id,path,role:n.role,pivot:n.pivot,joints:n.joints,parentKey:n.parentKey,view});return node(key,l.name,path,'layer',{psdId:l.id,left:n.left,top:n.top,width:n.width,height:n.height,image});});
 let layers;
 if(three)layers=parsed.children.map((g,vi)=>{const {view,dir,meta}=entries[vi];viewRoles[view]={};return node(`/${vi}`,g.name,g.name,'group',{children:g.children.map((sub,si)=>node(`/${vi}/${si}`,sub.name,`${g.name}/${sub.name}`,'group',{children:layerTree(sub,`/${vi}/${si}`,`${g.name}/${sub.name}`,view,dir,meta)}))});});
 else{viewRoles.front={};layers=parsed.children.map((sub,si)=>node(`/${si}`,sub.name,sub.name,'group',{children:layerTree(sub,`/${si}`,sub.name,'front',entries[0].dir,entries[0].meta)}));}
 for(const p of parts){if(p.parentKey)p.parentKey=viewRoles[p.view][p.parentKey];else delete p.parentKey;delete p.view;}
 const asset=`hahmostudio-${name.toLowerCase()}-cutout-${three?'3d':'2d'}-v1`;
 const quick={version:1,asset,roles:viewRoles.front,...(three?{views:viewRoles}:{}),bindings,strength:1,speed:1,gate:.015,sensitivity:10,smoothing:.6,idle:true};
 const tracks=Object.entries(viewRoles).flatMap(([view,r])=>[...(three?[{key:r.root,frames:[{...pose,opacity:view==='front'?1:0}]}]:[]),...hiddenRoles.filter(role=>r[role]).map(role=>({key:r[role],frames:[{...pose,opacity:0}]}))]);
 files['source/character.psd']=bytes;files['images/original.png']=fs.readFileSync(new URL(`${name}/front/preview.png`,build));
 files['KAYTTOOHJE.txt']=strToU8(guide(name,views.length));
 files['provenance.json']=strToU8(JSON.stringify({asset,version:2,author:'Hahmostudio',license:'CC0-1.0',origin:'studio-library',externalAssets:[],views,graphics:'Original procedural cutout artwork (scripts/create-cutout-kids.py); not derived from any TV series',capabilities:['full-body','wave','walk','run','crouch','jump','sit','point','volume-mouth','smile','sad-mouth',...(three?['multiview','cutout-3d']:[])]}));
 files['project.json']=strToU8(JSON.stringify({format:'hahmostudio-project',version:2,document:{name:outName+'.psd',width:W,height:H,size:bytes.length,warnings:[],layers,composite:'images/original.png',sourcePsd:'source/character.psd',quick},animation:{format:'hahmostudio-animation',version:1,fps:24,duration:2,rig:{format:'hahmostudio-rig',version:1,source:{name:outName+'.psd',width:W,height:H},parts},tracks},scene:{width:1080,height:1920,background:'#253341',design:'studio-v1',x:540,y:1050,scale:1.65,guides:true}}));
 fs.writeFileSync(new URL(outName+'.hahmo',out),zipSync(files));fs.writeFileSync(new URL(outName+'.psd',out),bytes);
 fs.copyFileSync(new URL(`${name}/front/preview.png`,build),new URL(outName+'.png',out));
 console.log(`${outName}: ${views.length} kuvakulmaa, ${parts.length} niveltettyä tasoa, PSD ${Math.round(bytes.length/1024)} kt`);
}

for(const [name,cfg] of Object.entries(cast)){if(only.length&&!only.includes(name))continue;pack(name,cfg,['front']);pack(name,cfg,['front','right','left']);}
