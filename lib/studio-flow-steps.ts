import type { StudioFlowStep } from './studio-flow-scope.ts';

/** Tuotannon viisi työvaihetta. Tunnisteet ovat pysyviä (tallennettu työvaiherajaus, kierros); nimet ovat elokuvan työvaiheita. */
export const studioFlowSteps: { id: StudioFlowStep; label: string; hint: string }[] = [
  { id: 'script', label: 'Tarina', hint: 'Käsikirjoitus ja kohtauksiin jako' },
  { id: 'characters', label: 'Roolitus', hint: 'Hahmot, kuvausympäristöt ja esineet rooleihin' },
  { id: 'storyboard', label: 'Storyboard', hint: 'Kuvakortit ja järjestys' },
  { id: 'shot', label: 'Kuvaus', hint: 'Valitun kuvan liike, ilme, kamera ja ääni' },
  { id: 'timeline', label: 'Leikkaus', hint: 'Aikajana, esikatselu, jaksot ja vienti' },
];

/** Työpaja on tuotannon rinnalla oleva osasto, jossa hahmot valmistetaan (tasot, piirto, nivelet, tuonnin tarkistus). */
export const studioWorkshop = { label: 'Työpaja', hint: 'Hahmon rakentaminen: tasot, piirto, nivelet ja tuonnin tarkistus' } as const;
