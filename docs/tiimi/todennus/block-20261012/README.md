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
- `npm run desktop:test:blocks`: **4 tarkistusta läpi, Alt-vaihe epäonnistui**. Aito pointer-raahaus jakoi tauon ja ilme alkoi 2 s, lähde tallentui pysyvästi, undo palautti tarkan lähteen. Undo ei palauttanut palikka-aikajanan mallia: ilme edelleen 2 s, mutta lähde ensimmäisellä rivillä. Alt-pudotus sen jälkeen ilmoitti “Rivi 2 on muuttunut palikan lukemisen jälkeen”. block-failed.png sekä JSON source/blocks todentavat ristiriidan.

Buildin muuttumaton `dist-desktop` ja private runtime käytetään toisesta saman SHA:n auditointikopiosta symlinkeillä levytilan säästämiseksi. Symlinkkejä, runtimeja ja testin userDataa ei stageta Gitissä. Tuotantokomponentteja ei tässä vaiheessa muutettu.

## Avoimet kysymykset ja ehdotukset

Avoinna: undo/source/model-ristiriidan juurisyy ja korjaus, sitten undo+Alt+redo uusinta. Neljäs ajo pääsi oikeaan raahaukseen ja löysi todellisen käyttöliittymän ristiriidan; ensimmäiset kolme ajoa olivat vain kohdistusvirheitä. Laajennusehdotus: erilliset usean palikan drag-, reunasta venytys-, pointercancel-, kirjasto-HTML-drag/drop- ja näppäimistötestit. Tämä testi ei hyväksy näitä eikä fyysisiä laitteita tai VoiceOveria.

## Claude: juurisyyt, korjaus ja uusinta 12.10.2026

Haara `claude/project-thread-zgcm7k` (sisältää `codex/block-drag-2026-10-12`:n `543c0f0`). Vika toistui Linux-pilven Electron 44.5.1:ssä (Xvfb).

Juurisyyt ja korjaukset:
1. **Vanha palikkamalli kumoamisen jälkeen** (`components/presentation-panel.tsx`). Projektin Kumoa kasvattaa `projectEpoch`ia, ja sen efekti asettaa mallin palautetusta `scene.presentationDraft`ista. Samassa commitissa ajettu bindings-synkronointiefekti käytti vanhaa `model`-sulkeumaa ja kutsui `setModel({...vanhaMalli,bindings})`, jolloin kumottu (siirretty) malli palasi. Efekti käyttää nyt funktionaalista päivitystä nykyiseen malliin. Tästä tuli Codexin havaitsema "Rivi 2 on muuttunut palikan lukemisen jälkeen": palikat luettiin siirretystä mallista mutta sovellettiin palautettuun tekstiin.
2. **Natiivi raahaus ja tyhjä pudotus** (`components/block-timeline.tsx`). Aikajanalla alkanut selaimen natiivi drag katkaisi palikan pointer-raahauksen, ja raidan `onDrop` tulkitsi tyhjän datan `Number('')===0`:ksi eli lisäsi kirjaston ensimmäisen palikan (Vilkuta). Natiivi dragstart estetään aikajanalla (kirjaston napit ovat sen ulkopuolella), ja pudotus hyväksyy vain olemassa olevan kirjastoindeksin.

Testiä tiukennettiin (ei väljennetty): undo vaatii nyt myös palikkamallin palautuksen (ilme alkaa 0 s, ei jaettua taukoa), Alt-undo palikkamallin ja redo yhteisen alkukohdan. Epäonnistumisraportti sisältää pysyvän snapshotin lähteen ja tilailmoitukset.

Negatiiviset kontrollit: ilman korjausta 1 uusi tarkistus "undo restores block model with the script" epäonnistuu; ilman korjausta 2 Alt-pudotus aikakatkaistaan. Codexin alkuperäinen epäonnistumiskuva: `codex-block-failed-ennen-korjausta.png`.

Komennot (Linux, root, siksi `--no-sandbox` suoraan Electronille; `npm run desktop:test:blocks` tekee saman macOS:llä):
- `npm run typecheck`: läpi. `npm run desktop:build`: läpi.
- `npm test`: 1402 testiä, 1401 läpi, 0 virhettä, 1 ohitus (natiivi-FFmpeg puuttuu Linux-ympäristöstä) — `claude-npm-test.txt`.
- `xvfb-run -a env HAHMOSTUDIO_TEST_DATA_DIR=$(mktemp -d) HAHMOSTUDIO_BLOCK_ACCEPTANCE=1 HAHMOSTUDIO_WORKFLOW_OUTPUT=docs/tiimi/todennus/block-20261012 node_modules/.bin/electron . --workflow-gui-test --no-sandbox`: **13/13 läpi**, ok=true, ei renderer-virheitä — `claude-electron-blocks.txt`, `block-report.json`, `block-success.png`.
- Sama ilman BLOCK-muuttujaa (tavallinen workflow): ok=true, 22 tarkistusta — `claude-workflow.txt`.

Ei hyväksytty tällä: macOS-ajo ja paketoitu .app (`npm run desktop:test:blocks` ja `-- --packaged` Macilla), fyysinen hiiri/ohjauslevy, VoiceOver, usean palikan raahaus, reunasta venytys, pointercancel, kirjaston HTML-drag/drop ja näppäimistöpolut.
