# KILSAT Studio 2

Suomenkielinen animaatiostudio Macille ja selaimeen: kirjoitat käsikirjoituksen, valitset hahmot ja saat muokattavan animaation, jonka viet MP4-videoksi. Kaikki käsittely tapahtuu omalla koneella, eikä mitään ladata pilveen.

## Pika-aloitus

```bash
npm ci
npm run desktop:dev      # Mac-työpöytäsovellus kehitystilassa
npm run dev              # selainversio (Vite)
```

Asennettu Mac-sovellus päivittyy vasta uudella paketilla: `npm run desktop:package:mac`, sulje vanha sovellus ja korvaa se `release/`-kansion uudella.

## Käyttöliittymä (2.0)

Tumma studiotyökalu, jossa sama kehys säilyy kaikissa vaiheissa: yläpalkki, vasen paneeli, näyttämö, oikea paneeli ja tilarivi.

- **Työvaiheet 1–5** yläpalkissa (pikanäppäin ⌥1–⌥5): **Käsikirjoitus**, **Hahmot**, **Storyboard**, **Kuva**, **Aikajana**.
- **Projektivalikko** projektin nimestä: avaa, tallenna, tallenna nimellä, versiot, tuo kuva/PSD, lisää ääni, erilliset JSON-tiedostot, asetukset, käyttöohje ja tuotantokierros.
- **⌘K** hakee minkä tahansa toiminnon nimellä.
- **Hahmot**: Rakenna (tasot, piirto, nivelet, alkuperäinen PSD) tai Esitys (kamera, mikrofoni, näppäimet, oton tallennus).
- **Storyboard**: kuvakortit, hyväksyntä ja lukitus, kommentit, työjono, tarkistuslista, hakunäkymät ja CSV.
- **Kuva**: kuvanauha, sijoittelu, liiketyökalut, ääni ja näyttämö.
- **Aikajana**: raidat, toisto, vienti ja sarja. Paneelien ja aikajanan kokoa muutetaan reunoista vetämällä.
- **Asetukset**: ulkoasu (tumma, vaalea tai järjestelmä), saavutettavuus, työvaiheen rajaus ja pikanäppäimet.

Rakenne ja toimintojen paikat: [docs/KILSAT-APP-SHELL.md](docs/KILSAT-APP-SHELL.md).

## Käsikirjoitus

Kirjoita vapaasti suomeksi tai englanniksi tavallisessa käsikirjoitusmuodossa tai tiukassa `#!kilsat`-muodossa. Sääntöpohjainen tunnistin luokittelee jokaisen rivin ja näyttää tulkinnan rivin vieressä (esim. "kävely ← 2 s"). Rivi, jota se ei ymmärrä, merkitään varoituksella, eikä sille arvata tulkintaa.

```text
INT. KEITTIÖ - AAMU

MIRA:
(hiljaa)
“Siirsitkö auton eilen?”

Niko kävelee sisään vasemmalta kaksi sekuntia.
Hän pysähtyy ja katsoo Miraa.
LÄHIKUVA MIRA
Mira nostaa kulmiaan ja hymyilee.
Niko näyttää surulliselta.
Mira katsoo kameraan.
Pieni tauko.
```

- **Rakenne**: kohtausotsikot (INT./EXT., SISÄ./ULKO., Kohtaus:, 0:00–0:04), siirtymät (CUT TO, FADE, HÄIVYTYS), puhujat (myös V.O., O.S., ruudun ulkopuolelta), sulkeohjeet ja repliikit.
- **Liikkeet**: kävely, juoksu, hyppy, kyykky, istuminen, vilkutus, nyökkäys, osoitus, nyrkki ja pysähdys. Suomen taivutusmuodot tunnistetaan (käveli, kävelevät, astelee), samoin suunta ja lähtöpaikka ("vasemmalta" tarkoittaa liikettä oikealle).
- **Ilmeet**: vihainen, huolestunut, hämmentynyt, loukkaantunut, pokerinaama, kulmat ylös, **iloinen** (hymy-suu), **surullinen** (surusuu) ja **peloissaan** (silmät laajenevat ja suu pyöristyy). Ilme pysyy seuraavaan ilmeeseen asti, ja repliikki ohittaa suun puheen ajaksi.
- **Katse**: hahmoon sijamuodossa (Killeä, Miraan), puhelimeen tai **kameraan**. 3D-esityksessä katse kameraan osuu katsojaan mistä kamerakulmasta tahansa.
- **Puhelin, tauot ja rajoitukset**: pitää, näyttää, korvalle, pöydälle; pieni tauko, beat; Ei isoja eleitä, Älä liikuta kameraa.
- **Kestot**: "2 s", "0,5 sekuntia", "puoli sekuntia", "two seconds", "beat".

Säännöt ja rajat: [docs/KASIKIRJOITUS-TUNNISTIN.md](docs/KASIKIRJOITUS-TUNNISTIN.md).

## Hahmot

Kirjastossa ovat neljä paksureunaista leikkaushahmoa (Pipsa, Ville, Taru ja Ukko; 2D- ja 3D-versiot) sekä muokattava Hahmopohja. Vanhemmat hahmot (Roni, Salla, Aino, Otto, Leo, Mr.Kille, Mr.Handu, Kille-Oma, Handu-Oma) poistettiin 2026-10-08; ne löytyvät gitin historiasta. Hahmot:

| Hahmo | 2D | 3D (kolme kuvakulmaa) |
|-------|----|------------------------|
| Pipsa: sadetakki, silmälasit, kumisaappaat | `Pipsa.psd` / `.hahmo` | `Pipsa-3D.psd` / `.hahmo` |
| Ville: kiharat, pisamat, neule ja shortsit | `Ville.psd` / `.hahmo` | `Ville-3D.psd` / `.hahmo` |
| Taru: nutturat, kuulokkeet, huppari | `Taru.psd` / `.hahmo` | `Taru-3D.psd` / `.hahmo` |
| Ukko: viikset, villatakki, tossut | `Ukko.psd` / `.hahmo` | `Ukko-3D.psd` / `.hahmo` |

Uusissa hahmoissa ovat nivelet, silmät, räpäytys ja suuasennot (lepo, auki, pyöreä, hymy, suru). "3D" tarkoittaa erikseen piirrettyjä kuvakulmia, joita Cutout3D-kamera kääntää, ei volumetristä mallia. Grafiikka on omaa (CC0), ja sen voi generoida uudelleen komennolla `npm run assets:cutout-kids`.

