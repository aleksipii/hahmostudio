# Script UX · luonnos 2026-10-06

Interaktiivinen HTML-luonnos (kaikki työvaiheet) voidaan pitää erillisenä prototyyppinä; **tuotantosovelluksessa** sama visuaalinen kieli on kytketty oikeaan editoriin.

## Sovelluksessa (React)

- **Luokka:** `.script-ux-luonnos` (Käsikirjoitus-hero + focus-sivu)
- **Tyylit:** [`styles/kilsat-app.css`](../styles/kilsat-app.css) (script-UX inline; lähde kopio: `kilsat-script-ux.css`)
- **Fontit:** Hanken Grotesk + Literata ([`index.html`](../index.html))
- **Komponentit:** [`script-compose-editor.tsx`](../components/script-compose-editor.tsx), [`script-command-palette.tsx`](../components/script-command-palette.tsx)

### Katselu

`npm run dev` → työvaihe **Käsikirjoitus** (keskialue-hero) tai yläpalkin **Käsikirjoitus** (focus).

### Kytkentä (ei erillistä `ScriptEditor.tsx`-mockia)

| Luonnos-TODO | Toteutus |
|--------------|----------|
| Parse / debounce | `scanScriptLineAnnotations` ([`lib/script-line-annotations.ts`](../lib/script-line-annotations.ts)), debounce `SCRIPT_ANNOTATE_DEBOUNCE_MS` (150) [`script-compose-editor.tsx`](../components/script-compose-editor.tsx) |
| Marginaalien rivikohdistus | `lineHeightPx` + scroll-virtualisoidut marginaalit (`renderMarginSide`) |
| Jakajaviiva (pointer) | `.script-parse-divider--live` + `onPointerDown` / window `pointermove` |
| Tokenit | [`styles/tokens.css`](../styles/tokens.css) `--script-violet*` → `--color-accent*`; hero [`kilsat-script-ux.css`](../styles/kilsat-script-ux.css) |
| Koko esityksen parse | **Jaa kohtauksiin** → `PresentationPanel` / `parsePresentation` (ei jokaisella näppäinpainalluksella) |

### Luonnoksesta vielä erillään

Storyboard-kortit, näyttämö-SVG, aikajana ja inspector-prototyyppi eivät ole vielä React-porttauksessa — vain käsikirjoitus-UX (tyhjä tila, 68ch-sarake, violetit tokenit, `/`-paletti).

## Standalone-prototyyppi

Täysi HTML-luonnos (mock-data) voidaan tallentaa esim. `public/prototypes/kilsat-script-ux-luonnos.html` ja avata `http://localhost:5173/prototypes/kilsat-script-ux-luonnos.html`.
