# Full-stack / Electron — ensimmäinen asiantuntijakierros

## Koodista todettu
`desktop/encoder.mjs / runEncoder` käynnisti child_process.spawn-kutsun ennen jo valmiiksi keskeytetyn AbortSignalin tarkastusta. Tällainen signaali ei enää laukaise myöhemmin lisättyä abort-kuuntelijaa, joten encoder saattoi käynnistyä peruutuksesta huolimatta. Tallennus/vienti käyttää jo pysyvää ExportQueue- ja manifestitarkistusketjua.

## Toteutus
Signaalin throwIfAborted tarkistetaan Promise-executorin alussa ennen spawnia. Uusi testifixture todentaa, ettei valmiiksi peruttu työ kirjoita outputia; onnistuneen enkooderin progress ja virheen välitys varmennetaan erikseen. Aiempi PSD-ryhmärajakorjaus kuuluu samaan full-stack/importer-vastuuseen.

## Ehdotukset ja avoimet
Koko KOETA-editorin GUI-vientikoe sekä paketoidun sovelluksen käynnistys pysyvät erillisinä hyväksyntöinä. Oikean VideoToolboxin allow_sw=0-probe voidaan ajaa olemassa olevalla paikallisella FFmpegillä, mutta värivideofixture ei osoita valmiin animaation laatua. Äänen kuuntelu kuuluu ääniasiantuntijalle, GPU/pilvi ei kuulu tähän testiin.

Testitulokset täydennetään ajon jälkeen. Koordinoija toimii tässä full-stack-asiantuntijana.

Integraatiokorjaus: toon-hem-regression findLast korvattu ES2022-yhteensopivalla reverse/find-haulla (TypeScriptin lib-asetus ES2022). Omistava 3D-agentti oli jo päättänyt työnsä; ei samanaikaisia kirjoituksia samaan testiin.

## Lopulliset kohdennetut tulokset 9.10.2026

Enkooderin kaksi regressiota ja oikean FFmpeg/ffprobe-tarkistuksen kolme testiä:5/5pass require_escalated-ajossa (sandbox-ajo epäonnistui native-prosessin käynnistykseen). PSD-importin tarkennetut rajatestit9/9pass. Tyypintarkistus exit0. Lokit /private/tmp/hahmostudio-encoder-second.log ja yhteinen typecheck-retry.log. Koko sarjan samanaikainen native-prosessin ajo tarkastetaan QA:n erillisessä raportissa eikä kohdennettu pass peitä sitä.
