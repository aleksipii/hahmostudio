import type { Presentation } from '../presentation-model.ts';
import { adaptPresentation, studioMetadata } from './domain.ts';

export type ShotGuardSummary = { approved: number; locked: number; protectedShots: number };

export function shotGuardSummary(p: Presentation): ShotGuardSummary {
  const meta = studioMetadata(p);
  const episode = adaptPresentation(p);
  let approved = 0;
  let locked = 0;
  for (const shot of episode.shots) {
    const state = meta.shots[shot.id]?.status ?? shot.status;
    if (state === 'locked') locked += 1;
    else if (state === 'approved') approved += 1;
  }
  return { approved, locked, protectedShots: approved + locked };
}

export function scriptEditShotGuardMessage(summary: ShotGuardSummary): string | null {
  if (summary.protectedShots === 0) return null;
  const parts: string[] = [];
  if (summary.approved) parts.push(`${summary.approved} hyväksyttyä`);
  if (summary.locked) parts.push(`${summary.locked} lukittua`);
  return `Huomio: ${parts.join(' ja ')} kuvaa. Käsikirjoituksen muutos voi palauttaa kuvat luonnokseksi. Työvaihe-pin ei korvaa kuvan Hyväksy/Lukitse-toimintoa.`;
}

/** Estää Jaa kohtauksiin -uudelleenjaon, jos käsikirjoitus poikkeaa tallennetusta ja lukittuja kuvia on. */
export function scriptReparseLockedBlock(model: Presentation | undefined, draftText: string): string | null {
  if (!model) return null;
  const summary = shotGuardSummary(model);
  if (summary.locked === 0) return null;
  const saved = (model.production?.studio?.rawScript ?? model.original ?? '').trim();
  if (draftText.trim() === saved) return null;
  return `${summary.locked} lukittua kuvaa: uudelleenjako on estetty, kunnes avaat lukituksen tai palautat viimeksi jaetun käsikirjoitustekstin.`;
}
