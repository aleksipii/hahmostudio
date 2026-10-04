# Hahmostudio 0.9: piirto, ääni ja vienti

Aiemmat PSD-hahmot, käsikirjoitukset, monikulmahahmot, 3D-paperisyvyys, kameraseuranta, Rhubarb-suumuodot, mikrofoni ja verkkoversio säilyvät. Työn aikana ei julkaista GitHubiin eikä muuteta omistajaa tai kirjautumista.

## Käyttö

- Avaa hahmo. Valitse **Hahmo → Hahmon osat → Piirtäminen** ja vasemmalta oikea taso. Sivellin, pyyhekumi, pipetti, aluevalinta/siirto, maskin piilotus/palautus ja vektorityökalut löytyvät piirtoalueen yläpuolelta. Näkymän siirtotyökalulla voi vierittää zoomattua kuvaa. Zoomaus ja Sovita säilyvät alareunassa.
- Oikealla **Tason ja vektorien asetukset**: lisää/kopioi/nimeä/järjestä/lukitse/piilota tasoja, peittävyys, sekoitustila, kuvasisällön paikallinen siirto/koko/kierto ja vektorin täyttö/viiva/pisteet. Polku syntyy napsauttamalla pisteet ja painamalla **Sulje ja lisää polku**. Polun pisteet ovat muokattavissa suhteellisina x,y-koordinaatteina. Yksinkertainen suljettu polku ei sisällä Bézier-kahvoja.
- **Nivelmääritys** on erillinen tehtävä. Piirtovedot eivät luo rigiä uudelleen. Olemassa olevan osan tunniste, kuvarajaus ja pivot säilyvät. Uusi taso saa uuden tunnisteen ja oletuspivotin; liitä osa itse oikeaan vanhempaan. Muunnos rajautuu alkuperäiseen tason kuvarajaukseen. Näyttämön sijainti/koko/kierto tehdään edelleen Animointi-työtilassa.
- **⌘Z / ⇧⌘Z** ja Muokkaa-valikko kumoavat Hahmo-työtilan tason muokkaukset; muissa työtiloissa animaation muutokset. Hahmon muokkaushistoria säilyttää dokumentin, rigin ja animaation tilannekuvat, enintään 40 askelta.
- **Animointi → Liikkeet → Ääni · aaltomuoto ja puheen teksti**: tuo ääni aiemmalla Lisää ääni -toiminnolla tai äänitä omalla mikrofonilla. Aaltomuotoa napsauttamalla siirryt esikuuntelussa. Voimakkuuteen perustuvat puhealueet ja hiljaisuudet ovat erillään sanojen litteroinnista.
- Valitse Suomi/Englanti ja **Litteroi puhe**. Paikallinen monikielinen Whisper base käsittelee enintään 60 s tallenteen. Segmenttiajat tulevat mallista; sanatarkkoja aikoja tai automaattista puhujan henkilöllisyyttä ei väitetä. Korjaa teksti, valitse puhuja ja jaa segmentti esikuuntelun toistopään kohdasta. Korjattu teksti, ajat, puhuja ja alkuperäinen ääni tallennetaan .hahmo-projektiin. Vertailu näyttää alkuperäisen käsikirjoituksen muuttamatta sitä. Puhujan segmenttimerkintä ei automaattisesti korvaa käsikirjoituksen repliikkiääniä: liitä ääni repliikkiin nykyisessä käsikirjoituksen valmistelussa. Rhubarb-äänneanalyysi ja alkuperäinen mouth track säilyvät erillisinä.
- **Vie…** avaa Macilla yhteisen vienti-ikkunan. MP4 H.264/AAC, GIF (128 värin paletti, toistot ja näkyvä fps) tai numeroidut PNG-ruudut uuteen kansioon. PNG:n mukana saa erillisen WAV-äänen ja kuvasarja.json-tiedoston. MP4 ei tue alfaa, GIF ei ääntä. Läpinäkyvä PNG ohittaa kuvausympäristön/taustavärin, säilyttää hahmot, esineet ja otsikot.
- Säädä koko, fps, alku/loppu, MP4-bittivirta, ääni ja formaatin muut valinnat. Tallenna oma esiasetus. **Pikavienti** käyttää viimeistä esiasetusta ja Macilla valittua kohdetta; aiemman MP4/GIF-tiedoston korvaus varmistetaan. Aiemman PNG-kansion päälle ei kirjoiteta. Vientikohde ja esiasetukset säilyvät Macin sovellusasetuksissa portin vaihtuessakin.
- Vientijonossa näet valmistelun/renderöinnin/pakkauksen, etenemisen ja todellisen pakkaajan. Peruuta, yritä uudelleen, poista päättynyt työ jonosta tai Näytä Finderissa. Jonosta poistaminen ei poista vientitiedostoa. Sovelluksen pienentäminen sallii viennin; lopettaessa voi jatkaa odottamista tai perua. Kokonaan suljettu sovellus ei renderöi.
- **Asetukset → Saavutettavuus**: vähennä liikettä/läpinäkyvyyttä ja nosta kontrastia. Näytä-valikon vaalea/tumma/järjestelmäteema ja paneelivalinnat säilyvät. Macin järjestelmän ikkunapainikkeet ja otsikkopalkki ovat natiivit; HTML/CSS-navigaatio ei ole Applen natiivi Liquid Glass.

