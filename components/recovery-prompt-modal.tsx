import type { RecoverySnapshot } from '../lib/studio/recovery';

/** Pakollinen valinta käynnistyksen palautuspisteestä — ei alareunan banneria. */
export default function RecoveryPromptModal({
  snapshot,
  error,
  busy,
  onRestore,
  onContinue,
  onDiscard,
  onClearCorrupt,
}: {
  snapshot: RecoverySnapshot | null;
  error: string;
  busy: boolean;
  onRestore: () => void;
  onContinue: () => void;
  onDiscard: () => void;
  onClearCorrupt: () => void;
}) {
  if (!snapshot && !error) return null;

  return (
    <div className="modal-backdrop recovery-modal-backdrop" role="presentation">
      <section
        className="help-modal recovery-prompt-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="recovery-prompt-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-heading">
          <h2 id="recovery-prompt-title">
            {error ? 'Palautuspisteessä on ongelma' : 'Edellinen työ löytyi automaattitallennuksesta'}
          </h2>
        </div>
        {error ? (
          <>
            <p className="recovery-prompt-lead">
              Palautustiedostoa ei voitu avata turvallisesti. Voit poistaa vioittuneen tallennuksen ja jatkaa
              nykyisellä näkymällä.
            </p>
            <p className="recovery-prompt-detail" role="status">
              {error}
            </p>
            <div className="recovery-prompt-actions">
              <button type="button" className="primary" onClick={onClearCorrupt}>
                Poista vioittuneet palautuspisteet
              </button>
            </div>
          </>
        ) : (
          snapshot && (
            <>
              <p className="recovery-prompt-lead">
                Valitse jatketaanko tallennetusta versiosta vai nykyisellä työpöydällä. Muokkaus on estetty, kunnes
                valitset yhden vaihtoehdoista.
              </p>
              <dl className="recovery-prompt-meta">
                <div>
                  <dt>Projekti</dt>
                  <dd>{snapshot.name}</dd>
                </div>
                <div>
                  <dt>Tallennettu</dt>
                  <dd>{new Date(snapshot.createdAt).toLocaleString('fi-FI')}</dd>
                </div>
              </dl>
              {(snapshot.previous || snapshot.replayed) && (
                <p className="recovery-prompt-detail" role="status">
                  {snapshot.previous ? 'Uusin tallennus oli vioittunut; näytetään edellinen ehjä versio. ' : ''}
                  {snapshot.replayed ? 'Palautus on rakennettu vahvistetuista journal-merkinnöistä.' : ''}
                </p>
              )}
              <div className="recovery-prompt-actions">
                <button type="button" className="primary" autoFocus onClick={onContinue}>
                  Jatka nykyisellä projektilla
                </button>
                <button type="button" className="secondary" disabled={busy} onClick={onRestore}>
                  Palauta tallennettu työ
                </button>
                <button type="button" className="text-button" onClick={onDiscard}>
                  Poista palautuspiste
                </button>
              </div>
            </>
          )
        )}
      </section>
    </div>
  );
}