## Kehitys

```bash
npm run typecheck
npm test                  # yli 1000 kooditestiä
npm run build             # selainversio
npm run desktop:build     # Electron-renderöijä
npm run assets:cutout-kids
```

Kehityshistoria: [KEHITYSMUISTIO.md](KEHITYSMUISTIO.md) ja `DEVELOPMENT-*.md`. Projektin ohjeet agenteille: [AGENTS.md](AGENTS.md).

---

## Aiemmat versiot

Vaihe 0.27: vahvistettu palautusjournal, editorin muokkaustransaktiot ja PSD/rig-hahmopaketin vaihto avainruudut säilyttäen. Tarkat rajat: DEVELOPMENT-0.27.md.

Vaihe 0.26: tuotantokomentoraja, tallentuva komentohistoria, resurssit ja SHA-256-äänipalautus sekä hyväksynnän resurssitarkistus. Vaiheiden 6–10 rajaus ja puutteet: DEVELOPMENT-0.26.md.

Vaihe 0.25: tuotantopolun integraatiotarkistus, tarkistusilmoitusten haku ja selaus sekä käänteinen työjonolajittelu. Katso DEVELOPMENT-0.25.md.

Vaihe 0.24: työjonon lajittelu ja lajittelun tallennus hakunäkymiin. Katso DEVELOPMENT-0.24.md.

Vaihe 0.23: nimetyt paikalliset työjonon hakunäkymät. Katso DEVELOPMENT-0.23.md.

Vaihe 0.22: kuvakohtainen tarkistuslista ja Mac-viennin todellinen tilannekuvaesitarkistus. Katso DEVELOPMENT-0.22.md.

Vaihe 0.21: tuotannon tarkistuspaneeli, tapahtuman/kuvan/toistokohdan navigointi ja korjausehdotukset. Katso DEVELOPMENT-0.21.md.

Vaihe 0.20: työjonon usean kuvan yhteismuokkaus haun/suodatuksen pohjalta, yksi kumottava transaktio. Katso DEVELOPMENT-0.20.md.

# KILSAT Studio

Mac-työpöytäsovelluksen näkyvä nimi on KILSAT Studio. Aiempi Hahmostudio-projektirakenne ja tiedostomuodot säilyvät. [Työtilauudistus 0.11](DEVELOPMENT-0.11.md).

**Uutta 0.19:** koko valmistelun tai suodatetun työjonon CSV-vienti. [Käyttö ja rajat](DEVELOPMENT-0.19.md).

**Uutta 0.18:** kuvien vastuuhenkilöt, määräajat sekä myöhässä/ilman vastuuhenkilöä -työjonosuodatus. [Käyttö ja rajat](DEVELOPMENT-0.18.md).

**Uutta 0.17:** tuotantotilanteen koonti, kuvien tilasuodatus ja siirtyminen seuraavaan keskeneräiseen kuvaan. [Käyttö ja rajat](DEVELOPMENT-0.17.md).

**Uutta 0.16:** projektiin tallentuvat kuvakohtaiset tarkistuskommentit, toistokohtaan navigointi ja käsittelytilat. [Käyttö ja rajat](DEVELOPMENT-0.16.md).

**Uutta 0.15:** kuvakohtainen muutoksen vaikutustarkistus. Muita kuvia voi muokata aiemman kuvan pysyessä lukittuna; muuttumattomien kuvien hyväksyntä säilyy. [Toiminta ja rajat](DEVELOPMENT-0.15.md).

**Uutta 0.14:** nimetyt projektiversiot, kuvien hyväksyntä/lukitus, ohjausmuokkausten komentoraja ja keskeytyksestä palautuva Mac-vientijono. [Käyttö ja rajat](DEVELOPMENT-0.14.md).

**Uutta 0.13:** pysyvä jakso/kohtaus/kuva-adapteri, äänenvaihdon transaktio, tarkistetut palautuspisteet, vientimanifesti ja kuvataulu. [Käyttö, toteutus ja rajat](DEVELOPMENT-0.13.md).

**Uutta 0.12:** Mr.Kille ja Mr.Handu, kolme kartonkitaustaa, yhdeksän suuasennon tuki ja sääntöpohjainen SVG/JSON-animaatio. [Toteutus, käyttö ja rajat](DEVELOPMENT-0.12.md).

# Hahmostudio — oma animaatiostudio

Hahmostudio on suomenkielinen PSD-pohjainen animaatioeditori omaan käyttöön. PSD:t ja animaatiot käsitellään paikallisesti. Pilvitallennusta ei ole.

**Moottorien ja aiempien ominaisuuksien kokonaiskuvaus:** [UI/UX, toiminnallisuudet, animaatiologiikka ja tekniset rajat](SOVELLUSKUVAUS.md).

## Uutta 0.8.0

Kamera ohjaa valmiin hahmon silmäluomia, katsetta, kulmakarvoja ja jatkuvaa suuasentoa. Valitse suun lähteeksi automaattinen, kamera tai mikrofoni. Voit tallentaa oman äänen ja esityksen tai äänittää repliikit suoraan käsikirjoituksen työpisteessä. Kirjastoon on lisätty Roni-Studio, Salla-Studio ja neljä tarkempaa taustaa. Näyttämön valinnainen 3D-paperimalli säilyttää PSD-osat ja nykyiset liikkeet, ja toimii samoin esikatselussa ja viennissä. Se ei sisällä tilavuudellista ihmisverkkoa tai 3D-luurankoa. Tarkemmat ohjeet: [Jakson valmistus](docs/EPISODE.md).

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
2. Valitse vasemmalta taso. Avaa **Hahmo → Nivelmääritys**, määritä rooli ja aseta kiertokeskus kuvan päälle.
3. Avaa **Animointi**. Valitse tason rata ja aikajanan ruutu.
4. Muokkaa liikettä X/Y-suunnassa, kiertoa, skaalaa tai peittävyyttä ja paina **Lisää avainruutu**.
5. Siirry seuraavaan ruutuun, muokkaa asentoa ja lisää seuraava avainruutu. **Toista** näyttää liikkeen silmukkana.
6. Valitse siirtymä: Pehmeä, Tasainen tai Pidä asento. Siirtymä koskee kyseisestä avainruudusta seuraavaan kulkevaa liikettä.
7. **Tallenna animaatio** tallentaa rigin ja avainruudut JSON-tiedostoon. Jatka avaamalla sama PSD ja **Avaa animaatio**. PSD-kuvia ei sisällytetä JSONiin.
8. **Vie PNG-kuvasarja** lataa ZIP-tiedoston, jossa on läpinäkyvät ruutukuvat ja FPS-tiedot. Voit käyttää ruutuja videon koostamiseen toisessa ohjelmassa.

