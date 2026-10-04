# Hahmostudio 0.9.0 — tarkistukset ja rajat

Päivä: 4.10.2026. Toimitus: macOS arm64, Electron 44.5.1. Koodin kehitys säilyttää aikaisemman verkkoversion, Electron-version ja kirjaston. GitHubiin ei julkaistu eikä käyttöoikeuksia muutettu.

## Automaattiset tarkistukset

- `npm test`: **147/147 hyväksytty**, ei ohitettuja eikä epäonnistuneita testejä.
- TypeScript-tarkistus, `npm run build:private` ja `npm run desktop:package:mac`: onnistuneet. Rakennus varoittaa suuresta JS-paketista ja päällekkäisestä fflate-tuonnista; nämä eivät estä rakennusta. .icon-muotoa koskeva pakkausvaroitus ei poista mukana olevaa .icns-kuvaketta.
- `npm run desktop:test:package`: onnistunut paketoidun Electronin Node-ajotilassa. Paikallinen autentikoitu palvelin, vanhat hahmot/PSD:t/kuvausympäristöt, kameramalli/WASM ja AudioWorklet palauttavat resurssit. Rhubarb käsittelee hiljaisen WAV:n molemmilla kielivalinnoilla. Tämä ei ole käyttöliittymän käynnistystesti eikä fyysinen laitetesti.
- Mac-paketin `codesign --verify --deep --strict`: onnistui. Paikallinen ad hoc -allekirjoitus; ei Applen notarisoima jakelu.
- Tasotestit: muokkaus säilyttää tunnisteen, PSD-sijainnin, pivotin, rigin ja animaation; vanhan projektin luku ja v4-muokkausten/maskien/vektorien/äänen analyysin tallennus–uudelleenavaus; lukitus, järjestys ja virheellisten syötteiden hylkäys.
- Jonotestit: itsenäinen tilannekuva, yksi aktiivinen työ, peruminen ja uudelleenyritys. ExportService-testissä korvattu Electron-ikkuna/IPC toimittaa oikeasti levylle ruudut: yksi kuittaus kerrallaan, valmis PNG-hakemisto, peruminen ja encoder-virhe säilyttävät aiemman vientitiedoston.
- Pitkän viennin WAV-muunnoksen 300 s raja testattu erillään litteroinnin/äänteiden 60 s syöterajasta; puhepalvelun rajoitusta ei laajenneta.
- Aikaisemmat kamera-, mikrofonin AudioWorklet-, mouth track-, käsikirjoitus-, kiinnitys-/IK-, audioajoitus- ja tiedostoturvatestit pysyvät mukana. Mallinnettu testi ei todista fyysistä mikrofonia tai kameraa.

## Todelliset paikalliset media-ajot

- whisper.cpp 1.9.4 + monikielinen Whisper base, CPU: tunnisti oikean englanninkielisen JFK-testitallenteen. Palvelun palauttama segmentti sisälsi mallin tuottaman tekstin ja 0–10 s ajoituksen. Litterointi ei ole esimerkkitekstin palautus.
- VideoToolboxin todellinen 320×240 H.264-koepakkaus `allow_sw=0` epäonnistui tässä ympäristössä (-12903). **Rautakiihdytyksen onnistumista ei väitetä.** Mukana oleva OpenH264-ohjelmistofallback onnistui.
- Jaetulla renderExport/renderScene-logiikalla tuotettiin yhden sekunnin kohtaus: 160×284, 4 fps, neljä PNG-ruutua sekä WAV-ääni. Canvas-pikselit tarkistettiin: tavallisen taustan kulmapikseli (25,44,67,255), läpinäkyvän PNG:n kulma (0,0,0,0).
- Todellinen native FFmpeg -pakkaus näistä ruuduista: MP4 H.264, 4 videoruutua, 1,000 s; AAC-ääni 16000 Hz, 1,000 s. ffprobe varmisti lopputuloksen.
- GIF: neljä ruutua, kesto 1,000 s, 250 ms/ruutu ja jatkuvan toiston asetus. Palettipakkaus onnistui.
- FFmpeg-dekoodaus tarkistettu WAV-, M4A/AAC- ja MP3-koenäytteillä. Sovelluksen AudioContext-dekoodaus on runtimekohtainen: fyysistä Safari-käyttöä tai kaikkia MP3/AAC-variantteja ei testattu.
- `otool -L`: toimitettujen FFmpeg/Whisper-binäärien riippuvuudet ovat järjestelmän kirjastoja/frameworkeja. Homebrew-polkuja ei tarvita.

