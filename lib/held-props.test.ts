import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {readProject} from './project-file.ts';
import {flatten} from './psd-model.ts';
import {buildEpisode,catalogFromNames} from './episode-builder.ts';
import {CHARACTER_PACK_OPTIONS} from './speaker-pack-options.ts';
import {renderPresentation} from './presentation-render.ts';
import {stageState} from './presentation-stage.ts';
import {viewAtFrame} from './character-view.ts';
import {heldProp,handGrip,heldPropPlacement,heldProps,heldPropSvg,propViewFor,type Hand} from './held-props.ts';
import {readQuick} from './quick-animation.ts';

type M=[number,number,number,number,number,number];
const mul=(p:M,q:M):M=>[p[0]*q[0]+p[2]*q[1],p[1]*q[0]+p[3]*q[1],p[0]*q[2]+p[2]*q[3],p[1]*q[2]+p[3]*q[3],p[0]*q[4]+p[2]*q[5]+p[4],p[1]*q[4]+p[3]*q[5]+p[5]];
const apply=(m:M,x:number,y:number)=>({x:m[0]*x+m[2]*y+m[4],y:m[1]*x+m[3]*y+m[5]});
/** Mallikonteksti: seuraa muunnospinoa ja kirjaa piirrot nykyisen muunnoksen kanssa. */
function mockCanvas(width:number,height:number){
 let m:M=[1,0,0,1,0,0];const stack:M[]=[];const draws:{op:string;args:unknown[];m:M;fill:string}[]=[];let fill='';
 const ctx:Record<string,unknown>={
  save:()=>stack.push(m),restore:()=>{m=stack.pop()??[1,0,0,1,0,0];},
  translate:(x:number,y:number)=>{m=mul(m,[1,0,0,1,x,y]);},scale:(x:number,y:number)=>{m=mul(m,[x,0,0,y,0,0]);},
  rotate:(a:number)=>{m=mul(m,[Math.cos(a),Math.sin(a),-Math.sin(a),Math.cos(a),0,0]);},
  transform:(a:number,b:number,c:number,d:number,e:number,f:number)=>{m=mul(m,[a,b,c,d,e,f]);},
  setTransform:(a:number|{a:number;b:number;c:number;d:number;e:number;f:number},b?:number,c?:number,d?:number,e?:number,f?:number)=>{m=typeof a==='object'?[a.a,a.b,a.c,a.d,a.e,a.f]:[a,b!,c!,d!,e!,f!];},
  getTransform:()=>({a:m[0],b:m[1],c:m[2],d:m[3],e:m[4],f:m[5]}),
  drawImage:(...args:unknown[])=>draws.push({op:'image',args,m,fill}),fillRect:(...args:unknown[])=>draws.push({op:'rect',args,m,fill}),ellipse:(...args:unknown[])=>draws.push({op:'ellipse',args,m,fill}),
  measureText:()=>({width:10}),createLinearGradient:()=>({addColorStop:()=>{}}),createRadialGradient:()=>({addColorStop:()=>{}}),
 };
 const proxy=new Proxy(ctx,{get:(t,k)=>k in t?t[k as string]:k==='canvas'?{width,height}:()=>{},set:(t,k,v)=>{if(k==='fillStyle')fill=String(v);t[k as string]=v;return true;}});
 return {canvas:{width,height,getContext:()=>proxy} as unknown as HTMLCanvasElement,draws,reset:()=>{draws.length=0;m=[1,0,0,1,0,0];stack.length=0;}};
}
async function pack(name:string){const r=await readProject(new Blob([readFileSync(new URL(`../public/library/${name}.hahmo`,import.meta.url))]));for(const n of flatten(r.doc.layers))(n as {image?:unknown}).image={fake:n.key,pack:name};return {doc:r.doc,animation:r.animation};}
const script=`Resurssi hahmo MIRA: Pipsa-3D
Resurssi hahmo NIKO: Ville-3D
Resurssi esine: pöytä
INT. KEITTIÖ
Mira seisoo puhelin kädessä.
Niko pitää kahvikuppia.
Mira kävelee oikealle 2 s.
Mira näyttää Nikolle puhelinta.
Niko kävelee vasemmalle 2 s.
Niko kävelee suoraan 2 s.
Mira siirtää puhelimen toiseen käteen.
Niko ottaa kirjan vasempaan käteen.
Mira laskee puhelimen pöydälle.
Niko laskee kupin pöydälle.
Mira vilkuttaa.`;

