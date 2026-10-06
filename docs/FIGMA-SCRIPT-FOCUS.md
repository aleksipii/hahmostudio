# Figma — Script / Focus · capture (0.42)

Design-tiedosto: [KILSAT Script UI · 0.38](https://www.figma.com/design/FFy68Fynv4Ds2VgRANZoXc)

## Frame: `Script / Focus · 03 Editor hero`

| Alue | px / token | Sovellus |
|------|------------|----------|
| Overlay | `screenplay-page` inset 64 / 26 | `app-shell.css` |
| Content max | 680 px | `.screenplay-page .presentation-panel` |
| Compose min-height | 360–530 px | `[data-script-layout=focus]` |
| Sticky CTA | 56 px | `.script-sticky-bar` |
| Piilotettu focusissa | otsikko, johdanto, 1–5-nav | `.script-panel--focus` |

## Capture-checklist (~10 min)

1. `npm run dev` → yläpalkki **Käsikirjoitus** (focus overlay).
2. Täytä textarea esimerkillä tai jätä tyhjä + ScriptGuide.
3. Varmista: ei vasemman paneelin häiriötä, Esc/Tab-vihje näkyy, **Jaa kohtauksiin** sticky alareunassa.
4. Figma: uusi frame **Script / Focus · 03 Editor hero** (1440×900) tai päivitä olemassa oleva.
5. **Import** localhost-capture (Cursor browser / screenshot) → linkitä FigJam sticky 1: [Script user flow](https://www.figma.com/board/RQ3kH9AAduLT7E3iJabv3e) kohta *Focus ↔ Panel*.

## Prototype-linkit (FigJam)

| Näkymä | Trigger | Kohde |
|--------|---------|--------|
| Panel draft | Topbar Käsikirjoitus | Focus hero |
| Focus hero | Esc / Takaisin | Editor panel |
| Focus hero | Jaa kohtauksiin | Parsing (03) |

Sovelluslogiikka: `scriptPage` + `scriptLayout="focus"` (`editor.tsx`, `presentation-panel.tsx`).
