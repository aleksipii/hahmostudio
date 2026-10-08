/**
 * Käteen annettavat esineet toon3d-hahmoille: kirjaston käsiesineet (kahvikuppi, kirja, laukku, sateenvarjo, tabletti, avaimet,
 * pullo, kynä, paperi, kansio, kirje, jäätelö, kukka, mikrofoni, taskulamppu, pallo) rakennetaan
 * yksinkertaisista suljetuista kappaleista (laatikko, sylinteri, kartio) käden tartuntapisteen ympärille. Verkot ovat
 * alkuperäistä geometriaa; käsiluu skinnaa ne renderöinnissä. Esine ei ole fysiikkaa: se seuraa kättä jäykästi.
 */
import type {Mesh3D,V3} from './toon3d.ts';

type Faces=Mesh3D['faces'];
const volume=(vertices:V3[],faces:Faces)=>faces.reduce((sum,[a,b,c])=>{const p=vertices[a],q=vertices[b],r=vertices[c];return sum+(p[0]*(q[1]*r[2]-q[2]*r[1])-p[1]*(q[0]*r[2]-q[2]*r[0])+p[2]*(q[0]*r[1]-q[1]*r[0]));},0)/6;
const boxFaces:Faces=[[0,2,1],[0,3,2],[4,5,6],[4,6,7],[0,1,5],[0,5,4],[1,2,6],[1,6,5],[2,3,7],[2,7,6],[3,0,4],[3,4,7]];
const boxCorners=(c:V3,w:number,h:number,d:number):V3[]=>[-d/2,d/2].flatMap(z=>[[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]].map(([x,y])=>[c[0]+x,c[1]+y,c[2]+z] as V3));
/** Samaan suuntaan kuin puhelimen laatikko (renderöijän takapintakarsinta riippuu pinnan kiertosuunnasta). */
export const REFERENCE_VOLUME_SIGN=Math.sign(volume(boxCorners([0,0,0],2,2,2),boxFaces));

/** Muodostaa verkon ja kääntää pinnat tarvittaessa niin, että tilavuus on referenssin etumerkkinen. */
function mesh(id:string,color:string,bone:string,vertices:V3[],faces:Faces):Mesh3D{
 const fixed=Math.sign(volume(vertices,faces))===REFERENCE_VOLUME_SIGN?faces:faces.map(([a,b,c])=>[a,c,b] as [number,number,number]);
 return {id,color,vertices:vertices.map(position=>({position,weights:[{bone,weight:1}]})),faces:fixed};
}
const box=(id:string,color:string,bone:string,c:V3,w:number,h:number,d:number)=>mesh(id,color,bone,boxCorners(c,w,h,d),boxFaces);
/** Pystysuuntainen sylinteri (y-akseli), `sides` sivua. */
function cylinder(id:string,color:string,bone:string,c:V3,r:number,h:number,sides=14):Mesh3D{
 const v:V3[]=[],f:Faces=[];
 for(let i=0;i<sides;i++){const a=i*Math.PI*2/sides;v.push([c[0]+Math.cos(a)*r,c[1]-h/2,c[2]+Math.sin(a)*r],[c[0]+Math.cos(a)*r,c[1]+h/2,c[2]+Math.sin(a)*r]);}
 const top=v.push([c[0],c[1]-h/2,c[2]])-1,bottom=v.push([c[0],c[1]+h/2,c[2]])-1;
 for(let i=0;i<sides;i++){const j=(i+1)%sides,a=2*i,b=2*i+1,c2=2*j,d=2*j+1;f.push([a,c2,b],[b,c2,d],[top,c2,a],[bottom,b,d]);}
 return mesh(id,color,bone,v,f);
}
/** Kartio: kärki ylhäällä (pienempi y), pohja `height` alempana; negatiivinen `height` kääntää kärjen alas. */
function cone(id:string,color:string,bone:string,apex:V3,r:number,height:number,sides=16):Mesh3D{
 const v:V3[]=[apex],f:Faces=[];
 for(let i=0;i<sides;i++){const a=i*Math.PI*2/sides;v.push([apex[0]+Math.cos(a)*r,apex[1]+height,apex[2]+Math.sin(a)*r]);}
 const centre=v.push([apex[0],apex[1]+height,apex[2]])-1;
 for(let i=0;i<sides;i++){const a=1+i,b=1+(i+1)%sides;f.push([0,b,a],[centre,a,b]);}
 return mesh(id,color,bone,v,f);
}

