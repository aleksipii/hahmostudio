# Visuaalinen tarkistus · Script Hero 0.48

**Päivä:** 2026-10-06 · **Ympäristö:** `npm run dev` · localhost:5173 (Cursor-selain, CDP-viewport)

## Viewportit (CDP `Emulation.setDeviceMetricsOverride`)

| Leveys | Hero (`script-hero-center`) | Focus (`script-page-open`) | Huomio |
|--------|------------------------------|----------------------------|--------|
| 1280 | OK · sticky 56 px | OK · step-nav piilossa, focus compose | Overlay täysleveys korjattu (`max-width` pois `.screenplay-page`-juuresta) |
| 1440 | OK · `--script-measure` 42rem, main ~578 px + gutterit | S-01-kohde · presentation max 680 px | Sticky CTA 56 px |
| 1920 | (sama logiikka CSS `@media`) | presentation max 720 px | Ei erillistä layout-riviä |

## Teemat

| Teema | Tarkistus | Tulos |
|-------|-----------|--------|
| Järjestelmä / vaalea | Hero tyhjä tila, marginaalit `--text-dim`, primary | OK |
| Tumma | `document.documentElement.dataset.theme=dark` | OK (automaatio) |

Manuaalinen: **Näytä → Ulkoasu → Vaalea/Tumma** ennen Figma-capturea.

## C3–C5

- **Marginaalit:** debounce ~320 ms; gutter scroll-synkki + textarea `paddingTop` (2026-10-06).
- **`/`:** rivin alussa avaa paletin (koodi + UI-testi hero-empty).
- **Jakoviiva:** `role="slider"`; snap kohtausrajoihin; parse = koko teksti.
- **5k rivi:** `lib/script-line-annotations.test.ts` &lt; 100 ms.

## Linja A · Figma-capture (2026-10-06)

| Vaihe | Tila |
|-------|------|
| Upload (Script `6:2`, Resolve `14:2`–`14:4`, `16:2`) | ✅ |
| Layout (overlay frame 03, **Capture · shot states**) | ✅ käsin 2026-10-06 |
| Live-hover PNG | ei Figmassa · sim `14:3` · live valinnainen käsin |

Ohje: [`FIGMA-CAPTURE-PLACEMENT-2026-10-06.md`](FIGMA-CAPTURE-PLACEMENT-2026-10-06.md) · istunto [`FIGMA-S-01-SESSION-2026-10-06.md`](FIGMA-S-01-SESSION-2026-10-06.md).

**Koodi / issue-taulukko:** ei uusia `Korjaa: kyllä` -rivejä. CDP-esikatselu: focus compose + sticky 56 px OK.
