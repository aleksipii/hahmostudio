/**
 * Ohjattu hahmon luonti: ehdottaa osille roolit, liitokset, pivotit, nivelkohdat ja käden tartuntapisteet PSD- tai
 * PNG-tasoista. Ehdotus perustuu tasojen nimiin (suomi ja englanti) ja rajauslaatikoiden geometriaan. Se ei ole
 * kuvantunnistus: nimeämätöntä tasoa ei arvata, vaan se jää “Ei roolia” -tilaan käyttäjän valittavaksi. Ehdotus on
 * puhdas laskenta; käyttäjä tarkistaa sen ja vasta vahvistus kirjoittaa rigin (yksi kumottava muutos).
 */
import {flatten,type LayerNode,type PsdDocument} from './psd-model.ts';
import {canAttach,type Point,type Rig,type RigPart,roles} from './rig-model.ts';

type Role=RigPart['role'];
export type RigSuggestion={key:string;name:string;role:Role;reason:string;side?:'left'|'right';parentKey?:string;parentName?:string;pivot:Point;joints:Point[];grip?:Point};
export type RigSuggestResult={rig:Rig;suggestions:RigSuggestion[];unrecognized:{key:string;name:string}[];notes:string[]};

const rules:[Role,RegExp][]=[
 ['foot',/(^|[^\p{L}])(jalkaterä|jalkaterat|foot|feet|kenkä|kengä|shoe|boot|sukka)/iu],
 ['hand',/(^|[^\p{L}])(kämmen|kammen|hand|palm|sormi|finger|nyrkki|fist)/iu],
 ['leg',/(^|[^\p{L}])(jalka|jalat|leg|thigh|calf|reisi|sääri|saari|housu|pant|trouser)/iu],
 ['arm',/(^|[^\p{L}])(käsivarsi|kasivarsi|käsi|kasi|arm|sleeve|hiha|forearm|upperarm|olkavarsi)/iu],
 ['eye',/(^|[^\p{L}])(silmä|silma|silmät|eye|pupil|pupilli|iiris|iris|eyelid|luomi|kulma|brow)/iu],
 ['mouth',/(^|[^\p{L}])(suu|mouth|lip|huul|teeth|hampa)/iu],
 ['head',/(^|[^\p{L}])(pää|paa|head|face|kasvo|naama)/iu],
 ['body',/(^|[^\p{L}])(vartalo|torso|body|keho|chest|rinta|paita|shirt|takki|jacket|hame|dress|mekko)/iu],
 ['accessory',/(^|[^\p{L}])(hattu|hat|lasit|glasses|hair|tukka|hiukset|laukku|bag|asuste|accessory)/iu],
];
const leftRe=/(^|[^\p{L}])(vasen|vasemma|left|l)([^\p{L}]|$)/iu,rightRe=/(^|[^\p{L}])(oikea|oikean|right|r)([^\p{L}]|$)/iu;
const centre=(n:LayerNode):Point=>({x:n.left+n.width/2,y:n.top+n.height/2});
const clamp=(p:Point,doc:PsdDocument):Point=>({x:Math.min(doc.width,Math.max(0,p.x)),y:Math.min(doc.height,Math.max(0,p.y))});
const area=(n:LayerNode)=>n.width*n.height;

function roleOf(name:string):Role|undefined{
 const tokens=name.replace(/[_\-.]+/g,' ');
 for(const [role,re] of rules)if(re.test(tokens))return role;
}
function sideOf(name:string):'left'|'right'|undefined{
 const t=name.replace(/[_\-.]+/g,' ');
 return leftRe.test(t)?'left':rightRe.test(t)?'right':undefined;
}

/** Pivot ja nivelkohta rajauslaatikosta roolin mukaan; asiakirjakoordinaatit. */
function geometry(role:Role,n:LayerNode,parent:LayerNode|undefined,doc:PsdDocument):{pivot:Point;joints:Point[]}{
 const c=centre(n),tall=n.height>=n.width*0.8;
 switch(role){
  case'head':return {pivot:clamp({x:c.x,y:n.top+n.height*0.92},doc),joints:[]};
  case'arm':case'leg':{
   if(tall||role==='leg')return {pivot:clamp({x:c.x,y:n.top+Math.min(n.height*0.1,24)},doc),joints:[clamp({x:c.x,y:n.top+n.height*0.92},doc)]};
   const towardBody=parent?centre(parent).x:doc.width/2,leftEnd=Math.abs(n.left-towardBody)<Math.abs(n.left+n.width-towardBody);
   const near=leftEnd?n.left+Math.min(n.width*0.1,24):n.left+n.width-Math.min(n.width*0.1,24),far=leftEnd?n.left+n.width*0.92:n.left+n.width*0.08;
   return {pivot:clamp({x:near,y:c.y},doc),joints:[clamp({x:far,y:c.y},doc)]};
  }
  case'hand':return {pivot:clamp({x:c.x,y:n.top+n.height*0.15},doc),joints:[]};
  case'foot':return {pivot:clamp({x:c.x,y:n.top+n.height*0.15},doc),joints:[]};
  default:return {pivot:clamp(c,doc),joints:[]};
 }
}

/**
 * Ehdottaa rigin. Oletuksena koskee vain osia, joilla ei ole roolia, joten käsin tehty työ säilyy.
 * `rig` palautetaan kopiona (syöte ei muutu) ja se läpäisee liitosten kehätarkistuksen.
 */
