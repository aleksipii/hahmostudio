import { useEffect, useRef, useState } from 'react';
import { desktop, type KokoroStatus } from '../lib/platform';
import type { AudioClip, Presentation } from '../lib/presentation-model';
import type { PresentationAudio } from '../lib/presentation-audio';
import { KOKORO_LABEL, KOKORO_VOICES, createDesktopEngine, synthesizeLines, type CachedVoice, type LineResult } from '../lib/kokoro';

const STATUS_TEXT: Record<LineResult['status'], string> = {
  synthesized: 'Tuotettu',
  cached: 'Tuotettu välimuistista',
  current: 'Ajan tasalla',
  'kept-own-audio': 'Oma ääni säilytetty',
  'needs-review': 'Huomautus vaatii hyväksynnän',
  'no-voice': 'Ääni puuttuu',
  'unsupported-language': 'Vain englanti',
  empty: 'Ei puhuttavaa',
};

/** Paikallinen Kokoro-puhe (E0). Ei koskaan ylikirjoita käyttäjän äänittämää tai tuomaa ääntä. */
export default function KokoroPanel({
  model,
  voices,
  disabled,
  setVoice,
  commit,
}: {
  model: Presentation;
  voices: Record<string, PresentationAudio>;
  disabled: boolean;
  setVoice: (speaker: string, voice: string) => Promise<void>;
  /** Liittää yhden rivin äänen yhtenä kumottavana muutoksena ja palaa vasta, kun malli on päivittynyt. */
  commit: (dialogue: string, file: File, synthetic: NonNullable<AudioClip['synthetic']>) => Promise<void>;
}) {
  const bridge = desktop();
  const [status, setStatus] = useState<KokoroStatus>();
  const [progress, setProgress] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [results, setResults] = useState<Record<string, LineResult>>({});
  const [accepted, setAccepted] = useState<ReadonlySet<string>>(new Set());
  const cache = useRef(new Map<string, CachedVoice>());
  const abort = useRef<AbortController | null>(null);
  const player = useRef<HTMLAudioElement | null>(null);
  const speakers = model.bindings.map(b => b.speaker);
  const dialogue = model.events.filter(e => e.kind === 'dialogue');
  useEffect(() => {
    if (!bridge) return;
    let live = true;
    void bridge.kokoroStatus().then(s => live && setStatus(s)).catch(() => undefined);
    const off = bridge.onKokoroProgress(p => live && setProgress(`${p.file}: ${Math.round(p.received / 1048576)} Mt${p.total ? ' / ' + Math.round(p.total / 1048576) + ' Mt' : ''}`));
    return () => {
      live = false;
      off();
      abort.current?.abort();
      player.current?.pause();
    };
  }, [bridge]);
  if (!bridge) {
    return (
      <section className="performance-panel kokoro-panel">
        <h3>Kokoro-puhe</h3>
        <p>Paikallinen puhesynteesi toimii vain Mac-sovelluksessa. Selaimessa käytä tuotuja tai äänitettyjä repliikkejä.</p>
      </section>
    );
  }
  const clipOf = (id: string) => model.audioClips.find(c => c.dialogue === id);
  const run = async (ids: string[], force: string[] = []) => {
    if (busy) return;
    setBusy(true);
    setMessage('');
    const controller = new AbortController();
    abort.current = controller;
    try {
      const lines = dialogue.filter(e => ids.includes(e.id)).map(e => ({ id: e.id, speaker: e.target, text: e.text ?? '' }));
      let changed = 0;
      const out = await synthesizeLines({
        lines,
        engine: createDesktopEngine(bridge),
        voiceFor: speaker => model.bindings.find(b => b.speaker === speaker)?.kokoroVoice,
        hasOwnAudio: id => {
          const c = clipOf(id);
          return !!c && (!c.synthetic || !!c.locked);
        },
        existingKey: id => clipOf(id)?.synthetic?.key,
        acceptedNotices: accepted,
        force: new Set(force),
        cache: cache.current,
        signal: controller.signal,
        onProgress: (done, total, r) => {
          setResults(prev => ({ ...prev, [r.id]: r }));
          setProgress(`Rivi ${done}/${total}: ${STATUS_TEXT[r.status]}`);
        },
      });
      for (const r of out) {
        controller.signal.throwIfAborted();
        if (!r.wav || !r.provenance) continue;
        await commit(r.id, new File([r.wav as BlobPart], `kokoro-${r.id}.wav`, { type: 'audio/wav' }), r.provenance);
        changed++;
      }
      setMessage(changed ? `${changed} riviä tuotettu (${KOKORO_LABEL}). Rakenna jakso uudelleen ennen uuden version vientiä.` : 'Ei uusia tuotettavia rivejä.');
    } catch (e) {
      setMessage(controller.signal.aborted ? 'Tuotanto peruttiin.' : e instanceof Error ? e.message : 'Puhesynteesi epäonnistui.');
    } finally {
      abort.current = null;
      setBusy(false);
    }
  };
  const download = async () => {
    setBusy(true);
    setMessage('');
    try {
      const r = await bridge.kokoroDownload();
      if ('cancelled' in r) setMessage('Latausta ei aloitettu.');
      else setStatus(r);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Mallin lataus epäonnistui.');
    } finally {
      setProgress('');
      setBusy(false);
    }
  };
  const play = (id: string) => {
    const clip = clipOf(id),
      file = clip && voices[clip.asset];
    if (!file) return;
    player.current?.pause();
    const url = URL.createObjectURL(file.blob),
      audio = new Audio(url);
    audio.onended = audio.onerror = () => URL.revokeObjectURL(url);
    player.current = audio;
    void audio.play().catch(() => URL.revokeObjectURL(url));
  };
  const idle = !busy && !disabled;
  return (
    <section className="performance-panel kokoro-panel" aria-labelledby="kokoro-title">
      <h3 id="kokoro-title">Kokoro-puhe · paikallinen, englanti</h3>
      <p>Synteesi tuottaa vain puuttuvat englanninkieliset rivit. Itse äänitettyä tai tuotua ääntä ei ylikirjoiteta. Suomenkielistä riviä ei lausuta englantilaisella äänellä.</p>
      {!status?.installed ? (
        <div>
          <p>Mallia ei ole ladattu. Lataus (noin 100 Mt, {status?.license ?? 'Apache-2.0'}) alkaa vasta vahvistettuasi sen. Malli tallennetaan sovelluksen tietokansioon, ei projektiin.</p>
          {status?.error && <p role="alert">{status.error}</p>}
          <button className="primary" disabled={!idle} onClick={() => void download()}>Lataa Kokoro-malli</button>
          {busy && <button className="secondary" onClick={() => void bridge.kokoroCancel()}>Peruuta</button>}
        </div>
      ) : (
        <>
          <div className="kokoro-voices">
            {speakers.map(speaker => (
              <label key={speaker}>
                {speaker} · ääni
                <select
                  disabled={!idle}
                  value={model.bindings.find(b => b.speaker === speaker)?.kokoroVoice ?? ''}
                  onChange={e => void setVoice(speaker, e.target.value).catch(err => setMessage(err instanceof Error ? err.message : 'Äänen valinta epäonnistui.'))}
                >
                  <option value="">Valitse ääni</option>
                  {KOKORO_VOICES.map(v => (
                    <option key={v.id} value={v.id}>{v.label}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <div className="kokoro-actions">
            <button className="primary" disabled={!idle || !dialogue.length} onClick={() => void run(dialogue.map(e => e.id))}>Tuota ääninauha</button>
            {busy && <button className="secondary" onClick={() => { abort.current?.abort(); void bridge.kokoroCancel(); }}>Peruuta</button>}
            <button className="secondary" disabled={!idle} onClick={() => void bridge.kokoroRemove().then(setStatus).catch(e => setMessage(e instanceof Error ? e.message : 'Poisto epäonnistui.'))}>Poista malli</button>
          </div>
          <ul className="kokoro-lines">
            {dialogue.map(e => {
              const clip = clipOf(e.id),
                r = results[e.id],
                own = !!clip && !clip.synthetic;
              return (
                <li key={e.id}>
                  <span>{e.target}: {e.text}</span>{' '}
                  <strong>{clip?.synthetic ? KOKORO_LABEL : own ? 'Oma ääni' : 'Ei ääntä'}</strong>
                  {clip && <span> · {clip.duration.toFixed(2)} s</span>}
                  {r && <span> · {STATUS_TEXT[r.status]}</span>}
                  {r?.notices.map(n => <em key={n} role="status"> {n}</em>)}
                  {r?.status === 'needs-review' && (
                    <label>
                      <input type="checkbox" checked={accepted.has(e.id)} onChange={ev => setAccepted(prev => { const next = new Set(prev); ev.target.checked ? next.add(e.id) : next.delete(e.id); return next; })} />
                      Hyväksy neutraali puhe ilman tukemattomia ohjeita
                    </label>
                  )}
                  {clip && <button className="secondary tiny" aria-label={`Soita: ${e.text}`} onClick={() => play(e.id)}>▶</button>}
                  <button className="secondary tiny" disabled={!idle || own} title={own ? 'Oma ääni suojataan' : undefined} onClick={() => void run([e.id], [e.id])}>Tuota uudelleen</button>
                </li>
              );
            })}
          </ul>
        </>
      )}
      {progress && busy && <p role="status">{progress}</p>}
      {message && <p role="status">{message}</p>}
      <p><small>Muistin ja nopeuden mittaus on tekemättä: se tehdään omalla Macilla. Mallin tarkiste kirjataan ensilatauksella eikä sitä ole verrattu julkaistuun arvoon.</small></p>
    </section>
  );
}
