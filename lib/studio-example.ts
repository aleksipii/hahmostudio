import {parsePresentation} from './presentation-parser.ts';
import {appendPresentation} from './presentation-append.ts';
import type {PresentationAssets} from './presentation-compile.ts';
import {functions} from './presentation-model.ts';
import type {Scene} from './scene-model.ts';
/** The Try button uses the real compiler, cast bindings and renderer, not a separate mock animation. */
export const studioExampleScript=`#!kilsat
Hahmo: Pipsa
Hahmo: Ville
Kohtaus: Tervetuloa studioon
Tausta: studio 0.5 s
Kamera: laaja 0.5 s
Pipsa vilkuttaa 2 s
Samalla: Ville nyökkää 2 s
Kamera: lähikuva Pipsa 1 s
Pipsa nyökkää 1 s
Kamera: laaja 1 s
Ville vilkuttaa 2 s
Odota 1 s`;
export function buildStudioExample(assets:PresentationAssets,settings:Scene){
 const first=assets.pipsa,second=assets.ville;if(!first?.doc.quick||!second?.doc.quick)throw Error('Esimerkin hahmopaketit puuttuvat.');
 const p=parsePresentation(studioExampleScript);p.metadata.title='Tervetuloa studioon';p.metadata.series='KILSAT';
 p.bindings=p.characters.map((speaker,index)=>({speaker,asset:index?'ville':'pipsa',voice:'Ei repliikkejä tässä liike-esimerkissä',side:index?'right':'left',functions:Object.fromEntries(functions.map(f=>[f,f==='show_phone'?'none':'supported']))}));
 // Normalize the large PSD canvas into a two-person composition using explicit user-editable placements.
 const scene:Scene={...settings,width:1080,height:1920,x:540,y:960,scale:.9,design:'studio-v1',presentations:undefined,presentationDraft:undefined,presentationSource:studioExampleScript};
 p.world={...p.world,width:1080,height:1920};p.bindings=p.bindings.map((b,index)=>({...b,x:index?780:300,y:1050,scale:.65}));
 const a={...first.animation,fps:24,duration:2,tracks:[]};const built=appendPresentation(a,scene,p,assets,true);
 return{...built,doc:{...first.doc,presentationAssets:assets},assets};
}