**Kumoa** ja **Tee uudelleen** toimivat avainruutujen ja aikajanan asetusten muutoksiin (40 muutosta). Asennon kenttien muokkaus on esikatselu, kunnes painat avainruudun tallennusta. Pelkkä aikajanalla siirtyminen ei tallenna uutta asentoa.

Nivelmääritys-osion Liitä osaan yhdistää tasot liikehierarkiaksi. Lapsi seuraa kohteen liikettä, kiertoa, kokoa ja peittävyyttä ja voi lisäksi käyttää omia avainruutujaan. Kiertokeskus vaikuttaa kiertoon. Kameraseuranta, kaksiosainen niveltaivutus ja paikallinen puheen suuasentotunnistus ovat nyt mukana. Sisäkkäiset animaatioklipit ja jatkuva kuvapinnan venytys puuttuvat edelleen; koko Adobe Character Animatorin toiminnallisuus ei ole toteutettu.

## Rajat

- RGB/harmaasävy, 8-bittinen PSD; ei PSB:tä.
- PSD enintään 100 MiB, kuva 16 MP, 1000 tasoa.
- Animaatio: 1–60 FPS, 2–1800 ruutua.
- PNG-vienti: enintään 300 ruutua, Animointi-työtilassa näyttämön koko (muuten pisin sivu 1080 px), tiedostojen yhteiskoko 128 MiB.
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
Yläpalkin Käyttöohje avaa kaksitoista ohjesivua: aloitus, nimeäminen, nivelmääritys, animointi, tallennus ja varoitukset. Työtilat ovat Hahmo, Esitys ja Animointi. Tasot ja Nivelmääritys löytyvät Hahmo-työtilasta. Nimillä ei käynnistetä automaattisia toimintoja. Vanhojen rigitiedostojen JSON-muoto säilyy yhteensopivana.

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

Valitse oikealta **Näyttämö ja videon koko → Pystyvideo**, avaa **Animointi** ja sommittele hahmo 1080 × 1920 -näyttämölle. Säädä sijaintia, kokoa ja taustaväriä. Näyttämön asetukset tallentuvat .hahmo-projektiin. PSD:n osien alkuperäiset koordinaatit säilyvät nivelten muokkauksessa.

**Vie MP4-video** tuottaa H.264-videon ja tarvittaessa AAC-ääniraidan, 30 kuvaa/s. Yksi jakso voi kestää enintään 60 sekuntia. Vienti edellyttää selaimen WebCodecs-tukea sekä H.264/AAC-koodereita; kameraa tai mikrofonia ei avata vientiä varten. Sommittelun apuviivat eivät näy videossa. Julkaise valmis MP4 itse Instagramiin, TikTokiin tai YouTubeen.

Avaa vasemmalta **Jaksot / sarja**. **Lisää nykyinen jakso** säilyttää senhetkisen projektiversion listassa. **Tuo jaksot** avaa aiemmat .hahmo-projektit. Järjestä jaksot nuolilla. Kun viisi jaksoa on valmiina, **Vie 5 jaksoa YouTubeen · MP4** tekee yhden 1920 × 1080 -videon äänten kanssa. Pystykuva säilyy kokonaan ja sivut täytetään jakson taustavärillä. Koosteen enimmäiskesto on viisi minuuttia.

**Tallenna sarja** tallentaa listan .sarja-tiedostoon. Sen voi avata myöhemmin Tuo jaksot -painikkeella. Selain ei tallenna listaa automaattisesti. Korjattu jakso lisätään listaan uudelleen vanhan tilalle. Sarjan projektit saavat olla yhteensä enintään 128 Mt ja tasokuvat 48 megapikseliä; videon enimmäiskoko on 128 Mt.

Paneelit: hahmon osat ja jaksot vasemmalla, näyttämö keskellä, kameraseuranta ja ominaisuudet oikealla, aikajana alhaalla. Käyttöohjeen viimeinen luku opastaa koko työnkulun. MP4-vienti korvaa aiemman WebM-viennin. PNG-kuvasarja käyttää Animointi-työtilassa näyttämön kokoa ja taustaväriä, muissa näkymissä alkuperäisen PSD:n rajauksen.

## Kävelyanimaatio ja tasohaku
Oikean paneelin **Kävelyanimaatio** luo jalkojen ja valinnaisten käsien vastakkaiset heilahdukset avainruuduiksi. Säädä askelkierron kestoa, kiertokulmia, vartalon pomppua ja etenemistä. Valitse raajojen yläosat ja aseta kiertokeskukset lonkkiin/olkapäihin. Vartalon liike edellyttää raajojen liittämistä vartaloon. Toiminto korvaa valittujen osien radat luontivälillä; muiden osien radat säilyvät ja Kumoa palauttaa muutoksen. Maahan lukitusta tai automaattista polvitaivutusta ei tehdä. Käyttöohjeen luku 11 opastaa vaiheet.

**Hae hahmon osaa** suodattaa tasoluettelon nimen tai ryhmäpolun mukaan. Hakua vastaavat ryhmät avautuvat myös silloin, kun ne on aiemmin suljettu. Haku ei muuta näkyvyyttä tai tallennettua PSD-hierarkiaa.


## Selkeämmät työkalunäkymät (3.10.2026)
Työtilat **Hahmo / Esitys / Animointi** ovat ylhäällä. Oikean paneelin **Valinta** näyttää tason ja nivelten tiedot, **Näyttämö** sommittelun, **Liikkeet** avainruudut, äänen, kävelyn, niveltaivutuksen ja videoviennin sekä **Ohjaus** kameran ja valmiin hahmon esityksen. Aikajana voidaan avata tai sulkea erikseen. Näkymän vaihto ei nollaa projektia, suukuvia, kävelyn tai kameran osavalintoja.

