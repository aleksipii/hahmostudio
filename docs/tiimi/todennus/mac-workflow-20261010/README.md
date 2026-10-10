# Mac-työvaiheet ja repliikkitallennuksen elinkaari — 10.10.2026

Testi käyttää oikeaa KOETA-editoria, Electron-siltaa ja AudioWorklet-tallenninta. Sen getUserMedia korvataan vain testiajossa generoidulla 220 Hz äänivirralla. Fyysistä mikrofonia ei avata, lupaa ei kysytä eikä käyttäjän ääntä käsitellä. Tallennus perutaan: äänen liittäminen, Rhubarb, Kokoro ja vientisynkka eivät kuulu tämän testin hyväksyntään.

Komennot projektin juuresta:

```sh
VITE_BASE_PATH=/ VITE_PRIVATE_SERVER=false npm run build -- --outDir dist-desktop --configLoader runner
npm run desktop:test:workflow
electron_config_cache=/Users/Aleksi/Library/Caches/electron node scripts/package-mac.mjs
npm run desktop:test:workflow -- --packaged
npm run desktop:test:package
```

Testikäynnistin luo jokaiselle ajolle uuden datakansion ja poistaa vanhan workflow-report.json:n ennen käynnistystä. Asennettua sovellusta ei korvata. --workflow-gui-test vaatii HAHMOSTUDIO_TEST_DATA_DIR:n. Käynnistysvirhe kirjoittaa uuden epäonnistuneen raportin. Paketista ajettaessa testikäynnistin vaatii myös packaged=true-merkinnän.

source/ ja packaged/ sisältävät erilliset JSON-raportit ja kuvat. Geometriaraportti käyttää todellista ikkunakokoa, jonka macOS voi rajata näytön työalueeseen. Testi tarkistaa kuusi vaihetta kahdella leveydellä ja jokaisen vaiheenvaihdon äänityksen aikana: sama tallennin ja portaali, elävä ääniraita, vain yksi mediavirran hankinta, tilateksti, painikkeen näkyvyys ja osumatesti. Peruutuksen jälkeen ääniraita on suljettu ja mikrofonin tila palautunut.

VoiceOver, fyysiset kamera/mikrofoni, tallenteen käyttäminen repliikkina, oikea Kokoro-inferenssi sekä vientisynkka vaativat vielä erillisen hyväksynnän. Nämä kuvat tai generoitu äänivirta eivät sulje niitä.
