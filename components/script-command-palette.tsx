import {useEffect, useRef} from 'react';

export type ScriptCommandId = 'import' | 'example-kilsat' | 'example-auto' | 'syntax' | 'new-scene';

const items: { id: ScriptCommandId; label: string; hint?: string }[] = [
  { id: 'import', label: 'Tuo UTF-8-tiedosto', hint: '.md · .txt' },
  { id: 'example-kilsat', label: 'KILSAT-esimerkki' },
  { id: 'example-auto', label: 'Esimerkki · auto' },
  { id: 'syntax', label: 'Syntaksiohje' },
  { id: 'new-scene', label: 'Uusi kohtaus · säilytä nykyinen' },
];

export default function ScriptCommandPalette({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (id: ScriptCommandId) => void;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    dialog.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="script-command-backdrop" onClick={onClose}>
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-label="Käsikirjoituksen komennot"
        className="script-command-palette"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="script-command-kicker">Kirjoita / avataksesi · Esc sulkee</p>
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              <button type="button" className="ghost-btn" onClick={() => onPick(item.id)}>
                <span>{item.label}</span>
                {item.hint && <small>{item.hint}</small>}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
