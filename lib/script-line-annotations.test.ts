import test from 'node:test';
import assert from 'node:assert/strict';
import {
  scanScriptLineAnnotations,
  scriptSceneBoundaryLines,
  snapDividerLine,
} from './script-line-annotations.ts';

test('scanScriptLineAnnotations marks scenes and speakers without full parse', () => {
  const text = 'Kohtaus: Studio\nKILLE:\n"Hei."\nHahmo MIRA: test\n';
  const rows = scanScriptLineAnnotations(text);
  assert.equal(rows[0].kind, 'scene');
  assert.equal(rows[0].left, '01');
  assert.equal(rows[1].kind, 'speaker');
  assert.equal(rows[1].right, 'KILLE');
  assert.equal(rows[3].kind, 'character');
  assert.deepEqual(scriptSceneBoundaryLines(rows), [1]);
});

test('snapDividerLine prefers nearby scene boundaries', () => {
  const boundaries = [5, 20, 40];
  assert.equal(snapDividerLine(6, boundaries, 100), 5);
  assert.equal(snapDividerLine(50, boundaries, 100), 50);
});

test('scanScriptLineAnnotations stays under 100ms for 5000 lines', () => {
  const text = Array.from({ length: 5000 }, (_, i) =>
    i % 3 === 0 ? `Kohtaus: ${i}` : i % 3 === 1 ? 'KILLE:' : '"rivi."',
  ).join('\n');
  assert.ok(text.split('\n').length === 5000);
  const start = performance.now();
  const rows = scanScriptLineAnnotations(text);
  const elapsed = performance.now() - start;
  assert.equal(rows.length, 5000);
  assert.ok(elapsed < 100, `scan took ${elapsed.toFixed(1)} ms`);
});

test('marginaali käyttää samaa hahmolöytöä kuin jaksonrakennus: hän-pronomini puhumattoman hahmon jälkeen tunnistuu', () => {
  // Niko ei puhu, joten hänet löytyy vain ohjeriviltä; ilman sitä rivi 2 jäisi "Ei tunnistettu".
  const text = 'INT. KEITTIÖ\nMIRA:\n“Hei.”\nNiko kävelee sisään vasemmalta kaksi sekuntia.\nHän pysähtyy ja katsoo Miraa.';
  const line5 = scanScriptLineAnnotations(text).find(n => n.line === 5);
  assert.ok(line5 && !line5.unrecognized, JSON.stringify(line5));
});
