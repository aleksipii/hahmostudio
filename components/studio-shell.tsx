import type { CSSProperties, DragEventHandler, ReactNode } from 'react';
import { Redo2, Search, Undo2 } from 'lucide-react';
import { studioFlowSteps } from '../lib/studio-flow-steps';
import type { StudioFlowStep } from '../lib/studio-flow-scope';

/** KILSAT Studio 2.0 -kehys: yläpalkki (projekti, viisi työvaihetta, toiminnot), sisältö ja tilarivi. Logiikka on editorissa. */
export default function StudioShell({
  active,
  onSelectPhase,
  projectMenu,
  viewMenu,
  onSearch,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  saveButton,
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
  projectMenu: ReactNode;
  viewMenu: ReactNode;
  onSearch: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  saveButton: ReactNode;
  exportControl: ReactNode;
  className?: string;
  style?: CSSProperties;
  onDragOver?: DragEventHandler;
  onDragLeave?: DragEventHandler;
  onDrop?: DragEventHandler;
  children: ReactNode;
}) {
  return (
    <main
      className={['kilsat-frame', 's2', `phase-${active}`, className].filter(Boolean).join(' ')}
      style={style}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <header className="kilsat-top s2-top">
        <div className="kilsat-brand s2-brand" aria-label="KILSAT Studio">
          <i className="kilsat-brand-mark s2-mark" aria-hidden>K</i>
          <span>KILSAT</span>
        </div>
        {projectMenu}
        <nav className="studio-flow-tabs s2-phases" aria-label="Tuotantovaiheet">
          {studioFlowSteps.map(({ id, label, hint }, index) => (
            <button
              key={id}
              type="button"
              className="studio-flow-tab s2-phase"
              data-studio-flow-step={id}
              aria-current={active === id ? 'page' : undefined}
              aria-pressed={active === id}
              title={`${hint} · ⌥${index + 1}`}
              onClick={() => onSelectPhase(id)}
            >
              <b className="studio-flow-tab-index" aria-hidden="true">{index + 1}</b>
              <span className="studio-flow-tab-label">{label}</span>
            </button>
          ))}
        </nav>
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
          {viewMenu}
          {saveButton}
          {exportControl}
        </div>
      </header>
      <div className="kilsat-body s2-body">
        <div className="kilsat-main s2-main">{children}</div>
      </div>
    </main>
  );
}
