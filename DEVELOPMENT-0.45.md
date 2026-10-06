# 0.45 — Figma-pariteetti · linja A (issue → koodi)

## Kehitysvaihe
Capture + silmämääräinen vertailu ensin; koodia vain dokumentoiduista eroista, joissa **Korjaa = kyllä**.

## Valmis (infrastrukturi + muu työ)
- Issue-malli: **`docs/FIGMA-PARITY-ISSUES-0.45.md`** (checklist + taulukko).
- Ohjeet: `FIGMA-UI-PARITY.md`, `FIGMA-RESOLVE-PARITY.md`, `FIGMA-SCRIPT-FOCUS.md`, `FIGJAM-STUDIO-FLOW.md`.
- **Desktop ExportQueue / cutout:** `lib/export-render.ts` käyttää samaa `buildCutoutRenderContextFromProject`-polkua kuin selain-MP4 (`export-worker.ts` → `renderExport`).
- **Reaktioklipit (Kille/Handu):** `lib/cutout/pack-reactions.ts`, `reaktio: nyökkäys|hämmästys|vilkutus` strict-kieliopissa; cutout-IR `REACT_*`.

## Yläpalkki (Resolve-shell)
- **`studio-flow-tabs`:** 01–05 ylhäällä; poistettu `WorkspaceTabs`, brändi ja `studio-logo`.
- Vasemman reunan `StudioFlowNav` poistettu (ei duplikaattia).
- Hahmo/Esitys: segmented vain **Hahmot**-vaiheessa. Oikealla: Focus, Tallenna, Vie, Lisätyökalut.

## Figma-koodierä (osittain)
- **S-02, S-03 korjattu** (`styles/ui-minimal.css`): sticky CTA 56 px, focus-compose min-korkeus.
- **S-01** odottaa käyttäjän capture-vertailua (`Korjaa: ei`).
- Uudet rivit: [`docs/FIGMA-PARITY-ISSUES-0.45.md`](docs/FIGMA-PARITY-ISSUES-0.45.md).

**Seuraava:** capture + mahdolliset uudet `Korjaa: kyllä` -rivit.

## Sinun työ (ei automatisoidu)
1. Istunto-checklist issue-docissa.
2. Merkitse korjattavat rivit `Korjaa: kyllä` (P1–P2).
3. FigJam + Figma-capture linkit designiin.
