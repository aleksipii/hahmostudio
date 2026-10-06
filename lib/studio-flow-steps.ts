import type { StudioFlowStep } from './studio-flow-scope.ts';

export const studioFlowSteps: { id: StudioFlowStep; label: string; hint: string }[] = [
  { id: 'script', label: 'Käsikirjoitus', hint: 'Teksti ja kohtauksiin jako' },
  { id: 'characters', label: 'Hahmot', hint: 'Kirjasto ja hahmopaketit' },
  { id: 'storyboard', label: 'Storyboard', hint: 'Kuvakortit ja järjestys' },
  { id: 'shot', label: 'Kuva', hint: 'Valitun kuvan ohjaus' },
  { id: 'timeline', label: 'Aikajana', hint: 'Esikatselu ja vienti' },
];
