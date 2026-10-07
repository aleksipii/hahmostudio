import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {readProject} from './project-file.ts';
import {buildEpisode,catalogFromNames} from './episode-builder.ts';
import {CHARACTER_PACK_OPTIONS} from './speaker-pack-options.ts';
import {measureCharacter,characterKind,floorLine,characterFooting,kindScale,screenDirectionDiagnostics,shotEyeLine,adultStageHeight} from './stage-composition.ts';
import {stageActor} from './presentation-stage.ts';
import {cameraTransform,boundedPresentation} from './stage-production.ts';
import {footPoint} from './motion-quality.ts';
import {heldProp,heldPropPlacement,handSize} from './held-props.ts';
import {initProduction} from './production-model.ts';

const cache=new Map<string,{doc:Awaited<ReturnType<typeof readProject>>['doc'];animation:Awaited<ReturnType<typeof readProject>>['animation']}>();
async function pack(n:string){if(!cache.has(n)){const r=await readProject(new Blob([readFileSync(new URL(`../public/library/${n}.hahmo`,import.meta.url))]));cache.set(n,{doc:r.doc,animation:r.animation});}return cache.get(n)!;}
const example=`Resurssi hahmo MIRA: Roni-Monikulma
Resurssi hahmo NIKO: Pipsa
INT. KEITTIÖ - AAMU
Mira seisoo ikkunan vieressä puhelin kädessä.
MIRA:
“Siirsitkö auton eilen?”
Niko kävelee sisään vasemmalta kaksi sekuntia.
Hän pysähtyy ja katsoo Miraa.
LÄHIKUVA MIRA
Mira näyttää Nikolle puhelinta.
Mira katsoo Nikoa.
Niko istuutuu.`;
async function built(text=example,width=1080,height=1920){const assets={'Roni-Monikulma':await pack('Roni-Monikulma'),Pipsa:await pack('Pipsa')};return {b:buildEpisode(text,{packs:catalogFromNames(CHARACTER_PACK_OPTIONS),assets},{width,height}),assets};}

test('vertailukorkeus ja hahmotyyppi jokaiselle kirjaston hahmolle; lapsi 0,72 × aikuinen',async()=>{
 for(const name of ['Pipsa','Ville','Taru','Ukko','Roni-Monikulma','Salla-Monikulma','Aino-Monikulma','Otto-Monikulma','Roni-Studio','Pipsa-3D']){const {doc}=await pack(name),m=measureCharacter(doc);assert.ok(m.height>doc.height*.5&&m.height<=doc.height,name+' '+m.height);assert.ok(m.eyeY>m.top&&m.eyeY<m.top+m.height*.45,name+' silmälinja');}
 assert.equal(characterKind((await pack('Pipsa')).doc),'lapsi');assert.equal(characterKind((await pack('Ukko')).doc),'aikuinen');assert.equal(characterKind((await pack('Otto-Monikulma')).doc),'robotti');assert.equal(characterKind((await pack('Roni-Monikulma')).doc),'aikuinen');
 const {b,assets}=await built(),h=(speaker:string)=>{const bind=b.presentation.bindings.find(x=>x.speaker===speaker)!,m=measureCharacter(assets[bind.asset as keyof typeof assets].doc);return m.height*stageActor(b.presentation,bind,0).scale;};
 assert.ok(Math.abs(h('NIKO')/h('MIRA')-kindScale.lapsi)<.01,`lapsi/aikuinen ${h('NIKO')/h('MIRA')}`);assert.ok(Math.abs(h('MIRA')-adultStageHeight(1080,1920))<1);
});

