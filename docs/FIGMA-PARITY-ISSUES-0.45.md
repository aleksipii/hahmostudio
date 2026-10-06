# Figma-pariteetti · havaittu erot (0.45 · linja A)

**Totuuslähde vertailuun:** sovellus `npm run desktop:dev` vs. Figma-design.  
**Koodia 0.45:een vain riveistä, joissa `Korjaa` = kyllä** ja prioriteetti P1–P2.

Design: [Script UI · 0.38](https://www.figma.com/design/FFy68Fynv4Ds2VgRANZoXc) · [UI Resolve](https://www.figma.com/design/vfBqIrcXhys0XoTODSbsI5)  
FigJam: [Script user flow](https://www.figma.com/board/RQ3kH9AAduLT7E3iJabv3e)

---

## Istunto-checklist

- [x] Koodipohja vs. [`FIGMA-SCRIPT-FOCUS.md`](FIGMA-SCRIPT-FOCUS.md) (px/token) — agentti 2026-10-06
- [x] Resolve 01–05 vs. [`FIGMA-RESOLVE-PARITY.md`](FIGMA-RESOLVE-PARITY.md) — jo 0.44
- [x] Desktop-dev + mittaus (agentti · [`FIGMA-CAPTURE-SESSION-0.45.md`](FIGMA-CAPTURE-SESSION-0.45.md))
- [ ] 1440×900 hero-capture Figmaan (käyttäjä)
- [ ] Shot hover + valinta (capture)
- [ ] FigJam sticky + design-linkit (käyttäjä)
- [ ] Capture Figmaan / FigJamiin (ei repoon)

---

## Issue-taulukko

| ID | Figma (frame/komponentti) | Sovellus (näkymä / luokka) | Ero (1 lause) | P | Korjaa | Tila |
|----|---------------------------|----------------------------|---------------|---|--------|------|
| S-02 | Script / Focus · 03 · sticky CTA | `.script-sticky-bar .primary.full` | Figma 56 px korkeus; sovelluksessa oli 40 px | P2 | kyllä | korjattu |
| S-03 | Script / Focus · 03 · compose | `.script-compose[data-script-layout=focus]` | Focus-sarakkeella puuttui compose-kortin min-korkeus (360–530 px) | P2 | kyllä | korjattu |
| S-01 | Script / Focus · 03 | `script-panel--focus` | 1440×900 Figma-hero vaatii käyttäjän capturen; koodi/spec 680 px + 56 px OK | — | ei | avoin |
| S-04 | Focus overlay | `.recovery-banner` vs `.screenplay-page` | Palautuspalkki peitti focus-näkymän (z-index) | P2 | kyllä | korjattu |
| R-TH | Comp / Shot-kortti thumb | `.resolve-shot-card__thumb` | Näyttämön kuvasuhde vs. Figman kiinteä 16:9 | — | ei | hylätty |
| R-SH | Koko app shell | `studio-flow-tabs` (yläpalkki) | Hahmo/Esitys/Animointi-välilehdet poistettu; 5 työvaihetta ylhäällä; Hahmo/Esitys vain Hahmot-vaiheessa | — | ei | korjattu |

**Prioriteetti:** P1 = luettavuus/valinta; P2 = visuaalinen epäyhtenäisyys; P3 = kosmetiikka; **—** = tarkoituksellinen ero.

---

## Tunnetut erot (älä toista issue-taulukkoon)

Siirretty [`FIGMA-RESOLVE-PARITY.md`](FIGMA-RESOLVE-PARITY.md) / [`FIGMA-UI-PARITY.md`](FIGMA-UI-PARITY.md).

---

## Seuraava

1. Käyttäjä: checklist + capture → täydennä S-01 tai uudet rivit.
2. Agentti: vain uudet `Korjaa: kyllä` -rivit → minimidiff + `npm test`.
