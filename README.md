# Hahmostudio — oma animaatiostudio

Hahmostudio on suomenkielinen PSD-pohjainen animaatioeditori omaan käyttöön. PSD:t ja animaatiot käsitellään paikallisesti. Pilvitallennusta ei ole.

## Yksityinen studio

Julkinen GitHub Pages -julkaisu on poistettu käytöstä yksityistä käyttöä varten: Pages ei suorita kirjautumista tarkistavaa Node-palvelinta. Käytä tämän projektin yksityistä palvelinta.

```sh
npm ci
npm run build:private
npm run start:private
```

Avaa **http://127.0.0.1:4176/**. Ensimmäisellä käyttökerralla etusivu pyytää luomaan oman käyttäjätunnuksen ja vähintään 12 merkin salasanan. Uusia käyttäjiä ei voi luoda tämän jälkeen. Palvelin kuuntelee oletuksena vain tämän koneen loopback-osoitetta.

Salasana tallennetaan satunnaisesti suolattuna scrypt-tiivisteenä. Kirjautuminen käyttää HttpOnly/SameSite-evästettä, ja palvelin estää sekä editorin että sen tiedostojen lataamisen ilman istuntoa. Istunto kestää 12 tuntia ja päättyy palvelimen uudelleenkäynnistyksessä. Käytä **Kirjaudu ulos**, kun lopetat.

Tunnustiedot ovat `.private-storage/owner.json`-tiedostossa. Kansiota ei viedä Gitiin. Säilytä kansio turvallisesti ja varmuuskopioi se; projektin päivitys ei saa korvata sitä. Älä laita salasanaa tai käyttöönottoavainta lähdekoodiin.

## Animointi

1. Avaa oma PSD tai kokeile valmista tasotestiä.
2. Valitse vasemmalta taso. Avaa **Nivelet**, määritä rooli ja aseta kiertokeskus kuvan päälle.
3. Avaa **Animoi**. Valitse tason rata ja aikajanan ruutu.
4. Muokkaa liikettä X/Y-suunnassa, kiertoa, skaalaa tai peittävyyttä ja paina **Lisää avainruutu**.
5. Siirry seuraavaan ruutuun, muokkaa asentoa ja lisää seuraava avainruutu. **Toista** näyttää liikkeen silmukkana.
6. Valitse siirtymä: Pehmeä, Tasainen tai Pidä asento. Siirtymä koskee kyseisestä avainruudusta seuraavaan kulkevaa liikettä.
7. **Tallenna animaatio** tallentaa rigin ja avainruudut JSON-tiedostoon. Jatka avaamalla sama PSD ja **Avaa animaatio**. PSD-kuvia ei sisällytetä JSONiin.
8. **Vie PNG-kuvasarja** lataa ZIP-tiedoston, jossa on läpinäkyvät ruutukuvat ja FPS-tiedot. Voit käyttää ruutuja videon koostamiseen toisessa ohjelmassa.

**Kumoa** ja **Tee uudelleen** toimivat avainruutujen ja aikajanan asetusten muutoksiin (40 muutosta). Asennon kenttien muokkaus on esikatselu, kunnes painat avainruudun tallennusta. Pelkkä aikajanalla siirtyminen ei tallenna uutta asentoa.

Nivelet-vaiheen Liitä osaan yhdistää tasot liikehierarkiaksi. Lapsi seuraa kohteen liikettä, kiertoa, kokoa ja peittävyyttä ja voi lisäksi käyttää omia avainruutujaan. Kiertokeskus vaikuttaa kiertoon. Kameraseuranta, kaksiosainen niveltaivutus ja paikallinen puheen suuasentotunnistus ovat nyt mukana. Sisäkkäiset animaatioklipit ja jatkuva kuvapinnan venytys puuttuvat edelleen; koko Adobe Character Animatorin toiminnallisuus ei ole toteutettu.

## Rajat

