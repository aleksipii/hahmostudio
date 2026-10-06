# S-01 · capture-istunto 2026-10-06

**Spec:** [`FIGMA-SCRIPT-FOCUS.md`](FIGMA-SCRIPT-FOCUS.md) · **Ohje:** [`FIGMA-S-01-CAPTURE.md`](FIGMA-S-01-CAPTURE.md)

## Capture (1440×900 · focus)

- **Näkymä:** `script-page-open` · yläpalkki **Käsikirjoitus** · `data-script-layout=focus`.
- **Paikallinen PNG (ei repo):** agent store  
  `…/cursor_agent_stores/68cec15b-793d-4f7f-aa73-375b8eed6a60/files/s01-focus-1440x900.png` (59 KiB).

## Figma-import

- **Design:** [KILSAT Script UI · 0.38](https://www.figma.com/design/FFy68Fynv4Ds2VgRANZoXc) · `upload_assets` 2026-10-06.
- **Upload 2026-10-06:** solmu **`6:2`** (59 KiB) · **layout OK** kehyksessä **Script / Focus · 03 Editor hero** (0,0 · 40 % · taakse). Irrallinen `5:2` poistettu tarvittaessa.
- **Ohje:** [`FIGMA-CAPTURE-PLACEMENT-2026-10-06.md`](FIGMA-CAPTURE-PLACEMENT-2026-10-06.md)

## Mittaus vs. speksi (CDP)

| Mitta | Speksi | Sovellus |
|-------|--------|----------|
| Viewport | 1440×900 | 1440×900 |
| `.presentation-panel` max | 680 px | 680 px (leveys 680) |
| Sticky CTA | 56 px | 56 px |
| Focus compose min-height | 360–530 px (speksi) / S-03 korjaus | 680 px min (aiempi korjaus) |
| Step-nav focusissa | piilossa | piilossa |
| Esc/Tab-vihje | näkyy | `.script-focus-hint` OK |
| **Jaa kohtauksiin** | sticky | näkyy focus-overlayssa |

**Uusia `Korjaa: kyllä` -issue-rivejä ei lisätty** — erot speksin kanssa on jo S-03:ssä.

### Overlay frame **03 Editor hero** (2026-10-06)

- **Figma MCP:** Starter-kiintiö esti `get_screenshot` / metadata frame 03:een — **pikseli-overlay ei API:lla**.
- **Korvaava vertailu:** S-01-capture + CDP vs. [`FIGMA-SCRIPT-FOCUS.md`](FIGMA-SCRIPT-FOCUS.md) (680 px, sticky 56 px, step-nav piilossa, Esc/Tab, sticky **Jaa kohtauksiin**).
- **Tulos:** ei uusia P1–P2-eroja, joita ei olisi jo korjattu (S-02, S-03, S-04, U-02). Frame 03 -overlay Figmassa (`6:2`, opacity ~40 % · layout 2026-10-06).

## FigJam

- **Board:** [Script user flow](https://www.figma.com/board/RQ3kH9AAduLT7E3iJabv3e)
- **Lisätty:** kaavio **Script Focus ↔ Panel (S-01)** (Panel → Focus → Parsing → Storyboard).
- **Käsin (valinnainen):** sticky 1 · linkitä design **Script / Focus · 03** + prototype nuoli panel ↔ focus ([`FIGJAM-STUDIO-FLOW.md`](FIGJAM-STUDIO-FLOW.md)).

### Pika-sticky (Focus ↔ Panel)

**Otsikko:** Focus ↔ Panel  
**Teksti:** Yläpalkki **Käsikirjoitus** avaa `Script / Focus · 03 Editor hero` (1440×900). Esc tai **Takaisin editoriin** → panel. **Jaa kohtauksiin** → parsing. Capture overlay `6:2` frame 03:ssa (2026-10-06).