export function suggestRig(doc:PsdDocument,rig:Rig,options:{onlyUnassigned?:boolean}={}):RigSuggestResult{
 const onlyUnassigned=options.onlyUnassigned!==false,nodes=new Map(flatten(doc.layers).filter(n=>n.kind==='layer').map(n=>[n.key,n]));
 const next:Rig={...rig,parts:rig.parts.map(p=>({...p,pivot:{...p.pivot},joints:p.joints.map(j=>({...j}))}))};
 const byKey=new Map(next.parts.map(p=>[p.key,p])),touched=new Set<string>(),unrecognized:{key:string;name:string}[]=[],notes:string[]=[];
 const roleFor=new Map<string,{role:Role;reason:string;side?:'left'|'right'}>();
 for(const part of next.parts){
  const n=nodes.get(part.key);if(!n)continue;
  if(onlyUnassigned&&part.role!=='none')continue;
  const role=roleOf(n.name)??roleOf(n.path.split('/').slice(-2,-1)[0]??'');
  if(!role){if(part.role==='none')unrecognized.push({key:part.key,name:n.name});continue;}
  roleFor.set(part.key,{role,reason:`nimi “${n.name}” → ${roles[role]}`,side:sideOf(n.name)});
 }
 const effectiveRole=(key:string):Role=>roleFor.get(key)?.role??byKey.get(key)!.role;
 const ofRole=(role:Role)=>next.parts.filter(p=>effectiveRole(p.key)===role&&nodes.has(p.key));
 const bodies=ofRole('body').sort((a,b)=>area(nodes.get(b.key)!)-area(nodes.get(a.key)!)),mainBody=bodies[0],mainHead=ofRole('head').sort((a,b)=>area(nodes.get(b.key)!)-area(nodes.get(a.key)!))[0];
 if(!mainBody&&roleFor.size)notes.push('Vartalo-osaa ei tunnistettu nimestä: käsiä, jalkoja ja päätä ei liitetty mihinkään. Anna vartalolle rooli ja aja ehdotus uudelleen.');
 const nearest=(from:LayerNode,candidates:RigPart[],preferSide?:'left'|'right')=>{
  let best:RigPart|undefined,bestD=Infinity;
  for(const c of candidates){const cn=nodes.get(c.key)!,cs=roleFor.get(c.key)?.side,d=Math.hypot(centre(cn).x-centre(from).x,cn.top+cn.height-centre(from).y)+(preferSide&&cs&&cs!==preferSide?1e6:0);if(d<bestD){best=c;bestD=d;}}
  return best;
 };
 const parentOf=(part:RigPart,role:Role,n:LayerNode,side?:'left'|'right'):RigPart|undefined=>{
  switch(role){
   case'head':case'arm':case'leg':return mainBody;
   case'hand':return nearest(n,ofRole('arm'),side)??mainBody;
   case'foot':return nearest(n,ofRole('leg'),side)??mainBody;
   case'eye':case'mouth':return mainHead??mainBody;
   case'accessory':{const h=mainHead&&nodes.get(mainHead.key);if(h){const ix=Math.max(0,Math.min(n.left+n.width,h.left+h.width)-Math.max(n.left,h.left)),iy=Math.max(0,Math.min(n.top+n.height,h.top+h.height)-Math.max(n.top,h.top));if(ix*iy>=area(n)*0.5)return mainHead;}return undefined;}
   default:return undefined;
  }
 };
 for(const [key,info] of roleFor){
  const part=byKey.get(key)!,n=nodes.get(key)!;
  part.role=info.role;touched.add(key);
 }
 const suggestions:RigSuggestion[]=[];
 for(const key of touched){
  const part=byKey.get(key)!,n=nodes.get(key)!,info=roleFor.get(key)!;
  let parent=parentOf(part,part.role,n,info.side);
  if(parent&&(parent.key===key||!canAttach(next,key,parent.key)))parent=undefined;
  if(parent&&part.parentKey===undefined)part.parentKey=parent.key;
  const g=geometry(part.role,n,parent&&nodes.get(parent.key),doc);
  part.pivot=g.pivot;part.joints=g.joints;
  suggestions.push({key,name:n.name,role:part.role,reason:info.reason,side:info.side,parentKey:part.parentKey,parentName:part.parentKey?nodes.get(part.parentKey)?.name:undefined,pivot:part.pivot,joints:part.joints,grip:part.role==='hand'?clamp(centre(n),doc):undefined});
 }
 // Molempien puolten käsiä/jalkoja ilman puolimerkintää ei arvata vasemmaksi tai oikeaksi.
 if(ofRole('arm').length>2)notes.push('Käsiä tunnistettiin yli kaksi: tarkista liitokset ja pivotit käsin.');
 if(unrecognized.length)notes.push(`${unrecognized.length} tasoa jäi ilman roolia, koska nimestä ei voi päätellä roolia. Valitse ne itse.`);
 for(const p of next.parts)if(touched.has(p.key))rigChainCheck(next,p.key);
 return {rig:next,suggestions,unrecognized,notes};
}
function rigChainCheck(rig:Rig,key:string){let part=rig.parts.find(p=>p.key===key);const seen=new Set<string>();while(part){if(seen.has(part.key))throw new Error('Ehdotettu liitos muodosti kehän.');seen.add(part.key);part=part.parentKey?rig.parts.find(p=>p.key===part!.parentKey):undefined;}}
