import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {readProject} from './project-file.ts';
import {buildEpisode,catalogFromNames,type EpisodeLibrary} from './episode-builder.ts';
import {CHARACTER_PACK_OPTIONS} from './speaker-pack-options.ts';
import {appendPresentation} from './presentation-append.ts';
import {pendingEpisodeDraft,pendingEpisodeMessage} from './export-draft.ts';
import type {Scene} from './scene-model.ts';

const script=`Jakso 1: Vientitesti
Musiikki: rauhallinen

INT. KEITTIÖ - AAMU
Mira kävelee oikealle 2 s.
Niko kävelee vasemmalle 2 s.
Mira nyökkää.`;
async function library():Promise<EpisodeLibrary>{const assets:EpisodeLibrary['assets']={};for(const n of ['Pipsa','Ville']){const r=await readProject(new Blob([readFileSync(new URL(`../public/library/${n}.hahmo`,import.meta.url))]));assets[n]={doc:r.doc,animation:r.animation};}return{packs:catalogFromNames(CHARACTER_PACK_OPTIONS),assets};}
const base={width:1080,height:1920} as Scene;

test('vienti tunnistaa projektiin lisäämättömän jakson: pelkkä Rakenna jakso ei päädy videoon',async()=>{
 const l=await library(),draft=buildEpisode(script,l).presentation,animation={fps:30,duration:0,tracks:[]} as unknown as import('./animation-model.ts').Animation;
 assert.equal(pendingEpisodeDraft(base),null,'ei luonnosta → ei huomautusta');
 const pending=pendingEpisodeDraft({...base,presentationDraft:draft});
 assert.equal(pending?.kind,'new');assert.match(pendingEpisodeMessage(pending!),/Rakenna muokattava jakso projektiin/);
 // Lisäys projektiin poistaa luonnoksen, joten vienti on ajan tasalla.
 const committed=appendPresentation(animation,{...base,presentationDraft:draft},draft,l.assets as never,true);
 assert.equal(committed.scene.presentationDraft,undefined);assert.equal(pendingEpisodeDraft(committed.scene),null);
 // Uudelleenrakennus ilman muutoksia ei vaadi päivitystä.
 const rebuilt=buildEpisode(script,l,{previous:committed.presentation}).presentation;
 assert.equal(rebuilt.id,committed.presentation.id);
 assert.equal(pendingEpisodeDraft({...committed.scene,presentationDraft:rebuilt}),null);
 // Muokattu kohtaus: video tehtäisiin vanhalla versiolla.
 const edited=buildEpisode(script.replace('Mira nyökkää.','Mira nyökkää.\nNiko hymyilee.'),l,{previous:committed.presentation}).presentation;
 const changed=pendingEpisodeDraft({...committed.scene,presentationDraft:edited});
 assert.equal(changed?.kind,'changed');assert.match(pendingEpisodeMessage(changed!),/Päivitä kohtaus/);
 // Päivitä kohtaus korvaa projektissa olevan version: muokattu teksti ei lisää samaa kohtausta toista kertaa.
 const updated=appendPresentation(committed.animation,{...committed.scene,presentationDraft:edited},edited,l.assets as never);
 assert.equal(updated.scene.presentations?.length,1);assert.equal(updated.start,0);
 assert.equal(updated.animation.duration,Math.ceil(updated.presentation.seconds*30));assert.equal(updated.scene.presentations?.[0].events.length,edited.events.length);
 // Uusi erillinen kohtaus aiempien rinnalla ei estä aiempien vientiä.
 assert.equal(pendingEpisodeDraft({...committed.scene,presentationDraft:{...edited,id:edited.id+'-2'}}),null);
});
