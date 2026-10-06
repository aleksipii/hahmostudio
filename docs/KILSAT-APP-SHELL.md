# KILSAT App Shell (uusi kuori)

## Entry

`main.tsx` lataa vain:

- `styles/tokens.css`
- `styles/kilsat-app.css` (yksi entry-CSS: kuori, layout, editor-primitiivit, script-UX)

Vanhoja entry-importteja (`style.css`, `studio-ui.css`, `ui-minimal.css`, `studio-components.css`, `kilsat-five-phase.css`) **ei** enää käytetä käynnistyksessä.

## Rakenne

| Tiedosto | Rooli |
|----------|--------|
| `components/kilsat-app-shell.tsx` | Brand, 5 vaihetta, sivuraili, valikkorivi |
| `components/editor.tsx` | Moottori: PSD, palautus, paneelit, aikajana (sama logiikka) |
| `lib/` | Projektimalli, studio, vienti — **ei koskettu** |

## Seuraava työ

- HTML-luonnoksen näyttämö-SVG, storyboard-protot ja aikajana (ei vielä React-portissa).
- Inspector: Valinta / Näyttämö / Liikkeet / Esitys — välilehdet paneelin yläreunassa (`kilsat-app`).

`styles/app-shell.css` ja `styles/kilsat-script-ux.css` säilyvät referenssinä; käynnistyksessä ladataan vain `kilsat-app.css`.
