import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clearPinnedFlowStep,
  flowStepScopes,
  libraryTabAllowed,
  readFlowPinEnabled,
  readPinnedFlowStep,
  writeFlowPinEnabled,
  workspaceAllowed,
  isStudioFlowStep,
  FLOW_PIN_ENABLED_KEY,
  FLOW_PIN_STORAGE_KEY,
} from './studio-flow-scope.ts';

test('flow scopes lock script source after käsikirjoitus', () => {
  assert.equal(flowStepScopes.script.scriptSourceLocked, false);
  for (const step of ['storyboard', 'shot', 'timeline', 'characters'] as const) {
    assert.equal(flowStepScopes[step].scriptSourceLocked, true, step);
  }
});

test('library tabs and workspaces are restricted per pinned step', () => {
  assert.equal(libraryTabAllowed('script', 'script'), true);
  assert.equal(libraryTabAllowed('script', 'library'), false);
  assert.equal(libraryTabAllowed('characters', 'library'), true);
  assert.equal(libraryTabAllowed('characters', 'script'), false);
  assert.equal(workspaceAllowed('characters', 'character'), true);
  assert.equal(workspaceAllowed('characters', 'animation'), false);
  assert.equal(libraryTabAllowed(null, 'episodes'), true);
});

test('isStudioFlowStep validates ids', () => {
  assert.ok(isStudioFlowStep('timeline'));
  assert.ok(!isStudioFlowStep('foo'));
});

test('flow pin can be disabled and cleared independently', () => {
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
    writeFlowPinEnabled(true);
    store.set(FLOW_PIN_STORAGE_KEY, 'storyboard');
    assert.equal(readPinnedFlowStep(), 'storyboard');
    writeFlowPinEnabled(false);
    assert.equal(readFlowPinEnabled(), false);
    assert.equal(readPinnedFlowStep(), null);
    store.set(FLOW_PIN_STORAGE_KEY, 'shot');
    assert.equal(readPinnedFlowStep(), null);
    writeFlowPinEnabled(true);
    assert.equal(readPinnedFlowStep(), 'shot');
    clearPinnedFlowStep();
    assert.equal(readPinnedFlowStep(), null);
    assert.equal(store.get(FLOW_PIN_ENABLED_KEY), '1');
  } finally {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: prev });
  }
});
