import {renderLayers} from './psd-render';
import {placement,type Scene} from './scene-model';
import type {PsdDocument} from './psd-model';
import type {Animation,Pose} from './animation-model';
export function renderScene(canvas:HTMLCanvasElement,scratch:HTMLCanvasElement,doc:PsdDocument,animation:Animation,frame:number,scene:Scene,draft?:{key:string;pose:Pose;poses?:Record<string,Pose>}){
 renderLayers(scratch,doc,undefined,animation,frame,draft);canvas.width=scene.width;canvas.height=scene.height;const ctx=canvas.getContext('2d')!;ctx.fillStyle=scene.background;ctx.fillRect(0,0,scene.width,scene.height);const r=placement(scene,doc);ctx.drawImage(scratch,r.x,r.y,r.width,r.height);
}
