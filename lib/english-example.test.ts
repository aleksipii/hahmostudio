import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {readProject} from './project-file.ts';
import {buildEpisode,catalogFromNames,synthPossibility,type EpisodeLibrary} from './episode-builder.ts';
import {CHARACTER_PACK_OPTIONS} from './speaker-pack-options.ts';

test('englanninkielinen esimerkki rakentuu ilman tunnistamattomia rivejä ja kaikki repliikit ovat Kokoro-kelpoisia',async()=>{
 const text=readFileSync(new URL('../public/library/Example-parking-ticket.md',import.meta.url),'utf8'),assets:EpisodeLibrary['assets']={};
 for(const n of ['Pipsa','Ville']){const r=await readProject(new Blob([readFileSync(new URL(`../public/library/${n}.hahmo`,import.meta.url))]));assets[n]={doc:r.doc,animation:r.animation};}
 const b=buildEpisode(text,{packs:catalogFromNames(CHARACTER_PACK_OPTIONS),assets});
 assert.deepEqual(b.diagnostics.filter(d=>d.severity==='error'&&d.code!=='missing-audio').map(d=>d.message),[]);
 assert.deepEqual(b.diagnostics.filter(d=>d.code==='unrecognized-line').map(d=>d.message),[]);
 const speech=b.presentation.events.filter(e=>e.kind==='dialogue');assert.equal(speech.length,4);
 for(const e of speech)assert.equal(synthPossibility(e.text??''),'possible',e.text);
 assert.ok(b.audioPlan.dialogue.every(d=>d.synth==='possible'),'jokaiselle repliikille voi luoda äänen Kokorolla');
 for(const k of ['walk-right','sit'])assert.ok(b.presentation.events.some(e=>e.value===k),k);
 assert.ok(b.presentation.events.some(e=>e.kind==='gaze'&&e.value==='camera'));assert.ok(b.presentation.events.some(e=>e.kind==='transition'&&e.value==='fade-out'));
});
