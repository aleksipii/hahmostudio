# Figma UI Resolve ↔ sovellus (0.44)

Design: [KILSAT Studio · UI Resolve](https://www.figma.com/design/vfBqIrcXhys0XoTODSbsI5)

| Figma | Komponentti / luokka | Tila 0.44 |
|-------|----------------------|-----------|
| `01 · Käsikirjoitus` … `05 · Aikajana` | `studio-flow-nav` + `studio-flow-step-index` (01–05) | ✅ |
| Comp / Työvaihe-kortti (default/hover/active) | `.studio-flow-step` + `--resolve-*` hover, vasen accent valinnassa | ✅ (0.38+) |
| Comp / Shot-kortti | `.resolve-shot-card` + `data-shot-status` + status-pill | ✅ |
| Storyboard segmented control | `.resolve-segmented` (kuvataulu + ohjauspöytä) | ✅ |
| Opastus / Spotlight · 1–5 | `studio-flow-tour` | ✅ (0.38) |
| Frame-tason padding/font 1:1 | — | ❌ ei vaadittu |
| Prototype-hitit FigJamissa | — | ❌ käsin |

## Erot jo tiedossa (ei korjattu)

- Resolve-framet sisältävät koko app shellin; koodissa Hahmo/Esitys/Animointi-välilehdet ovat erilliset.
- Shot-kortin thumbnail-koko vaihtelee näyttämön kuvasuhteesta; Figma kiinteä 16:9.
- Tuotantotilanne-näkymä on data-rich; Figmassa yksinkertaistettu grid.

## Tarkistus (sovellus)

1. `npm run desktop:dev` (tai `npm run dev` + Esitys/Animointi).
2. Avaa **Animointi**-työtila → vasen **Työvaihe**: numerot **01–05**, valinta (accent + vasen reuna).
3. **Storyboard / Kuvakortit**: grid, **resolve-segmented** (Kuvakortit | …), kortin status-pill, hover, valinta.
4. Ohjauspöydän ylänav: sama segmented-tyyli.

## FigJam / Figma-capture (käsin, ~15 min)

Design: [UI Resolve](https://www.figma.com/design/vfBqIrcXhys0XoTODSbsI5) · flow: [Script user flow](https://www.figma.com/board/RQ3kH9AAduLT7E3iJabv3e)

| Frame | Mitä kaapataan |
|-------|----------------|
| 01–05 | Koko näkymä tai vasen työvaihe + pääalue (vastaa frame-otsikkoa) |
| Shot-kortti | Yksi kortti hover + yksi valittuna |
| Segmented | Kuvataulun tai ohjauspöydän tilavalitsin |

Liitä FigJam-stickyyn linkki capture-frameen; pikselitarkkuus ei vaadita, mutta 01–05-järjestys ja korttipillit pitää näkyä.

Havaitut uudet erot → **[`FIGMA-PARITY-ISSUES-0.45.md`](FIGMA-PARITY-ISSUES-0.45.md)** (0.45 · linja A).