**Sulje kamera** näkyy ylhäällä aina, kun kamera on käynnistymässä tai käytössä. Se lopettaa mediaresurssit ja mahdollisen kameraliikkeen tallennuksen; jo tallennetut avainruudut säilyvät. Kamerapaneelin piilottaminen ei sammuta kameraa. Käynnistyksen voi perua myös mallin latautuessa.

Yläpalkissa ovat animaation **Kumoa / Tee uudelleen**. Projektirivi muistuttaa .hahmo-tallennuksesta ja ilmoittaa, kun projektitiedosto on ladattu. Selain ei pysty varmistamaan tiedoston säilyttämistä levyllä; automaattitallennusta ei lisätty. Projektiformaatti ja yksityinen kirjautuminen säilyvät ennallaan. Kehityksen rajaus ja jatko ovat [KEHITYSMUISTIO.md](KEHITYSMUISTIO.md)-tiedostossa.


## Pikaanimointi · Otto (3.10.2026)

Avaa Aloituskirjasto → Valitse Pipsa. Valmis hahmo ja studiotausta avautuvat suoraan 1080 × 1920 -näyttämölle. A/D nostavat hahmon omat kädet (pidä painettuna), W tekee hypyn, 1/2/3 valitsevat ilmeet, B räpäyttää ja R aloittaa/lopettaa uuden oton. Painikkeet käyttävät samoja toimintoja.

Käynnistä mikrofoni vasta halutessasi käyttää sitä; lupa pyydetään silloin. Sulje mikrofoni pysäyttää laitteen. Suu reagoi paikalliseen äänenvoimakkuuteen, ei tunnista puheen äänteitä. Kameraa ei tarvita. Asetuksista säädät kohinarajaa, herkkyyttä, pehmennystä, liikkeitä ja näppäimiä. Määritykset tallentuvat projektiin; ristiriitaiset näppäinvalinnat on estetty. Kirjoituskentät ja ⌘/⌥/Control/Shift-yhdistelmät eivät laukaise perusliikkeitä. ⌘S lataa projektin, ⌘Z/⇧⌘Z kumoavat animaatiomuutoksia tekstikenttien ulkopuolella.

Tallenna uusi otto lisää enintään 24 sekunnin muokattavat liikkeet aikajanan nykyisen keston jälkeen. Lepoliike, silmät ja suu tallentuvat avainruuduiksi. Mikrofoni tallentuu paikalliseksi mono-WAV-raidaksi; olemassa oleva ääni yhdistetään monoksi, säilyttäen sen koko kesto, ja uusi ääni lisätään oton kohdalle. Jos yhdistäminen epäonnistuu, liike ja vanha ääni säilyvät ja näet ilmoituksen. Animaation kumoaminen koskee avainruutuja; tarvittaessa poista tai vaihda ääniraita erikseen. Animointi-työtilassa korjaat ottoa nykyisellä aikajanalla. Tallenna .hahmo jatkamista varten ja Vie MP4 julkaistavaksi.

Paketissa on yksi oikea rasteritasoinen RGB/8-bit PSD, yksi valmis 25-osainen robotti, kolme suuvarianttia ja yksi studiotausta. Ohjatut raajaliikkeet ovat vasen käsi ylös, oikea käsi ylös ja hyppy. Kolme ilmettä ja räpäytys ovat erillisiä kasvojen kanavia. Ottoa voi käyttää, muokata ja jakaa (oma Hahmostudio-grafiikka, CC0-1.0); Adobe-aineistoja ei ole mukana. PSD ja valmis .hahmo ovat eri lataukset. Pelkkä PSD-tuonti säilyttää grafiikan mutta ei asenna pikaanimoinnin sidoksia. Valmis .hahmo sisältää myös lähde-PSD:n.

Uusi .hahmo-versio 2 sisältää pikaanimoinnin asetukset ja lähde-PSD:n. Vanha versio 1 avautuu edelleen; vanhat projektit tallentuvat versiona 1, ellei niihin ole näitä uusia tietoja. Studiotausta on erillinen, version mukaan toistettava näyttämöpresetti (studio-v1), ja ladattava PNG löytyy kirjastosta. Aiemmat niveliin, kameraan, Rhubarbiin, jaksoihin ja vientiin liittyvät työkalut säilyvät.

Grafiikan uudelleenluonti kehittäjälle: `python3 scripts/create-otto.py` (Pillow), sitten `node scripts/create-otto.mjs` (lukitussa projektissa jo olevat ag-psd/fflate). Välitiedostot syntyvät `.asset-build`-kansioon; niitä ei tarvita sovelluksen käyttöön.

Kesken: kaksi muuta hahmoa, tyhjä PSD-pohja, toinen suutyylipaketti, neljä muuta taustaa, vilkutus/kävely/kyykky/osoitus/nyökkäys pikatoimintoina, omien PSD/PNG-kuvien sovitus ja tarkempi pikatyötilan visemekartta. Uudessa toiminnossa ei käytetä ulkoisia malleja tai pilvipalvelua.

## Kolme työtilaa ja laitteiden kooditestit · 3.10.2026

Yläpalkin **Hahmo**, **Esitys** ja **Animointi** järjestävät nykyiset työkalut. Hahmo sisältää Tasot, Nivelmäärityksen ja alkuperäisen PSD-esikatselun. Esitys kokoaa ohjauslähteet ja uuden oton. Animointi näyttää aikajanan ja liikkeen korjaustyökalut. Aikajanan voi avata/sulkea ilman tietojen menetystä. Valmiiksi määritetty Otto avautuu Esitys-työtilaan. Ulkoasu voi olla järjestelmän mukainen, vaalea tai tumma; valinta säilyy tällä selaimella.

- **Tallenna projekti** lataa .hahmo-tiedoston. Tilatieto perustuu tallennettuun projektiversioon; selaimen latauksen valmistumista tai levylle kirjoittamista ei voida todentaa sovelluksesta.
- **Tallenna uusi otto** lisää yhteisen esityksen nykyisen aikajanan jälkeen.
- **Vie MP4** tuottaa valmiin videon.

