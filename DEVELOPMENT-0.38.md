# KILSAT Studio 0.38 — minimalistinen UI (Rive / Character Animator -henki)

## Kehitysvaihe
Visuaalinen yhtenäistäminen ilman layout- tai toimintomuutoksia. Suomenkielinen UI säilyy.

## Valmis (koodi)
- **Design-tokenit** (`styles/tokens.css`): tummat neutraalit (`--bg-0` …), sininen aksentti (`--color-accent`), legacy-sillat (`--bg`, `--panel`, `--green` → accent).
- **App shell** (`styles/app-shell.css`): olemassa oleva Rive-tyylinen runko (segmentoidut välilehdet, matala topbar, checker-stage).
- **Minimal polish** (`styles/ui-minimal.css`): ohjauspöydän ghost-nav, kuvakortit/shot-kisko, paneelivälilehdet ilman raskaita outlineja.
- Shot-aikajanan playhead: `--playhead` (punainen), valinta: accent-reuna.
- **Käsikirjoitus** (`ui-minimal.css`): `screenplay-page` yksi sarake (~680 px), vaihenav ghost-tyylillä, fieldset-reunat poistettu (erottimet / pehmeä tausta).
- **Transport + aikajana** (`editor.tsx` + `ui-minimal.css`): `timeline-dock` yhdistää toggle, transportin ja containerin; `transport-cluster` icon-only -ryhmä.
- **Vienti / tuotanto** (`export-panel.tsx`, `ui-minimal.css`): `studio-export`-dialogi tokenien mukaan; tuotantodashboard, CSV ja kuvataulu yhtenäisellä pinnalla.

## Ei vahvistettu
- Pikselitason vastaavuus Rive.app tai Adobe Character Animatoriin (ei Figma-viitettä).
- Graafinen regressiotesti koko työtiloissa; `server/ui.test.mjs` + `lib/studio-theme.test.ts` kontrastit.

## Tuotantovaiheet vs. käyttäjän 5 työtilaa (rehellinen kartta)

| Vaihe | Toteutus nyt | Huomio |
|-------|----------------|--------|
| 1. Käsikirjoitus | `PresentationPanel` + täysi `screenplay-page`; **Jaa kohtauksiin** (= aiempi tunnista/tarkista) | |
| 2. Hahmot | Kirjasto (`AssetLibrary`), .hahmo-paketit, sidokset käsikirjoituksessa | Ei @nimi-referenssejä, referenssiarkkia eikä “lukitusta” erillisenä vaiheena |
| 3. Storyboard | Ohjauspöytä → Kuvakortit, shot-kisko, drag-reorder | Generointi uudelleen = käsikirjoituksen päivitys + tarkistus |
| 4. Shot-editori | Ohjauspöydän valinta + oikean reunan tuotanto-inspector + tapahtumaeditori | Yksi kuva kerrallaan |
| 5. Aikajana | `timeline-dock`, shot-strip, animaatio-raita, vienti | Hahmo/Esitys/Animointi -työtilat säilyvät |

Vasemman reunan **Työvaihe**-lista (`studio-flow-nav`) vain **navigoi** yllä oleviin; se ei poista Hahmo/Esitys/Animointi -välilehtiä eikä luo uutta datamallia.

Automaattitallennus: palautuspiste / journal (statusbar: “Automaattitallennus…”), ei pilvipalvelua.

## Figma / FigJam — käsikirjoitus (UX-viite, ei tuotteen totuuslähde)

