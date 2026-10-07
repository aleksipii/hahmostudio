import test from 'node:test';
import assert from 'node:assert/strict';
import { KOKORO_LABEL, createTestEngine, isEnglishLine, parseSpokenText, synthesizeLines, type CachedVoice } from './kokoro.ts';
import { functions, validatePresentation } from './presentation-model.ts';
import { parsePresentation } from './presentation-parser.ts';

const lines = [
  { id: 'a', speaker: 'MIRA', text: 'Did you move the car yesterday?' },
  { id: 'b', speaker: 'NIKO', text: '(whispers) I did.' },
  { id: 'c', speaker: 'MIRA', text: '(quickly) Come on.' },
];
const voices: Record<string, string> = { MIRA: 'af_heart', NIKO: 'am_adam' };

test('speed cues are interpreted, unsupported emotions become notices and are never guessed', () => {
  assert.deepEqual(parseSpokenText('(quickly) Come on.'), { text: 'Come on.', speed: 1.2, notices: [] });
  assert.equal(parseSpokenText('(slowly) Wait.').speed, 0.85);
  assert.equal(parseSpokenText('(hitaasti) Wait.').speed, 0.85);
  const w = parseSpokenText('(whispers) I did.');
  assert.equal(w.text, 'I did.');
  assert.equal(w.speed, 1);
  assert.match(w.notices[0], /whispers/);
});

test('language gate: Finnish lines are not voiced by an English voice', () => {
  assert.equal(isEnglishLine('Did you move the car?'), true);
  assert.equal(isEnglishLine('Siirsitkö auton eilen?'), false);
});

test('synthesis: label, cache, one-line regeneration, notices and own audio protection (test engine, no network)', async () => {
  const engine = createTestEngine(),
    cache = new Map<string, CachedVoice>(),
    base = { engine, voiceFor: (s: string) => voices[s], cache },
    first = await synthesizeLines({ ...base, lines, hasOwnAudio: id => id === 'c' });
  assert.deepEqual(first.map(r => r.status), ['synthesized', 'needs-review', 'kept-own-audio']);
  assert.equal(first[0].provenance?.engine, 'kokoro');
  assert.equal(KOKORO_LABEL, 'Kokoro · synteettinen');
  assert.equal(engine.calls.length, 1);
  assert.equal(first[2].wav, undefined, 'own audio is never replaced');
  const again = await synthesizeLines({ ...base, lines: lines.slice(0, 1) });
  assert.equal(again[0].status, 'cached');
  assert.equal(engine.calls.length, 1);
  assert.deepEqual(again[0].wav, first[0].wav);
  const forced = await synthesizeLines({ ...base, lines: lines.slice(0, 1), force: new Set(['a']) });
  assert.equal(forced[0].status, 'synthesized');
  assert.equal(engine.calls.length, 2);
  const changed = await synthesizeLines({ ...base, lines: [{ ...lines[0], text: 'Did you move my car?' }, lines[2]] });
  assert.deepEqual(changed.map(r => r.status), ['synthesized', 'synthesized']);
  assert.equal(engine.calls.length, 4);
  const accepted = await synthesizeLines({ ...base, lines: [lines[1]], acceptedNotices: new Set(['b']) });
  assert.equal(accepted[0].status, 'synthesized');
  assert.equal(engine.calls.at(-1)?.text, 'I did.');
  assert.ok(accepted[0].notices.length === 1, 'notice stays visible after acceptance');
});

test('missing voice, Finnish text and cancellation do not synthesize', async () => {
  const engine = createTestEngine();
  const r = await synthesizeLines({ engine, lines: [{ id: 'x', speaker: 'ZED', text: 'Hello there.' }, { id: 'y', speaker: 'MIRA', text: 'Siirsitkö auton?' }], voiceFor: s => voices[s] });
  assert.deepEqual(r.map(x => x.status), ['no-voice', 'unsupported-language']);
  assert.equal(engine.calls.length, 0);
  const c = new AbortController();
  c.abort();
  await assert.rejects(synthesizeLines({ engine, lines, voiceFor: s => voices[s], signal: c.signal }));
  assert.equal(engine.calls.length, 0);
});

test('AudioClip.synthetic is optional and validated', () => {
  const p = parsePresentation('SARJA — S01E01: "T"\nMIRA:\n"Hello there."\n') as any;
  const base = JSON.parse(JSON.stringify(p));
  assert.doesNotThrow(() => validatePresentation(base));
  const ev = base.events.find((e: any) => e.kind === 'dialogue');
  assert.ok(ev, 'fixture has a dialogue event');
  const clip = { id: 'voice-' + ev.id, dialogue: ev.id, asset: 'a', start: 0, end: 1, duration: 1, mouth: [], source: 'volume' };
  const ok = { ...base, audioClips: [{ ...clip, synthetic: { engine: 'kokoro', voice: 'af_heart', speed: 1, modelVersion: 'm', key: 'a'.repeat(64) } }] };
  assert.doesNotThrow(() => validatePresentation(ok));
  const bad = { ...base, audioClips: [{ ...clip, synthetic: { engine: 'cloud', voice: 'x', speed: 1, modelVersion: 'm', key: 'a'.repeat(64) } }] };
  assert.throws(() => validatePresentation(bad));
});

test('binding kokoroVoice is optional, validated and survives a JSON roundtrip', () => {
  const p = JSON.parse(JSON.stringify(parsePresentation('SARJA — S01E01: "T"\nMIRA:\n"Hello there."\n')));
  if (!p.bindings.length) p.bindings.push({ speaker: p.characters[0], asset: 'a', voice: 'v', side: 'left', functions: Object.fromEntries(functions.map(f => [f, 'supported'])) });
  assert.doesNotThrow(() => validatePresentation(p));
  p.bindings[0].kokoroVoice = 'af_heart';
  assert.equal(validatePresentation(JSON.parse(JSON.stringify(p))).bindings[0].kokoroVoice, 'af_heart');
  p.bindings[0].kokoroVoice = '../evil';
  assert.throws(() => validatePresentation(p));
});
