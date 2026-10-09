import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildEpisode,catalogFromNames} from './episode-builder.ts';
import {CHARACTER_PACK_OPTIONS} from './speaker-pack-options.ts';
import {readProject,saveProject} from './project-file.ts';
import {renderToonCast} from './toon-render.ts';
import {buildToonAsset,toonProfiles,type ToonProfile} from './toon3d.ts';
import {validatePresentation} from './presentation-model.ts';
import {createScene} from './scene-model.ts';

async function fixture(){
 const source=await readProject(new Blob([readFileSync(new URL('../public/library/Pipsa.hahmo',import.meta.url))]));
 const assets={Pipsa:{doc:source.doc,animation:source.animation}};
 const result=buildEpisode('Resurssi hahmo MIRA: Pipsa\nINT. STUDIO\nMira odottaa 2 s.',{packs:catalogFromNames(CHARACTER_PACK_OPTIONS),assets});
 assert.deepEqual(result.diagnostics.filter(d=>d.severity==='error'),[]);
 result.presentation.production!.representations={MIRA:'toon3d'};
 return{source,assets,p:result.presentation};
}

function paints(p:Awaited<ReturnType<typeof fixture>>['p'],assets:Awaited<ReturnType<typeof fixture>>['assets']){
 const fills:string[]=[],strokes:{color:string;width:number}[]=[];
 const state:Record<string,unknown>={fillStyle:'',strokeStyle:'',lineWidth:1};
 const ctx=new Proxy(state,{
  get(target,key){if(key==='fill')return()=>fills.push(String(target.fillStyle));if(key==='stroke')return()=>strokes.push({color:String(target.strokeStyle),width:Number(target.lineWidth)});return key in target?target[String(key)]:()=>{};},
  set(target,key,value){target[String(key)]=value;return true;}
 }) as unknown as CanvasRenderingContext2D;
 renderToonCast(ctx,p,assets,0,1080,1920);
 return{fills,strokes};
}

test('flat toon rendering retains mesh colors and omits dark silhouette strokes in front and quarter views',async()=>{
 const {p,assets}=await fixture();
 const profile:ToonProfile={...toonProfiles[0],renderStyle:'flat'};
 p.production!.characterProfiles={MIRA:profile};
 const palette=new Set(buildToonAsset(profile).meshes.map(m=>m.color));
 for(const view of ['front','quarter-right'] as const){
  const shot=p.events.find(e=>e.kind==='shot');
  if(shot)p.production!.cameras[shot.id]={size:'wide',view,angle:'eye',motion:'still'};
  else p.events.unshift({id:'style-shot',kind:'shot',target:'MIRA',value:'wide',basis:'user',section:'intro',sourceRef:{line:1,text:'LAAJA KUVA'},at:0});
  if(!shot)p.production!.cameras['style-shot']={size:'wide',view,angle:'eye',motion:'still'};
  const rendered=paints(p,assets);
  assert.ok(rendered.fills.length>100);
  assert.ok(rendered.fills.every(c=>palette.has(c)),`mesh colors only in ${view}`);
  assert.ok(rendered.strokes.every(s=>palette.has(s.color)&&s.width===.5),`no silhouette in ${view}`);
 }
});

test('legacy profiles without a render style retain cel shades and silhouette; explicit cel uses profile width',async()=>{
 const {p,assets}=await fixture();
 assert.ok(paints(p,assets).strokes.some(s=>s.color==='#222a30'),'old scene without a stored profile');
 const legacy:ToonProfile={...toonProfiles[0],version:'1.0.0'};
 delete legacy.renderStyle;
 p.production!.characterProfiles={MIRA:legacy};
 const palette=new Set(buildToonAsset(legacy).meshes.map(m=>m.color)),old=paints(p,assets);
 assert.ok(old.fills.some(c=>!palette.has(c)),'legacy cel shading');
 assert.ok(old.strokes.some(s=>s.color==='#222a30'&&s.width===1.3),'legacy stroke width');
 p.production!.characterProfiles.MIRA={...legacy,renderStyle:'cel',outline:2.5};
 assert.ok(paints(p,assets).strokes.some(s=>s.color==='#222a30'&&s.width===2.5));
});

test('profile styles validate and survive a .hahmo roundtrip, while unsupported style is rejected',async()=>{
 const {source,p}=await fixture();
 for(const style of ['flat','cel',undefined] as const){
  p.production!.characterProfiles={MIRA:{...toonProfiles[0],renderStyle:style}};
  const validated=validatePresentation(p);
  // A draft intentionally allows missing cast resources; no user assets are changed.
  const scene={...createScene(source.doc),presentationDraft:validated};
  const restored=await readProject(await saveProject(source.doc,source.animation,undefined,scene));
  assert.equal(restored.scene.presentationDraft!.production!.characterProfiles!.MIRA.renderStyle,style);
 }
 p.production!.characterProfiles!.MIRA.renderStyle='photoreal' as ToonProfile['renderStyle'];
 assert.throws(()=>validatePresentation(p),/resurssiprofiili/);
});
