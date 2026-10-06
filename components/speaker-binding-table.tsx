import { speakerBindingRows } from '../lib/speaker-binding-rows';
import type { PresentationAssets } from '../lib/presentation-compile';
import type { Presentation } from '../lib/presentation-model';

export default function SpeakerBindingTable({
  model,
  assets,
  scriptText,
  compact = false,
}: {
  model: Presentation;
  assets: PresentationAssets;
  /** Nykyinen käsikirjoitus; @-tunnukset näkyvät ennen kuin speakerHandles on commitattu. */
  scriptText?: string;
  compact?: boolean;
}) {
  const rows = speakerBindingRows(model, assets, scriptText);
  if (!rows.length) return null;
  return (
    <div className={`speaker-binding-table${compact ? ' compact' : ''}`}>
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
                {row.packId ? (
                  <>
                    <code>{row.packId}</code>
                    {!compact && row.packLabel !== row.packId ? ` · ${row.packLabel}` : ''}
                  </>
                ) : (
                  '—'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.some(r => r.pendingCharacter) && (
        <p role="status">@tunnus ilman Hahmo-riviä: lisää hahmo käsikirjoitukseen ja Jaa kohtauksiin.</p>
      )}
      {rows.some(r => r.missing && !r.pendingCharacter) && (
        <p role="status">Puuttuva paketti: valitse hahmo alla tai Hahmot-kirjastosta.</p>
      )}
    </div>
  );
}