test('esine pysyy kädessä joka ruudussa kaikissa kuvakulmissa: tartuntapisteiden etäisyys < 0,5 px (piirtopolun kautta)',async()=>{
 const assets={'Pipsa-3D':await pack('Pipsa-3D'),'Ville-3D':await pack('Ville-3D')};
 const b=buildEpisode(script,{packs:catalogFromNames(CHARACTER_PACK_OPTIONS),assets},{fps:24,width:1080,height:1920});const p=b.presentation;
 assert.deepEqual(b.diagnostics.filter(d=>d.severity==='error').map(d=>d.message),[]);
 const values=p.events.filter(e=>e.kind==='prop'||e.value.startsWith('phone')).map(e=>e.target+' '+e.value);
 for(const v of ['MIRA phone-on','NIKO hold:mug-prop-v1','MIRA phone_transfer','NIKO hold:book-prop-v1','MIRA phone_down','NIKO drop:mug-prop-v1'])assert.ok(values.includes(v),v+' / '+values.join(', '));
 const {canvas,draws,reset}=mockCanvas(1080,1920);const scratch=mockCanvas(1,1).canvas;
 const views=new Set<string>(),hands=new Set<string>();let checks=0,worst=0,released=0;const releasedAt:Record<string,string>={};
 const frames=Math.ceil(p.seconds*24);
 for(let frame=0;frame<=frames;frame++){const time=frame/24;reset();renderPresentation(canvas,scratch,p,assets,time,1080,1920);const world=stageState(p,time);
  for(const binding of p.bindings){const asset=assets[binding.asset as keyof typeof assets],a=p.actorAnimations![binding.speaker],f=Math.max(0,Math.min(a.duration-1,time*a.fps)),view=viewAtFrame(asset.doc.quick!,a,f);
   const items:{id:string;hand:Hand;releasedAt?:number}[]=[...(world.phone.enabled&&world.phone.carrier===binding.speaker?[{id:'phone-v1',hand:world.phone.hand,releasedAt:world.phone.releasedAt}]:[]),...world.held.filter(h=>h.carrier===binding.speaker)];
   for(const item of items){const spec=heldProp(item.id)!,placement=heldPropPlacement(asset.doc,a,item.releasedAt===undefined?f:Math.max(0,Math.min(a.duration-1,item.releasedAt*a.fps)),item.hand,spec)!;
    const first=spec.views[placement.view][0],shape=first.rect??first.ellipse!,op=first.rect?'rect':'ellipse';
    const drawn=draws.filter(d=>d.op===op&&d.fill===first.fill&&(d.args as number[]).slice(0,4).every((v,i)=>v===shape[i]));
    const scaleOf=(m:M)=>Math.hypot(m[0],m[1])/placement.width;
    if(item.releasedAt!==undefined){assert.ok(drawn.length>=1,'laskettu esine piirretään');const key=item.id+binding.speaker,pos=JSON.stringify(drawn.at(-1)!.m.map(v=>v.toFixed(3)));releasedAt[key]??=pos;assert.equal(pos,releasedAt[key],'laskettu esine pysyy paikallaan');released++;continue;}
    const layer=flatten(asset.doc.layers).find(l=>l.key===placement.handKey)!,handDraw=draws.find(d=>d.op==='image'&&(d.args[0] as {fake:string;pack:string}).fake===layer.key&&(d.args[0] as {pack:string}).pack===binding.asset);
    assert.ok(handDraw,'käsikerros piirretään');assert.ok(drawn.length>=1,spec.name+' piirretään ruudussa '+frame);
    const propM=drawn.find(d=>draws.indexOf(d)<draws.indexOf(handDraw!))?.m;assert.ok(propM,'esine piirretään käsikerroksen alle (sormet päälle)');
    const grip=handGrip(asset.doc,view,item.hand)!,hc=apply(handDraw!.m,grip.x,grip.y),pc=apply(propM!,spec.grip.x,spec.grip.y);
    const dist=Math.hypot(hc.x-pc.x,hc.y-pc.y)/scaleOf(propM!);worst=Math.max(worst,dist);checks++;views.add(view);hands.add(item.hand);
    assert.ok(dist<.5,`${binding.speaker} ${spec.name} ruutu ${frame} (${view}): ${dist.toFixed(4)} px`);
   }}
 }
 assert.ok(checks>frames,'tarkistuksia '+checks);assert.ok(views.has('front')&&(views.has('left')||views.has('right')),[...views].join());
 assert.ok(hands.has('leftHand')&&hands.has('rightHand'));assert.ok(released>0);assert.ok(worst<1e-6,'suurin poikkeama '+worst);
});

test('esinekirjasto: kaikki 17 käsiesinettä kolmena näkymänä; vanhat profiilit ilman grips-kenttää kelpaavat',async()=>{
 assert.deepEqual(heldProps.map(h=>h.name),['Puhelin','Kahvikuppi','Kirja','Laukku','Sateenvarjo','Tabletti','Avaimet','Juomapullo','Kynä','Paperi','Kansio','Kirje','Jäätelö','Kukka','Mikrofoni','Taskulamppu','Pallo']);
 for(const h of heldProps)for(const v of ['front','side','back'] as const){assert.ok(h.views[v].length>0);assert.match(heldPropSvg(h.id,v),/^<svg/);}
 assert.equal(propViewFor('left'),'side');assert.equal(propViewFor('back'),'back');
 const roni=await pack('Pipsa-3D');const q=readQuick(roni.doc.quick,roni.animation.rig)!;assert.equal(q.grips,undefined);
 const withGrips={...roni.doc.quick!,grips:{front:{leftHand:{x:10,y:20,angle:15}}}};assert.deepEqual(readQuick(withGrips,roni.animation.rig)!.grips,withGrips.grips);
 assert.throws(()=>readQuick({...roni.doc.quick!,grips:{front:{leftHand:{x:Number.NaN,y:0,angle:0}}}},roni.animation.rig),/tartuntapisteet/);
 assert.deepEqual(handGrip({...roni.doc,quick:withGrips},'front','leftHand'),{x:10,y:20,angle:15});
});
