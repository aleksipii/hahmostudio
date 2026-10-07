import { recognizeScript, describeLine } from './script-recognizer.ts';

/** Debounce live-marginaaliskannaukselle (ms) — alle ~100 ms tuntuva viive pitkissä teksteissä. */
export const SCRIPT_ANNOTATE_DEBOUNCE_MS = 150;

/** Johdettu rivikohtainen skannaus käsikirjoituksen marginaaleihin — ei muuta parse-moottoria. */

export type ScriptLineAnnotation = {
  line: number;
  left?: string;
  right?: string;
  kind: 'empty' | 'scene' | 'speaker' | 'character' | 'time' | 'heading' | 'comment' | 'body';
  /** Sääntötunnistin ei ymmärtänyt riviä: näytetään varoituksena marginaalissa. */
  unrecognized?: boolean;
};

const sceneRe = /^(?:Kohtaus|Scene):\s*(.*)$/i;
const characterRe = /^(?:Hahmo|Character)\s+([\p{L}][\p{L}\s.]{0,35}):/iu;
const speakerLineRe = /^([\p{L}][\p{L}\s.]{0,35}):\s*$/u;
const inlineSpeakerRe = /^([\p{L}][\p{L}\s.]{0,35}):\s*[“"„]/u;
const timeRe = /^(\d+:\d{2})\s*[-–—]\s*(\d+:\d{2})/;
const titleRe = /^(?:Jakson nimi|Title):/i;

export function scanScriptLineAnnotations(text: string): ScriptLineAnnotation[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  let sceneIndex = 0;
  const out: ScriptLineAnnotation[] = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim().replace(/^#{1,6}\s*/, '').replace(/\*\*/g, '');
    const n = i + 1;
    if (!line) {
      out.push({ line: n, kind: 'empty' });
      continue;
    }
    if (line.startsWith('#!kilsat')) {
      out.push({ line: n, left: '§', right: 'Tiukka tila', kind: 'heading' });
      continue;
    }
    if (titleRe.test(line)) {
      out.push({ line: n, right: 'Otsikko', kind: 'heading' });
      continue;
    }
    const scene = line.match(sceneRe);
    if (scene) {
      sceneIndex += 1;
      const name = scene[1].trim();
      out.push({
        line: n,
        left: String(sceneIndex).padStart(2, '0'),
        right: name.length > 18 ? name.slice(0, 16) + '…' : name,
        kind: 'scene',
      });
      continue;
    }
    const times = line.match(timeRe);
    if (times) {
      out.push({ line: n, left: '⏱', right: `${times[1]}–${times[2]}`, kind: 'time' });
      continue;
    }
    const character = line.match(characterRe);
    if (character) {
      out.push({ line: n, right: character[1].trim(), kind: 'character' });
      continue;
    }
    if (speakerLineRe.test(line)) {
      out.push({ line: n, right: line.slice(0, -1), kind: 'speaker' });
      continue;
    }
    const inline = line.match(inlineSpeakerRe);
    if (inline) {
      out.push({ line: n, right: inline[1].trim(), kind: 'speaker' });
      continue;
    }
    if (/^(?:CUT|LAAJA|WIDE|MEDIUM|CLOSE)/i.test(line)) {
      out.push({ line: n, right: 'Kuva', kind: 'body' });
      continue;
    }
    if (/^\/\//.test(line) || /^(Character Animator|Leikkauskieli)/i.test(line)) {
      out.push({ line: n, kind: 'comment' });
      continue;
    }
    out.push({ line: n, kind: 'body' });
  }
  // Lainattu repliikki: merkitään suoraan, ei tarvita tunnistinta.
  for (const a of out) if (a.kind === 'body' && !a.right && /^[“"„«].*[”"»]?\.?$/.test(lines[a.line - 1].trim())) a.right = 'Repliikki';
  // Ohjerivit: sääntöpohjainen tunnistin kertoo marginaalissa, mitä rivi tekee (tai ettei sitä tunnistettu).
  if (out.some((a) => a.kind === 'body' && !a.right)) {
    const recognized = recognizeScript(text, [], { discoverActors: true }).lines;
    for (const a of out) {
      if (a.kind !== 'body' || a.right) continue;
      const r = recognized[a.line - 1];
      if (!r || r.kind === 'empty') continue;
      const label = describeLine(r);
      if (label) a.right = label.length > 28 ? label.slice(0, 26) + '…' : label;
      if (r.kind === 'unknown') a.unrecognized = true;
    }
  }
  return out;
}

/** Kohtausrajat snap-jakajalle (rivinumerot). */
export function scriptSceneBoundaryLines(annotations: ScriptLineAnnotation[]): number[] {
  return annotations.filter((a) => a.kind === 'scene' || a.kind === 'time').map((a) => a.line);
}

export function snapDividerLine(line: number, boundaries: number[], maxLine: number): number {
  const clamped = Math.max(1, Math.min(maxLine, Math.round(line)));
  if (!boundaries.length) return clamped;
  let best = boundaries[0];
  let dist = Math.abs(clamped - best);
  for (const b of boundaries) {
    const d = Math.abs(clamped - b);
    if (d < dist) {
      dist = d;
      best = b;
    }
  }
  return dist <= 3 ? best : clamped;
}