## Tiedostomuoto ja rajat

.hahmo-muodon versio 4 sisältää muokattavat sivellin-/pyyhinvedot, nondestruktiiviset maskivedot, vektorit ja paikalliset muunnokset. Versioita 1–3 luetaan edelleen. Alkuperäinen PSD ja PNG:t säilyvät. Muokattu projekti on tarkoitus avata 0.9-versiolla; vanha versio hylkää v4-tiedoston. Photoshopin täydellistä PSD-edestakaista yhteensopivuutta ei ole. Alkuperäisen PSD:n lataus ja yksittäisten alkuperäisten tasojen PNG-vienti eivät sisällä .hahmo-editorin uusia muokkausoperaatioita; koko kohtauksen uusi vienti sisältää ne.

Editorissa on rajattu paikallinen tason kuvarajaus, ei rajattomasti kasvavaa rasteripintaa. Tason väripoiminta poimii valitun tason kuvasisällön, ei koko yhdistelmäkuvaa. Polut ovat suljettuja suoria segmenttejä. Tasomaski piilottaa/palauttaa alfan eikä tuhoa alkuperäistä pikseliä; alueen siirto ei siirrä erillistä maskia. Nämä rajat ovat näkyvissä työkalun ohjeessa.

Vientijono on Electron-version ominaisuus. Verkkoversion aiempi MP4- ja PNG-zip-vienti säilyy; selainversiossa ei ole uuden Mac-jonon FFmpeg/GIF/Finder-toimintoja. Puhemalli toimii verkkoversiossa paikallisen Node-palvelimen kanssa, ei staattisessa Pages-sivussa. Uusien puhe- ja vientiruntimejen käyttö ei edellytä Adobea. Paikallinen malli on mukana Mac-paketissa. Jos malli puuttuu, UI:n **Lataa paikallinen puhemalli** lataa noin 148 Mt HTTPS-yhteydellä ja tarkistaa SHA-256:n. Vain mallia ladataan, ääntä ei lähetetä verkkoon.

Projektin rajoitukset: 128 Mt arkisto, 25 Mt alkuperäinen ääni, 1000 tasoa; muokkaustason enintään 2000 operaatiota / 100000 piirtopistettä. Vienti enintään 4096×4096 (yhteensä 8 294 400 pikseliä), 60 fps / 300 s / 18000 ruutua. PNG-väliruudut ovat levyllä, enintään 4 Gt per työ. Jonossa enintään neljä keskeneräistä työtä ja 256 Mt tilannekuvia. Pitkä laadukas vienti voi tarvita lyhyempiä osia. Vientiasetus ei muuta projektin mittoja.

## Toteutusrakenne

