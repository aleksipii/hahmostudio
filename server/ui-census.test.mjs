// Hallintolaskurin (scripts/ui-census.mjs) puhtaat apufunktiot ilman selainta.
import assert from 'node:assert/strict';
import test from 'node:test';
import { CONTENT_RULES, ZONE_RULES, budgets, classify, evaluate, formatTable, tally } from '../scripts/ui-census.mjs';

/** Jäljittelee e.closest(selector):ia: hallinnan esivanhempien valitsimet. */
const at = (...selectors) => (sel) => selectors.includes(sel);

test('vyöhyke ja sisältö tunnistetaan valitsimista, ei sijainnista', () => {
  assert.deepEqual(classify(at('.s2-top')), { zone: 'ylapalkki', content: null });
  assert.deepEqual(classify(at('.timeline-dock')), { zone: 'aikajana', content: null });
  assert.deepEqual(classify(at('.timeline-dock', '.animation-tracks')), { zone: 'aikajana', content: 'aikajana-raidat' });
  assert.deepEqual(classify(at('.layers-panel', '.character-card')), { zone: 'vasen', content: 'kirjastokortit' });
  assert.deepEqual(classify(at('.preview-panel', '.resolve-shot-card')), { zone: 'nayttamo', content: 'kuvakortit' });
  assert.deepEqual(classify(at('.layers-panel', '.layer-tree')), { zone: 'vasen', content: 'tasopuu' });
  assert.deepEqual(classify(at('.preview-panel', '.script-line-field')), { zone: 'nayttamo', content: 'kasikirjoitus' });
  assert.deepEqual(classify(at()), { zone: 'muu', content: null });
});

test('sääntöjen valitsimet ovat luokkia ja vyöhykkeet uniikkeja', () => {
  for (const [, sel] of [...ZONE_RULES, ...CONTENT_RULES]) assert.match(sel, /^\.[a-z0-9-]+$/);
  assert.equal(new Set(ZONE_RULES.map(([z]) => z)).size, ZONE_RULES.length);
});

test('sisältö ei kasvata budjettiin laskettavaa lukua', () => {
  const ui = [{ zone: 'ylapalkki', content: null }, { zone: 'aikajana', content: null }];
  const tracks = (n) => Array.from({ length: n }, () => ({ zone: 'aikajana', content: 'aikajana-raidat' }));
  const low = tally([...ui, ...tracks(13)], 100);
  const tall = tally([...ui, ...tracks(18)], 100);
  assert.equal(low.controls, 2);
  assert.equal(tall.controls, 2);
  assert.equal(low.content, 13);
  assert.equal(tall.content, 18);
  assert.deepEqual(tall.contentByKind, { 'aikajana-raidat': 18 });
  assert.equal(tall.zones.aikajana, 1);
  assert.equal(tall.zones.ylapalkki, 1);
});

test('budjettivertailu: hallinnat, sanat ja yläpalkki', () => {
  const base = { content: 99, contentByKind: {}, words: 10, zones: { ylapalkki: 5 } };
  const rows = evaluate({
    timeline: { ...base, controls: budgets.timeline.controls },
    shot: { ...base, controls: budgets.shot.controls + 1 },
    script: { ...base, controls: 1, words: budgets.script.words + 1 },
    workshop: { ...base, controls: 1, zones: { ylapalkki: budgets.topbar + 1 } },
    tuntematon: { ...base, controls: 0 },
  });
  assert.deepEqual(rows.map((r) => [r.id, r.ok]), [
    ['timeline', true], ['shot', false], ['script', false], ['workshop', false], ['tuntematon', false],
  ]);
});

test('taulukossa on vyöhykkeet ja sisältösarake', () => {
  const rows = evaluate({ timeline: tally([{ zone: 'aikajana', content: null }, { zone: 'aikajana', content: 'aikajana-raidat' }], 7) });
  const lines = formatTable(rows, { width: 1440, height: 900, url: 'http://x/' });
  assert.match(lines[1], /kuorma sisältö/);
  assert.match(lines[1], /ylä vasen näytt oikea aikaj muu/);
  assert.match(lines[2], /^timeline\s+1\s+1\s+7 \|/);
  assert.match(lines.at(-1), /aikajana-raidat 1/);
});

test('UI-sanat ja näkyvä käyttäjäsisältö tallentuvat erikseen, sisältö ei muuta UI-budjettia',()=>{
 const items=[{zone:'nayttamo',content:'kuvakortit'}],a=tally(items,149,10),b=tally(items,149,5000);
 assert.equal(a.words,b.words);assert.equal(a.visibleWords,159);assert.equal(b.visibleWords,5149);assert.equal(b.contentWords,5000);assert.equal(evaluate({storyboard:b})[0].ok,true);
});
