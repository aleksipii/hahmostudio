# UI-tyylikerrosten kartoitus ja siirtosuunnitelma (0.47)

**Päivä:** 2026-10-06  
**Tavoite:** Yksi token-pohjainen tyylikerros; vanha `style.css` vähennetään asteittain.

## Vaihe 1 — tehty (2026-10-06)

- Luotu `styles/studio-components.css` ja linkitetty `main.tsx`:ään viimeiseksi.
- Korjattu `--studio-control-height`-ristiriita (`26px` poistettu; 32 px).
- Kanoniset painike- ja välilehtityylit `.studio`-scopeen; inspector- ja script-layout-täydennykset.

**Vaihe 1b (2026-10-06):** Poistettu päällekkäiset `.studio .primary`, välilehdet, focus-outline ja tab border-bottom -säännöt `style.css`:stä (kommentti viittaa `studio-components.css`).

**Vaihe 1c (2026-10-06):** Aikajana-tokenit (`--timeline-*`) `tokens.css`:ssä; kanoniset override `.studio .timeline` / track / field `studio-components.css`:ssä (legacy `style.css` minifi jää taustalle).

**Ei vielä:** täysi legacy-minifi poisto / `style.css` pilkkominen (0.47d–e).

## Latausjärjestys (`main.tsx`)

1. `style.css` — legacy (minified, laaja)
2. `studio-ui.css` — Mac/workspace/presentation-dock (sticky inspector, production)
3. `styles/tokens.css` — design tokenit + KILSAT semantic (`--bg-*`, `--accent`)
4. `styles/app-shell.css` — motion-tools, shell-korjaukset
5. `styles/ui-minimal.css` — Studio 0.38+ polish
6. **`styles/studio-components.css`** — kanoninen komponenttikerros (0.47+, voittaa päällekkäisyydet)

## Päällekkäisyydet (käytössä olevat)

| Alue | `style.css` | Uudempi kerros | Ongelma |
|------|-------------|----------------|---------|
| `.studio .primary` / `.secondary` | vihreä accent, reunat 8px | `ui-minimal` + `app-shell` violetti, border none | Kaksi teemaa; hover `filter: brightness` kaikille napeille |
| `.library-tabs` / `.inspector-tabs` | sticky, vihreä active, 2px border-bottom | `ui-minimal` grid, violetti | Padding/sticky gap inspectorissa |
| `.studio button` min-height | 34px / 40px | `--studio-control-height` 26px vs 32px token-ristiriita | Epätasainen korkeus |
| `:focus-visible` | `--green` outline 3px | accent 2px | Sekava fokus |
| Timeline / quick-controls | kovakoodatut `#17191b`, `#303740` | osittain app-shell | Ei vielä tokenisoitu |
| Topbar / workspace grid | kiinteät px, `#1e2125` | tokens `--bg-*` | Legacy layout-säännöt tarpeen desktopille |

## Kuolleet / vähäiset (ei poistettu vielä)

- Vanhat `.workspace-tabs` (Hahmo/Esitys/Animointi yläpalkissa) — korvattu `studio-flow-tabs`; säännöt voivat jäädä fileen mutta eivät osu DOM:iin.
- `.guide-layout` vihreä nav — erillinen modaali, matala prioriteetti.
- Responsiiviset `@media` rivit 600px — tarvitaan kunnes shell siirretään.

## Kovakoodatut arvot (prioriteetti siirtoon tokeneihin)

- `ui-minimal.css`: `rgba(0,0,0,0.35)` varjot → `--shadow-panel`
- `style.css`: satoja `#24272b`, `#303740` jne. — siirretään vain kun kosketetaan kyseistä moduulia
- ~~`tokens.css`: `--studio-control-height` kahdesti~~ — **korjattu 0.47**

## Siirtosuunnitelma (järjestys, riskit)

| Vaihe | Toimenpide | Riski |
|-------|------------|--------|
| 0.47a | `studio-components.css` + token-korjaus + legacy override (hover/filter, focus) | Matala — viimeinen CSS |
| 0.47b | Tab/komponentti yhtenäistys (library, inspector, flow) | Keskitaso — visuaalinen regressio |
| 0.47c | Käsikirjoitus container + focus hero (1280–1920) | Keskitaso — layout |
| 0.47d | `style.css` pilkkominen: siirrä `.timeline` / `.studio .layer-*` erillisiin tiedostoihin | Korkea — laaja diff |
| 0.47e | Poista duplikaatit `style.css`:stä kun testit + desktop smoke OK | Korkea |

**Ei tehdä kerralla:** koko `style.css`:n poisto (rikkoisi timeline, guide, import-card ilman auditointia).

## Hyväksyntä ennen 0.47d–e

Käyttäjän OK ennen kuin poistetaan yli 200 riviä legacy-CSS:ää yhdessä commitissa.
