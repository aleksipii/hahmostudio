import { normalizeSpeaker } from './presentation-model.ts';
import type { PresentationAssets } from './presentation-compile.ts';

/** Oletusvalinnat käsikirjoituksen hahmopaketeille (ei automaattista .hahmo-sidontaa). */
export const CHARACTER_PACK_OPTIONS = [
  'Kille-Oma',
  'Handu-Oma',
  'Roni-Studio',
  'Salla-Studio',
  'Roni-Monikulma',
  'Salla-Monikulma',
  'Aino-Monikulma',
  'Otto-Monikulma',
  'Aino',
  'Otto',
  'Pipsa-3D',
  'Ville-3D',
  'Taru-3D',
  'Ukko-3D',
  'Pipsa',
  'Ville',
  'Taru',
  'Ukko',
] as const;

export function packOptionsForAssets(assets: PresentationAssets): string[] {
  const known = new Set<string>(CHARACTER_PACK_OPTIONS);
  const extra = Object.keys(assets).filter(k => (k.startsWith('cast-') || k.startsWith('cast-sha256-')) && !known.has(k));
  return [...CHARACTER_PACK_OPTIONS, ...extra];
}

/** Heuristinen ehdotus (ei pakota sidontaa). */
export function suggestPackForSpeaker(speaker: string, handle?: string): string | undefined {
  const norm = normalizeSpeaker(speaker);
  const handleNorm = handle ? normalizeSpeaker(handle.replace(/^@/, '')) : '';
  for (const pack of CHARACTER_PACK_OPTIONS) {
    const packNorm = normalizeSpeaker(pack.replace(/[-_]/g, ' '));
    if (packNorm.includes(norm) || norm.includes(packNorm.replace(/\s/g, ''))) return pack;
    if (handleNorm && packNorm.includes(handleNorm)) return pack;
  }
  if (norm.includes('KILLE')) return 'Kille-Oma';
  if (norm.includes('HANDU')) return 'Handu-Oma';
  if (norm.includes('RONI')) return 'Roni-Studio';
  if (norm.includes('SALLA')) return 'Salla-Studio';
  return undefined;
}
