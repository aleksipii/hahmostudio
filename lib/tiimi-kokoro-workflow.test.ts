import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildEpisode, catalogFromNames, packsNeeded, type EpisodeLibrary } from './episode-builder.ts';
import { CHARACTER_PACK_OPTIONS } from './speaker-pack-options.ts';
import { readProject } from './project-file.ts';
import { createTestEngine, synthesizeLines } from './kokoro.ts';
import { compilePresentation } from './presentation-compile.ts';
import { replaceBlockedBy } from './voice-sources.ts';
import type { AudioClip } from './presentation-model.ts';

test('English sample: test-engine synthesis, imported voice priority, audio duration and mouth compilation', async () => {
  const source = readFileSync(new URL('../public/library/Esimerkki-kokoro-en.md', import.meta.url), 'utf8');
  const packs = catalogFromNames(CHARACTER_PACK_OPTIONS), assets: EpisodeLibrary['assets'] = {};
  for (const name of packsNeeded(source, packs)) {
    const project = await readProject(new Blob([readFileSync(new URL(`../public/library/${name}.hahmo`, import.meta.url))]));
    assets[name] = { doc: project.doc, animation: project.animation };
  }
  const build = buildEpisode(source, { packs, assets }), model = build.presentation;
  const lines = model.events.filter(e => e.kind === 'dialogue').map(e => ({ id: e.id, speaker: e.target, text: e.text! }));
  const engine = createTestEngine(), voiceFor = (speaker: string) => model.bindings.find(b => b.speaker === speaker)?.kokoroVoice;
  const results = await synthesizeLines({ lines, engine, voiceFor });
  assert.equal(results.length, 2);
  assert.ok(results.every(r => r.status === 'synthesized' && r.provenance?.modelVersion === 'test-engine'));
  assert.equal(engine.calls.length, 2, 'only deterministic tones, no real Kokoro inference');
  for (const result of results) {
    const wav = new DataView(result.wav!.buffer, result.wav!.byteOffset, result.wav!.byteLength);
    assert.equal(wav.getUint32(24, true), 16000, 'speech WAV is resampled to 16 kHz');
    assert.ok(Math.abs(wav.getUint32(40, true) / 2 / 16000 - result.duration!) < 1 / 16000, 'resampling retains duration to one output sample');
  }
  const imported: AudioClip = {
    id: 'voice-' + lines[0].id, dialogue: lines[0].id, asset: 'fixture-imported', start: 0, end: 1.75, duration: 1.75,
    source: 'volume', mouth: [{ time: 0, shape: 'rest' }, { time: .25, shape: 'open' }, { time: 1.75, shape: 'rest' }], locked: true,
  };
  const untouched = structuredClone(imported);
  const protectedResults = await synthesizeLines({ lines, engine, voiceFor, hasOwnAudio: id => id === imported.dialogue, force: new Set(lines.map(l => l.id)) });
  assert.equal(protectedResults[0].status, 'kept-own-audio');
  assert.equal(protectedResults[0].wav, undefined);
  assert.equal(engine.calls.length, 3, 'force regeneration still preserves imported audio');
  assert.deepEqual(imported, untouched);
  assert.ok(replaceBlockedBy(imported, true));
  const second = results[1];
  const synthetic: AudioClip = { ...imported, id: 'voice-' + second.id, dialogue: second.id, asset: 'fixture-test-tone', end: second.duration!, duration: second.duration!, locked: false, synthetic: second.provenance,
    mouth: [{ time: 0, shape: 'rest' }, { time: .25, shape: 'open' }, { time: second.duration!, shape: 'rest' }] };
  assert.ok(replaceBlockedBy({ ...synthetic, locked: true }, true), 'mouth lock blocks synthetic replacement');
  const compiled = compilePresentation({ ...model, audioClips: [imported, synthetic] }, assets, 30);
  for (const clip of compiled.audioClips) {
    const event = compiled.events.find(e => e.id === clip.dialogue)!;
    assert.equal(event.duration, clip.duration, 'no shortening or time stretching');
    const binding = compiled.bindings.find(b => b.speaker === event.target)!;
    const roles = assets[binding.asset].doc.quick!.roles;
    const animation = compiled.actorAnimations![event.target];
    const track = animation.tracks.find(t => t.key === roles.mouthOpen)!;
    assert.ok(track.frames.some(f => f.frame === Math.round((event.at! + .25) * 30) && f.opacity === 1));
    assert.ok(track.frames.some(f => f.frame === Math.round((event.at! + clip.duration) * 30) && f.opacity === 0));
  }
  assert.equal(compiled.diagnostics.some(d => d.code === 'missing-audio'), false);
});