- RGB/harmaasävy, 8-bittinen PSD; ei PSB:tä.
- PSD enintään 100 MiB, kuva 16 MP, 1000 tasoa.
- Animaatio: 1–60 FPS, 2–1800 ruutua.
- PNG-vienti: enintään 300 ruutua, Animoi-näkymässä näyttämön koko (muuten pisin sivu 1080 px), tiedostojen yhteiskoko 128 MiB.
- Monimutkaiset Photoshop-tehosteet voivat poiketa alkuperäisestä kuvasta. Tasojen näkyvyysmuutokset eivät sisälly animaatio-JSONiin.

## Suojattu käyttö internetissä

Etäkäyttö vaatii Node-palvelinta tukevan hostauksen ja HTTPS:n. GitHub Pages ei riitä. Palvelin on valmisteltu tähän, mutta hostaus on määritettävä erikseen:

- `HAHMOSTUDIO_HOST=0.0.0.0`
- `HAHMOSTUDIO_ORIGIN=https://oma-studio.example`
- `HAHMOSTUDIO_SETUP_TOKEN`: pitkä satunnainen kertakäyttöinen käyttöönottoavain; syötä se ensimmäisen tunnuksen luonnissa.
- `HAHMOSTUDIO_DATA_DIR`: pysyvä yksityinen tallennuskansio.
- `PORT`: palvelimen portti (oletus 4176).

Käytä HTTPS-välityspalvelinta ja estä suora julkinen pääsy Node-porttiin. Älä julkaise `dist`-kansiota suojaamattomalla staattisella palvelimella. Palvelin ei lähetä salasanaa tai tunnustietoja selaimeen.

## Kehityksen tarkistukset

```sh
npm test
npm run typecheck
npm run build:private
```

Node.js 22.13+ vaaditaan. Tuotannossa käytä Node.js 24:ää. PSD:n purku, malli, rigi, animaation interpolointi, renderöinti ja yksityinen palvelin ovat erillisiä moduuleja.

Lähdekoodi on julkisessa GitHub-repositoriossa. Kirjautuminen suojaa omaa palvelinta; muut voivat edelleen kopioida julkisen lähdekoodin.

## Käyttöohje studiossa
Yläpalkin Käyttöohje avaa kymmenen ohjesivua: aloitus, nimeäminen, nivelmääritys, animointi, tallennus ja varoitukset. Työvaiheet ovat 1. Tasot, 2. Nivelet ja 3. Animoi. Nimillä ei käynnistetä automaattisia toimintoja. Vanhojen rigitiedostojen JSON-muoto säilyy yhteensopivana.

## Kokonainen projekti, ääni ja video
Tallenna projekti kirjoittaa .hahmo-tiedoston, joka sisältää tasokuvat, näkyvyydet, nivelmääritykset, avainruudut ja valinnaisen äänen. Avaa projekti ei tarvitse erillistä PSD:tä. Alkuperäinen Photoshop-tiedosto kannattaa säilyttää, koska projektissa on normalisoidut rasterikuvat eikä Photoshopin muokattavia maskeja. Projektin kokoraja on 128 Mt. Lisää ääni hyväksyy MP3/WAV/OGG/M4A-tiedoston enintään 25 Mt. Luo suun liike vaihtaa kahta suutasoa äänen voimakkuudesta (ei foneemien tunnistusta) ja korvaa niiden avainruudut; Kumoa palauttaa aiemmat. Vie MP4-video tuottaa näyttämön kokoisen, enintään 60 sekunnin H.264/AAC-tallennuksen. Katso alta uudet liikkeen tallennustoiminnot.


## Kameraseuranta, niveltaivutus ja puheen suuasennot

- **Kameraseuranta**: valitse pää ja halutessasi silmät/suu, avaa kamera, kalibroi ja tallenna liike avainruuduiksi. MediaPipe Face Landmarker toimii paikallisessa taustatyössä, noin 10 näytettä sekunnissa. Kamerakuvia ei tallenneta tai lähetetä. Kasvomalli ja WASM-koodi ladataan vain build-vaiheessa, minkä jälkeen ne tarjoillaan kirjautumisen takaa omalta palvelimelta.
- **Niveltaivutus**: yläosan kiertokeskus olkapäähän/lonkkaan, alaosan kiertokeskus kyynärpäähän/polveen, alaosan ensimmäinen nivel ranteeseen/nilkkaan. Liitä alaosa yläosaan, valitse yläosa, paina Taivuta raajaa ja napsauta tavoite. Molemmat kierrot tallentuvat avainruuduiksi.
- **Äänteisiin perustuva suun liike**: valitse suomi tai englanti ja kuusi eri suukuvaa A–F. G, H ja X ovat vapaaehtoisia. Rhubarb tuottaa ajoitetut suuasennot paikallisesti. Suomen kielestä riippumaton foneettinen malli voi vaatia enemmän käsinkorjausta kuin englannin puhemalli. Tuloksena ei ole tekstiä tai täydellistä äännetranskriptiota. Enimmäiskesto 60 sekuntia.

