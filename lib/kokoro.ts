import { encodeSpeechWav } from './phonetic-speech.ts';

/** Paikallinen Kokoro-puhesynteesi (vaihe E0). Moottori on vaihdettava rajapinta; testit käyttävät testimoottoria. */
export const KOKORO_LABEL = 'Kokoro · synteettinen';
export const KOKORO_MODEL_VERSION = 'Kokoro-82M-v1.0-ONNX';
export const KOKORO_MAX_LINE = 600;
export const KOKORO_VOICES: readonly { id: string; label: string }[] = [
  { id: 'af_heart', label: 'Heart · nainen' },
  { id: 'af_bella', label: 'Bella · nainen' },
  { id: 'af_nicole', label: 'Nicole · nainen' },
  { id: 'am_adam', label: 'Adam · mies' },
  { id: 'am_michael', label: 'Michael · mies' },
  { id: 'bf_emma', label: 'Emma · nainen (UK)' },
  { id: 'bm_george', label: 'George · mies (UK)' },
];
const voiceIds = new Set(KOKORO_VOICES.map(v => v.id));
export const isKokoroVoice = (id: unknown): id is string => typeof id === 'string' && voiceIds.has(id);

/** Tallennetaan AudioClip.synthetic-kenttään. Merkintä ei koskaan ole pelkkä käyttöliittymän teksti. */
export type KokoroProvenance = { engine: 'kokoro'; voice: string; speed: number; modelVersion: string; key: string };

const FAST = /^(?:quickly|fast|rapidly|nopeasti|nopea)$/i;
const SLOW = /^(?:slowly|slow|hitaasti|hidas)$/i;
export type SpokenLine = { text: string; speed: number; notices: string[] };

/**
 * Sulkeohjeet: vain nopeusohjeet tulkitaan. Muut, esim. (whispers), poistetaan puhutusta tekstistä ja palautetaan
 * huomautuksena. Tunnetta ei arvata eikä korvata toisella.
 */
export function parseSpokenText(raw: string): SpokenLine {
  const notices: string[] = [];
  let speed = 1;
  const text = raw
    .replace(/\(([^()]{0,60})\)/g, (_all, inner: string) => {
      const cue = inner.trim();
      if (FAST.test(cue)) speed = Math.min(1.25, speed * 1.2);
      else if (SLOW.test(cue)) speed = Math.max(0.7, speed * 0.85);
      else notices.push(`Kokoro ei tue ohjetta (${cue}); sitä ei arvata.`);
      return ' ';
    })
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length > KOKORO_MAX_LINE) notices.push(`Rivi on yli ${KOKORO_MAX_LINE} merkkiä.`);
  return { text, speed: Math.round(speed * 1000) / 1000, notices };
}

const FINNISH = /[äöÄÖ]|\b(?:että|mutta|minä|sinä|mitä|kun|niin|olen|oli|joo|ei|kyllä|hän|siirsitkö|eilen)\b/i;
/** Kokoro-ääni tässä vaiheessa vain englanniksi; suomalaista riviä ei yritetä lausua englantilaisella äänellä. */
export const isEnglishLine = (text: string) => /[a-z]/i.test(text) && !FINNISH.test(text);

export async function kokoroKey(text: string, voice: string, speed: number, modelVersion: string): Promise<string> {
  const data = new TextEncoder().encode(JSON.stringify(['kokoro', text, voice, speed, modelVersion]));
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', data))].map(b => b.toString(16).padStart(2, '0')).join('');
}

export type SpeechRequest = { text: string; voice: string; speed: number };
export type SpeechAudio = { samples: Float32Array; sampleRate: number };
export type SpeechEngine = {
  id: string;
  modelVersion: string;
  synthesize(request: SpeechRequest, signal?: AbortSignal): Promise<SpeechAudio>;
};

/** Deterministinen korvaava moottori: ei mallia, ei verkkoa. Kesto seuraa tekstin pituutta ja nopeutta. */
export function createTestEngine(modelVersion = 'test-engine'): SpeechEngine & { calls: SpeechRequest[] } {
  const calls: SpeechRequest[] = [];
  return {
    id: 'test',
    modelVersion,
    calls,
    async synthesize(request, signal) {
      signal?.throwIfAborted();
      calls.push({ ...request });
      const rate = 24000,
        seconds = Math.max(0.2, (request.text.length * 0.06) / request.speed),
        samples = new Float32Array(Math.round(seconds * rate)),
        pitch = 180 + (request.voice.charCodeAt(0) % 7) * 20;
      for (let i = 0; i < samples.length; i++) samples[i] = 0.2 * Math.sin((2 * Math.PI * pitch * i) / rate);
      return { samples, sampleRate: rate };
    },
  };
}

