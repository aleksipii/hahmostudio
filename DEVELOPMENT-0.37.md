# KILSAT Studio 0.37 — versio-, Cut- ja provenance-sopimukset

## Kehitysvaihe
CURSOR_PEREHDYTYS.md:n työpaketti 1: pienet tuotantoluotettavuuskorjaukset ennen laajaa UI-työtä.

## Valmis
### Työpaketti 1 — versio, Cut, provenance
- `STUDIO_APP_VERSION` synkronoitu `package.json`-versioon (0.36.0); render-manifesti ja testi yhtenäisyydelle.
- Englannin `Cut:` ja rinnakkaiset `Meanwhile:`/`Simultaneously:` tunnistetaan kovaksi kameraleikkaukseksi samoin kuin `Leikkaus:` (`isHardCameraCutSource`, render + stageProjection).
- Hahmopaketin `provenance.json` v2: studio-kirjasto säilyttää CC0-1.0; käyttäjän PSD:stä johdetut paketit merkitään `license: unknown`, `origin: user-import`.
- Kille-Oma ja Handu-Oma -paketit uudelleen tallennettu rehellisellä provenance-metadatalla.

### Työpaketti 3 — kamera/mikrofoni ja A/V-synkka (koodi)
- `lib/quick-recording-sync.ts`: eroteltu live-tick (`performanceTakeFrame`, pyöristys) vs. kamerakanavan hankinta-aika (`keyframeRecordFrame` → `captureFrame`/floor).
- `components/quick-panel.tsx` käyttää yhteisiä apureita (ei käyttäytymis muutosta tarkoituksella).
- `lib/av-recording-sync.test.ts`: analyysiviive vs. capture-ms, `cameraOffsetMs`, suun lähde (`mixPerformance` + `cameraCaptureTimes`), pitkä räpäytys aikajanalla.
- `lib/quick-recording-sync.test.ts`: regressiosuoja timeline-indeksille.
- **Ei oikeaa laitetta:** kamera/mikrofoni/Bluetooth-latenssi testataan vain simuloituina; fyysinen A/V ei vahvistettu.

### Työpaketti 2 — käsikirjoitusworkflow (koodi)
- `commitSource` stabiloitu (`useCallback` + `persistMutationRef`); debounce ei enää sidu uuteen callback-viitteeseen joka renderöinnillä (mahdollinen Maximum update depth -lähde).
- `PresentationPanel`: `sourceChanged` / `draftChanged` refeillä debounce-effekteihin.
- Projektin avaus/undo tyhjentää `sourceDraft`-luonnoksen; käsikirjoitussivun **Takaisin editoriin** yrittää tallentaa keskeneräisen lähdetekstin ennen sulkemista.
- `lib/screenplay-workflow.test.ts`: tyhjän Tuotanto-projektin `presentationSource`-roundtrip, valmisteluluonnos + cast + `rawScript`, studio-esimerkin tallennus.

## Testit
- 934/934 kooditestiä (`npm test`), mukaan lukien `playback-load`, `av-recording-sync`, `screenplay-workflow` (1 skip FFmpeg).
- `npm run playback:benchmark` → `docs/benchmarks/0.37-playback.json` (stub-canvas, studiojakso ~9 s / 216 ruutua preflight).
- `npm run typecheck` läpi.

## GUI-pilotti (käsikirjoitussivu, Electron)
Automatisointi:
- `npm run desktop:test:screenplay-gui` — eristetty `HAHMOSTUDIO_TEST_DATA_DIR`, lippu `--screenplay-gui-test`, raportti `screenplay-gui.json` (ketju: Käsikirjoitus → teksti → Takaisin → uudelleenavaus → kumoa → tyhjä).
- Toteutus: `desktop/screenplay-diagnostic.mjs`.

**Agenttiympäristö (2026-10-05):** Electron kaatui heti käynnistyksessä (`sandbox_extension_issue_file … Operation not permitted` Electron Helper -resursseihin). Graafista checklistiä **ei vahvistettu** tässä sessiossa. Aja sama komento paikallisessa Terminaalissa tai Finder-avauksella.

