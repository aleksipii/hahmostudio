import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildEpisode, catalogFromNames, packsNeeded, type EpisodeLibrary } from './episode-builder.ts';
import { episodeTemplate } from './episode-templates.ts';
import { readProject } from './project-file.ts';
import { CHARACTER_PACK_OPTIONS } from './speaker-pack-options.ts';
import { isEnglishLine, parseSpokenText } from './kokoro.ts';

test('English Kokoro example builds deterministically with current packs and an explicit missing-audio plan', async () => {
  const source = readFileSync(new URL('../public/library/Esimerkki-kokoro-en.md', import.meta.url), 'utf8');
  assert.equal(episodeTemplate('kokoro-en')?.source, source);
  assert.ok(episodeTemplate('chat-en'), 'existing English template is preserved');
  const packs = catalogFromNames(CHARACTER_PACK_OPTIONS);
  const assets: EpisodeLibrary['assets'] = {};
  for (const name of packsNeeded(source, packs)) {
    const project = await readProject(new Blob([readFileSync(new URL(`../public/library/${name}.hahmo`, import.meta.url))]));
    assets[name] = { doc: project.doc, animation: project.animation };
  }
  const library = { packs, assets };
  const build = buildEpisode(source, library);
  assert.deepEqual(build.cast.map(c => [c.speaker, c.pack]), [['MIRA', 'Pipsa'], ['NIKO', 'Ville']]);
  assert.deepEqual(build.lines.filter(l => l.outcome === 'unrecognized'), []);
  assert.deepEqual(build.diagnostics.filter(d => ['unrecognized-line', 'note-line', 'build-failed'].includes(d.code) || (d.severity === 'error' && d.code !== 'missing-audio')), []);
  assert.equal(build.audioPlan.dialogue.length, 2);
  assert.ok(build.audioPlan.dialogue.every(d => d.status === 'missing' && d.synth === 'possible'));
  for (const line of build.audioPlan.dialogue) {
    const spoken = parseSpokenText(line.text);
    assert.equal(isEnglishLine(spoken.text), true);
    assert.deepEqual(spoken.notices, []);
    assert.ok(build.presentation.bindings.find(b => b.speaker === line.speaker)?.kokoroVoice);
  }
  assert.equal(build.presentation.audioClips.length, 0, 'a plan is not a synthesized recording');
  assert.deepEqual(build.presentation, buildEpisode(source, library).presentation);
});
