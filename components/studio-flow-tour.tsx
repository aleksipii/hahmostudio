import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { flowTourSteps, type FlowTourStepId } from '../lib/studio-flow-tour';

type Rect = { top: number; left: number; width: number; height: number };

function measureStep(id: FlowTourStepId): Rect | null {
  if (typeof document === 'undefined') return null;
  const el = document.querySelector<HTMLElement>(`[data-studio-flow-step="${id}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

export default function StudioFlowTour({
  open,
  stepIndex,
  onStepIndex,
  onDone,
  onOpenStep,
}: {
  open: boolean;
  stepIndex: number;
  onStepIndex: (index: number) => void;
  onDone: () => void;
  onOpenStep: (id: FlowTourStepId) => void;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const step = flowTourSteps[Math.min(Math.max(stepIndex, 0), flowTourSteps.length - 1)];
  const [spot, setSpot] = useState<Rect | null>(null);

  const remeasure = useCallback(() => {
    setSpot(measureStep(step.id));
  }, [step.id]);

  useLayoutEffect(() => {
    if (!open) return;
    remeasure();
    const onResize = () => remeasure();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    const panel = document.querySelector('.layers-panel');
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onResize) : null;
    if (panel && ro) ro.observe(panel);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
      ro?.disconnect();
    };
  }, [open, remeasure]);

  useEffect(() => {
    if (!open) return;
    dialogRef.current?.querySelector<HTMLButtonElement>('.studio-flow-tour-next')?.focus();
  }, [open, stepIndex]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onDone();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onDone]);

  if (!open || typeof document === 'undefined') return null;

  const pad = 6;
  const hole = spot
    ? {
        top: spot.top - pad,
        left: spot.left - pad,
        width: spot.width + pad * 2,
        height: spot.height + pad * 2,
      }
    : null;

  const tooltipStyle: CSSProperties = hole
    ? {
        top: Math.min(hole.top + hole.height + 12, window.innerHeight - 200),
        left: Math.min(Math.max(hole.left, 12), window.innerWidth - 380),
      }
    : { top: '50%', left: '50%', transform: 'translate(-50%, -50%)', maxWidth: 360 };

  const last = stepIndex >= flowTourSteps.length - 1;

  return createPortal(
    <div className="studio-flow-tour-root" role="presentation">
      {!hole && <div className="studio-flow-tour-scrim" aria-hidden="true" />}
      {hole && (
        <div
          className="studio-flow-tour-spotlight"
          style={{ top: hole.top, left: hole.left, width: hole.width, height: hole.height }}
          aria-hidden="true"
        />
      )}
      <section
        ref={dialogRef}
        className="studio-flow-tour-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={tooltipStyle}
      >
        <p className="studio-flow-tour-kicker">
          Tuotantokierros · {stepIndex + 1} / {flowTourSteps.length}
        </p>
        <h2 id={titleId}>{step.title}</h2>
        <p>{step.body}</p>
        <div className="studio-flow-tour-actions">
          <button type="button" className="secondary studio-flow-tour-skip" onClick={onDone}>
            Ohita
          </button>
          <button type="button" className="secondary" onClick={() => onOpenStep(step.id)}>
            Avaa työvaihe
          </button>
          <button
            type="button"
            className="primary studio-flow-tour-next"
            onClick={() => {
              if (last) onDone();
              else onStepIndex(stepIndex + 1);
            }}
          >
            {last ? 'Valmis' : 'Seuraava →'}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
