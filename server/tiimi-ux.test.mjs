// Tekoäly-paneelin merkintä Nodessa ilman selainta (vaihe 1).
import test from 'node:test';import assert from 'node:assert/strict';import {registerHooks} from 'node:module';import {readFileSync,existsSync} from 'node:fs';import {fileURLToPath} from 'node:url';import ts from 'typescript';import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';
const root=new URL('../',import.meta.url);
registerHooks({
 resolve(specifier,context,next){
  if(specifier.startsWith('.')&&context.parentURL?.startsWith(root.href)&&!context.parentURL.includes('/node_modules/')){for(const suffix of ['','.ts','.tsx']){const url=new URL(specifier,context.parentURL).href+suffix;if(existsSync(fileURLToPath(url))&&!url.endsWith('/'))return {url,shortCircuit:true};}}
  return next(specifier,context);
 },
 load(url,context,next){if(url.startsWith(root.href)&&!url.includes('/node_modules/')&&/\.tsx?$/.test(url)){
  let source=readFileSync(fileURLToPath(url),'utf8').replaceAll('import.meta.env',"({BASE_URL:'/',VITE_PRIVATE_SERVER:'true'})");
  if(url.endsWith('/components/production-board.tsx'))source=source.replace("useState('shots')","useState('cast')");
  return {format:'module',source:ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText,shortCircuit:true};
 }return next(url,context);}
});
const {AiPanelView}=await import('../components/ai-panel.tsx');
const {default:ProductionBoard}=await import('../components/production-board.tsx');

test('AI-paneeli ilmoittaa keskeneräisen tilalatauksen ja valmistumisen saavutettavasti',()=>{
 const loading=renderToStaticMarkup(React.createElement(AiPanelView,{rows:[],loading:true}));
 assert.match(loading,/aria-busy="true"/);
 assert.match(loading,/role="status">Luetaan tiloja…/);
 const ready=renderToStaticMarkup(React.createElement(AiPanelView,{rows:[],loading:false}));
 assert.match(ready,/aria-busy="false"/);
 assert.ok(!ready.includes('Luetaan tiloja…'));
});

// SSR-fixture valitsee Hahmot-välilehden loaderissa; tuotantokoodin oletus pysyy Kuvakorteissa.
test('Hahmot-välilehti estää koko hahmokentän muokkauksen disabled-tilassa',()=>{
 const model={events:[],characters:['Pipsa'],bindings:[{speaker:'Pipsa',asset:'pipsa'}],
  production:{scriptRevision:1,diff:{removed:[]},representations:{},characterProfiles:{}}};
 const props={model,compiled:model,assets:{},frame:0,fps:30,seek:()=>{},change:()=>{}};
 const disabled=renderToStaticMarkup(React.createElement(ProductionBoard,{...props,disabled:true}));
 assert.match(disabled,/<fieldset disabled=""><legend>Pipsa<\/legend>/);
 assert.match(disabled,/<select[^>]*><option value="2d" selected="">Alkuperäinen 2D/);
 assert.match(disabled,/<option value="toon3d" disabled="">3D-vastaavuus puuttuu/);
 const enabled=renderToStaticMarkup(React.createElement(ProductionBoard,{...props,disabled:false}));
 assert.match(enabled,/<fieldset><legend>Pipsa<\/legend>/);
});

test('3D-tyylivalinta näkyy vain 3D-esitystavassa ja säilyttää legacy cel -oletuksen',()=>{
 const profile={coat:'#123456',trousers:'#123456',shoes:'#123456',hair:'#123456',skin:'#123456'};
 const model={events:[],characters:['Pipsa'],bindings:[{speaker:'Pipsa',asset:'pipsa'}],
  production:{scriptRevision:1,diff:{removed:[]},representations:{Pipsa:'toon3d'},characterProfiles:{Pipsa:profile}}};
 const props={model,compiled:model,assets:{},frame:0,fps:30,seek:()=>{},change:()=>{},disabled:true};
 const legacy=renderToStaticMarkup(React.createElement(ProductionBoard,props));
 assert.match(legacy,/3D-hahmon tyyli<select disabled="">/);
 assert.match(legacy,/<option value="cel" selected="">/);
 const flat={...model,production:{...model.production,characterProfiles:{Pipsa:{...profile,renderStyle:'flat'}}}};
 assert.match(renderToStaticMarkup(React.createElement(ProductionBoard,{...props,model:flat})),/<option value="flat" selected="">/);
 const twoD={...model,production:{...model.production,representations:{Pipsa:'2d'}}};
 assert.ok(!renderToStaticMarkup(React.createElement(ProductionBoard,{...props,model:twoD})).includes('3D-hahmon tyyli'));
});
