import { speakerBindingRows } from '../lib/speaker-binding-rows';
import { packOptionsForAssets } from '../lib/speaker-pack-options';
import type { PresentationAssets } from '../lib/presentation-compile';
import type { Presentation } from '../lib/presentation-model';
import { useRef } from 'react';

export default function SpeakerBindingTable({
  model,
  assets,
  scriptText,
  compact = false,
  disabled = false,
  onSelectPack,
  onImportPack,
}: {
  model: Presentation;
  assets: PresentationAssets;
  scriptText?: string;
  compact?: boolean;
  disabled?: boolean;
  onSelectPack?: (speaker: string, packId: string) => void;
  onImportPack?: (speaker: string, file: File) => void;
}) {
  const importRef = useRef<HTMLInputElement>(null);
  const importSpeaker = useRef<string>('');
  const rows = speakerBindingRows(model, assets, scriptText);
  const packOptions = packOptionsForAssets(assets);
  const canPick = !!onSelectPack && !disabled;
  if (!rows.length) return null;
  return (
    <div className={`speaker-binding-table${compact ? ' compact' : ''}`}>
      <input
        ref={importRef}
        type="file"
        accept=".hahmo"
        hidden
        onChange={e => {
          const file = e.target.files?.[0];
          if (file && onImportPack && importSpeaker.current) onImportPack(importSpeaker.current, file);
          e.target.value = '';
          importSpeaker.current = '';
        }}
      />
      <table>
        <caption>Puhujan sidonta · @tunnus · .hahmo</caption>
        <thead>
          <tr>
            <th scope="col">Puhuja</th>
            <th scope="col">@tunnus</th>
            <th scope="col">.hahmo</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr
              key={`${row.speaker}:${row.handle}`}
              className={[row.missing && 'missing', row.pendingCharacter && 'pending'].filter(Boolean).join(' ') || undefined}
            >
              <td>
                {row.speaker}
                {row.pendingCharacter && !compact ? ' · odottaa Hahmo-riviä' : ''}
              </td>
              <td>
                <code>{row.handle}</code>
              </td>
              <td>
                {canPick && !row.pendingCharacter ? (
                  <div className="speaker-binding-pack-cell">
                    <select
                      aria-label={`${row.speaker} · hahmopaketti`}
                      value={row.packId}
                      disabled={disabled}
                      onChange={e => onSelectPack(row.speaker, e.target.value)}
                    >
                      <option value="">Valitse .hahmo</option>
                      {row.suggestedPack && !row.packId && (
                        <option value={row.suggestedPack}>{row.suggestedPack} (ehdotus)</option>
                      )}
                      {packOptions.map(id => (
                        <option key={id} value={id}>
                          {id}
                        </option>
                      ))}
                    </select>
                    {onImportPack && (
                      <button
                        type="button"
                        className="secondary tiny"
                        disabled={disabled}
                        onClick={() => {
                          importSpeaker.current = row.speaker;
                          importRef.current?.click();
                        }}
                      >
                        Tuo
                      </button>
                    )}
                  </div>
                ) : row.packId ? (
                  <>
                    <code>{row.packId}</code>
                    {!compact && row.packLabel !== row.packId ? ` · ${row.packLabel}` : ''}
                  </>
                ) : row.suggestedPack ? (
                  <span className="pack-suggestion">Ehdotus: {row.suggestedPack}</span>
                ) : (
                  '—'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.some(r => r.pendingCharacter) && (
        <p role="status">@tunnus ilman Hahmo-riviä: lisää hahmo käsikirjoitukseen ja Jaa kohtauksiin ennen pakettia.</p>
      )}
      {rows.some(r => r.missing && !r.pendingCharacter && !canPick) && (
        <p role="status">Puuttuva paketti: valitse hahmo alla tai Hahmot-kirjastosta.</p>
      )}
      {compact && !canPick && rows.some(r => r.suggestedPack && r.missing) && (
        <p role="status">Avaa Käsikirjoitus-välilehti valitaksesi paketin taulukosta.</p>
      )}
    </div>
  );
}
