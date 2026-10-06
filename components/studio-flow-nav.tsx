import type { StudioFlowStep } from '../lib/studio-flow-scope';

export type { StudioFlowStep };

const steps: { id: StudioFlowStep; label: string; hint: string }[] = [
  { id: 'script', label: 'Käsikirjoitus', hint: 'Teksti ja kohtauksiin jako' },
  { id: 'characters', label: 'Hahmot', hint: 'Kirjasto ja hahmopaketit' },
  { id: 'storyboard', label: 'Storyboard', hint: 'Kuvakortit ja järjestys' },
  { id: 'shot', label: 'Kuva', hint: 'Valitun kuvan ohjaus' },
  { id: 'timeline', label: 'Aikajana', hint: 'Esikatselu ja vienti' },
];

export default function StudioFlowNav({ active, onSelect }: { active: StudioFlowStep; onSelect: (step: StudioFlowStep) => void }) {
  return (
    <nav className="studio-flow-nav" aria-label="Tuotantovaiheet">
      <p className="studio-flow-nav-title">Työvaihe</p>
      <ol>
        {steps.map(({ id, label, hint }, index) => (
          <li key={id}>
            <button type="button" className="studio-flow-step resolve-flow-step" data-studio-flow-step={id} aria-current={active === id ? 'step' : undefined} aria-pressed={active === id} title={hint} onClick={() => onSelect(id)}>
              <span className="studio-flow-step-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
              <span className="studio-flow-step-label">{label}</span>
              <span className="studio-flow-step-hint">{hint}</span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
