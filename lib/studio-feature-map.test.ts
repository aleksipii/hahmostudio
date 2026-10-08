import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MAX_PRIMARY_ACTIONS, primaryActions, studioFeatureMap } from './studio-feature-map.ts';
import { studioFlowSteps } from './studio-flow-steps.ts';

const editorSource = readFileSync(new URL('../components/editor.tsx', import.meta.url), 'utf8');
function paletteIds(): string[] {
  const start = editorSource.indexOf('const paletteCommands:PaletteCommand[]=[');
  assert.ok(start >= 0, 'paletteCommands löytyy editorista');
  const end = editorSource.indexOf('\n ];', start);
  return [...editorSource.slice(start, end).matchAll(/id:'([a-z0-9-]+)'/g)].map((m) => m[1]);
}

test('jokaisella ominaisuudella on yksi koti ja yksilöllinen tunniste', () => {
  const ids = studioFeatureMap.map((f) => f.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const f of studioFeatureMap) {
    if (f.department === 'tuotanto') assert.ok(f.step, `${f.id}: tuotannon ominaisuudella on työvaihe`);
    else assert.equal(f.step, undefined, `${f.id}: vain tuotannolla on työvaihe`);
    if (f.layer === 'haku') assert.ok(f.palette, `${f.id}: vain haussa oleva ominaisuus tarvitsee ⌘K-komennon`);
  }
});

test('mikään ⌘K-komento ei putoa kartan ulkopuolelle eikä kartta viittaa puuttuvaan komentoon', () => {
  const palette = paletteIds();
  const mapped = studioFeatureMap.flatMap((f) => (f.palette ? [f.palette] : []));
  for (const id of palette) assert.ok(mapped.includes(id), `⌘K-komennolla ${id} ei ole kotia kartassa`);
  for (const id of mapped) assert.ok(palette.includes(id), `kartan komentoa ${id} ei ole editorissa`);
});

test('jokaisen työvaiheen ja Työpajan päänäkymä pysyy väljänä', () => {
  for (const { id } of studioFlowSteps) {
    const actions = primaryActions(id);
    assert.ok(actions.length > 0, `${id}: vaiheella on päätehtävä`);
    assert.ok(actions.length <= MAX_PRIMARY_ACTIONS, `${id}: ${actions.length} päätoimintoa`);
  }
  assert.ok(primaryActions('tyopaja').length <= MAX_PRIMARY_ACTIONS);
});