Oton kamera ja mikrofoni pysyvät käynnissä työtilaa vaihdettaessa ja projektia tallennettaessa. Laitteet suljetaan erillisillä painikkeilla; ne näkyvät tilapalkissa myös muissa työtiloissa. Näppäinohjauksella on oma valintansa. Tekstikenttä, ikkunan fokuksen menetys tai ohjausten tilapäinen lukitus vapauttaa painetut kädet. Aikajanan toisto näyttää tallennetun liikkeen ilman kameran/mikrofonin sulkemista. Projektin korvaaminen tai sivun sulkeminen vapauttaa aiemmat laitteet. Piilotettu selainvälilehti sulkee mikrofonin ja viimeistelee mahdollisen oton.

Ohjausten prioriteetti: aikajana säilyttää lähtöasennon muissa osissa; näppäimet ohjaavat käsien/vartalon kanavia ja valittuja ilmeitä; kamera ohittaa pään sijainnin/kierron/koon ja sille valittujen pupillitasojen näkyvyyden; mikrofoni ohjaa kolmen suukuvan näkyvyyttä ja ohittaa kameran suun koon. Kun kamera ei löydä kasvoja tai suljetaan, sen ohitus poistuu. Yhteinen otto tallentaa yhdistetyt asennot. Kameran oma erillistallennus säilyy tavallisille PSD-hahmoille.

`npm test` sisältää alkuperäiset mallien, tallennusmuotojen ja yksityisen palvelimen testit sekä simuloidut mikrofonin elinkaaritestit, AudioWorklet-prosessorin testin, ohjauslähteiden yhdistämisen ja React-komponenttien palvelinrenderöinnin testit. Testit eivät avaa selainta, kameraa tai mikrofonia. `npm run build:private` tarkistaa myös TypeScript-tyypit ja kääntää JavaScriptin kohteisiin ES2022 / Safari 16.4. Tämä käännöskohde ei takaa kaikkien laite- tai kooderirajapintojen saatavuutta: ne tarkistetaan käytön yhteydessä. AudioContextin tavallinen ja webkit-nimi käsitellään, puuttuva AudioWorklet antaa ymmärrettävän virheen ja luvan odotuksen peruminen sulkee myös jälkikäteen myönnetyn ääniraidan.

Fyysisen mikrofonin ääntä, oikean Safarin laitelupia ja näyttöasettelua ei ole tässä päivityksessä testattu. Niitä ei voi varmistaa simuloiduilla kooditesteillä. PNG-osien erottelu, piirtäminen, osien uudelleennimeäminen sovelluksessa, sisäkkäiset klipit sekä Oton vilkutus/kyykky/Q–E-kävely puuttuvat edelleen. Kävelyn avainruutugeneraattori on erillinen olemassa oleva työkalu. Laajempi hahmo- ja liikekirjasto on seuraava vaihe.

## Mac-työpöytäversio · 0.2.0

Electron käyttää samaa editoria, animaatiologiikkaa ja .hahmo/.sarja-tiedostoja. Native-tiedostoikkunat, Tallenna/Tallenna nimellä, viimeksi avatut projektit ja Mac-valikot on lisätty. Valmis .app sisältää runtimen ja offline-aineistot eikä tarvitse terminaalia. Työpöytäversio käyttää Macin käyttäjätiliä; verkkoversion tunnusta ei muuteta. PNG avautuu yhtenä tasona.

```sh
npm ci
npm test
npm run desktop:dev
npm run desktop:build
npm run desktop:package:mac
```

Paketti: `release/Hahmostudio-darwin-arm64/Hahmostudio.app` ja `release/Hahmostudio-Mac-arm64.zip` tällä Apple Silicon -Macilla. Ohjeet: [Mac-asennus ja jatkokehitys](docs/MAC_DESKTOP.md), [arkkitehtuuri](docs/ARCHITECTURE.md), [todellinen tila ja seuraavat vaiheet](docs/ROADMAP.md). Lähdekoodimuutos tarvitsee uuden paketoinnin ennen kuin asennettu sovellus päivittyy. Fyysinen laite- ja Safari-varmennus eivät seuraa kooditestien läpäisystä.

### Käynnistyskorjaus 0.2.1

Korjattu Electronin valmiustapahtumaa odottanut päämoduulin lukkiutuminen. 70 kooditestiä läpäisee, mukaan lukien oikean päämoduulin käynnistysjärjestyksen testi. Käynnistyksen vaihe löytyy käyttäjäkohtaisen asetuskansion `startup-status.json`-tiedostosta. Vanha jumiutunut sovellus pitää lopettaa ennen uuden version avaamista.


## Versio 0.3.0 · helpompi aloitus ja käsikirjoitus

Avaa **Hahmot ja taustat**, valitse Pipsa, Ville, Taru, Ukko tai muokattava Hahmopohja, valitse kuvausympäristö ja paina **Kirjoita käsikirjoitus**. Yksi tapahtuma per rivi, esimerkiksi `Hei! [vilkuta 2s]`, `[kävele oikealle 3s]` ja `[tausta auto kuljettaja]`. **Lisää animaatio aikajanan loppuun** säilyttää aiemman työn. Toista, korjaa avainruutuja, tallenna `.hahmo` ja vie 1080×1920 MP4. Viisi jaksoa voi koota nykyisellä sarjatyökalulla YouTube-laajakuvaksi.

Käsikirjoitus toimii paikallisilla fi/en-liikeohjeilla, ei pilven kielimallilla. Teksti ei vielä tuota puheääntä tai tekstityksiä. Kävely taivuttaa erillisiä sääriä; automaattista jalkalukitusta tai kuvan mesh-venytystä ei ole. Tuntemattomat hakasuljeohjeet ilmoitetaan, puhe ilman tunnistettua liikettä muodostaa tauon.

Kirjasto sisältää aidot tasolliset PSD:t ja valmiit `.hahmo`-paketit (Pipsa 28, Ville, Taru ja Ukko 27, Hahmopohja 25 tasoa), kaksi A–H/X-suupakettia ja kuusi taustaa SVG/PNG-muodossa. Grafiikka on Hahmostudion alkuperäistä CC0-aineistoa; ulkoisia hahmokuvia ei kopioida. Muokkaa PSD Photoshopissa tasoja yhdistämättä. Tavallinen PSD-tuonti tarvitsee erillisen nivelmäärityksen; valmis `.hahmo` sisältää sen.

