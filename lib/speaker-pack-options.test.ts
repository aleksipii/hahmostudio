import test from 'node:test';
import assert from 'node:assert/strict';
import { suggestPackForSpeaker } from './speaker-pack-options.ts';

test('suggestPackForSpeaker maps common cast names', () => {
  assert.equal(suggestPackForSpeaker('PIPSA'), 'Pipsa-3D');
  assert.equal(suggestPackForSpeaker('ville'), 'Ville-3D');
  assert.equal(suggestPackForSpeaker('KILLE'), undefined);
  assert.equal(suggestPackForSpeaker('MIRA', 'mira'), undefined);
});
