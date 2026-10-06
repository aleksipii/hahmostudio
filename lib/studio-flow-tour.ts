import type { StudioFlowStep } from './studio-flow-scope.ts';

export type FlowTourStepId = StudioFlowStep;

export const FLOW_TOUR_STORAGE_KEY = 'hahmostudio-studio-flow-tour-v1';

export const flowTourSteps: { id: FlowTourStepId; title: string; body: string }[] = [
  {
    id: 'script',
    title: 'Tästä kirjoitat käsikirjoituksen',
    body: 'Tuo käsikirjoitus tai aloita tyhjästä. Jaa kohtauksiin, kun teksti on valmis.',
  },
  {
    id: 'characters',
    title: 'Tästä luot hahmon',
    body: 'Avaa Hahmot ja liitä hahmopaketti puhujiin.',
  },
  {
    id: 'storyboard',
    title: 'Tästä rakennat storyboardin',
    body: 'Järjestä kuvakortit ja tarkista kohtauksen rytmi.',
  },
  {
    id: 'shot',
    title: 'Tästä ohjaat yksittäisen kuvan',
    body: 'Valitse kuva ja säädä liike, suu ja ilme.',
  },
  {
    id: 'timeline',
    title: 'Tästä esikatselet ja viet',
    body: 'Aikajana, ääni ja vienti — lopullinen tarkistus ennen MP4:ää.',
  },
];

export function readFlowTourDone(): boolean {
  try {
    return localStorage.getItem(FLOW_TOUR_STORAGE_KEY) === 'done';
  } catch {
    return false;
  }
}

export function writeFlowTourDone(): void {
  try {
    localStorage.setItem(FLOW_TOUR_STORAGE_KEY, 'done');
  } catch {
    /* Preference storage is optional. */
  }
}

export function clearFlowTourDone(): void {
  try {
    localStorage.removeItem(FLOW_TOUR_STORAGE_KEY);
  } catch {
    /* Preference storage is optional. */
  }
}
