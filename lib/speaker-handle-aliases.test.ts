import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applySpeakerHandlesToScript,
  parseSpeakerHandleAliases,
  speakerHandlesToPresentationAliases,
  stripSpeakerHandleDeclarations,
} from './speaker-handle-aliases.ts';
import { parsePresentation } from './presentation-parser.ts';

test('parse and apply @ speaker handle declarations', () => {
  const src = `@mira → MIRA
Hahmo MIRA: rauhallinen.
@mira: "Hei."
Mira vilkuttaa 2 s.`;
  const handles = parseSpeakerHandleAliases(src);
  assert.deepEqual(handles, { mira: 'MIRA' });
  assert.ok(!stripSpeakerHandleDeclarations(src).includes('@mira →'));
  const prepared = applySpeakerHandlesToScript(src, handles);
  assert.match(prepared, /MIRA: "Hei."/);
  const p = parsePresentation(prepared, speakerHandlesToPresentationAliases(handles));
  assert.deepEqual(p.characters, ['MIRA']);
  assert.equal(p.events.filter(e => e.kind === 'dialogue').length, 1);
});
