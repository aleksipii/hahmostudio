import { functions, type Presentation } from './presentation-model.ts';

export function patchSpeakerBinding(
  model: Presentation,
  speaker: string,
  assetId: string,
): Presentation {
  const existing = model.bindings.find(b => b.speaker === speaker);
  const side =
    existing?.side ??
    (model.characters.indexOf(speaker) === 0 ? 'left' : model.characters.indexOf(speaker) > 0 ? 'right' : 'left');
  return {
    ...model,
    bindings: [
      ...model.bindings.filter(b => b.speaker !== speaker),
      {
        speaker,
        asset: assetId,
        voice:
          existing?.voice ??
          model.direction?.profiles.find(p => p.speaker === speaker)?.delivery ??
          'Omat repliikkiäänet',
        side,
        functions: existing?.functions ?? Object.fromEntries(functions.map(f => [f, 'supported'] as const)),
      },
    ],
  };
}
