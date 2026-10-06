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
- [x] 1440×900 hero-capture Figmaan — agentti 2026-10-06 · [`FIGMA-S-01-SESSION-2026-10-06.md`](FIGMA-S-01-SESSION-2026-10-06.md) · overlay frame **03 Editor hero** (käsin 2026-10-06)
- [x] Shot hover + valinta (capture) — agentti 2026-10-06 · [`FIGMA-SHOT-HOVER-SESSION-2026-10-06.md`](FIGMA-SHOT-HOVER-SESSION-2026-10-06.md)
- [x] FigJam Focus ↔ Panel -kaavio — agentti 2026-10-06 · board RQ3kH9AAduLT7E3iJabv3e · design-linkki stickyyn: [`FIGJAM-STUDIO-FLOW.md`](FIGJAM-STUDIO-FLOW.md) (2 min käsin)
- [x] Capture Figmaan / FigJamiin (ei repoon)

---

## Issue-taulukko

| ID | Figma (frame/komponentti) | Sovellus (näkymä / luokka) | Ero (1 lause) | P | Korjaa | Tila |
|----|---------------------------|----------------------------|---------------|---|--------|------|
| S-02 | Script / Focus · 03 · sticky CTA | `.script-sticky-bar .primary.full` | Figma 56 px korkeus; sovelluksessa oli 40 px | P2 | kyllä | korjattu |
| S-03 | Script / Focus · 03 · compose | `.script-compose[data-script-layout=focus]` | Focus-sarakkeella puuttui compose-kortin min-korkeus (360–530 px) | P2 | kyllä | korjattu |
| S-01 | Script / Focus · 03 | `script-panel--focus` | Capture overlay Figmassa (`6:2` frame 03 · 40 %) · [`FIGMA-CAPTURE-PLACEMENT-2026-10-06.md`](FIGMA-CAPTURE-PLACEMENT-2026-10-06.md) | — | ei | layout OK 2026-10-06 |
| S-04 | Focus overlay | `.recovery-banner` vs `.screenplay-page` | Palautuspalkki peitti focus-näkymän (z-index) | P2 | kyllä | korjattu |
| R-TH | Comp / Shot-kortti thumb | `.resolve-shot-card__thumb` | Näyttämön kuvasuhde vs. Figman kiinteä 16:9 | — | ei | hylätty |
| R-SH | Koko app shell | `studio-flow-tabs` (yläpalkki) | Hahmo/Esitys/Animointi-välilehdet poistettu; 5 työvaihetta ylhäällä; Hahmo/Esitys vain Hahmot-vaiheessa | — | ei | korjattu |
| U-01 | Resolve · painikkeet / välilehdet | `styles/studio-components.css` + `style.css` trim | Yhtenäinen ghost/primary; legacy `.studio` tab/primary-säännöt poistettu style.css:stä | P2 | kyllä | korjattu (0.47 · 1b) |
| U-02 | Script · paneeli vs focus | `.library-script-tab`, `.script-shell` | Container query 720/900 px + viewport 1280/1440/1920; focus max 680/720 px | P2 | kyllä | korjattu (0.47 · capture S-01 erikseen) |
| U-03 | Inspector · Näyttämö/Liikkeet | `.stage-inspector`, `.details-panel` | Tiheämpi rakenne ilman sisäkkäisiä details-pinoja pääkohdissa | P2 | kyllä | korjattu (0.47 · `scene-panel`) |
| U-04 | Inspector · Valinta | `.selection-inspector` | Yhtenäinen tiheys, esikatselu, tekniset tiedot | P2 | kyllä | korjattu (0.47 · `editor` + CSS) |

**Prioriteetti:** P1 = luettavuus/valinta; P2 = visuaalinen epäyhtenäisyys; P3 = kosmetiikka; **—** = tarkoituksellinen ero.

---

## Tunnetut erot (älä toista issue-taulukkoon)

Siirretty [`FIGMA-RESOLVE-PARITY.md`](FIGMA-RESOLVE-PARITY.md) / [`FIGMA-UI-PARITY.md`](FIGMA-UI-PARITY.md).

---

## Seuraava

1. Valinnainen: live-hover PNG devistä → Figma `Capture · hover (live)` · [`FIGMA-CAPTURE-PLACEMENT-2026-10-06.md`](FIGMA-CAPTURE-PLACEMENT-2026-10-06.md) vaihtoehto 3.
2. Agentti: vain uudet `Korjaa: kyllä` -rivit → minimidiff + `npm test`.
