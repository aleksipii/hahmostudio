/**
 * Mittasuhteet ja sommittelu (vaihe D).
 *
 * - Hahmopaketin vertailukorkeus = pään yläreuna – jalkapohja (etunäkymä, lepoasento) ja hahmotyyppi
 *   (lapsi, aikuinen, robotti). Näyttämö skaalaa hahmot yhteiseen mittakaavaan: aikuinen 1,0, lapsi 0,72, robotti 0,9.
 * - Lattiaviiva taustoittain: jalkapohjat asetetaan lattiaviivalle.
 * - Kuvakoot rajataan silmälinjan mukaan: lähikuvassa silmät kolmanneksen korkeudelle, katseen suuntaan jää tilaa.
 * - 180 asteen sääntö: kahden hahmon kohtauksessa hahmojen puolet eivät vaihdu leikkauksissa.
 */
import {flatten,type PsdDocument} from './psd-model.ts';
import type {Rig} from './rig-model.ts';
import type {Binding,Presentation,Diagnostic} from './presentation-model.ts';
import {defaultSafeArea,type SafeArea} from './stage-bounds.ts';

export type CharacterKind='lapsi'|'aikuinen'|'robotti';
export const kindScale:Record<CharacterKind,number>={aikuinen:1,lapsi:.72,robotti:.9};
/** Hahmopakettien tyyppi QuickProfile.asset-tunnisteen mukaan; tuntematon = aikuinen. */
export const assetKinds:Record<string,CharacterKind>={
 'hahmostudio-pipsa-cutout-2d-v1':'lapsi','hahmostudio-pipsa-cutout-3d-v1':'lapsi','hahmostudio-ville-cutout-2d-v1':'lapsi','hahmostudio-ville-cutout-3d-v1':'lapsi',
 'hahmostudio-taru-cutout-2d-v1':'lapsi','hahmostudio-taru-cutout-3d-v1':'lapsi','hahmostudio-ukko-cutout-2d-v1':'aikuinen','hahmostudio-ukko-cutout-3d-v1':'aikuinen',
 'hahmostudio-otto-robot-v1':'robotti','hahmostudio-otto-multiview-v1':'robotti',
};
export function characterKind(doc:PsdDocument):CharacterKind{return assetKinds[doc.quick?.asset??'']??'aikuinen';}

export type CharacterMeasure={top:number;sole:number;height:number;eyeY:number;eyeX:number;hand:number;width:number};
/** Etunäkymän kerrosavaimet riggauksen liitosketjusta (tai undefined, jos riggausta ei ole dokumentissa). */
const frontCache=new WeakMap<object,Set<string>|undefined>();
function frontKeys(doc:PsdDocument,rig:Rig):Set<string>|undefined{if(frontCache.has(rig))return frontCache.get(rig);const q=doc.quick,root=(q?.views?.front??q?.roles)?.root;let out:Set<string>|undefined;if(root){const parent=new Map(rig.parts.map(p=>[p.key,p.parentKey]));out=new Set(rig.parts.filter(p=>{let k:string|undefined=p.key;for(let i=0;k&&i<64;i++){if(k===root)return true;k=parent.get(k);}return false;}).map(p=>p.key));}frontCache.set(rig,out);return out;}
const box=(doc:PsdDocument,key:string|undefined)=>key?flatten(doc.layers).find(l=>l.key===key&&l.width&&l.height):undefined;
/** Etunäkymän mitat dokumentin koordinaateissa (lepoasento). */
export function measureCharacter(doc:PsdDocument,rig?:Rig):CharacterMeasure{
 const q=doc.quick,r=q?.views?.front??q?.roles??{};
 const head=box(doc,r.head),feet=[box(doc,r.leftFoot),box(doc,r.rightFoot)].filter(Boolean) as NonNullable<ReturnType<typeof box>>[],legs=[box(doc,r.leftLeg),box(doc,r.rightLeg)].filter(Boolean) as NonNullable<ReturnType<typeof box>>[];
 const eyes=[box(doc,r.leftPupil),box(doc,r.rightPupil),box(doc,r.leftEye),box(doc,r.rightEye)].filter(Boolean) as NonNullable<ReturnType<typeof box>>[];
 // Etunäkymän kerrokset: osat, joiden liitosketju johtaa etunäkymän juureen (monikulmahahmon muut näkymät pois).
 const keys=rig?frontKeys(doc,rig):undefined,all=flatten(doc.layers).filter(l=>l.visible&&l.width&&l.height&&l.png&&(!keys||keys.has(l.key)));
 const top=Math.min(head?head.top:Infinity,...all.map(l=>l.top));
 const sole=feet.length?Math.max(...feet.map(f=>f.top+f.height)):legs.length?Math.max(...legs.map(f=>f.top+f.height)):Math.max(...all.map(l=>l.top+l.height),doc.height);
 const eyeY=eyes.length?eyes.reduce((s,e)=>s+e.top+e.height/2,0)/eyes.length:top+(sole-top)*.18,eyeX=eyes.length?eyes.reduce((s,e)=>s+e.left+e.width/2,0)/eyes.length:doc.width/2;
 const hand=box(doc,r.leftHand)??box(doc,r.rightHand),xs=[head,...feet].filter(Boolean).flatMap(b=>[b!.left,b!.left+b!.width]);
 return {top,sole,height:Math.max(1,sole-top),eyeY,eyeX,hand:hand?Math.max(hand.width,hand.height):(sole-top)*.07,width:xs.length?Math.max(...xs)-Math.min(...xs):doc.width};
}

