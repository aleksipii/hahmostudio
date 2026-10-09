import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {applyExpertMode,readExpertMode,writeExpertMode,EXPERT_MODE_KEY} from './expert-mode.ts';

const memory=()=>{const m=new Map<string,string>();return{getItem:(k:string)=>m.get(k)??null,setItem:(k:string,v:string)=>{m.set(k,v);}};};

test('asiantuntijatila on oletuksena pois ja tallentuu näkymäasetuksena',()=>{
 const s=memory();
 assert.equal(readExpertMode(s),false);
 writeExpertMode(true,s);assert.equal(s.getItem(EXPERT_MODE_KEY),'on');assert.equal(readExpertMode(s),true);
 writeExpertMode(false,s);assert.equal(readExpertMode(s),false);
 assert.equal(readExpertMode(null),false);
 const broken={getItem:()=>{throw Error('estetty');},setItem:()=>{throw Error('estetty');}};
 assert.equal(readExpertMode(broken),false);assert.doesNotThrow(()=>writeExpertMode(true,broken));
});

test('juurielementin data-expert seuraa valintaa',()=>{
 const root={dataset:{} as Record<string,string|undefined>};
 applyExpertMode(false,root);assert.equal(root.dataset.expert,'off');
 applyExpertMode(true,root);assert.equal(root.dataset.expert,'on');
});

test('tekniset yksityiskohdat piilotetaan vain tyylillä, eivät poistu näkymästä',()=>{
 const css=readFileSync(new URL('../styles/koeta-minimal.css',import.meta.url),'utf8');
 assert.match(css,/:root:not\(\[data-expert="on"\]\) \.expert-detail\s*\{\s*display:\s*none/);
 for(const file of ['revision-panel.tsx','export-panel.tsx','production-resources-panel.tsx'])
  assert.match(readFileSync(new URL('../components/'+file,import.meta.url),'utf8'),/className="expert-detail"/,file);
});
