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
