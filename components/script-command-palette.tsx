import {useEffect, useMemo, useRef, useState} from 'react';

export type ScriptCommandId =
  | 'import'
  | 'example-kilsat'
  | 'example-auto'
  | 'example-youtube'
  | 'example-short'
  | 'syntax'
  | 'new-scene'
  | 'save-source'
  | 'review'
  | 'blocks';

export type ScriptCommandItem = { id: ScriptCommandId; label: string; hint?: string };

/** Mitä "Työkalut /" -paletti voi tarjota juuri nyt. */
export type ScriptCommandState = {
  /** Käsikirjoitustekstin tallennus komentojournaliin on käytettävissä. */
  canSaveSource?: boolean;
  /** Jakso on tunnistettu: tarkistus, ohjaus ja palikkaeditori ovat olemassa. */
  hasEpisode?: boolean;
  reviewOpen?: boolean;
  blocksOpen?: boolean;
};

/**
 * Tarina-vaiheen harvinaiset käsikirjoitustyökalut. Sama luettelo on ainoa koti toiminnoille,
 * jotka eivät näy Tarinan päänäkymässä (vasen työkalurivi on piilossa keskitetyssä näkymässä).
 */
export function scriptCommandItems(state: ScriptCommandState = {}): ScriptCommandItem[] {
  return [
    { id: 'import', label: 'Tuo tiedosto', hint: '.md · .txt (UTF-8)' },
    { id: 'example-kilsat', label: 'Lataa KILSAT-esimerkki', hint: 'Esimerkit' },
    { id: 'example-auto', label: 'Lataa toinen esimerkki · auto', hint: 'Esimerkit' },
    { id: 'example-youtube', label: 'YouTube-runko · kartonki', hint: 'Esimerkit' },
    { id: 'example-short', label: 'Uusi lyhytvideo-pohja', hint: 'Esimerkit' },
    { id: 'syntax', label: 'Syntaksiohje', hint: 'rakenne ja mallit' },
    { id: 'new-scene', label: 'Uusi kohtaus · säilytä nykyinen' },
    ...(state.canSaveSource ? [{ id: 'save-source' as const, label: 'Tallenna käsikirjoitusteksti' }] : []),
    ...(state.hasEpisode
      ? [
          {
            id: 'review' as const,
            label: state.reviewOpen ? 'Piilota tarkistus ja ohjaus' : 'Näytä tarkistus ja ohjaus',
            hint: 'korjausehdotukset, hahmot, äänet',
          },
          {
            id: 'blocks' as const,
            label: state.blocksOpen ? 'Piilota palikkaeditori' : 'Näytä palikkaeditori',
            hint: 'liikkeet palikoina',
          },
        ]
      : []),
  ];
}

export default function ScriptCommandPalette({
  open,
  onClose,
  onPick,
  state,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (id: ScriptCommandId) => void;
  state?: ScriptCommandState;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const items = useMemo(
    () => scriptCommandItems(state),
    [state?.canSaveSource, state?.hasEpisode, state?.reviewOpen, state?.blocksOpen],
  );
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((c) => c.label.toLowerCase().includes(q) || c.hint?.toLowerCase().includes(q));
  }, [query, items]);

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
        aria-label="Käsikirjoituksen työkalut"
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