Manuaalinen varmistus (sama logiikka):
1. Tyhjä projekti → **Käsikirjoitus** → kirjoita teksti → **Takaisin editoriin**.
2. Avaa uudelleen → teksti näkyy.
3. **Kumoa** → teksti poistuu; ei React Maximum update depth -virhettä.

Koodipuoli: `screenplay-workflow.test.ts`, `closeScriptPage`/`commitSource`.

### Työpaketti 4 — renderin ja toiston kuorma (koodi, ei GPU-GUI)
- `lib/playback-load.ts`: sama Kille/Handu-studiojakso mitattuna kolmella näkymäkoolla (1080×1920, 720×1280, 540×960), simuloitu 60 Hz -askel + `renderPresentation` stub-canvasilla.
- `lib/playback-load.test.ts`: regressiorajat (p95/max) ja export-preflightin determinismi (`inspectRenderSnapshot`).
- `npm run playback:benchmark` → `docs/benchmarks/0.37-playback.json` (Node-raportti; **ei** korvaa selain-/Electron-rAF-mittaus).
- Vientijonon `interrupted` + `retry` pysyy `desktop/durable-storage.test.mjs` -kattavuudessa; ei uutta moottoria.

**Ei vahvistettu:** todellinen rAF p95 graafisessa editorissa, Safari, pitkä ääniraita laitteella, paketoidun Electronin present-aika.

### Työpaketti 5 — shot-aikajana (jatkuu)
- `ShotTimelineStrip`: kuvien thumbnailit (`ShotThumb` + `lib/shot-thumb-cache.ts`), **keston mukainen kisko** (`lib/shot-timeline-layout.ts`, 48 px/s), scroll-virtualisointi muuttuville leveyksille.
- **Dekoodattu aaltomuoto** kuvakohtaisesti: `lib/shot-audio-envelope.ts` (`audioEnvelope` + `presentationAudio`-blobit); vihreä raita = PCM, sininen = suu/ajoitus-fallback.
- Editorin **globaali aikajana**: kuvakisko `timeline-container`-alueella, `sceneFrame`/`documentFrame` + `selectShot` yhteisen playheadin kanssa.
- Electron-rAF: `docs/benchmarks/0.37-playback-raf-electron.json` (~59,4 fps / p95 ~17,4 ms molemmilla ikkunakoolla paikallisessa ajossa).

**Ei vahvistettu:** satojen kuvien raskaan thumbnailin GUI-kuorma; Series/Season-hierarkia; selain/Electron-dekoodaus ilman oikeaa äänitiedostoa.

### Paketointi (Mac)
- `npm run desktop:package:mac` → `release/KILSAT Studio-darwin-<arch>/KILSAT Studio.app` ja `release/Hahmostudio-Mac-<arch>.zip` (vaatii arm64/x64-yhteensopivan `.private-runtime/rhubarb/rhubarb`).
- Node-smoke: `npm run desktop:test:package` (ELECTRON_RUN_AS_NODE + `runtime-smoke.mjs`).
- **Finder-käynnistys:** kopioi `.app` esim. `~/Applications/`, sulje vanha instanssi, avaa uusi tuplaklikkauksella. Lähdekoodimuutokset eivät päivity asennettuun bundleen ennen uutta paketointia.
- **Agenttiympäristö (2026-10-05):** `desktop:package:mac` keskeytyi, koska Rhubarb-binääri ei vastaa arm64:ää. Aja paketointi paikallisella Macilla, jossa native-runtime on valmis.

### Provenance v2 — kirjastopaketit
- `npm run library:upgrade-provenance` päivittää CC0-kirjaston `.hahmo`-tiedostot (`origin: studio-library`, `version: 2`).
- `Kille-Oma` / `Handu-Oma` säilyvät `user-import` / `license: unknown`.
- Luontiskriptit (`create-library`, `create-multiview`, `create-otto`) kirjoittavat v2:n suoraan.

### ShotImage-välimuisti
- Ohjauspöydän kuvakortit käyttävät samaa `ShotThumb` + `shot-thumb-cache` -polkua kuin aikajana.

## Jäljellä
- Graafinen Finder-käynnistys ja codesign-quarantine käyttäjän koneella (ei agenttiympäristössä).
