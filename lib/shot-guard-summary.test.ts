import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePresentation } from './presentation-parser.ts';
import { initProduction } from './production-model.ts';
import { adaptPresentation, studioMetadata } from './studio/domain.ts';
import { readFlowPinEnabled, writeFlowPinEnabled } from './studio-flow-scope.ts';
import { scriptEditShotGuardMessage, scriptReparseApprovedWarning, scriptReparseLockedBlock, shotGuardSummary } from './studio/shot-guard-summary.ts';

test('shot guard summary counts approved and locked shots', () => {
  const p = parsePresentation('Hahmo MIRA: test.\nMIRA: "Hei."');
  p.production = initProduction(p);
  const shots = adaptPresentation(p).shots;
  assert.equal(shots.length, 1);
  const meta = studioMetadata(p);
  p.production!.studio = {
    ...meta,
    shots: {
      [shots[0]!.id]: { status: 'approved', approvedRevision: 1 },
      'orphan-shot': { status: 'locked', approvedRevision: 1 },
    },
  };
  const summary = shotGuardSummary(p);
  assert.equal(summary.approved, 1);
  assert.equal(summary.locked, 0);
  assert.equal(summary.protectedShots, 1);
  const msg = scriptEditShotGuardMessage(summary);
  assert.ok(msg?.includes('Työvaihe-pin'));
});

test('script reparse warns when approved shots exist and draft text changed', () => {
  const p = parsePresentation('Hahmo MIRA: test.\nMIRA: "Hei."');
  p.production = initProduction(p);
  const shotId = adaptPresentation(p).shots[0]!.id;
  p.production!.studio = {
    ...studioMetadata(p),
    rawScript: p.original,
    shots: { [shotId]: { status: 'approved', approvedRevision: 1 } },
  };
  assert.equal(scriptReparseApprovedWarning(p, p.original), null);
  assert.ok(scriptReparseApprovedWarning(p, p.original + '\nMIRA: "Muutos."')?.includes('hyväksyttyä'));
});

test('script reparse is blocked when locked shots exist and draft text changed', () => {
  const p = parsePresentation('Hahmo MIRA: test.\nMIRA: "Hei."');
  p.production = initProduction(p);
  const shotId = adaptPresentation(p).shots[0]!.id;
  p.production!.studio = {
    ...studioMetadata(p),
    rawScript: p.original,
    shots: { [shotId]: { status: 'locked', approvedRevision: 1 } },
  };
  assert.equal(scriptReparseLockedBlock(p, p.original), null);
  assert.ok(scriptReparseLockedBlock(p, p.original + '\nMIRA: "Muutos."')?.includes('lukittua'));
});

test('shot approval metadata is independent of työvaihe-pin setting', () => {
  const store = new Map<string, string>();
  const prev = globalThis.localStorage;
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    },
  });
  try {
    writeFlowPinEnabled(false);
    assert.equal(readFlowPinEnabled(), false);
    const p = parsePresentation('Hahmo MIRA: test.\nMIRA: "Hei."');
    p.production = initProduction(p);
    const shotId = adaptPresentation(p).shots[0]!.id;
    p.production!.studio = {
      ...studioMetadata(p),
      shots: { [shotId]: { status: 'approved', approvedRevision: 1 } },
    };
    const summary = shotGuardSummary(p);
    assert.equal(summary.protectedShots, 1);
    writeFlowPinEnabled(true);
    assert.deepEqual(shotGuardSummary(p), summary);
  } finally {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: prev });
  }
});
