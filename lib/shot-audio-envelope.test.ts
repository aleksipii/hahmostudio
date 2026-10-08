import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildStudioExample} from './studio-example.ts';
import {createScene} from './scene-model.ts';
import {readProject} from './project-file.ts';
import {adaptPresentation,ticks,type Shot} from './studio/domain.ts';
import type {Presentation} from './presentation-model.ts';
import {shotWaveformRail} from './shot-audio-envelope.ts';

test('decoded envelope peaks align with scheduled dialogue inside a shot',()=>{
 const waveform=[0,0,.8,.9,.7,0,0];
 const env=new Map([['voice',{waveform,duration:7}]]);
 const p={schemaVersion:1 as const,id:'t',original:'',metadata:{series:'',season:1,episode:1,title:'',target:60,purpose:'',environment:''},characters:['A'],assets:[],world:{width:1080,height:1920,background:'white',phone:{enabled:false,model:'phone-v1' as const,carrier:'A',hand:'rightHand' as const,view:'front' as const}},sections:[],events:[{id:'d',kind:'dialogue' as const,target:'A',section:'s',sourceRef:{line:1,text:''},at:1,value:'',basis:'user' as const}],comments:[],bindings:[],audioClips:[{id:'c',dialogue:'d',asset:'voice',start:0,end:7,duration:7,mouth:[],source:'volume' as const}],diagnostics:[],seconds:10,natural:true,source:'script' as const} satisfies Presentation;
 const shot:Shot={id:'s1',sourceEventId:'cut',sceneId:'sc',name:'Kuva 001',at:ticks(0),duration:ticks(5),revision:1,status:'draft',eventIds:['d'],characterIds:['A'],audioStatus:'ready',errors:[]};
 const rail=shotWaveformRail(p,shot,env,12);
 assert.equal(rail.decoded,true);
 assert.ok(rail.levels.some(v=>v>.5));
 assert.equal(rail.hasDialogue,true);
});

test('studio example without voice blobs keeps timing fallback rail',async()=>{
 const load=async(name:string)=>readProject(new Blob([readFileSync(new URL('../public/library/'+name+'.hahmo',import.meta.url))]));
 const [kille,handu]=await Promise.all([load('Pipsa'),load('Ville')]);
 const built=buildStudioExample({pipsa:{doc:kille.doc,animation:kille.animation},ville:{doc:handu.doc,animation:handu.animation}},createScene({width:1080,height:1920}));
 const p=built.scene.presentations![0],shot=adaptPresentation(p).shots[0];
 const rail=shotWaveformRail(p,shot,new Map(),12);
 assert.equal(rail.decoded,false);
 assert.equal(rail.hasDialogue,false);
});
