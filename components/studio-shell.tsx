import type { CSSProperties, DragEventHandler, ReactNode } from 'react';
import { ArrowRight, Hammer, Redo2, Search, Undo2 } from 'lucide-react';
import { studioFlowSteps, studioWorkshop } from '../lib/studio-flow-steps';
import type { StudioFlowStep } from '../lib/studio-flow-scope';

/** KILSAT Studio 2.0 -kehys: yläpalkki (projekti, viisi tuotannon työvaihetta, Työpaja, toiminnot), sisältö ja tilarivi. Logiikka on editorissa. */
export default function StudioShell({
  active,
  onSelectPhase,
  workshop,
  onWorkshop,
  projectMenu,
  onSearch,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  exportControl,
  className,
  style,
  onDragOver,
  onDragLeave,
  onDrop,
  children,
}: {
  active: StudioFlowStep;
  onSelectPhase: (step: StudioFlowStep) => void;
  /** Työpaja (hahmon rakentaminen) on auki; silloin mikään tuotannon vaihe ei ole valittuna. */
  workshop: boolean;
  onWorkshop: () => void;
  projectMenu: ReactNode;
  onSearch: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  exportControl: ReactNode;
  className?: string;
  style?: CSSProperties;
  onDragOver?: DragEventHandler;
  onDragLeave?: DragEventHandler;
  onDrop?: DragEventHandler;
  children: ReactNode;
}) {
  const activeIndex = studioFlowSteps.findIndex((step) => step.id === active);
  const nextIndex = workshop ? 1 : activeIndex + 1;
  const next = studioFlowSteps[nextIndex];
  const nextLabel = workshop ? 'Roolitukseen' : next?.label;
  return (
    <main
      className={['kilsat-frame', 's2', workshop ? 'phase-workshop' : `phase-${active}`, className].filter(Boolean).join(' ')}
      style={style}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <header className="kilsat-top s2-top">
        <div className="kilsat-brand s2-brand" aria-label="KOETA">
          <img className="kilsat-brand-mark s2-mark" src={`${import.meta.env.BASE_URL}branding/koeta.png`} alt="" aria-hidden />
          <span>KOETA</span>
        </div>
        {projectMenu}
        <nav className="studio-flow-tabs s2-phases" aria-label="Tuotantovaiheet">
          {studioFlowSteps.map(({ id, label, hint }, index) => (
            <button
              key={id}
              type="button"
              className="studio-flow-tab s2-phase"
              data-studio-flow-step={id}
              aria-current={!workshop && active === id ? 'page' : undefined}
              aria-pressed={!workshop && active === id}
              title={`${hint} · ⌥${index + 1}`}
              onClick={() => onSelectPhase(id)}
            >
              <b className="studio-flow-tab-index" aria-hidden="true">{index + 1}</b>
              <span className="studio-flow-tab-label">{label}</span>
            </button>
          ))}
        </nav>
        <button
          type="button"
          className="s2-workshop"
          aria-current={workshop ? 'page' : undefined}
          aria-pressed={workshop}
          title={studioWorkshop.hint}
          onClick={onWorkshop}
        >
          <Hammer size={14} aria-hidden />
          <span>{studioWorkshop.label}</span>
        </button>
        <div className="s2-tools">
          <button type="button" className="s2-search" onClick={onSearch} aria-label="Hae toimintoa (⌘K)">
            <Search size={14} aria-hidden />
            <span>Hae toimintoa…</span>
            <kbd>⌘K</kbd>
          </button>
          <button type="button" className="s2-icon" onClick={onUndo} disabled={!canUndo} title="Kumoa (⌘Z)" aria-label="Kumoa">
            <Undo2 size={16} aria-hidden />
          </button>
          <button type="button" className="s2-icon" onClick={onRedo} disabled={!canRedo} title="Tee uudelleen (⇧⌘Z)" aria-label="Tee uudelleen">
            <Redo2 size={16} aria-hidden />
          </button>
          {next && (
            <button type="button" className="s2-next" onClick={() => onSelectPhase(next.id)} title={`${next.hint} · ⌥${nextIndex + 1}`}>
              <span>{nextLabel}</span>
              <ArrowRight size={14} aria-hidden />
            </button>
          )}
          {exportControl}
        </div>
      </header>
      <div className="kilsat-body s2-body">
        <div className="kilsat-main s2-main">{children}</div>
      </div>
    </main>
  );
}
