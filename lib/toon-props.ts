/**
 * Käteen annettavat esineet toon3d-hahmoille: kirjaston esineet (kahvikuppi, kirja, laukku, sateenvarjo) rakennetaan
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
/** Kartio: kärki ylhäällä (pienempi y), pohja `height` alempana. */
function cone(id:string,color:string,bone:string,apex:V3,r:number,height:number,sides=16):Mesh3D{
 const v:V3[]=[apex],f:Faces=[];
 for(let i=0;i<sides;i++){const a=i*Math.PI*2/sides;v.push([apex[0]+Math.cos(a)*r,apex[1]+height,apex[2]+Math.sin(a)*r]);}
 const centre=v.push([apex[0],apex[1]+height,apex[2]])-1;
 for(let i=0;i<sides;i++){const a=1+i,b=1+(i+1)%sides;f.push([0,b,a],[centre,a,b]);}
 return mesh(id,color,bone,v,f);
}

export const toonHeldPropIds=['mug-prop-v1','book-prop-v1','bag-prop-v1','umbrella-prop-v1'] as const;
/** Esineen verkot käden tartuntapisteen `grip` ympärillä. `outward` on +1/-1: kummalle puolelle (x) kahva tai reuna kääntyy. */
export function toonHeldPropMeshes(id:string,grip:V3,hand:'leftHand'|'rightHand',outward:1|-1):Mesh3D[]|undefined{
 const bone=hand,[x,y,z]=grip;
 switch(id){
  case'mug-prop-v1':return [cylinder(id,'#b57860',bone,[x,y-6,z],13,30),cylinder('mug-coffee','#765448',bone,[x,y-20.5,z],11,2),box('mug-handle','#b57860',bone,[x+outward*17,y-6,z],8,16,5)];
  case'book-prop-v1':return [box(id,'#b57860',bone,[x,y-16,z],44,58,9),box('book-pages','#f0ead9',bone,[x+outward*1.5,y-16,z+.5],40,54,8),box('book-spine','#9c5f4d',bone,[x-outward*20,y-16,z],5,58,10)];
  case'bag-prop-v1':return [box(id,'#b57860',bone,[x,y+32,z],58,46,22),box('bag-flap','#995c49',bone,[x,y+13,z],60,8,23),box('bag-handle-l','#24364b',bone,[x-9,y+4,z],3,16,3),box('bag-handle-r','#24364b',bone,[x+9,y+4,z],3,16,3),box('bag-handle-top','#24364b',bone,[x,y-3,z],21,3,3)];
  case'umbrella-prop-v1':return [cylinder(id,'#24364b',bone,[x,y-34,z],2.4,120,8),cone('umbrella-canopy','#4f8a8b',bone,[x,y-106,z],54,42,18),box('umbrella-hook','#24364b',bone,[x+outward*4,y+27,z],9,3,3)];
  default:return undefined;
 }
}