export type DialogueLine = { id: string; speaker: string; text: string };
export type CachedVoice = { wav: Uint8Array; duration: number };
export type LineStatus = 'synthesized' | 'cached' | 'current' | 'kept-own-audio' | 'needs-review' | 'no-voice' | 'unsupported-language' | 'empty';
export type LineResult = {
  id: string;
  status: LineStatus;
  notices: string[];
  wav?: Uint8Array;
  duration?: number;
  provenance?: KokoroProvenance;
};
export type SynthesisOptions = {
  lines: DialogueLine[];
  engine: SpeechEngine;
  /** Puhujan Kokoro-ääni; puuttuva ääni estää rivin. */
  voiceFor: (speaker: string) => string | undefined;
  /** Rivi, jolla on jo käyttäjän äänittämä tai tuoma ääni. Sitä ei koskaan synteettisoida. */
  hasOwnAudio?: (id: string) => boolean;
  /** Rivit, joiden huomautukset käyttäjä on hyväksynyt (tällöin puhe tuotetaan ilman tukemattomia ohjeita). */
  acceptedNotices?: ReadonlySet<string>;
  /** Rivin nykyisen Kokoro-version avain. Jos se vastaa uutta avainta, riviä ei tuoteta uudelleen. */
  existingKey?: (id: string) => string | undefined;
  /** Rivit, jotka tuotetaan uudelleen välimuistista huolimatta. */
  force?: ReadonlySet<string>;
  cache?: Map<string, CachedVoice>;
  signal?: AbortSignal;
  onProgress?: (done: number, total: number, result: LineResult) => void;
};

const durationOf = (a: SpeechAudio) => a.samples.length / a.sampleRate;

/** Tuottaa vain puuttuvat tai muuttuneet rivit. Palautus ei muuta yhtään olemassa olevaa ääntä. */
export async function synthesizeLines(o: SynthesisOptions): Promise<LineResult[]> {
  const out: LineResult[] = [],
    cache = o.cache ?? new Map<string, CachedVoice>();
  for (const [index, line] of o.lines.entries()) {
    o.signal?.throwIfAborted();
    const result = await synthesizeOne(line, o, cache);
    out.push(result);
    o.onProgress?.(index + 1, o.lines.length, result);
  }
  return out;
}

async function synthesizeOne(line: DialogueLine, o: SynthesisOptions, cache: Map<string, CachedVoice>): Promise<LineResult> {
  if (o.hasOwnAudio?.(line.id)) return { id: line.id, status: 'kept-own-audio', notices: [] };
  const spoken = parseSpokenText(line.text),
    notices = [...spoken.notices];
  if (!spoken.text) return { id: line.id, status: 'empty', notices: [...notices, 'Rivillä ei ole puhuttavaa tekstiä.'] };
  if (spoken.text.length > KOKORO_MAX_LINE) return { id: line.id, status: 'needs-review', notices };
  if (!isEnglishLine(spoken.text)) return { id: line.id, status: 'unsupported-language', notices: [...notices, 'Kokoro tukee tässä vaiheessa vain englanninkielisiä rivejä.'] };
  const voice = o.voiceFor(line.speaker);
  if (!voice || !isKokoroVoice(voice)) return { id: line.id, status: 'no-voice', notices: [...notices, `Puhujalle ${line.speaker} ei ole valittu Kokoro-ääntä.`] };
  if (notices.length && !o.acceptedNotices?.has(line.id)) return { id: line.id, status: 'needs-review', notices };
  const key = await kokoroKey(spoken.text, voice, spoken.speed, o.engine.modelVersion),
    provenance: KokoroProvenance = { engine: 'kokoro', voice, speed: spoken.speed, modelVersion: o.engine.modelVersion, key },
    forced = o.force?.has(line.id) ?? false;
  if (!forced && o.existingKey?.(line.id) === key) return { id: line.id, status: 'current', notices, provenance };
  const hit = forced ? undefined : cache.get(key);
  if (hit) return { id: line.id, status: 'cached', notices, wav: hit.wav, duration: hit.duration, provenance };
  const audio = await o.engine.synthesize({ text: spoken.text, voice, speed: spoken.speed }, o.signal);
  if (!audio.samples.length || !Number.isFinite(audio.sampleRate) || audio.sampleRate < 8000) throw Error('Puhemoottori palautti virheellisen äänen.');
  const wav = encodeSpeechWav([audio.samples], audio.sampleRate),
    duration = durationOf(audio);
  cache.set(key, { wav, duration });
  return { id: line.id, status: 'synthesized', notices, wav, duration, provenance };
}

type KokoroBridge = {
  kokoroSynthesize(request: SpeechRequest): Promise<SpeechAudio & { modelVersion: string }>;
  kokoroCancel(): Promise<void>;
};
/** Mac-sovelluksen moottori: pyyntö kulkee kapean validoidun IPC:n kautta pääprosessin Kokoro-palveluun. */
export function createDesktopEngine(bridge: KokoroBridge): SpeechEngine {
  return {
    id: 'kokoro',
    modelVersion: KOKORO_MODEL_VERSION,
    async synthesize(request, signal) {
      signal?.throwIfAborted();
      const cancel = () => void bridge.kokoroCancel();
      signal?.addEventListener('abort', cancel, { once: true });
      try {
        const audio = await bridge.kokoroSynthesize(request);
        signal?.throwIfAborted();
        if (audio.modelVersion !== KOKORO_MODEL_VERSION) throw Error('Puhemallin versio ei täsmää.');
        return { samples: audio.samples, sampleRate: audio.sampleRate };
      } finally {
        signal?.removeEventListener('abort', cancel);
      }
    },
  };
}
