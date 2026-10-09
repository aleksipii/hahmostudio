// Tekoäly-paneelin merkintä Nodessa ilman selainta (vaihe 1).
import test from 'node:test';import assert from 'node:assert/strict';import {registerHooks} from 'node:module';import {readFileSync,existsSync} from 'node:fs';import {fileURLToPath} from 'node:url';import ts from 'typescript';import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';
const root=new URL('../',import.meta.url);
registerHooks({
 resolve(specifier,context,next){
  if(specifier.startsWith('.')&&context.parentURL?.startsWith(root.href)&&!context.parentURL.includes('/node_modules/')){for(const suffix of ['','.ts','.tsx']){const url=new URL(specifier,context.parentURL).href+suffix;if(existsSync(fileURLToPath(url))&&!url.endsWith('/'))return {url,shortCircuit:true};}}
  return next(specifier,context);
 },
 load(url,context,next){if(url.startsWith(root.href)&&!url.includes('/node_modules/')&&/\.tsx?$/.test(url)){
  const source=readFileSync(fileURLToPath(url),'utf8').replaceAll('import.meta.env',"({BASE_URL:'/',VITE_PRIVATE_SERVER:'true'})");
  return {format:'module',source:ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText,shortCircuit:true};
 }return next(url,context);}
});
const {AiPanelView,CloudControls}=await import('../components/ai-panel.tsx');const {aiStatusRows}=await import('../lib/ai-status.ts');

test('tekoälypaneeli: ei saatavilla oleva pilvi on pelkkä "ei saatavilla" -teksti ilman painiketta',()=>{
 const html=renderToStaticMarkup(React.createElement(AiPanelView,{loading:false,rows:aiStatusRows({audioModel:{model:false,binary:true},kokoro:{installed:true},camera:'granted',cloud:{available:false}})}));
 assert.ok(!html.includes('<button'),'paneelin sisällössä ei ole toimintopainikkeita');
 const cloud=html.slice(html.indexOf('data-ai-feature="cloud-render"'));
 assert.match(cloud,/Ei saatavilla/);assert.match(cloud,/estetty/);assert.match(cloud,/Pois · ei käytössä/);
 for(const label of ['Missä','Lupa','Mitä dataa lähtee ja minne','Kustannus','Viimeisin tulos'])assert.ok(html.includes(label),label);
 assert.match(html,/Litterointi \(whisper\.cpp\).*?Pois · ei käytössä/s);
 assert.match(html,/Englanninkielinen puhe \(Kokoro\).*?Paikallinen</s);
 assert.match(html,/sääntöpohjainen, ei tekoälyä/);
});
test('työpöydän Näytä-valikko avaa Tekoäly-paneelin ja editori käsittelee toiminnon',()=>{
 assert.match(readFileSync(new URL('desktop/main.mjs',root),'utf8'),/\{label:'Tekoäly…',click:\(\)=>action\('ai'\)\}/);
 assert.match(readFileSync(new URL('components/editor.tsx',root),'utf8'),/case 'ai':openAi\(\)/);
});