**Pää irtoaa?** Pään nimi/rooli ei luo liitosta: Hahmo → Nivelmääritys → Liitä osaan → Vartalo. Aseta kiertokeskus kaulaan ja liitä silmät/suu päähän. Kameraseuranta pitää liitetyn pään paikallaan ja kallistaa sitä ±25°. Vanhoja tallennettuja siirtymiä ei poisteta.

Kirjaston lähdekuvat voi generoida `npm run assets:generate` -komennolla (Python 3 + Pillow); olemassa oleva Otto säilyy. Rakentaminen ja käyttö eivät tarvitse Pythonia. Mac-päivitys: tallenna projektisi, sulje vanha Hahmostudio kokonaan ⌘Q, pura uusi ZIP ja avaa uusi Hahmostudio.app. Lähdekoodin muutos ei päivitä käynnissä olevaa sovellusta.


## 0.4.0 · eri kuvakulmat, kävely/juoksu ja esineet

**Hahmot ja esineet** -painike avaa kirjaston myös piilotettuna. Valitse **Aino · eri kuvakulmat** tai **Otto · eri kuvakulmat** (75 tasoa/hahmo, kolme erikseen piirrettyä 2D-kulmaa: edestä/oikea profiili/vasen profiili). Vanhoja hahmopaketteja ei muuteta. Yläreunan kuvakulmavalinta tekee muokattavan vaihtokohdan nykyiseen ruutuun; Kumoa palauttaa myös ohjaussidokset. Liike → Kävely/Juoksu → Vasemmalle/Kohti katsojaa/Oikealle lisää kahden sekunnin liikkeen aiemman työn perään. Kohti katsojaa -liike käyttää perspektiivikokoa, ei 3D-mallia. Sivuaskeleen polvi taipuu IK:lla ja tukijalka pysyy paikallaan tukivaiheessa.

Käsikirjoitus ymmärtää `[kävele suoraan 2s]`, `[juokse oikealle 2s]`, `[juokse vasemmalle 2s]`, `[juokse suoraan 2s]` sekä `[hahmo edestä]`, `[hahmo vasen]`, `[hahmo oikea]` ennen tapahtumariviä. Kulma vaihtuu monikulmahahmossa automaattisesti suunnan mukaan. Luonti, puhelin ja kuvakulmat säilyvät .hahmo:ssa; aiempi animaatio säilytetään.

Kirjaston **Esineet · puhelimet** tarjoaa puhelimen edestä/takaa/sivulta. Kiinnitä valmiin hahmon käteen tai sijoita näyttämölle; koko/kierto/siirtymä ovat muokattavia. `[puhelin edestä]`, `[puhelin takaa]`, `[puhelin sivulta]`, `[puhelin pois]` vaihtavat esineen kulmaa seuraavasta tapahtumasta alkaen. Puhelinta esittävä tausta on erillinen asia: `[tausta puhelin edestä]`.

**Näkymä**-valikko näyttää/piilottaa kirjaston, ominaisuudet/ohjauksen, aikajanan ja laitteiden tilarivin. Komponentit säilyvät asennettuina: paneelin piilotus ei sulje laitteita. Palauta oletusnäkymä tuo paneelit takaisin. Näkymäasetukset tallentuvat paikalliseen käyttöliittymäasetukseen, eivät projektin animaatioon.

Päivitä Lataukset-kansion sovellus: tallenna projektit, sulje vanha ⌘Q, pura uusi 0.4.0-ZIP ja korvaa vanha Hahmostudio.app.


## Mac 0.5.0 · työtilan selkeytys ja paperileikkaushahmot

Yläreunan Tiedosto, Muokkaa, Näytä ja Ohje kokoavat toiminnot; Macin natiivi valikkorivi sisältää myös Näytä ja Ohje. Näytä → Keskity näyttämöön piilottaa sivupaneelit ja aikajanan; Sovita koko näyttämö palauttaa koko videokuvan. Kirjaston/ominaisuuksien sisäreunoja ja aikajanan yläreunaa voi vetää, tai käyttää Tab + nuolet / Home / End. Koot tallentuvat paikallisiin asetuksiin, eivät projektin piirroksiin. Pienet näytöt pinovat paneelit.

Hahmot ja esineet → Hahmot sisältää uudet Roni ja Salla · eri kuvakulmat: omat paperileikkaustyyliset hahmot, ei sarjan hahmoja tai kopioitua grafiikkaa. Molemmissa on kolme kuvakulmaa, 75 tasoa, nivelet ja .hahmo sekä lähde-PSD. Vanha kirjasto säilyy. Lataa ja muokkaa avaa hahmokortin PSD/.hahmo-lataukset.

Asennettu sovellus ei päivity automaattisesti. Tallenna projektit ja sarja, sulje ⌘Q, pura Hahmostudio-Mac-0.5.0-arm64.zip ja korvaa vanha Hahmostudio.app. Projektit ja asetukset ovat sovelluspaketin ulkopuolella.

## Uutta 0.6.0: käsikirjoituksesta dialogikohtaukseksi

Käsikirjoitus → Dialogi ja leikkaukset tuo UTF-8 Markdownin tai tekstin. KILSAT-esimerkissä KILLE on Roni ja HANDU Salla. Repliikit säilyvät alkuperäisinä; hahmot, ilmeet, katseet, puhelin, suorat kameraleikkaukset ja suojatut tauot ovat muokattavia tapahtumia. Tuo omat repliikkiäänet: todellinen äänen kesto määrää ajoituksen. Tavoiteristiriidat näytetään, ääntä ei nopeuteta. Käsikirjoitus ei tuota puheääntä.

Keskeneräisen valmistelun voi liittää projektiin ja tallentaa .hahmo-tiedostoon. Valmis kohtaus lisätään aiemman aikajanan loppuun, ja sen päivittäminen on kumottavissa myös äänen osalta. Projektimuoto v3 sisältää käsikirjoituksen, näyttämön, erilliset hahmopaketit, alkuperäiset repliikkiäänet ja suuajoitukset. Vanhat v1/v2-projektit avautuvat edelleen.

Roni ja Salla saivat korjatun sivukuvien käsien piirtojärjestyksen. Keskitä hahmo huomioi liikkuvien osien rajat. Sommittelun turvarajat näkyvät vain editorissa. Dialoginäyttämöllä kummallakin hahmolla on oma paikka ja koko.