### Paikallisen puhemallin asennus

Valmis yksityinen macOS/Apple Silicon -paketti sisältää ARM64-tunnistimen ja sen malliaineiston `.private-runtime/rhubarb/`-kansiossa. Pelkässä GitHub-lähdekoodissa ne eivät ole mukana. Asenna [Rhubarb Lip Sync 1.14.0](https://github.com/DanielSWolf/rhubarb-lip-sync/releases/tag/v1.14.0) käyttöjärjestelmäsi mukaan. Kopioi suoritettava `rhubarb` ja sen `res`-kansio `.private-runtime/rhubarb/`-kansioon. macOS:n virallinen julkaisu on Intel-versio; Apple Silicon tarvitsee ARM64-lähdekoodikäännöksen. `scripts/build-rhubarb-macos.sh` tekee tämän, kun CMake ja Xcode Command Line Tools ovat asennettuina.

Kaikki uudet toiminnot on kuvattu myös studion Käyttöohjeessa. Vanhojen projektien ja JSON-tiedostojen muoto säilyy yhteensopivana.

## Lyhytvideot ja viiden jakson YouTube-kooste

Valitse oikealta **Näyttämö ja videon koko → Pystyvideo**, avaa **Animoi** ja sommittele hahmo 1080 × 1920 -näyttämölle. Säädä sijaintia, kokoa ja taustaväriä. Näyttämön asetukset tallentuvat .hahmo-projektiin. PSD:n osien alkuperäiset koordinaatit säilyvät nivelten muokkauksessa.

**Vie MP4-video** tuottaa H.264-videon ja tarvittaessa AAC-ääniraidan, 30 kuvaa/s. Yksi jakso voi kestää enintään 60 sekuntia. Vienti edellyttää selaimen WebCodecs-tukea (ajantasainen Chrome/Edge); kameraa tai mikrofonia ei avata vientiä varten. Sommittelun apuviivat eivät näy videossa. Julkaise valmis MP4 itse Instagramiin, TikTokiin tai YouTubeen.

Avaa vasemmalta **Jaksot / sarja**. **Lisää nykyinen jakso** säilyttää senhetkisen projektiversion listassa. **Tuo jaksot** avaa aiemmat .hahmo-projektit. Järjestä jaksot nuolilla. Kun viisi jaksoa on valmiina, **Vie 5 jaksoa YouTubeen · MP4** tekee yhden 1920 × 1080 -videon äänten kanssa. Pystykuva säilyy kokonaan ja sivut täytetään jakson taustavärillä. Koosteen enimmäiskesto on viisi minuuttia.

**Tallenna sarja** tallentaa listan .sarja-tiedostoon. Sen voi avata myöhemmin Tuo jaksot -painikkeella. Selain ei tallenna listaa automaattisesti. Korjattu jakso lisätään listaan uudelleen vanhan tilalle. Sarjan projektit saavat olla yhteensä enintään 128 Mt ja tasokuvat 48 megapikseliä; videon enimmäiskoko on 128 Mt.

Paneelit: hahmon osat ja jaksot vasemmalla, näyttämö keskellä, kameraseuranta ja ominaisuudet oikealla, aikajana alhaalla. Käyttöohjeen viimeinen luku opastaa koko työnkulun. MP4-vienti korvaa aiemman WebM-viennin. PNG-kuvasarja käyttää Animoi-näkymässä näyttämön kokoa ja taustaväriä, muissa näkymissä alkuperäisen PSD:n rajauksen.