export const toonHeldPropIds=['mug-prop-v1','book-prop-v1','bag-prop-v1','umbrella-prop-v1','tablet-prop-v1','keys-prop-v1','bottle-prop-v1','pen-prop-v1','paper-prop-v1','folder-prop-v1','letter-prop-v1','icecream-prop-v1','flower-prop-v1','microphone-prop-v1','flashlight-prop-v1','ball-prop-v1'] as const;
/** Esineen verkot käden tartuntapisteen `grip` ympärillä. `outward` on +1/-1: kummalle puolelle (x) kahva tai reuna kääntyy. */
export function toonHeldPropMeshes(id:string,grip:V3,hand:'leftHand'|'rightHand',outward:1|-1):Mesh3D[]|undefined{
 const bone=hand,[x,y,z]=grip;
 switch(id){
  case'mug-prop-v1':return [cylinder(id,'#b57860',bone,[x,y-6,z],13,30),cylinder('mug-coffee','#765448',bone,[x,y-20.5,z],11,2),box('mug-handle','#b57860',bone,[x+outward*17,y-6,z],8,16,5)];
  case'book-prop-v1':return [box(id,'#b57860',bone,[x,y-16,z],44,58,9),box('book-pages','#f0ead9',bone,[x+outward*1.5,y-16,z+.5],40,54,8),box('book-spine','#9c5f4d',bone,[x-outward*20,y-16,z],5,58,10)];
  case'bag-prop-v1':return [box(id,'#b57860',bone,[x,y+32,z],58,46,22),box('bag-flap','#995c49',bone,[x,y+13,z],60,8,23),box('bag-handle-l','#24364b',bone,[x-9,y+4,z],3,16,3),box('bag-handle-r','#24364b',bone,[x+9,y+4,z],3,16,3),box('bag-handle-top','#24364b',bone,[x,y-3,z],21,3,3)];
  case'umbrella-prop-v1':return [cylinder(id,'#24364b',bone,[x,y-34,z],2.4,120,8),cone('umbrella-canopy','#4f8a8b',bone,[x,y-106,z],54,42,18),box('umbrella-hook','#24364b',bone,[x+outward*4,y+27,z],9,3,3)];
  case'tablet-prop-v1':return [box(id,'#24364b',bone,[x,y-30,z],50,68,4),box('tablet-screen','#76b5d1',bone,[x,y-31,z],44,58,4.6)];
  case'keys-prop-v1':return [cylinder(id,'#8c949a',bone,[x,y-4,z],7,2,12),box('keys-blade','#a8adb0',bone,[x+outward*8,y+6,z],4,18,1.5),box('keys-fob','#b57860',bone,[x-outward*7,y+8,z],8,12,3)];
  case'bottle-prop-v1':return [cylinder(id,'#76b5d1',bone,[x,y-14,z],10,56,14),cylinder('bottle-label','#f0ead9',bone,[x,y-10,z],10.6,16,14),cylinder('bottle-cap','#24364b',bone,[x,y-46,z],6,8,10)];
  case'pen-prop-v1':return [cylinder(id,'#b57860',bone,[x,y-10,z],2,40,8),cone('pen-tip','#24364b',bone,[x,y+16,z],2,-6,8)];
  case'paper-prop-v1':return [box(id,'#f0ead9',bone,[x,y-26,z],42,58,1.4),box('paper-lines','#76b5d1',bone,[x,y-32,z],30,2,1.8)];
  case'folder-prop-v1':return [box(id,'#b57860',bone,[x,y-30,z],52,64,4),box('folder-sheet','#f0ead9',bone,[x,y-30,z],46,58,4.6)];
  case'letter-prop-v1':return [box(id,'#f0ead9',bone,[x+outward*12,y-6,z],46,32,1.4),box('letter-stamp','#c8372d',bone,[x+outward*28,y-16,z],8,9,2)];
  case'icecream-prop-v1':return [cone('icecream-cone','#d9a35b',bone,[x,y+6,z],11,-40,12),cylinder(id,'#f3b6c4',bone,[x,y-40,z],11,10,14),cylinder('icecream-top','#fbf2dc',bone,[x,y-50,z],8.5,10,14)];
  case'flower-prop-v1':return [cylinder(id,'#5f8f4f',bone,[x,y-30,z],1.6,64,6),cone('flower-bloom','#e8607a',bone,[x,y-60,z],14,-20,10),cylinder('flower-centre','#f2c230',bone,[x,y-66,z],5,4,10)];
  case'microphone-prop-v1':return [cylinder(id,'#24364b',bone,[x,y-8,z],4,40,10),cylinder('mic-head','#6b7480',bone,[x,y-34,z],8,14,12),box('mic-band','#c8372d',bone,[x,y-4,z],9,3,9)];
  case'flashlight-prop-v1':return [cylinder(id,'#4f8a8b',bone,[x,y-6,z],5,46,10),cylinder('flashlight-head','#3e4955',bone,[x,y-34,z],8,10,12),cylinder('flashlight-lens','#fff2b0',bone,[x,y-39.5,z],6.5,1.5,12)];
  case'ball-prop-v1':return [cylinder(id,'#c8372d',bone,[x,y-22,z],20,30,16),cylinder('ball-band','#f4f0e6',bone,[x,y-24,z],20.6,6,16),cylinder('ball-cap-top','#c8372d',bone,[x,y-38,z],14,4,16),cylinder('ball-cap-bottom','#c8372d',bone,[x,y-6,z],14,4,16)];
  default:return undefined;
 }
}
