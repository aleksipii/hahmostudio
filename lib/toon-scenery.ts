/**
 * 3D-lavasteet toon3d-kohtauksiin: jokaisesta kirjaston lavasteesta (lib/prop-library.ts) rakennetaan suljettu, litteävärinen
 * kappale. Pohjana on lavasteen oma 2D-piirros: jokainen väripinta pursotetaan syvyyteen (laatikko, sylinteri, monikulmio),
 * pinnan sisään jäävät yksityiskohdat (näyttö, kirjan selät, viisarit) nousevat ohuina laattoina pinnan päälle ja kapeat
 * jalat tehdään etu- ja takapuolelle. Pyöreät esineet (muki, pullo, roskakori, lamppu, ruukku) pyöräytetään akselin ympäri.
 * Alkuperäistä geometriaa, ei reunaviivaa; renderöi sama toon3d-kolmiorenderöijä kuin hahmot, joten kamera kiertää lavasteita
 * hahmojen mukana ja syvyysjärjestys on yhteinen. Mallit ovat yksikkökuutiossa: x ja y kuten 2D-piirroksessa, z syvyys.
 */
import {propLibrary,propShapes,type PropInstance} from './prop-library.ts';
import type {Shape} from './backgrounds.ts';
import type {V3} from './toon3d.ts';
import {volume,REFERENCE_VOLUME_SIGN} from './toon-props.ts';

export type SceneMesh={id:string;color:string;vertices:V3[];faces:[number,number,number][]};
export type SceneModel={meshes:SceneMesh[];/** Etupinnan z yksikkökoordinaateissa (lavasteen etureuna asetetaan tähän syvyyteen). */front:number};
export type SceneFace={points:V3[];color:string;depth:number;outline:boolean[]};
type P2=[number,number];

const SIDES=24;
const ellipsePoly=(cx:number,cy:number,rx:number,ry:number):P2[]=>Array.from({length:SIDES},(_,i)=>[cx+Math.cos(i*Math.PI*2/SIDES)*rx,cy+Math.sin(i*Math.PI*2/SIDES)*ry]);
const rectPoly=(x:number,y:number,w:number,h:number):P2[]=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
const shapePoly=(s:Shape):P2[]=>s.rect?rectPoly(s.rect[0],s.rect[1],s.rect[2],s.rect[3]):s.ellipse?ellipsePoly(s.ellipse[0],s.ellipse[1],s.ellipse[2],s.ellipse[3]):s.points!.map(([x,y])=>[x,y] as P2);
const bounds=(poly:P2[])=>({x0:Math.min(...poly.map(p=>p[0])),x1:Math.max(...poly.map(p=>p[0])),y0:Math.min(...poly.map(p=>p[1])),y1:Math.max(...poly.map(p=>p[1]))});
const signedArea=(poly:P2[])=>poly.reduce((s,p,i)=>{const q=poly[(i+1)%poly.length];return s+p[0]*q[1]-q[0]*p[1];},0)/2;
const cross=(a:P2,b:P2,c:P2)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const insideTri=(p:P2,a:P2,b:P2,c:P2)=>cross(a,b,p)>=-1e-9&&cross(b,c,p)>=-1e-9&&cross(c,a,p)>=-1e-9;

/** Korvakolmiointi (vastapäivään kiertävä monikulmio); epäkelvolla syötteellä viuhka, jolloin verkko pysyy suljettuna. */
function earClip(poly:P2[]):[number,number,number][]{
 const tris:[number,number,number][]=[],rest=[...poly.keys()];let guard=0;
 while(rest.length>3&&guard++<400){
  let cut=false;
  for(let k=0;k<rest.length;k++){
   const a=rest[(k+rest.length-1)%rest.length],b=rest[k],c=rest[(k+1)%rest.length];
   if(cross(poly[a],poly[b],poly[c])<=1e-9)continue;
   if(rest.some(i=>i!==a&&i!==b&&i!==c&&insideTri(poly[i],poly[a],poly[b],poly[c])))continue;
   tris.push([a,b,c]);rest.splice(k,1);cut=true;break;
  }
  if(!cut)break;
 }
 for(let k=1;k+1<rest.length;k++)tris.push([rest[0],rest[k],rest[k+1]]);
 return tris;
}

/** Kääntää pinnat tarvittaessa niin, että tilavuus on samanmerkkinen kuin muilla toon3d-verkoilla (takapintakarsinta). */
function oriented(id:string,color:string,vertices:V3[],faces:[number,number,number][]):SceneMesh{
 const fixed=Math.sign(volume(vertices,faces))===REFERENCE_VOLUME_SIGN?faces:faces.map(([a,b,c])=>[a,c,b] as [number,number,number]);
 return {id,color,vertices,faces:fixed};
}

