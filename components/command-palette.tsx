import { useEffect, useMemo, useRef, useState } from 'react';

export type PaletteCommand = {
  id: string;
  group: string;
  label: string;
  shortcut?: string;
  keywords?: string;
  disabled?: boolean;
  run: () => void;
};

/** ⌘K-haku: jokainen toiminto löytyy nimellä riippumatta siitä, missä paneelissa se on. Ajaa samat funktiot kuin painikkeet. */
export default function CommandPalette({ open, commands, onClose }: { open: boolean; commands: PaletteCommand[]; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const restore = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restore.current = document.activeElement as HTMLElement | null;
    setQuery('');
    setIndex(0);
    requestAnimationFrame(() => input.current?.focus());
    return () => restore.current?.focus?.();
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('fi');
    const words = q.split(/\s+/).filter(Boolean);
    return commands.filter(c => {
      if (!words.length) return true;
      const hay = `${c.label} ${c.group} ${c.keywords ?? ''}`.toLocaleLowerCase('fi');
      return words.every(w => hay.includes(w));
    });
  }, [commands, query]);

  useEffect(() => {
    list.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [index, results]);

  if (!open) return null;

  const run = (c: PaletteCommand | undefined) => {
    if (!c || c.disabled) return;
    onClose();
    c.run();
  };
  let group = '';

  return (
    <div className="s2-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="s2-palette" role="dialog" aria-modal="true" aria-label="Hae toimintoa">
        <input
          ref={input}
          role="combobox"
          aria-expanded="true"
          aria-controls="s2-palette-list"
          aria-activedescendant={results[index] ? `s2-cmd-${results[index].id}` : undefined}
          placeholder="Hae toimintoa, työvaihetta tai paneelia…"
          value={query}
          onChange={e => { setQuery(e.target.value); setIndex(0); }}
          onKeyDown={e => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setIndex(i => Math.min(results.length - 1, i + 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setIndex(i => Math.max(0, i - 1)); }
            else if (e.key === 'Enter') { e.preventDefault(); run(results[index]); }
            else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); }
          }}
        />
        <div ref={list} id="s2-palette-list" className="s2-palette-list" role="listbox" aria-label="Toiminnot">
          {results.length === 0 && <p className="s2-palette-empty">Ei osumia. Kokeile toista sanaa, esimerkiksi “vie” tai “nivel”.</p>}
          {results.map((c, i) => {
            const head = c.group !== group;
            group = c.group;
            return (
              <div key={c.id} role="presentation">
                {head && <div className="s2-palette-group" role="presentation">{c.group}</div>}
                <div
                  id={`s2-cmd-${c.id}`}
                  role="option"
                  aria-selected={i === index}
                  aria-disabled={c.disabled || undefined}
                  className="s2-palette-item"
                  onMouseMove={() => setIndex(i)}
                  onClick={() => run(c)}
                >
                  <span>{c.label}</span>
                  {c.shortcut && <kbd>{c.shortcut}</kbd>}
                </div>
              </div>
            );
          })}
        </div>
        <div className="s2-palette-foot"><span><kbd>↑</kbd><kbd>↓</kbd> valitse</span><span><kbd>↵</kbd> suorita</span><span><kbd>Esc</kbd> sulje</span></div>
      </div>
    </div>
  );
}
