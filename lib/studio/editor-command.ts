import {flatten,type PsdDocument} from '../psd-model.ts';
import {readRig,validateRig,type Rig} from '../rig-model.ts';
import {readAnimation,validateAnimation,type Animation} from '../animation-model.ts';
type Prepared={doc:PsdDocument;rig:Rig;animation:Animation};
const cache=new WeakMap<PsdDocument,WeakMap<Rig,WeakMap<Animation,Prepared>>>();
function bucket(doc:PsdDocument,rig:Rig){let rigs=cache.get(doc);if(!rigs){rigs=new WeakMap();cache.set(doc,rigs);}let animations=rigs.get(rig);if(!animations){animations=new WeakMap();rigs.set(rig,animations);}return animations;}
/** Pure validated boundary for the existing editor document/rig/animation transaction. */
export function prepareEditorEdit(doc:PsdDocument,rig:Rig,animation:Animation){
 const nodes=flatten(doc.layers),paths=new Map(nodes.map(n=>[n.key,n.path]));
 const known=Object.isFrozen(rig)&&Object.isFrozen(animation)?bucket(doc,rig).get(animation):undefined;if(known&&rig.source.width===doc.width&&rig.source.height===doc.height&&rig.parts.length===nodes.filter(n=>n.kind==='layer').length&&rig.parts.every(p=>nodes.some(n=>n.key===p.key&&n.path===p.path&&n.psdId===p.psdId)))return known;
 const synced={...rig,parts:rig.parts.map(p=>paths.has(p.key)?{...p,path:paths.get(p.key)!}:p)};
 const validatedRig=validateRig(synced,doc),validatedAnimation=validateAnimation({...animation,rig:synced},doc);
 freezeJson(validatedRig);freezeJson(validatedAnimation);const result={doc,rig:validatedRig,animation:validatedAnimation};bucket(doc,validatedRig).set(validatedAnimation,result);return result;
}

function freezeJson(value:unknown){if(value&&typeof value==='object'&&!Object.isFrozen(value)){for(const child of Object.values(value))freezeJson(child);Object.freeze(value);}}
