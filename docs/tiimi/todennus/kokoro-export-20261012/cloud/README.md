# Kokoro → MP4 -vientisynkka pilvessä (Claude, 12.10.2026)

Linux-kontti, Node 22.22, Electron 44.5.1 Xvfb:ssä, järjestelmän ffmpeg 6.1.1 (libx264). **Ei aitoa Kokoro-inferenssiä**: Hugging Face on kontin verkkosäännössä estetty (403), joten mallipainoja ei ole. Sijaismoottori (`scripts/kokoro-standin-engine.cjs`) korvaa vain `kokoro-js`-kutsun deterministisellä tavuäänellä; kaikki muu on sovelluksen omaa koodia: IPC, utilityProcess, mallin tarkistus, WAV-liittäminen, suuajat, jakson koostus, Pikavienti, MP4-tarkistus.

Huom: klipin `synthetic.modelVersion` näyttää `Kokoro-82M-v1.0-ONNX`, koska pääprosessi leimaa version. Raportin `standinEngine: true` ja `realInference: false` ovat tämän ajon totuus.

## Komennot
```
npm ci && npm run desktop:build
node scripts/kokoro-standin-runtime.mjs     # .private-runtime/kokoro (sijainen), mallikansio, ffmpeg/ffprobe-kääre
HAHMOSTUDIO_ELECTRON_NO_SANDBOX=1 HAHMOSTUDIO_KOKORO_STANDIN=1 \
HAHMOSTUDIO_KOKORO_MODEL_DATA=$PWD/.private-runtime/kokoro-standin-data \
HAHMOSTUDIO_KOKORO_EXPORT_ACCEPTANCE=1 HAHMOSTUDIO_WORKFLOW_OUTPUT=/tmp/kx/out \
xvfb-run -a -s "-screen 0 1600x1000x24" node scripts/desktop-workflow-test.mjs
python3 lip.py <data>/export-out/kokoro.mp4   # renderöidyn suun aukeama vs. äänen RMS ruuduittain
```
`--no-sandbox` vain siksi, että kontti ajaa rootina; Mac-ajossa muuttujaa ei käytetä.

## Tulokset (kokoro-export-report.json, workflow-report.json: ok=true)
- Repliikki 4,993 s, 26 suuavainta, joista 25 löytyi koostetun hahmon suuraidoilta oikeassa ruudussa.
- MP4: H.264 1080×1920 30 fps, AAC 48 kHz, 5,1 s = 153 ruutua, vientityö `done`.
- Dekoodattu AAC vs. alkuperäinen WAV: korrelaatio **0,9964**, ajoitusero **+0,04 ms** (raja 33,3 ms).
- Renderöity suu (lipsync-measure.txt, lipsync-standin.png): suun tummien pikselien ja äänen RMS:n korrelaatio huippu **viiveellä 0 ruutua** (0,79; ±1 ruutu 0,65/0,70). Suu aukeaa tavuilla ja sulkeutuu taukoihin.
- `npm test` 1403/1403, typecheck läpi.

## Löydetyt ja korjatut
1. **Tuotekoodi, desktop/encoder.mjs:** MP4-koodaus käytti `-t (end-start)`. Kun pituus × fps ei ole kokonaisluku (5,0833 s @ 30 = 152,5), ffmpeg 6.1 pudotti viimeisen ruudun ja vientitarkistus hylkäsi videon (152 vs. sopimuksen ceil = 153). Nyt `-t ceil(pituus×fps)/fps`. Testattu 24/25/30 fps useilla pituuksilla; uusi yksikkötesti epäonnistuu ilman korjausta. Codexin aiempi 10 s e2e ei osunut tähän. Macin ffmpeg 8.1:n käytöstä ilman korjausta ei ole mittausta.
2. **Diagnostiikka:** testikäsikirjoitus `Pipsa: …` ei ole repliikkirivi (0 tapahtumaa) → `PIPSA: …`.
3. **Diagnostiikka:** korrelaatiohaku 1 ms välein ohitti huipun (0,85 → hylätty, vaikka todellinen 0,996). Nyt karkea haku + tarkennus näytteen tarkkuudella.

## Avoinna
Aito Kokoro-inferenssi tällä polulla omalla Macilla (sama komento ilman STANDIN/NO_SANDBOX-muuttujia, `HAHMOSTUDIO_KOKORO_MODEL_DATA` = käyttäjän hyväksytty malli), paketoitu ajo (`--packaged`) uudesta .app:sta, ihmisen kuuntelu ja silmämääräinen huulisynkan hyväksyntä. WAV/MP4 eivät ole Gitissä.
