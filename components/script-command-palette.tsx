import {useEffect, useMemo, useRef, useState} from 'react';

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
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((c) => c.label.toLowerCase().includes(q) || c.hint?.toLowerCase().includes(q));
  }, [query]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    dialog.current?.querySelector<HTMLInputElement>('.script-command-search')?.focus();
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
        <input
          className="script-command-search"
          type="search"
          placeholder="Hae työkalua…"
          aria-label="Hae työkalua"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && filtered[0]) {
              e.preventDefault();
              onPick(filtered[0].id);
            }
          }}
        />
        <ul>
          {filtered.map((item) => (
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
