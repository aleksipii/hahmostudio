# Varmennus · 3.10.2026

- `npm test`: 69 testiä läpäisi, 0 epäonnistui, 0 ohitettu. Mukana vanhat projektit, paikallinen tunnistuspalvelu, simuloidut laitteet ja ohjauslähteet sekä natiivitiedostojen ja IPC-politiikan yksikkötestit.
- `npm run desktop:build`: TypeScript ja erillinen tuotantokäännös läpäisi.
- `npm run build:private`: verkkoversion tuotantokäännös läpäisi.
- ARM64-Mac-paketti Electron 44.5.1:llä valmistui. Ad hoc -allekirjoitus: `codesign --verify --deep --strict` läpäisi. Kamera- ja mikrofonikuvaukset tarkistettiin pää- ja Renderer Helper -paketista.
- `npm run desktop:test:package`: läpäisi sovelluksen oman Electron/Node-runtimen kautta, cwd lähdekoodin ulkopuolella ja PATH=/usr/bin:/bin. app.asar-resurssit, paikallinen suojattu palvelu, Otto/PSD/tausta/kasvomalli/WASM/worklet ja mukana tuleva Rhubarb fi/en tarkistettiin. Ääniaineisto oli yhden sekunnin synteettinen hiljaisuus; tämä ei varmista puheen tunnistustarkkuutta.

## Ei varmistettu

Piilotettu GUI-käynnistystesti ei päässyt sovelluslogiikkaan: sekä paketti että muuttamaton Electron keskeytyivät macOSin `_RegisterApplication`-kohdassa tässä rajatussa suorituksessa. Ensimmäisen paketin allekirjoitusasetuksesta löytynyt kirjastolatausongelma korjattiin; uudessa paketissa kyseistä virhettä ei esiintynyt. Paketissa on erillinen `--self-test`-polku GUI/preload-varmennukseen, mutta sen tulosta ei ole saatavilla. Tavallista Finder-käynnistystä ei siis ole osoitettu toimivaksi.

Fyysinen kamera/mikrofoni, käyttöjärjestelmän lupadialogit, native-ikkunoiden käyttö käsin, oikean Safarin toiminta ja visuaalinen tarkistus jäivät tekemättä. Käyttäjän aiempi ohje rajasi testauksen koodiin; automaattinen runtime-testi ei käyttänyt laitteita tai selainesikatselua.

Vite raportoi suuren päächunkin ja yhteisen staattisen/dynaamisen fflate-importin optimointihuomiot. Ne eivät estäneet kummankaan version tuotantokäännöstä.

## Käynnistyskorjaus 0.2.1

Päämoduulin top-level `await app.whenReady()` esti ESM-moduulin latautumisen päättymisen, jota Electron odottaa ennen `appCodeLoaded`-kutsua ja valmiustapahtumaa. Korjaus rekisteröi valmius-callbackin odottamatta sitä moduulitasolla. Electronin version 44.5.1 toteutus: https://raw.githubusercontent.com/electron/electron/v44.5.1/lib/browser/init.ts .

Uusi testi tuo oikean main.mjs-tiedoston erilliseen Node-prosessiin simuloidulla Electronin ready-tapahtumalla. Vanha koodi jumiutui testin aikarajaan; korjattu koodi vapauttaa moduulilataajan ennen readyä. Kaikki 70 testiä läpäisevät. Paketin oma runtime sekä allekirjoitus tarkistettiin uudelleen. Käynnistyksen vaihe näkyy nyt käyttäjäkohtaisen asetuskansion startup-status.json-tiedostossa; siinä ei ole istuntotunnusta tai projektisisältöä. Fyysiset laitteet ja visuaalinen tarkistus ovat edelleen varmistamatta.


## 0.3.0 · kirjasto, käsikirjoitus, pään liitos ja saavutettavuus

- 83/83 Node-kooditestiä läpi: vanhat projektit, uusi kirjasto, aidot tasolliset PSD:t, lähde-PSD:n vastaavuus, parentKey-liitokset, kaksi yhdeksän suun PSD-pakettia, kuusi erilaista taustan geometriaa ja SVG-lähteiden vastaavuus.
- Käsikirjoituksen fi/en-liikkeet, desimaalikestot ja kuvakulmat, tuntemattomien hakasuljeohjeiden hylkäys, negaation käsittely, liikeradat, vanhan toiston ja suutasojen säilyminen, muotokuvan jalkaliikkeiden esto, enimmäiskestot sekä .hahmo-roundtrip.
- Kameran liitetyn pään nollasiirtymä ja vakioskaala; kaulan maailmakoordinaatti säilyy täsmälleen vartalon liikkeen mukana myös pään kääntyessä. Vanhoja tallennettuja avainruutuja ei muuteta.
- React-komponenttien todellinen palvelinrenderöinti: kirjaston toiminnot, valintatilat, käsikirjoituksen nimetty textarea, suunnitelma ja estetty luonti ilman hahmoa. Vaalean/tumman teeman tekstiparit ja valitut ohjaimet saavuttavat vähintään 4,5:1 kontrastin testatuilla väreillä. Tämä ei ole koko sovelluksen WCAG-sertifiointi.
- TypeScript ja Viten työpöytä-/yksityisversiot rakentuvat. Apple Silicon -Mac-paketti sisältää uudet aineistot. Electronin paketoitu Node-runtime palvelee kirjautumissuojattuja aineistoja ja Rhubarbin hiljaisen WAV:n fi/en-tunnistus onnistuu. codesign --verify --deep --strict tarkistetaan toimituspaketista.
- Ei selaimen visuaalista testiä, fyysistä kamera-/mikrofonitestiä tai oikean Safarin käytännön testiä. Natiiveja tiedostoikkunoita ei simuloida varmennetuiksi laitetesteiksi. Valmiin Macin graafinen käyttö tarkistetaan käyttäjän omassa käynnistyksessä.
- Käsikirjoitus on paikallinen rajattu jäsennin, ei generatiivinen tekoäly. Se ei luo puheääntä, tekstityksiä, monen hahmon kohtauksia eikä maahan lukittuja jalkoja. Ohjeet kertovat nämä rajat.