Katso sovelluksen Käyttöohje → Dialogi ja repliikkiäänet sekä [dialogin ohje](docs/DIALOGUE.md). Mukana ei ole oikeita KILSAT-repliikkiäänityksiä eikä puhesynteesiä. Kooditestit ja Mac-paketin runtime-testi eivät varmista fyysisiä laitteita, Finder-käynnistystä tai oikeaa Safari-käyttöä.

## Uutta 0.7.0: yleinen jakson ohjaussuunnitelma

Käsikirjoitus → Dialogi ja leikkaukset käsittelee myös uusia hahmonimiä, ympäristöjä ja ajoituksia. Valitse itse nimien hahmopaketit. KILSAT on esimerkkisyöte; sen nimiin tai studioon ei sidota toteutusta. Toinen mukana tuleva esimerkki on Aamu autossa.

Ohjaussuunnitelma näyttää lähderiveineen tarkoituksen, luonteen/suhteet, miljöön, rekvisiitan, sijoittelun, dialogin, toiminnan, katseet, ilmeet, tauot, rajoitukset, kameraleikkaukset ja lopetuksen. Toteutettu, Arvio ja Puuttuu erotetaan. Arviot pitää hyväksyä, puuttuvat olennaiset toiminnot korjata. Liikeohjeet käyttävät nykyisen moottorin kävely-, juoksu-, vilkutus-, hyppy-, kyykistys- ja nyökkäystoimintoja.

Tuettuja miljöitä ovat kirjaston taustat ja neutraali valkoinen tausta. Muu ympäristö tai rekvisiitta merkitään puuttuvaksi. Käsikirjoitus tulkitaan paikallisilla säännöillä: vapaamuotoisen tarkoituksen ja hahmokuvauksen tulkinta näytetään arviona. Puhesynteesiä ei ole kytketty; käytä tuotuja repliikkiääniä. Ilman ääniä tulos on alustava esikatselu. Katso [yleisen jaksotyökalun ohje](docs/EPISODE.md).

## 0.9: piirtäminen, litterointi ja Macin vientijono

Hahmo → Piirtäminen sisältää rasterisiveltimen, pyyhkimen, pipetin, aluevalinnan/siirron, palautettavat maskit ja muokattavat vektorit. Animointi → Liikkeet sisältää aaltomuodon ja paikallisen Whisper-litteroinnin. Macin Vie-päätoiminto sisältää MP4/GIF/PNG-esiasetukset ja erillisessä prosessissa toimivan vientijonon. [Käyttö, toteutus, riippuvuudet ja todelliset rajat](DEVELOPMENT-0.9.md).

## Käsikirjoitus ja 3D-toon (0.10)

Ohjauspöytä, vakaat päivitykset, kuvakortit, reaktiolukitukset, Roni/Salla-3D, 32 taustaa ja 20 esinettä: katso [käyttö ja todelliset rajat](DEVELOPMENT-0.10.md). Koko laajennus ja lopullinen äänellinen esittelyvideo eivät vielä ole valmiit. Paikallinen semanttinen malli ja KILSAT-repliikkiäänet puuttuvat.

## KILSAT Studio 0.32 — tiukka käsikirjoitus ja toisto

Mac Apple Silicon: pura `Hahmostudio-Mac-0.32.0-arm64.zip`, sulje vanha versio,
siirrä `KILSAT Studio.app` Ohjelmat-kansioon ja avaa se Finderista.
Nodea, npm:ää tai kehitystyökaluja ei tarvita jaettuun sovellukseen.
Paketin natiivipalvelut on testattava erikseen GUI:n käynnistymisestä;
puhtaan toisen Macin käyttöä ei tällä build-ympäristöllä todisteta.

Animointi → Käsikirjoitus → Dialogi ja leikkaukset tukee vanhaa mallia sekä
`#!kilsat`-alkuista tiukkaa kielioppia. Tunnista ja tarkista käsikirjoitus,
yhdistä hahmot ja repliikkiäänet, korjaa kaikki ilmoitukset ja rakenna jakso.

```text
#!kilsat
Hahmo: Kille
Hahmo: Handu
Kohtaus: Studiossa
Tausta: studio 1 s
Kille kävelee oikealle 2 s
Samalla: Handu ilme: huolestunut 2 s
Kamera: lähikuva Kille 1 s
Kille sanoo: "Hei Handu!" 2 s
Samalla: Handu katsoo: Kille 2 s
Kohtaus: Puhelin
Kille puhelin: esille 1 s
hän katsoo: se 1 s
Leikkaus: laaja 1 s
Odota 1 s
```

Anna jokaiselle tapahtumalle 0,5–20 s kesto. Repliikkiäänen todellisen keston
pitää vastata ohjetta; puhetta ei luoda tai nopeuteta. `Samalla:` viittaa
edeltävän tapahtuman alkuun, ei kohtauksen alkuun. Hahmot ja puhelimen viite
säilyvät kohtausrajojen yli. `hän` tarkoittaa viimeistä onnistuneen tapahtuman
kohdehahmoa ja `se` viimeistä esinettä. Epäselvä viite tuottaa virheen.

Tuettuja vartaloliikkeitä ovat kävely/juoksu vasemmalle, oikealle tai suoraan,
vilkutus, nyökkäys, hyppy ja kyykistys. Tuetut kamerakoot ovat lähikuva,
puolikuva ja laaja. Tiukan tilan 2D-kamera vaihtuu 0,35 s pehmeällä siirtymällä;
`Leikkaus:` tekee suoran vaihdon. Ylhäältä, takaa, olan yli, istuminen,
uudet esineet ja vapaamuotoiset lauseet eivät muutu vääriksi arvioiksi:
niistä tulee näkyvä ilmoitus. Nykyiset vanhan mallin lisätoiminnot säilyvät.

Toistopalkki: Toista, Tauko/Jatka, Pysäytä, Uudelleen alusta ja kohtausvalinta.
Toisto etenee seuraavaan kohtaukseen automaattisesti ja pysähtyy jakson lopussa.
FPS-raportin voi tallentaa toiston jälkeen. 60 fps -tavoite on laite-/projektikohtainen.

Kehittäjä: `npm test`, `npm run typecheck`, `npm run desktop:package:mac`.
`npm run grammar:coverage -- --verify --list` laskee, listaa ja varmentaa
1 228 800 rajatun liikegrammatiikan lauseasua; lukema ei tarkoita miljoonaa
itsenäistä toimintoa tai yleistä suomen kielen ymmärtämistä.