/** Pursottaa tasomonikulmion z0..z1 (z1 on edessä). */
function extrude(id:string,color:string,input:P2[],z0:number,z1:number):SceneMesh{
 const poly=signedArea(input)<0?[...input].reverse():input,n=poly.length;
 const vertices:V3[]=[...poly.map(([x,y])=>[x,y,z1] as V3),...poly.map(([x,y])=>[x,y,z0] as V3)],faces:[number,number,number][]=[];
 for(const [a,b,c] of earClip(poly)){faces.push([a,b,c],[c+n,b+n,a+n]);}
 for(let i=0;i<n;i++){const j=(i+1)%n;faces.push([i,j+n,j],[i,i+n,j+n]);}
 return oriented(id,color,vertices,faces);
}

/** Pyöräytys pystyakselin ympäri: `profile` on [säde, y] ylhäältä alas; ensimmäinen ja viimeinen säde 0 sulkee kappaleen. */
function lathe(id:string,color:string,profile:P2[],cx=.5,cz=0,sides=20):SceneMesh{
 const vertices:V3[]=[],faces:[number,number,number][]=[],start:number[]=[];
 for(const [r,y] of profile){start.push(vertices.length);if(r===0)vertices.push([cx,y,cz]);else for(let j=0;j<sides;j++){const a=j*Math.PI*2/sides;vertices.push([cx+Math.cos(a)*r,y,cz+Math.sin(a)*r]);}}
 const at=(row:number,j:number)=>start[row]+(profile[row][0]===0?0:j%sides);
 for(let i=0;i+1<profile.length;i++)for(let j=0;j<sides;j++){
  const a=at(i,j),a1=at(i,j+1),b=at(i+1,j),b1=at(i+1,j+1);
  if(a!==a1)faces.push([a,a1,b]);// ylärivin kärki: ei ensimmäistä kolmiota
  if(b!==b1)faces.push([a1,b1,b]);// alarivin kärki: ei toista kolmiota
 }
 return oriented(id,color,vertices,faces);
}
const box=(id:string,color:string,x:number,y:number,w:number,h:number,z0:number,z1:number)=>extrude(id,color,rectPoly(x,y,w,h),z0,z1);
/** Kääntää verkon pystyakselin (x=cx) ympäri 90°: ristiin asetetut lehdet. */
const turned=(m:SceneMesh,cx=.5):SceneMesh=>({...m,id:m.id+'-turned',vertices:m.vertices.map(([x,y,z])=>[cx-z,y,x-cx] as V3)});

/** Syvyys (yksikkökuution z-leveys) lavastetyypeittäin; oletus .3. */
const depthOf:Record<string,number>={phone:.06,tablet:.05,laptop:.4,monitor:.2,keyboard:.3,mouse:.4,book:.16,notebook:.08,paper:.015,pen:.06,keys:.03,bag:.35,backpack:.35,folder:.06,table:.5,chair:.45,sofa:.5,board:.12,bed:.55,tv:.12,fridge:.45,bookshelf:.22,clock:.1,bicycle:.12,rug:.015};
/** Kuvion järjestysnumeron mukaiset z-välit, kun oletussääntö ei kuvaa esinettä: [z0,z1] tai null (oletus). */
const zOverrides:Record<string,([number,number]|null)[]>={
 chair:[null,null,[-.22,-.14],[-.2,.2],[-.22,-.14],[-.22,-.14]],
 sofa:[null,null,[-.25,-.06],[-.25,.25],[-.25,.25],[-.25,.25]],
 bed:[null,null,null,null,null,[-.25,-.05],null]
};

function generic(key:string,shapes:Shape[]):SceneModel{
 const D=depthOf[key]??.3,meshes:SceneMesh[]=[],placed:{x0:number;x1:number;y0:number;y1:number;z1:number}[]=[],over=zOverrides[key]??[];
 shapes.forEach((s,i)=>{
  const poly=shapePoly(s),b=bounds(poly),w=b.x1-b.x0,h=b.y1-b.y0,id=`${key}-${i}`;
  const holder=[...placed].reverse().find(q=>b.x0>=q.x0-.002&&b.x1<=q.x1+.002&&b.y0>=q.y0-.002&&b.y1<=q.y1+.002);
  const fixed=over[i];
  if(fixed){meshes.push(extrude(id,s.fill,poly,fixed[0],fixed[1]));placed.push({...b,z1:fixed[1]});return;}
  if(holder){const z0=holder.z1,z1=z0+Math.min(.014,D*.25);meshes.push(extrude(id,s.fill,poly,z0,z1));placed.push({...b,z1});return;}
  if(s.rect&&w<=.08&&h>=.12&&b.y1>=.6){const t=Math.min(.08,D*.4);meshes.push(extrude(id+'-f',s.fill,poly,D/2-t,D/2),extrude(id+'-b',s.fill,poly,-D/2,-D/2+t));placed.push({...b,z1:D/2});return;}
  const z1=D/2+.002*i;meshes.push(extrude(id,s.fill,poly,-D/2,z1));placed.push({...b,z1});
 });
 return {meshes,front:D/2+.002*shapes.length};
}

