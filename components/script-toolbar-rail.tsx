/** Käsikirjoituksen työkalurivi — yksi toteutus dockille ja upotetulle sarakkeelle. */
export default function ScriptToolbarRail({
  scriptLocked,
  sourceChanged,
  docked,
  job,
  onImportText,
  onLoadExample,
  onNewScene,
  onSaveSource,
}: {
  scriptLocked: boolean;
  sourceChanged?: boolean;
  docked?: boolean;
  job: (fn: () => Promise<void>) => void;
  onImportText: (text: string) => Promise<void>;
  onLoadExample: (id: 'kilsat' | 'auto' | 'youtube' | 'short') => void;
  onNewScene: () => void;
  onSaveSource?: () => Promise<void>;
}) {
  const importFile = (f: File | undefined) => {
    if (!f) return;
    void job(async () => {
      if (f.size > 150000) throw Error('Tekstitiedosto on liian suuri.');
      await onImportText(new TextDecoder('utf-8', { fatal: true }).decode(await f.arrayBuffer()));
    });
  };

  return (
    <aside className="script-sidebar script-left-rail" aria-label="Käsikirjoitustoiminnot">
      <div className="script-toolbar" role="toolbar" aria-label="Käsikirjoitustoiminnot">
        {docked ? (
          <label className="script-file-import secondary" title="Tuo UTF-8-tekstitiedosto">
            <span className="script-file-import-title">Tuo tekstitiedosto</span>
            <span className="script-file-import-hint">.md tai .txt (UTF-8)</span>
            <input
              type="file"
              accept=".md,.txt"
              disabled={scriptLocked}
              onChange={(e) => {
                importFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>
        ) : (
          <label className="file-label secondary">
            Tuo UTF-8-teksti
            <input
              type="file"
              accept=".md,.txt"
              disabled={scriptLocked}
              onChange={(e) => {
                importFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>
        )}
        <details className="script-toolbar-more">
          <summary title={docked ? 'Esimerkit' : undefined}>Esimerkit</summary>
          <div className="script-toolbar-more-panel">
            <button className="secondary" disabled={scriptLocked} onClick={() => onLoadExample('kilsat')}>
              Lataa KILSAT-esimerkki
            </button>
            <button className="secondary" disabled={scriptLocked} onClick={() => onLoadExample('auto')}>
              Lataa toinen esimerkki · auto
            </button>
            <button className="secondary" disabled={scriptLocked} onClick={() => onLoadExample('youtube')}>
              YouTube-runko · kartonki
            </button>
            <button className="secondary" disabled={scriptLocked} onClick={() => onLoadExample('short')}>
              Uusi lyhytvideo-pohja
            </button>
          </div>
        </details>
        <button className="secondary" disabled={scriptLocked} onClick={onNewScene}>
          Uusi kohtaus · säilytä nykyinen
        </button>
        {sourceChanged && onSaveSource && (
          <button className="secondary" disabled={scriptLocked} onClick={() => void job(onSaveSource)}>
            Tallenna käsikirjoitusteksti
          </button>
        )}
      </div>
      <details className="script-syntax-help">
        <summary title={docked ? 'Syntaksiohje' : undefined}>Syntaksi</summary>
        <p className="panel-note">
          Valinnainen puhujan tunnus: <code>@mira → MIRA</code> tai <code>Tunnus @mira: MIRA</code>. Repliikissä{' '}
          <code>@mira: &quot;Hei.&quot;</code> tulkitaan samaksi hahmoksi.
        </p>
        <p className="panel-note">
          Suomi ja englanti: <code>Character: Kille</code>, <code>Kille walks right 2 seconds</code>,{' '}
          <code>Camera: wide 1 second</code>. Tiukka sääntöpohjainen tila: aloita rivillä <code>#!kilsat</code>.
          Määritä <code>Hahmo: Kille</code>, sitten esimerkiksi <code>Kille kävelee oikealle 2 s</code>.{' '}
          <code>Samalla:</code> aloittaa tapahtuman edeltävän tapahtuman kanssa. Tuntemattomat rivit estävät
          rakentamisen.
        </p>
      </details>
    </aside>
  );
}
