import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePresentation } from './presentation-parser.ts';
import { initProduction } from './production-model.ts';
import { studioMetadata } from './studio/domain.ts';
import { speakerBindingRows } from './speaker-binding-rows.ts';

test('speaker binding rows read @ lines from script before metadata commit', () => {
  const p = parsePresentation('Hahmo MIRA: x.\nMIRA: "Hei."');
  p.production = initProduction(p);
  p.bindings = [{ speaker: 'MIRA', asset: 'roni-pack', voice: 'x', side: 'left', functions: {} }];
  const rows = speakerBindingRows(
    p,
    { 'roni-pack': { doc: { name: 'Roni.psd' } as never, animation: {} as never } },
    '@mira → MIRA\n',
  );
  assert.equal(rows[0].handle, '@mira');
});

test('speaker binding rows include @ target before Hahmo line', () => {
  const p = parsePresentation('Hahmo KILLE: x.\nKILLE: "Hei."');
  p.production = initProduction(p);
  p.bindings = [{ speaker: 'KILLE', asset: 'kille-pack', voice: 'x', side: 'left', functions: {} }];
  const rows = speakerBindingRows(p, {}, '@mira → MIRA\n');
  assert.equal(rows.length, 2);
  const pending = rows.find(r => r.speaker === 'MIRA');
  assert.ok(pending);
  assert.equal(pending.handle, '@mira');
  assert.equal(pending.pendingCharacter, true);
  assert.equal(pending.missing, true);
});

test('speaker binding rows expose handle and pack id', () => {
  const p = parsePresentation('@mira → MIRA\nHahmo MIRA: x.\nMIRA: "Hei."');
  p.production = {
    ...initProduction(p),
    studio: { ...studioMetadata(p), speakerHandles: { mira: 'MIRA' } },
  };
  p.bindings = [{ speaker: 'MIRA', asset: 'roni-pack', voice: 'x', side: 'left', functions: {} }];
  const rows = speakerBindingRows(p, {
    'roni-pack': { doc: { name: 'Roni.psd' } as never, animation: {} as never },
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].handle, '@mira');
  assert.equal(rows[0].packId, 'roni-pack');
  assert.equal(rows[0].missing, false);
});
