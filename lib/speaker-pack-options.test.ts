import test from 'node:test';
import assert from 'node:assert/strict';
import { suggestPackForSpeaker } from './speaker-pack-options.ts';

test('suggestPackForSpeaker maps common cast names', () => {
  assert.equal(suggestPackForSpeaker('KILLE'), 'Kille-Oma');
  assert.equal(suggestPackForSpeaker('HANDU'), 'Handu-Oma');
  assert.equal(suggestPackForSpeaker('MIRA', 'mira'), undefined);
});
