import { studioFlowSteps } from '../lib/studio-flow-steps';
import type { StudioFlowStep } from '../lib/studio-flow-scope';

export default function StudioFlowTabs({ active, onSelect }: { active: StudioFlowStep; onSelect: (step: StudioFlowStep) => void }) {
  return (
    <nav className="studio-flow-tabs" aria-label="Tuotantovaiheet">
      {studioFlowSteps.map(({ id, label, hint }, index) => (
        <button
          key={id}
          type="button"
          className="studio-flow-tab"
          data-studio-flow-step={id}
          aria-current={active === id ? 'page' : undefined}
          aria-pressed={active === id}
          title={hint}
          onClick={() => onSelect(id)}
        >
          <span className="studio-flow-tab-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
          <span className="studio-flow-tab-label">{label}</span>
        </button>
      ))}
    </nav>
  );
}