## 0.4.0 · kuvakulmat, askellus, juoksu, puhelin ja Näkymä

93 kooditestiä: vanhat 0.3.0 projektit ja ominaisuudet säilyvät, Aino/Otto monikulmapaketit 75 tasolla, kolme erillistä roolikarttaa, kävely/juoksun automaattiset kuvakulmat, perspektiivikoko, sivuaskelen tukijalan maailmakoordinaatti sekä generoidun aikajanan tukivaihe (<2 px toleranssi interpoloiduille ruuduille), yksi aktiivinen hahmokuvakulma, phone/phoneCues-validointi ja käteen kiinnitetyn puhelimen seuranta, .hahmo-roundtrip ja näkymäasetusten turvallinen lukeminen. React-SSR-varmennus Näkymä-valikon neljästä valinnasta ja palautuksesta, puhelimen kolmesta kuvakulmasta sekä yläreunan liikepainikkeista. Node-testit eivät ole fyysinen laite- tai selain/visuaalinen varmennus.

Mac-paketti rakennetaan samasta editorista. Paketoidun Electronin Node-runtime tarkistaa myös uudet hahmopaketit ja paikallisen Rhubarbin fi/en-hiljaisen WAV:n. Yksityinen webversio rakennetaan samalla. Sivukulmat ovat alkuperäisiä 2D-piirroksia; vasen peilaa erikseen piirretyn sivukuvan. Kohti katsojaa -liike on tyylitelty 2D-perspektiivi, ei 3D-malli.


## 0.5.0 · valikot, joustava näyttämö ja paperileikkaushahmot

101/101 kooditestiä: vanhat projektit ja toiminnot, Roni/Salla 75-tasoiset kolmen kuvakulman aineistot ja kävely/juoksu/.hahmo-roundtrip, paneelien tallennetun koon validointi ja keskialueen tilan säilyminen desktop-leveyksillä, React-SSR-varmennus valikoista ja kolmen jakajan saavutettavuusattribuuteista. TypeScript, yksityinen webbuild ja Mac-build tarkistetaan. Paketoidun runtimen resurssi- ja paikallinen fi/en Rhubarb-testi sekä ad hoc -allekirjoitus tarkistetaan. Ei selaimen visuaalista, fyysistä laite- tai oikean Safarin testiä. Paneelien vetämistä ei ole testattu graafisessa sovelluksessa; koodi ja kokolaskenta on varmennettu.

## 0.6.0 · dialogikohtaukset, sivukäsien korjaus ja keskitys

- `npm run typecheck`: läpäisi.
- `npm test`: 115/115 läpäisi, 0 epäonnistui tai ohitettiin.
- Uudet tarkistukset: 18 alkuperäistä repliikkiä ja lähderivit, Markdown/CRLF/viivavariantit ja nimialias-rajapinta; mitattu ajoitus, tavoiteristiriidat ja suojatut 0,5/0,7 s tauot; katsekierros ja suorat kameraleikkaukset; puhuvan/kuuntelevan hahmon suu; lukitukset, uudelleenrakennus ja vanhojen ratojen säilyminen; v3 valmis/keskeneräinen tallennus ja hahmo/äänilinkit; Roni/Salla sivukäsien piirtojärjestys ja vakaat PSD-ID:t; keskitys liikkuvien osien rajoihin; kuvataajuuden muutokset; viimeisen kohtauksen lyhennys ja myöhemmän sisällön suojaus; tallennetut kasvot eivät korvaa repliikkiäänen suuajoitusta.
- Äänitestissä syötettiin simuloituun AudioContextiin oikeita synteettisiä PCM-näytteitä ja hiljaisuutta. Tarkistettiin rajaus, kesto, suun avautuminen/sulkeutuminen, ääneen sisältyvä tauko, 48 kHz WAV-miksaus ja vanhan äänen säilyminen. Tämä ei ole fyysisen mikrofonin testi.
- Reactin palvelinrenderöintitesti tarkistaa dialogityökalun integraation ja puuttuvien resurssien estämän luontipainikkeen. Selainikkunaa ei avattu.
- `npm run desktop:package:mac` ja `npm run build:private`: läpäisivät. Electron 44.5.1 / arm64; Mac-paketin ad hoc -allekirjoituksen tarkistus läpäisi.
- `npm run desktop:test:package`: läpäisi paketin omalla Electron/Node-runtimella. Tarkistettiin myös uusi KILSAT-Markdown, korjatut Roni/Salla-resurssit ja paikallinen Rhubarb fi/en synteettisellä hiljaisuudella.

Oikeita repliikkiääniä ei toimitettu. Valmiin puhutun jakson ajoitusta, tunnistustarkkuutta ja MP4-vientiä ei ole kokeiltu todellisella dialogilla. GUI-, Finder-, laite-, Safari- ja visuaalisia testejä ei tehty. Puhesynteesiä ei ole valittu. Viten chunk-koko ja yhteisen fflate-importin optimointihuomiot ovat jäljellä; build valmistui.