const status=(o={})=>({available:true,enabled:false,running:false,storage:null,modelPins:false,settings:{enabled:false,colabClassifiedFree:false,notebookClassifiedFree:false},jobs:[],policy:{mode:'zero-cost',allowPaidCompute:false,maxCostEur:0,allowPaidFallback:false,allowUnknownCost:false,allowedBackendClasses:['free']},secrets:{encryption:true,keys:{HAHMOSTUDIO_COLAB_COMFYUI_URL:{label:'ComfyUI-tunnelin osoite',set:true},HAHMOSTUDIO_COMFYUI_BEARER:{label:'ComfyUI-välityspalvelimen tunnus',set:false}}},...o});
test('pilven asetukset: pois päältä vain käyttöönottopainike; päällä todelliset toiminnot ilman arvoja',()=>{
 assert.equal(renderToStaticMarkup(React.createElement(CloudControls,{status:{...status(),available:false},busy:false,act:()=>{}})),'');
 const off=renderToStaticMarkup(React.createElement(CloudControls,{status:status(),busy:false,act:()=>{}}));
 assert.deepEqual([...off.matchAll(/<button[^>]*>([^<]*)<\/button>/g)].map(m=>m[1]),['Ota pilvirenderöinti käyttöön…']);
 const on=renderToStaticMarkup(React.createElement(CloudControls,{status:status({enabled:true}),busy:false,act:()=>{},onOpenCloud:()=>{}}));
 assert.match(on,/ComfyUI-tunnelin osoite: asetettu/);assert.match(on,/ComfyUI-välityspalvelimen tunnus: ei asetettu/);assert.match(on,/ei tuotu; renderöinti on estetty ilman lukittua mallia/);
 for(const label of ['Liitä tunnelin osoite leikepöydältä…','Tuo asetustiedosto…','Vahvista Kaggle-muistikirja ilmaiseksi…','Tuo mallien lukitus…','Avaa pilvirenderöinti…','Poista pilvirenderöinti käytöstä'])assert.ok(on.includes(label),label);
 assert.ok(!/https:\/\//.test(on),'ei osoitteita näkyvissä');
 const noKeychain=renderToStaticMarkup(React.createElement(CloudControls,{status:status({enabled:true,secrets:{encryption:false,keys:{}}}),busy:false,act:()=>{}}));
 assert.match(noKeychain,/<button type="button" class="secondary" disabled="">Liitä tunnelin osoite/);
});

test('Tekoäly-paneeli löytyy sovelluksen omasta Näytä-valikosta ja toimintohausta, ei vain macOS:n valikkoriviltä',async()=>{
 const {readFile}=await import('node:fs/promises');
 const editor=await readFile(new URL('../components/editor.tsx',import.meta.url),'utf8');
 assert.match(editor,/extra=\{<><button className="secondary" onClick=\{openAi\}>Tekoäly…<\/button>/);
 assert.match(editor,/\{id:'ai',group:'Näkymä',label:'Tekoäly: tilat ja pilvirenderöinti…'[^}]*run:openAi\}/);
});
test('V7: alapalkin Tekoäly-painike ja Vie tekoälyrenderöitynä avaavat olemassa olevat ikkunat',()=>{
 const editor=readFileSync(new URL('components/editor.tsx',root),'utf8'),exporter=readFileSync(new URL('components/export-panel.tsx',root),'utf8');
 assert.match(editor,/className="text-button ai-chip"[^>]*onClick=\{openAi\}>\{aiChipLabel\(aiCloud\)\}/);
 assert.match(editor,/id:'cloud-export',group:'Vienti',label:'Vie tekoälyrenderöitynä…'[^}]*run:\(\)=>setCloudRender\(true\)/);
 assert.match(editor,/cloud=\{bridge\?\(\)=>setCloudRender\(true\):undefined\}/);
 assert.match(exporter,/\{cloud&&<p className="export-cloud"><button[^>]*onClick=\{\(\)=>\{setOpen\(false\);cloud\(\);\}\}>Vie tekoälyrenderöitynä…<\/button>/);
});
test('V7: Tekoäly on Tarkastelijan välilehti, kun oikea paneeli on näyttämön vieressä; muuten sama sisältö dialogina',()=>{
 const editor=readFileSync(new URL('components/editor.tsx',root),'utf8'),panel=readFileSync(new URL('components/ai-panel.tsx',root),'utf8');
 // Kolme sisäänkäyntiä (Näkymä-valikko, ⌘K, alapalkki) ja työpöydän valikko kulkevat saman funktion kautta.
 assert.equal([...editor.matchAll(/setAiOpen\(true\)/g)].length,1,'dialogi avataan vain openAi-funktiosta');
 assert.match(editor,/const aiInTab=inspectorBeside&&inspectorOn,aiTabOpen=inspectorOn&&inspector==='ai';/);
 assert.match(editor,/const openAi=\(\)=>\{if\(!aiInTab\)\{setAiOpen\(true\);return;\}setInspector\('ai'\);setAiFocus\(n=>n\+1\);\};/);
 assert.match(editor,/matchMedia\('\(min-width: 851px\)'\)/,'raja vastaa koeta-responsive.css:n 850 px:n asettelua');
 // Välilehti on kaikissa työtiloissa; sisältö mountataan vain auki ollessa (tilat luetaan vasta silloin), isäntä pysyy DOMissa.
 assert.match(editor,/\['ai','Tekoäly'\]\] as const\)\.filter\(\(\[id\]\)=>id==='ai'\|\|/);
 assert.match(editor,/<div hidden=\{!aiTabOpen\} className="inspector-section ai-inspector-dock">\{aiTabOpen&&<AiInspectorTab focusKey=\{aiFocus\} onOpenCloud=\{\(\)=>setCloudRender\(true\)\}\/>\}<\/div>/);
 // Tuotannon ja piirron ominaisuusisännät piilotetaan välilehden ajaksi, mutta niiden portaalisisältö pysyy mounted.
 assert.match(editor,/ref=\{setProductionInspector\} hidden=\{[^}]*\|\|inspector==='ai'\}/);
 assert.match(editor,/ref=\{setDrawingTarget\} hidden=\{[^}]*\|\|inspector==='ai'\}/);
 // Alapalkin pilvitila luetaan uudelleen, kun dialogi tai välilehti sulkeutuu.
 assert.match(editor,/if\(!bridge\|\|aiOpen\|\|aiTabOpen\)return;[^\n]*\},\[aiOpen,aiTabOpen\]\);/);
 // Dialogi ja välilehti käyttävät samaa sisältöä; pilvitoiminnot ovat vain AiContentissa.
 assert.equal([...panel.matchAll(/<AiContent onOpenCloud=\{onOpenCloud\}\/>/g)].length,2);
 assert.equal([...panel.matchAll(/bridge\.cloudEnable\(\)/g)].length,1);
 assert.match(panel,/role="dialog" aria-modal="true" aria-labelledby="ai-title"/);
 assert.match(panel,/if\(e\.key==='Escape'\)/);
 assert.match(readFileSync(new URL('main.tsx',root),'utf8'),/import '\.\/styles\/minimal-tekoaly\.css';\nif\(location/);
});
test('V7: Tekoäly-välilehden sisältö renderöityy ilman siltaa (web): tilat lataamassa, ei pilvipainikkeita',async()=>{
 const {AiInspectorTab}=await import('../components/ai-panel.tsx');
 const html=renderToStaticMarkup(React.createElement(AiInspectorTab,{focusKey:0}));
 assert.match(html,/^<section tabindex="-1" class="ai-inspector" aria-labelledby="ai-inspector-title"><h2 id="ai-inspector-title">Tekoäly<\/h2><div class="ai-status" aria-busy="true">/);
 assert.match(html,/Luetaan tiloja…/);
 assert.ok(!html.includes('<button'),'ennen tilojen lukua ei näytetä toimintoja');
});