/** Pyöreät esineet ja muut, joille pursotettu 2D-kuva ei riitä. */
const custom:Record<string,()=>SceneModel>={
 mug:()=>({front:.3,meshes:[
  lathe('mug-body','#b57860',[[0,.2],[.3,.2],[.3,.8],[0,.8]],.42),lathe('mug-coffee','#765448',[[0,.19],[.24,.19],[.24,.2],[0,.2]],.42),
  box('mug-handle-top','#b57860',.68,.32,.24,.08,-.05,.05),box('mug-handle-bottom','#b57860',.68,.56,.24,.08,-.05,.05),box('mug-handle-side','#b57860',.86,.32,.08,.32,-.05,.05)]}),
 bottle:()=>({front:.25,meshes:[
  lathe('bottle-cap','#344b5a',[[0,.03],[.11,.03],[.11,.13],[0,.13]]),lathe('bottle-neck','#86adb8',[[0,.13],[.1,.13],[.1,.23],[0,.23]]),
  lathe('bottle-body','#86adb8',[[0,.23],[.1,.23],[.22,.39],[.22,.91],[0,.91]]),lathe('bottle-label','#f0ead9',[[0,.52],[.225,.52],[.225,.71],[0,.71]])]}),
 bin:()=>({front:.35,meshes:[
  lathe('bin-body','#5f8f4f',[[0,.22],[.28,.22],[.22,.96],[0,.96]]),lathe('bin-lid','#4f7a41',[[0,.16],[.32,.16],[.32,.22],[0,.22]]),lathe('bin-knob','#4f7a41',[[0,.1],[.08,.1],[.08,.16],[0,.16]])]}),
 floorlamp:()=>({front:.3,meshes:[
  lathe('lamp-shade','#f2d48a',[[0,.04],[.2,.04],[.3,.3],[0,.3]]),lathe('lamp-pole','#344b5a',[[0,.3],[.02,.3],[.02,.9],[0,.9]]),lathe('lamp-base','#344b5a',[[0,.9],[.2,.9],[.2,.94],[0,.94]])]}),
 plant:()=>{
  const leaves=propShapes('plant-prop-v1').slice(2).map((s,i)=>extrude('plant-leaf-'+i,s.fill,shapePoly(s),-.02,.02));
  return {front:.3,meshes:[lathe('plant-pot','#b57860',[[0,.62],[.22,.62],[.16,.96],[0,.96]]),lathe('plant-rim','#9c5f4d',[[0,.6],[.24,.6],[.24,.65],[0,.65]]),...leaves,...leaves.map(m=>turned(m))]};
 }
};

const cache=new Map<string,SceneModel|null>();
/** Lavasteen 3D-malli yksikkökuutiossa; `undefined`, jos tunnistetta ei ole kirjastossa. */
export function sceneModel(asset:string):SceneModel|undefined{
 if(cache.has(asset))return cache.get(asset)??undefined;
 const key=asset.replace('-prop-v1',''),entry=propLibrary.find(p=>p.id===asset);
 const model=entry?(custom[key]?custom[key]():generic(key,propShapes(asset))):undefined;
 cache.set(asset,model??null);return model;
}

const tone=(color:string,shade:number)=>'#'+[1,3,5].map(i=>Math.min(255,Math.round(parseInt(color.slice(i,i+2),16)*shade)).toString(16).padStart(2,'0')).join('');
/**
 * Aikaikkunassa näkyvien lavasteiden kolmiot projisoituna kameraan. Lavasteen paikka ja koko ovat samat kuin 2D-piirrossa
 * (keskipiste x·leveys, y·korkeus; koko = lyhyempi sivu · mittakaava); etureuna on hahmojen takana, jotta hahmot jäävät esiin.
 */
export function sceneryFaces(items:PropInstance[],time:number,width:number,height:number,project:(point:V3)=>V3):SceneFace[]{
 const out:SceneFace[]=[];
 for(const item of items){
  if(time<item.start||time>=item.end)continue;
  const model=sceneModel(item.asset);if(!model)continue;
  const size=Math.min(width,height)*item.scale,cx=item.x*width,cy=item.y*height,front=-45*width/1080;
  for(const m of model.meshes){
   const points=m.vertices.map(v=>project([cx+(v[0]-.5)*size,cy+(v[1]-.5)*size,front+(v[2]-model.front)*size]));
   for(const f of m.faces){
    const [a,b,c]=f.map(i=>points[i]),area=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
    if(area<.001)continue;
    const ab=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],ac=[c[0]-a[0],c[1]-a[1],c[2]-a[2]],normal=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]],length=Math.hypot(...normal)||1,light=Math.abs((normal[0]*-.3+normal[1]*-.5+normal[2]*.81)/length);
    out.push({points:[a,b,c],color:tone(m.color,light>.6?1:light>.3?.93:.86),depth:(a[2]+b[2]+c[2])/3,outline:[false,false,false]});
   }
  }
 }
 return out;
}
