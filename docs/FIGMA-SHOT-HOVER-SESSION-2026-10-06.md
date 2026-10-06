# Shot-kortti · hover + valinta (capture 2026-10-06)

**Spec:** [`FIGMA-RESOLVE-PARITY.md`](FIGMA-RESOLVE-PARITY.md) · **Checklist:** [`FIGMA-PARITY-ISSUES-0.45.md`](FIGMA-PARITY-ISSUES-0.45.md)

## Capture (1440×900 · Storyboard)

- **Polku:** Mr.Kille → KILSAT-esimerkki → **Jaa kohtauksiin** → työvaihe **Storyboard** → ohjauspöytä **Kuvakortit** (19 × `.resolve-shot-card`).
- **Viewport:** CDP `Emulation.setDeviceMetricsOverride` 1440×900.
- **Paikalliset PNG (ei repo):** agent store `…/68cec15b-…/files/`:
  - `resolve-shot-grid-storyboard-1440x900.png` — kuvataulu (dock max-height avattu capturea varten)
  - `resolve-shot-hover-sim-1440x900.png` — hover simuloitu luokalla `figma-capture-hover` (CSS sama kuin `:hover:not(.selected)`)
  - `resolve-shot-selected-hover-mix-1440x900.png` — valittu + hover naapurikortissa (mix)

## Hover-rajoitus (automaatio)

Cursor-browser estää `Input.dispatchMouseEvent` (Electron-webview). **Oikeaa `:hover`-pseudoa ei kaapattu.** Hover-capture käyttää väliaikaista luokkaa, joka kopioi `styles/ui-minimal.css` -säännöt:

```css
.resolve-shot-card.figma-capture-hover:not(.selected) {
  background: var(--resolve-bg-hover);
  border-color: var(--resolve-border-hover);
  box-shadow: var(--resolve-shadow-hover);
}
```

## Mittaus (CDP · computed)

| Tila | Reunaväri (esim.) | Tausta / varjo |
|------|-------------------|----------------|
| Oletus | `rgb(197, 205, 216)` | ei varjoa |
| Hover (sim) | `rgb(168, 180, 196)` | `--resolve-shadow-hover` |
| Valittu | `rgb(8, 117, 219)` | inset 3 px accent + 1 px reunus |

Status-pill (Luonnos): valkoisella taustalla, reunus `--border`.

## Issue-taulukko

**Ei uusia P1–P2 + `Korjaa: kyllä` -rivejä** — hover/valinta vastaa 0.44-pariteettia; thumb-kuvasuhde pysyy R-TH (hylätty).

## Figma-import

**Upload + layout 2026-10-06:** [UI Resolve](https://www.figma.com/design/vfBqIrcXhys0XoTODSbsI5) · kehys **Capture · shot states**: **`14:2`** grid · **`14:3`** hover (sim) · **`14:4`** hover (sim B) · **`16:2`** selected. Käsin vahvistettu · [`FIGMA-CAPTURE-PLACEMENT-2026-10-06.md`](FIGMA-CAPTURE-PLACEMENT-2026-10-06.md). Live-hover valinnainen.