`layer-edit.ts` validoi muokkaukset ja tekee immuuttiset tasopäivitykset. `layer-pixels.ts` muodostaa yhden muuttuneen tason välimuistitekstuurin. Sama tekstuuri menee PSD-/animaatio-/paperi-3D-renderöintiin. Maski kootaan erikseen ennen lopullista alfa-yhdistystä. Vektorin projektitiedot pysyvät vektoreina.

`export-service.mjs` omistaa Macin dialogilla valitun vientikohteen. `ExportQueue` ottaa kopion .hahmo-arkiston tavuista. Piilotettu BrowserWindow on erillinen renderer-prosessi, ilman Nodea/kameraa/mikrofonia; oma rajattu preload sallii vain nykyisen työn ruudun/äänen/valmistumisen. `renderExport` käyttää `renderScene`-aikajanalogiikkaa ilman live-ohjausta. Yksi ruutu kirjoitetaan ja kuitataan ennen seuraavaa. FFmpeg toimii erillisenä lapsiprosessina, PNG/GIF/ääni CPU-polulla. Väliaikaiset tiedostot ovat kohteen vieressä; vasta onnistunut tulos siirretään lopulliseksi. Peruminen ja virhe poistavat vain työn oman väliaikaisen hakemiston.

VideoToolbox testataan pienellä todellisella H.264-pakkauksella ja `allow_sw=0`: onnistuminen merkitsee vaadittua laitteistoenkoodausta. Jos testi tai varsinainen pakkaus epäonnistuu, käytetään mukana toimitettua OpenH264-ohjelmistopakkaajaa. Encoder-nimi kerrotaan työssä. H.264-pakkaus ei tarkoita koko Canvas/GIF/PNG/audioputken GPU-kiihdytystä.

`transcriber.mjs` käyttää whisper.cpp 1.9.4:n CLI:tä ja monikielistä base-mallia paikallisessa lapsiprosessissa. CPU-polku on eksplisiittinen (`--no-gpu`), vaikka binääri sisältää Metal-tuen. Alkuperäinen ääni dekoodataan nykyisen selaimen AudioContextilla ja toimitetaan tunnistimelle kanavayhdistelmänä 16 kHz WAV-muodossa. Puhe/hiljaisuus on RMS-kynnysanalyysi, visemit ovat Rhubarbia ja sanat Whisperiä. Ne eivät ole sama analyysi.

## Kehitys ja Mac-paketointi

```sh
npm ci
npm run native:prepare
npm run typecheck
npm test
npm run desktop:package:mac
npm run desktop:test:package
```

`native:prepare` on ylläpitäjän verkkoyhteyttä vaativa lähdekäännös (Xcode Command Line Tools, make ja cmake). Se varmistaa FFmpeg 8.1:n, OpenH264 2.6.0:n, whisper.cpp 1.9.4:n, pkgconf 2.5.1:n ja mallin tarkistussummat. Valmis loppukäyttäjän Mac-sovellus sisältää FFmpegin, ffproben, Whisperin, mallin, Rhubarbin sekä lähdepaketit/lisenssit. Normaali käyttö ei vaadi Nodea/Homebrewta/FFmpegiä. Natiivit binäärit pitää kääntää kohdearkkitehtuurille. Tämä toimitus on arm64; Intel-käännöstä ei testattu.

Tarkistettujen periaatteiden lähteet: [Apple Materials](https://developer.apple.com/design/human-interface-guidelines/materials), [Layout](https://developer.apple.com/design/human-interface-guidelines/layout), [Toolbars](https://developer.apple.com/design/human-interface-guidelines/toolbars), [Sidebars](https://developer.apple.com/design/human-interface-guidelines/sidebars), [Typography](https://developer.apple.com/design/human-interface-guidelines/typography), [Color](https://developer.apple.com/design/human-interface-guidelines/color), [Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility), [FFmpeg](https://ffmpeg.org/ffmpeg.html), [VideoToolbox-enkooderi](https://ffmpeg.org/doxygen/8.1/videotoolboxenc_8c.html), [whisper.cpp](https://github.com/ggml-org/whisper.cpp).
