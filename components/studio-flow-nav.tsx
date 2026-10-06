import type { StudioFlowStep } from '../lib/studio-flow-scope';
import { studioFlowSteps } from '../lib/studio-flow-steps';

export type { StudioFlowStep };

export default function StudioFlowNav({ active, onSelect }: { active: StudioFlowStep; onSelect: (step: StudioFlowStep) => void }) {
  return (
    <nav className="studio-flow-nav" aria-label="Tuotantovaiheet">
      <p className="studio-flow-nav-title">Työvaihe</p>
      <ol>
        {studioFlowSteps.map(({ id, label, hint }, index) => (
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