**Kehitysvaihe 0.38:** koodissa on `script-compose` + `data-script-layout="panel"|"focus"` (vasen paneeli vs. `screenplay-page`). FigJam: [KILSAT Script user flow](https://www.figma.com/board/RQ3kH9AAduLT7E3iJabv3e). Figma Design: [KILSAT Script UI · 0.38](https://www.figma.com/design/FFy68Fynv4Ds2VgRANZoXc) — wireframe **00 Script** + localhost-capture [`Script / Panel · 02 Draft (capture)`](https://www.figma.com/design/FFy68Fynv4Ds2VgRANZoXc?node-id=2-2) (Animointi · käsikirjoitus, ei login-projektia).

### Frame: `Script / Panel · 02 Draft` (1440×900)
| Alue | px | Token / luokka |
|------|-----|----------------|
| Top bar | 40 | `.studio .topbar` |
| Status bar | 26 | `.statusbar` |
| Library (suositus Script-vaiheessa) | 280–320 | `--library-size` |
| Työvaihe-nav rivi | ~44 | `.studio-flow-nav` |
| Stepper gap | 6 | `.screenplay-step-nav` |
| Toolbar | 40 | `.script-toolbar` |
| Editor padding | 12×14 | `.script-editor-field` |
| Editor min (panel) | 240 | `[data-script-layout=panel]` |
| Editor min (focus) | 360 / ~530 @900 | `[data-script-layout=focus]` |
| Status rivi | 28 | `.script-status` |
| Sticky CTA | 56 (40+8+8) | `.script-sticky-bar` |
| Focus content max | 680 | `.screenplay-page .presentation-panel` |

### Komponentit Figmassa
- **Script / Editor** — variantit `panel`, `focus` (sama rakenne, eri min-height).
- **Script / Sticky action bar** — primary **Jaa kohtauksiin**, 100 % leveys.
- **Nav / Flow step** — 5 vaihetta (vastaa `studio-flow-nav`).

### FigJam-prototype (frame-nimet)
`Script / Panel · 01 Empty` → `02 Draft` → `03 Parsing` → (virhe: `04 Parse error`) → toast → `Storyboard / Grid · default`. Rinnakkain: `Script / Focus · 03 Editor hero` ↔ panel (top **Käsikirjoitus**).

## Valmis (tämä erä)
- Käsikirjoitus: toolbar, status-rivi, sticky **Jaa kohtauksiin**, layout-variantit panel/focus.
- Aikajana piilotetaan käsikirjoitusvaiheessa (`activeFlowStep === 'script'`) ja focus-sivulla (`scriptPage`).
- Tuotantokierros: `localStorage` `hahmostudio-studio-flow-tour-v1`, Resolve-hover tokenit, **Ohje → Näytä tuotantokierros uudelleen**.

### FigJam ↔ Resolve (manuaalinen linkitys)
Figma MCP ei muokkaa FigJam-boardia. Board [Script user flow](https://www.figma.com/board/RQ3kH9AAduLT7E3iJabv3e): lisää jokaiseen työvaihe-vaiheeseen **Link to design** → [KILSAT Studio · UI Resolve](https://www.figma.com/design/vfBqIrcXhys0XoTODSbsI5) frame `01…05` tai **Opastus / Spotlight · 1–5**. Script-polku: linkitä `Storyboard / Grid` → `03 · Storyboard`.

## Valmis (FigJam + sovellus, 0.38 jatko)
- **FigJam copy-paste:** `docs/FIGJAM-STUDIO-FLOW.md` (5 stickyä + prototype-taulukko + Resolve-linkit).
- **Työvaihe-pin:** `lib/studio-flow-scope.ts` — välilehtien/työtilan rajaus, käsikirjoituslähde lukittu vaiheissa 2–5, `localStorage` `hahmostudio-pinned-flow-step`.
- **Light-teema:** studio-tokenit (`--bg-*`, `--resolve-*`) vaaleassa ja järjestelmän vaaleassa tilassa; esikatselu `.script-preview-wrap`.

## Seuraava työ
- FigJam-boardille stickyt ja **Link to design** käsin (`docs/FIGJAM-STUDIO-FLOW.md`).
- **Figma Design:** focus-frame, component setit (Script UI 0.38).
- Tuotantovaihe 2–5: syvempi dataluku (hahmopaketin @sidonta, hyväksyntä erillään navigoinnista) — omat erät.
- Valinnainen: transport-komponentti; työvaihe-pin nollaus (asetukset).
