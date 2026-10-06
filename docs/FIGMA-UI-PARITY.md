# Figma ↔ työpöytäsovellus — pariteettitarkistus

Design: [KILSAT Script UI · 0.38](https://www.figma.com/design/FFy68Fynv4Ds2VgRANZoXc) · Resolve: [UI Resolve](https://www.figma.com/design/vfBqIrcXhys0XoTODSbsI5)

**Rehellinen tila:** sovellus seuraa Figmaa **rakenteessa ja mitoissa**, ei pikseli-identtisenä kopiona. Totuuslähde on koodi + `DEVELOPMENT-0.38.md`.

## Frame → sovellus

| Figma | Sovellus | Pariteetti |
|-------|----------|------------|
| Script / Panel · 02 Draft | Vasen paneeli → Käsikirjoitus, `data-script-layout=panel` | Toolbar, compose-kortti, sticky CTA |
| Script / Focus · 03 Editor hero | Yläpalkki **Käsikirjoitus**, `scriptPage` + focus | 680px sarake, piilotettu step-nav (`.script-panel--focus`) |
| Resolve 01–05 | `studio-flow-nav`, `resolve-shot-card` | Katso **`docs/FIGMA-RESOLVE-PARITY.md`** (0.44) |

## 0.43 koodissa

- Focus-overlay: ei sisäkkäistä korttikehystä (`screenplay-page .presentation-panel`).
- Compose-kortti: varjo focus-tilassa, panel min-height 280px.
- Parse-vahvistus: suomenkielinen dialogi hyväksytyille kuville.

## Sinun käsin (ei automatisoidu)

1. Focus-screenshot → Figma frame **Script / Focus · 03** (`docs/FIGMA-SCRIPT-FOCUS.md`).
2. FigJam-linkit sticky 1 ↔ focus/panel (`docs/FIGJAM-STUDIO-FLOW.md`).
3. Sivu vierekkäin: Figma frame vs. `npm run desktop:dev` — merkitse erot issue-listaan.

## Ei vielä 1:1

- Resolve-komponenttien exact padding/font Figmasta.
- Prototype-hitit FigJamissa (osittain ohje).
- Koko app shell (Hahmo/Esitys/Animointi) vs. vain Script-frames.
