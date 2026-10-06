import { normalizeSpeaker } from './presentation-model.ts';

const DECL =
  /^(?:Tunnus\s+)?@([a-zA-Z0-9_.-]{1,32})\s*(?:→|->|:)\s*([\p{L}][\p{L}\s.]{0,35})\s*$/u;

/** Parses `@mira → MIRA` / `Tunnus @mira: MIRA` lines (handles lower-case, no @ in map keys). */
export function parseSpeakerHandleAliases(original: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of original.replace(/\r\n?/g, '\n').split('\n')) {
    const m = line.trim().match(DECL);
    if (!m) continue;
    out[m[1].toLowerCase()] = m[2].trim();
  }
  return out;
}

export function stripSpeakerHandleDeclarations(original: string): string {
  return original
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter(line => !line.trim().match(DECL))
    .join('\n');
}

/** Rewrites `@handle:` dialogue and `@handle action` to canonical speaker names before parse. */
export function applySpeakerHandlesToScript(original: string, handles: Record<string, string>): string {
  let text = stripSpeakerHandleDeclarations(original);
  for (const [handle, speaker] of Object.entries(handles)) {
    const esc = handle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    text = text.replace(new RegExp(`@${esc}\\s*:`, 'giu'), `${speaker}:`);
    text = text.replace(
      new RegExp(`@${esc}(\\s+(?:kävelee|walks|vilkuttaa|waves|nyökkää|nods|pysähtyy|stops))`, 'giu'),
      `${speaker}$1`,
    );
  }
  return text;
}

/** Maps informal stems to canonical speaker ids for `parsePresentation` alias table. */
export function speakerHandlesToPresentationAliases(handles: Record<string, string>): Record<string, string> {
  const aliases: Record<string, string> = {};
  for (const [handle, speaker] of Object.entries(handles)) {
    aliases[normalizeSpeaker(handle)] = normalizeSpeaker(speaker);
    aliases[normalizeSpeaker(speaker)] = normalizeSpeaker(speaker);
  }
  return aliases;
}