## Kohdistettu selainesikatselu

Uusimman pyynnön mukainen pieni käyttöliittymäesikatselu: Roni-Studio → Hahmo → Piirtäminen → oikea olkavarsi. Työkalut ovat piirtoalueella, tason/vektorin ominaisuudet omassa vieritettävässä oikeassa paneelissa. Vaalea ja tumma teema sekä vähennetty läpinäkyvyys/liike ja suuri kontrasti katsottiin. Esikatselukuvat ovat Esimerkit-kansiossa.

Canvas-pikselitarkistus: maskin piilotus/palautus palauttaa alkuperäisen punaisen pikselin; pyyhin ja sen kumoaminen, alueen siirto, vektorin piirto ja kumoaminen toimivat. Tämä ei ole kaikkien työkalujen hiiri-/näppäimistö-/ruudunlukijatesti.

## Ei vielä varmennettu

- Uuden Mac-ikkunan GUI-käynnistys ja vientijono kokonaisena Electron-käyttäjäpolkuna: paikallinen GUI-yritys ei tuottanut valmistumisraporttia. Toimitusta ei merkitä tältä osin varmennetuksi. Prosessirakenne on testattu erikseen ja renderöinti sekä native-pakkaus ajettiin erillisinä todellisina vaiheina.
- Fyysinen mikrofoni/kamera, käyttöoikeusdialogit ja Safari; tämän ympäristön kokeet eivät todista niitä.
- Suomenkielisen Whisper-tunnistuksen laatu, monen puhujan tarkkuus ja sanatason ajoitus. Kielivalinta ja paikallinen backend ovat toteutettu, mutta suomenkielistä vertailutallennetta ei testattu.
- VideoToolboxin onnistunut laitteistopakkaus, M1/M2/M3/M4-laitematriisi ja Intel-Mac.
- Pitkä 1080×1920 tuotanto kuormituksen alla, sovelluksen pienentämisen/sulkemisen koko GUI-polku ja kaikkien vanhojen käyttäjäprojektien yhteensopivuus.

## Toteutuksen rajat

Muokattava .hahmo v4 on ensisijainen piirtoeditorin tallennusmuoto; vanhemmat sovellukset eivät avaa v4:ää. PSD:n täydellistä round-trip-vientiä ei luvata. Paikallinen kuvasisältö rajautuu tason alkuperäiseen kuvarajaukseen; yksinkertaiset vektoripolut ovat suljettuja suoria segmenttejä. Alueen siirto ei siirrä erillistä maskia. Vanha alkuperäisen PSD:n/tason PNG:n lataus säilyttää alkuperäisen sisällön, uuden kohtausviennin kuva sisältää muokkaukset.

Litterointi enintään 60 s; puhealue/hiljaisuus on RMS-kynnysanalyysi, sanat Whisperiä ja visemit Rhubarbia. Puhujan kohdistus on manuaalinen; liitä repliikkiääni erikseen nykyisessä käsikirjoitustyönkulussa. Alkuperäistä käsikirjoitusta ei korvata.

Uusi taustajono/GIF/Finder ovat Mac-ominaisuuksia; vanhat web-MP4/PNG-viennit säilyvät. Malli on Mac-paketissa. Staattinen Pages ei voi ajaa paikallista Whisper-palvelinta. Canvas-renderöinnin, PNG/GIF:n ja äänen koko putki ei ole VideoToolbox-kiihdytetty. Työ ei jatku sovelluksen täydellisen sulkemisen jälkeen.

Käyttö, asetukset, rajat ja rakentamiskomennot: DEVELOPMENT-0.9.md. Projektit ja asetukset säilytetään sovelluspaketin ulkopuolella. Vanha Lataukset-kansion app ei päivity automaattisesti: sulje se ja korvaa sovellus uudella paketilla.
