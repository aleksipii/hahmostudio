/**
 * Asiantuntijatila (docs/UI-MINIMALISMI-SUUNNITELMA.md, V8). Näkymäasetus, ei projektidataa:
 * oletuksena pois, jolloin tekniset yksityiskohdat (tarkistussummat, render-revisiot, tuotantokomentojen loki)
 * piilotetaan CSS:llä luokasta `expert-detail`. Mitään ei pureta eikä poisteta; tiedot pysyvät projektissa.
 */
export const EXPERT_MODE_KEY = 'hahmostudio-expert-mode';

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem'>;

function storage(): Storage | null {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

export function readExpertMode(store: Storage | null = storage()): boolean {
  try { return store?.getItem(EXPERT_MODE_KEY) === 'on'; } catch { return false; }
}

export function writeExpertMode(on: boolean, store: Storage | null = storage()): void {
  try { store?.setItem(EXPERT_MODE_KEY, on ? 'on' : 'off'); } catch { /* yksityinen ikkuna: asetus pysyy vain tämän istunnon */ }
}

/** Asettaa juurielementin `data-expert`-arvon, jonka mukaan tyylit näyttävät tai piilottavat tekniset tiedot. */
export function applyExpertMode(on: boolean, root: { dataset: Record<string, string | undefined> } | null = globalThis.document?.documentElement ?? null): void {
  if (root) root.dataset.expert = on ? 'on' : 'off';
}
