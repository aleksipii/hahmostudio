# Palikkaeditorin pointer- ja Alt-auditointi 12.10.2026

Lähtö `f4f2ea8efdf902e54988a5834af905e0109c4ef4`, oma haara `codex/block-drag-2026-10-12`.

## Koodista todettu

`components/block-timeline.tsx` käyttää pointer capturea, siirtää palikan `dx / 48` sekuntia ja välittää pointerupin Alt-modifierin `together`-komennoksi. `components/presentation-panel.tsx` käsittelee komennon tekstimuutoksena ja yhtenä pysyvästi tallennettuna uudelleenrakennuksena. `lib/blocks.ts` jakaa tauon siirtokohdassa; Samalla sijoittaa liikkeen/ilmeen/katseen/esineen repliikin alkuun. Käsikirjoitus säilyy auktoriteettina.

Nykyinen Tarina-näkymä käyttää rivikohtaisia `textarea.script-line-field`-kenttiä. Yhden rivin kentän rivinvaihdot normalisoidaan välilyönneiksi. Fixture syötetään riveittäin. Työkalupaletin napin ensimmäinen span on otsikko ja small selite; testissä nämä erotetaan.

## Testin rajaus

`HAHMOSTUDIO_BLOCK_ACCEPTANCE=1` valitsee vain olemassa olevan eristetyn Electron-workflow-diagnostiikan sisällä uuden testin. Tavallinen ohjelman käynnistys ja workflow-auditointi eivät muutu. Electron päättää itse testin jälkeen. Rendererille ei lisätä IPC-rajapintoja. Ohjelman omat DOM/React- ja pointer-capture-käsittelijät toimivat; Chromium CDP lähettää hiiren siirto/painallus/vapautus tapahtumat. Fyysistä OS-hiirtä, näppäimistöä, VoiceOveria tai käyttäjän dataa ei käytetä.

Tarkistettavat jälkiehdot: lähde ja ackattu levy-snapshot ennen editointia; tauon jako ja ilmeen alku 2 s; tekstin atominen tallennus; undo palauttaa tarkan lähteen; Alt-pudotus repliikin päälle lisää Samalla-rivin; repliikin ja ilmeen sama alkuaika; persistentti tallennus; undo/redo säilyttää tarkan lähteen; ei renderer-konsolivirheitä.

## Komennot ja todennus

- `node --check desktop/block-diagnostic.mjs`: läpi.
- `node --experimental-strip-types --test lib/blocks.test.ts`: **10/10 läpi**, ei ohituksia.
- `npm run desktop:test:blocks`: GUI-ajo vielä kesken; lue viimeisen ajon block-report.json ja workflow-report.json, älä päättele onnistumista tästä suunnitelmasta.

Buildin muuttumaton `dist-desktop` ja private runtime käytetään toisesta saman SHA:n auditointikopiosta symlinkeillä levytilan säästämiseksi. Symlinkkejä, runtimeja ja testin userDataa ei stageta Gitissä. Tuotantokomponentteja ei tässä vaiheessa muutettu.

## Avoimet kysymykset ja ehdotukset

Avoinna: viimeisen kohdistuksiltaan korjatun GUI-ajon hyväksyntä. Aiemmat kehitysajot pysähtyivät testikohdistuksiin eivätkä ole näyttö tuotantopalikan viasta. Laajennusehdotus: erilliset usean palikan drag-, reunasta venytys-, pointercancel-, kirjasto-HTML-drag/drop- ja näppäimistötestit. Tämä testi ei hyväksy näitä eikä fyysisiä laitteita tai VoiceOveria.
