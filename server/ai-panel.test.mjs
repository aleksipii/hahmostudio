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
const {AiPanelView}=await import('../components/ai-panel.tsx');const {aiStatusRows}=await import('../lib/ai-status.ts');

test('tekoälypaneeli: pilvirivi on vaiheessa 1 pelkkä "ei saatavilla" -teksti ilman painiketta',()=>{
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
 assert.match(readFileSync(new URL('components/editor.tsx',root),'utf8'),/case 'ai':setAiOpen\(true\)/);
});
