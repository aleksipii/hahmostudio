import type { PresentationAssets } from './presentation-compile.ts';
import { normalizeSpeaker, type Presentation } from './presentation-model.ts';
import { parseSpeakerHandleAliases } from './speaker-handle-aliases.ts';
import { suggestPackForSpeaker } from './speaker-pack-options.ts';
import { studioMetadata } from './studio/domain.ts';

/** Committed metadata wins; käsikirjoituksen @-rivit täyttävät tyhjät ennen Jaa kohtauksiin -commitia. */
export function effectiveSpeakerHandles(model: Presentation, scriptText?: string): Record<string, string> {
  const meta = studioMetadata(model).speakerHandles ?? {};
  const raw = scriptText?.trim() || studioMetadata(model).rawScript || '';
  return { ...parseSpeakerHandleAliases(raw), ...meta };
}

export type SpeakerBindingRow = {
  speaker: string;
  handle: string;
  packId: string;
  packLabel: string;
  missing: boolean;
  /** @-tunnuksen kohde ennen Hahmo:-riviä / characters-listaa. */
  pendingCharacter?: boolean;
  suggestedPack?: string;
};

function bindingTableSpeakers(model: Presentation, handles: Record<string, string>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (name: string) => {
    const norm = normalizeSpeaker(name);
    if (!norm || seen.has(norm)) return;
    seen.add(norm);
    out.push(name.trim());
  };
  for (const speaker of model.characters) push(speaker);
  for (const target of Object.values(handles)) push(target);
  return out;
}

export function speakerBindingRows(
  model: Presentation,
  assets: PresentationAssets,
  scriptText?: string,
): SpeakerBindingRow[] {
  const handles = effectiveSpeakerHandles(model, scriptText);
  const characterNorms = new Set(model.characters.map(normalizeSpeaker));
  const handleForSpeaker = (speaker: string) => {
    const norm = normalizeSpeaker(speaker);
    for (const [h, target] of Object.entries(handles)) {
      if (normalizeSpeaker(target) === norm) return `@${h}`;
    }
    return '—';
  };
  return bindingTableSpeakers(model, handles).map(speaker => {
    const norm = normalizeSpeaker(speaker);
    const binding = model.bindings.find(b => normalizeSpeaker(b.speaker) === norm);
    const packId = binding?.asset ?? '';
    const pack = packId ? assets[packId] : undefined;
    const pendingCharacter = !characterNorms.has(norm);
    const handleKey = Object.entries(handles).find(([, t]) => normalizeSpeaker(t) === norm)?.[0];
    const suggestedPack = !packId ? suggestPackForSpeaker(speaker, handleKey ? `@${handleKey}` : undefined) : undefined;
    return {
      speaker,
      handle: handleForSpeaker(speaker),
      packId,
      packLabel: pack?.doc.name?.replace(/\.psd$/i, '') ?? (packId || '—'),
      missing: !packId || !pack,
      pendingCharacter,
      suggestedPack,
    };
  });
}
