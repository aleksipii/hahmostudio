import type {Scene} from './scene-model.ts';
/** Changes exported content size, independently of the editor preview zoom. */
export function resizeSceneContent(scene:Scene,factor:number):Scene {
 if(!Number.isFinite(factor)||factor<=0)throw Error('Koon muutoksen pitää olla positiivinen.');
 const size=(scale:number)=>Math.max(.001,Math.min(100,scale*factor));
 const production=(p:NonNullable<Scene['presentationDraft']>)=>({...p,bindings:p.bindings.map(b=>({...b,scale:size(b.scale??Math.min(p.world.width/1400,p.world.height/1100))}))});
 return {...scene,scale:size(scene.scale),...(scene.presentations?{presentations:scene.presentations.map(production)}:{}),...(scene.presentationDraft?{presentationDraft:production(scene.presentationDraft)}:{})};
}