/** Lattiaviiva (0–1 näyttämön korkeudesta), jolle jalkapohjat asetetaan. Tausta piirtää lattian tämän kohdalle. */
export const floorLines:Record<string,number>={
 'kitchen-scene-v1':.9,'office-scene-v1':.9,'meeting-scene-v1':.9,'home-office-scene-v1':.9,'hall-scene-v1':.9,'cafe-scene-v1':.9,'restaurant-scene-v1':.9,'classroom-scene-v1':.9,'library-scene-v1':.9,'service-scene-v1':.9,'garage-scene-v1':.9,
 'dark-studio-scene-v1':.9,'color-studio-scene-v1':.9,'white-studio-scene-v1':.88,'infographic-scene-v1':.88,
 'street-scene-v1':.74,'square-scene-v1':.86,'bus-stop-scene-v1':.88,'park-scene-v1':.86,'forest-scene-v1':.86,'beach-scene-v1':.86,'parking-scene-v1':.86,
};
export function floorLine(design:string|undefined){return design?floorLines[design]??.88:.88;}
/** Aikuisen vertailukorkeus näyttämöpikseleinä: nykyinen perusmittakaava × 700 dokumenttipikseliä. */
export function adultStageHeight(width:number,height:number,safe:SafeArea=defaultSafeArea){return Math.min(Math.min(width/1400,height/1100)*700,(height-safe.top-safe.bottom)*.86);}

/** Hahmon sijoitus: mittakaava tyypin mukaan, jalkapohjat lattiaviivalle. */
/**
 * Lattiaviiva näyttämöpikseleinä: taustan lattia, mutta aina turva-alueen sisällä (alareunan käyttöliittymäpeitot).
 * `overhang`: kiertyneiden raajakerrosten rajauslaatikon ylitys jalkapohjan alle (istuminen, kävely), jotta
 * näyttämön rajaus ei koskaan nosta jalkoja irti lattiasta.
 */
export function stageFloor(design:string|undefined,height:number,safe:SafeArea=defaultSafeArea,overhang=0){return Math.min(floorLine(design)*height,height-safe.bottom-4-overhang);}
/** Hahmon mittakaava ja lattiaviiva tällä näyttämöllä. */
export function characterFooting(doc:PsdDocument,width:number,height:number,design:string|undefined,safe:SafeArea=defaultSafeArea,rig?:Rig){const m=measureCharacter(doc,rig),scale=adultStageHeight(width,height,safe)*kindScale[characterKind(doc)]/m.height;return {m,scale,floor:stageFloor(design,height,safe,m.height*.08*scale)};}
export function composeBinding(b:Binding,doc:PsdDocument,width:number,height:number,design:string|undefined,x?:number,safe:SafeArea=defaultSafeArea,rig?:Rig):Pick<Binding,'x'|'y'|'scale'>{
 const {m,scale,floor}=characterFooting(doc,width,height,design,safe,rig);
 // Hahmo piirretään dokumentin keskipisteen ympärille: y = lattia − (jalkapohja − puolikorkeus)·mittakaava.
 return {x:x??b.x??width*(b.side==='left'?.28:.72),y:floor-(m.sole-doc.height/2)*scale,scale};
}

/** Kuvakoot: silmälinja ruudun korkeudesta ja zoom. Laaja kuva näyttää koko näyttämön. */
export const shotEyeLine={close:1/3,medium:.3,wide:undefined} as const;
/**
 * Kuvan ankkuri: silmäpiste (maailmassa) ja sen paikka ruudulla. Katseen suuntaan jätetään tilaa:
 * vasemmalla seisova (katsoo oikealle) sijoittuu ruudun vasempaan kolmannekseen ja päinvastoin.
 */
export function shotAnchor(size:'close'|'medium'|'wide',side:'left'|'right'|'center',looking:'left'|'right'|'camera'|undefined,width:number,height:number){
 const eye=size==='wide'?.46:shotEyeLine[size],dir=looking==='camera'?0:looking==='left'?-1:looking==='right'?1:side==='left'?1:side==='right'?-1:0;
 return {x:width*(.5-dir*(size==='close'?.12:size==='medium'?.1:0)),y:height*eye};
}

/** 180 asteen sääntö: hahmojen puolet eivät saa vaihtua kohtauksen sisällä eikä takakamera saa kääntää akselia. */
export function screenDirectionDiagnostics(p:Presentation):Diagnostic[]{
 const out:Diagnostic[]=[];if(p.characters.length<2)return out;
 for(const e of p.events.filter(e=>e.kind==='shot')){const cam=p.production?.cameras[e.id];if(cam&&(cam.view==='rear'||cam.view==='profile-left'||cam.view==='profile-right'))out.push({code:'axis-crossed',severity:'warning',event:e.id,message:`Rivi ${e.sourceRef.line}: kuvakulma ${cam.view==='rear'?'takaa':'sivulta'} ylittää 180 asteen akselin kahden hahmon kohtauksessa. Hahmojen puolet vaihtuvat katsojan silmissä.`});}
 for(const s of p.sections){const sides=new Map<string,string>();for(const e of p.events.filter(e=>e.section===s.id&&e.kind==='placement')){const old=sides.get(e.target);if(old&&old!==e.value)out.push({code:'axis-crossed',severity:'warning',event:e.id,message:`${e.target} vaihtaa puolta kohtauksen ${s.name} sisällä (${old} → ${e.value}). Lisää välikuva tai uusi kohtaus.`});sides.set(e.target,e.value);}}
 return out;
}
