import test from 'node:test';
import assert from 'node:assert/strict';
import { clearFlowTourDone, flowTourSteps, FLOW_TOUR_STORAGE_KEY, readFlowTourDone, writeFlowTourDone } from './studio-flow-tour.ts';

test('flow tour steps cover five production phases in order', () => {
  assert.equal(flowTourSteps.length, 5);
  assert.deepEqual(
    flowTourSteps.map(s => s.id),
    ['script', 'characters', 'storyboard', 'shot', 'timeline'],
  );
});

test('flow tour completion persists in localStorage', () => {
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
    clearFlowTourDone();
    assert.equal(readFlowTourDone(), false);
    writeFlowTourDone();
    assert.equal(store.get(FLOW_TOUR_STORAGE_KEY), 'done');
    assert.equal(readFlowTourDone(), true);
    clearFlowTourDone();
    assert.equal(readFlowTourDone(), false);
  } finally {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: prev });
  }
});