## 0.33 – muotojen reunaviivat ja värit

Hahmo → Piirtäminen → valitse taso. Uusien muotojen reunaviiva valitsee tulevien suorakulmioiden, ellipsien ja polkujen viivan. Ominaisuudet → Muokkaa vektoria → valitse muoto → Näytä reunaviiva pois. Täyttö vaihtaa sisävärin, Viiva reunavärin ja Viivan leveys paksuuden. Kumoa palauttaa edellisen projektimuutoksen. Muotoasetukset säilyvät .hahmo-tiedostossa.

PSD/PNG:n rasteroitu viiva ei ole vektorimuoto: käytä pyyhekumia tai maskia. Uusissa Mr.Kille/Mr.Handu-pohjissa paidan ylimääräinen sisähelma/taskuruutu on poistettu; vanhat projektit säilyvät muuttumattomina.

Mac 0.33: pura Hahmostudio-Mac-0.33.0-arm64.zip, sulje vanha app ja siirrä KILSAT Studio.app Ohjelmat-kansioon. Paikallinen Kilometrikirja-esimerkkivideo sisältää käyttäjän alkuperäisiä puheääniä ja suomenkieliset tekstitykset; yksityiset äänet eivät sisälly repositorioon.

## KILSAT Studio 0.34

Käyttäjän KILSAT-logo näkyy oikeassa yläreunassa sekä Mac-kuvakkeena. Pura Hahmostudio-Mac-0.34.0-arm64.zip, sulje vanha sovellus ja korvaa KILSAT Studio.app Ohjelmat-kansiossa.

Käsikirjoitus → Dialogi ja leikkaukset → Käsikirjoituksen lähdeteksti ja tuonti → Rakenne, esimerkit ja kirjoitusohje. Valitse malli ja lisää se tyhjään kenttään tai kopioi tarvitut rivit. Muokkaa, tunnista, valitse hahmot/äänet, tarkista ja rakenna jakso. Malli ei tuota ääntä automaattisesti. Kaikki käsitellään paikallisesti.

Esitys: käynnistä kamera ja mikrofoni ja tallenna yhteinen otto. Äänen ja kameran ajoitus tarjoaa -500…500 ms kameraliikkeen korjauksen. Aloita arvolla 0 ja tee lyhyt puhekoe. Laitekohtainen viive tarvitsee oman laitteesi tarkistuksen. Työtilan vaihto säilyttää lähteet; sulje ne omista painikkeistaan.

Animointi: toista yleisestä toistonohjauksesta. Aikajanan asetukset avaa kuvataajuuden, ruutumäärän ja PNG-kuvasarjaviennin. Näytä-valikosta voit säätää paneeleja tai keskittyä näyttämöön.

Valmiit liikkeet avaa kävelyn, juoksun ja suunnan pikatyökalut. Toiston mittaus avaa fps-tiedot ja mittausraportin tallennuksen. Pikavienti löytyy nyt Vie-ikkunasta. Aikajanan avainruudut säilyvät; niiden ympäriltä poistettiin ylimääräinen painikereunus.

### Paikallinen Mac-asennus

FileProviderin tai iCloudin hallinnoima työ-/toimituskansio voi lisätä purettuun .app-bundleen Finder-metatietoja, jotka estävät allekirjoitustarkistuksen. Pura ZIP paikalliseen Ohjelmat-kansioon. Tämän toimituksen erillinen tarkistettu asennus on käyttäjän `~/Applications/KILSAT Studio 0.34.app`; vanhaa asennusta ei korvattu. Tallenna työ ja sulje vanha KILSAT Studio ennen uuden avaamista.

## KILSAT Studio 0.35

Raahaa hahmoa näyttämöllä. Shift lukitsee akselin; nuolinäppäimet siirtävät 1 px ja Shift 10 px. Näyttämön tulee olla aktiivinen. Yksi raahaus on yksi projektin kumoamiskomento. Näyttämö → Turva-alue ja reunakäytös määrittää reunat sekä pysähtymisen, kääntymisen tai kävelyn lyhennyksen. Näytä-valikosta turvakehys voidaan piilottaa.

Työpöydän minimikoko on 1200×700. Aikajanan Zoom muuttaa ajan näkymää; paneelit ja accordionit muistetaan natiivissa asetustiedostossa. Lisätyökalut tarjoaa aiemmat lisätiedosto- ja revisiotoiminnot. Tavallinen näyttämö tukee raahausta kaikilla editorin zoomeilla; tuotantokohtauksissa raahaus on 2D-laajakuvassa, koska seuraavia lähikuvakameroita ei muuteta. Katso DEVELOPMENT-0.35.md:n varmennusrajat.

### Käsikirjoitussivu (0.36)

Paina yläpalkin **Käsikirjoitus**. Kirjoita tai tuo teksti, paina **Tunnista ja tarkista käsikirjoitus**, valitse jokaiselle puhujalle hahmopohja ja lisää repliikkiäänet. Korjaa tarkistuksessa näkyvät puutteet, sitten **Rakenna muokattava jakso projektiin**. **Takaisin editoriin** säilyttää valmistelun. **Kokeile esimerkkianimaatiota** käynnistää uuden Kille–Handu-liike-esimerkin; siinä ei ole puhetta. Omat PSD-hahmot löytyvät kirjastosta nimillä Kille-Oma ja Handu-Oma.

Englanninkielinen tiukka esimerkki:

```text
#!kilsat
Character: Kille
Scene: Studio
Background: studio 0.5 seconds
Camera: wide 0.5 seconds
Kille walks right 2 seconds
Meanwhile: Kille nods 2 seconds
Kille waves 2 seconds
Wait 1 second
```

Suomenkieliset vastineet: Hahmo, Kohtaus, Tausta, Kamera, kävelee oikealle, Samalla, nyökkää, vilkuttaa ja Odota. Repliikki kirjoitetaan `Kille says: "Hello!" 2 seconds` tai `Kille sanoo: "Hei!" 2 s`; sille tarvitaan oikea äänitiedosto/tallenne. Ohjeen mallivalikossa on englanninkielinen kahden hahmon pohja. Istuminen ja ylä-/takakamera eivät kuulu tiukkaan kielioppiin.