test('jalkapohjat ovat taustan lattiaviivalla ±2 px koko jakson ajan (pystykuva ja vaakakuva)',async()=>{
 for(const [w,h] of [[1080,1920],[1920,1080]]){const {b,assets}=await built(example,w,h),p=b.presentation;assert.equal(p.world.design,'kitchen-scene-v1');
  for(const bind of p.bindings){const a=p.actorAnimations![bind.speaker],doc=assets[bind.asset as keyof typeof assets].doc,floor=characterFooting(doc,w,h,p.world.design,undefined,assets[bind.asset as keyof typeof assets].animation.rig).floor;assert.ok(floor<=floorLine(p.world.design)*h&&floor>=h*.7,'lattiaviiva turva-alueen sisällä '+floor);
   for(let f=0;f<a.duration;f+=3){const bounded=boundedPresentation(p,assets,f/24),r=stageActor(bounded,bounded.bindings.find(x=>x.speaker===bind.speaker)!,f/24,w,h),lowest=Math.max(...(['left','right'] as const).map(s=>footPoint(doc,a,f,s)!.y)),sole=r.y+(lowest-doc.height/2)*r.scale;
    // Jalka on maassa (alin jalkapohja) ellei hahmo hyppää; hyppyä ei tässä ole.
    assert.ok(Math.abs(sole-floor)<=2,`${bind.speaker} ${w}x${h} ruutu ${f}: jalkapohja ${sole.toFixed(1)} vs lattia ${floor.toFixed(1)}`);}}}
});

test('esineen ja käden kokosuhde: esine skaalautuu käden koon mukaan hahmon koosta riippumatta',async()=>{
 const {b,assets}=await built();for(const bind of b.presentation.bindings){const doc=assets[bind.asset as keyof typeof assets].doc,a=b.presentation.actorAnimations![bind.speaker];
  for(const id of ['phone-v1','mug-prop-v1','book-prop-v1','bag-prop-v1','umbrella-prop-v1']){const spec=heldProp(id)!,pl=heldPropPlacement(doc,a,0,'leftHand',spec)!;assert.ok(Math.abs(pl.height/handSize(doc,'front','leftHand')-spec.handRatio)<1e-9,id);assert.ok(Math.abs(pl.width/pl.height-spec.aspect)<1e-9);}}
 const m=measureCharacter((await pack('Pipsa')).doc),phone=heldProp('phone-v1')!;assert.ok(m.hand*phone.handRatio/m.height>.06&&m.hand*phone.handRatio/m.height<.14,'puhelin on noin kämmenen mittainen suhteessa hahmoon');
});

test('lähikuva rajautuu silmälinjaan (1/3 ±5 % korkeudesta) ja jättää tilaa katseen suuntaan',async()=>{
 const {b,assets}=await built(),p=b.presentation,close=p.events.find(e=>e.kind==='shot'&&e.value==='close')!,t=close.at!+.3,bind=p.bindings.find(x=>x.speaker==='MIRA')!;
 const cam=cameraTransform(p,assets,t),r=stageActor(p,bind,t),m=measureCharacter(assets['Roni-Monikulma'].doc),a=p.actorAnimations!.MIRA;
 const root=a.tracks.find(x=>x.key===assets['Roni-Monikulma'].doc.quick!.roles.root),pose={x:0,y:0,...(root?{}:{})};void pose;
 const eye={x:r.x+(m.eyeX-300)*r.scale,y:r.y+(m.eyeY-450)*r.scale},screen={x:eye.x*cam.scale+cam.x,y:eye.y*cam.scale+cam.y};
 assert.ok(Math.abs(screen.y/1920-shotEyeLine.close)<=.05,`silmälinja ${(screen.y/1920).toFixed(3)}`);
 // Mira on vasemmalla ja katsoo Nikoa (oikealle): silmät ruudun vasemmalla puolella, tilaa oikealle.
 const gaze=p.events.find(e=>e.kind==='gaze'&&e.target==='MIRA'&&e.value==='NIKO')!;const tg=gaze.at!+.1,cg=cameraTransform(p,assets,tg),rg=stageActor(p,bind,tg),sx=(rg.x+(m.eyeX-300)*rg.scale)*cg.scale+cg.x;assert.ok(sx<540-60,`katseen suuntaan tilaa: ${sx.toFixed(0)}`);
});

test('180 asteen sääntö: takakamera kahden hahmon kohtauksessa on varoitus, yhden hahmon ei',async()=>{
 const {b}=await built(),p=structuredClone(b.presentation);p.production??=initProduction(p);const shot=p.events.find(e=>e.kind==='shot'&&e.value==='close')!;p.production.cameras[shot.id]={...p.production.cameras[shot.id],view:'rear'};
 assert.ok(screenDirectionDiagnostics(p).some(d=>d.code==='axis-crossed'));assert.deepEqual(screenDirectionDiagnostics({...p,characters:['MIRA']}),[]);
 assert.deepEqual(screenDirectionDiagnostics(b.presentation),[]);
});
