import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readProject } from './project-file.ts';
import { characterTier, characters, missingStudioCriteria, qualitySummary } from './character-catalog.ts';

test('kirjaston laatuarvot vastaavat .hahmo-pakettien todellista sisältöä', async () => {
  for (const c of characters) {
    const p = await readProject(new Blob([readFileSync(new URL(`../public/library/${c.name}.hahmo`, import.meta.url))]));
    const q = p.doc.quick;
    assert.ok(q, c.name);
    const roles = Object.keys(q.roles);
    assert.equal(Math.max(1, Object.keys(q.views ?? {}).length), c.quality.views, `${c.name}: kuvakulmat`);
    assert.equal(roles.filter((r) => /mouth/i.test(r)).length, c.quality.mouths, `${c.name}: suumuodot`);
    assert.equal(roles.includes('leftFoot') && roles.includes('rightFoot'), c.quality.fullBody, `${c.name}: jalat`);
    assert.equal(p.doc.warnings.some((w) => /Oma PSD/i.test(w)), c.quality.origin === 'oma', `${c.name}: alkuperä`);
  }
});

test('Studio-taso vaatii kaikki kriteerit, omat näkyvät aina ja luonnokset kertovat puutteet', () => {
  const by = (tier: string) => characters.filter((c) => characterTier(c) === tier).map((c) => c.name);
  assert.deepEqual(by('studio'), ['Pipsa-3D', 'Ville-3D', 'Taru-3D', 'Ukko-3D']);
  assert.deepEqual(by('oma'), []);
  assert.equal(by('studio').length + by('oma').length + by('luonnos').length, characters.length);
  const pipsa = characters.find((c) => c.name === 'Pipsa')!;
  assert.deepEqual(missingStudioCriteria(pipsa.quality), ['kuvakulmat']);
  assert.equal(qualitySummary(pipsa.quality), '1 kulma · 5 suuta · koko vartalo');
  assert.deepEqual(missingStudioCriteria({ views: 1, mouths: 9, fullBody: false, origin: 'studio' }), ['kuvakulmat', 'jalat']);
});
