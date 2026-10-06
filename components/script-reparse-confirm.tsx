import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export default function ScriptReparseConfirm({
  open,
  message,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    dialog.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [open, onCancel]);
  if (!open) return null;
  const markup = (
    <div className="studio-dialog-backdrop script-reparse-backdrop" onClick={onCancel}>
      <div
        ref={dialog}
        tabIndex={-1}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="script-reparse-title"
        aria-describedby="script-reparse-body"
        className="studio-dialog script-reparse-dialog"
        onClick={e => e.stopPropagation()}
      >
        <header>
          <div>
            <span className="eyebrow">KÄSIKIRJOITUS</span>
            <h2 id="script-reparse-title">Jaetaanko kohtauksiin uudelleen?</h2>
          </div>
        </header>
        <p id="script-reparse-body">{message}</p>
        <footer className="script-reparse-actions">
          <button type="button" className="secondary" onClick={onCancel}>
            Peruuta
          </button>
          <button type="button" className="primary" autoFocus onClick={onConfirm}>
            Jaa kohtauksiin uudelleen
          </button>
        </footer>
      </div>
    </div>
  );
  if (typeof document !== 'undefined' && document.body) return createPortal(markup, document.body);
  return markup;
}
