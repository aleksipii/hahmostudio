# Hahmostudio — oma animaatiostudio

Hahmostudio on suomenkielinen PSD-pohjainen animaatioeditori omaan käyttöön. PSD:t ja animaatiot käsitellään paikallisesti. Pilvitallennusta ei ole.

## Yksityinen studio

Julkinen GitHub Pages -julkaisu on poistettu käytöstä yksityistä käyttöä varten: Pages ei suorita kirjautumista tarkistavaa Node-palvelinta. Käytä tämän projektin yksityistä palvelinta.

```sh
npm ci
npm run build:private
npm run start:private
```

Avaa **http://127.0.0.1:4174/**. Ensimmäisellä käyttökerralla etusivu pyytää luomaan oman käyttäjätunnuksen ja vähintään 12 merkin salasanan. Uusia käyttäjiä ei voi luoda tämän jälkeen. Palvelin kuuntelee oletuksena vain tämän koneen loopback-osoitetta.

Salasana tallennetaan satunnaisesti suolattuna scrypt-tiivisteenä. Kirjautuminen käyttää HttpOnly/SameSite-evästettä, ja palvelin estää sekä editorin että sen tiedostojen lataamisen ilman istuntoa. Istunto kestää 12 tuntia ja päättyy palvelimen uudelleenkäynnistyksessä. Käytä **Kirjaudu ulos**, kun lopetat.

Tunnustiedot ovat `.private-storage/owner.json`-tiedostossa. Kansiota ei viedä Gitiin. Säilytä kansio turvallisesti ja varmuuskopioi se; projektin päivitys ei saa korvata sitä. Älä laita salasanaa tai käyttöönottoavainta lähdekoodiin.

## Animointi

1. Avaa oma PSD tai kokeile valmista tasotestiä.
2. Valitse vasemmalta taso. Avaa **Rigi**, määritä rooli ja aseta kierron pivot-piste kuvan päälle.
3. Avaa **Animoi**. Valitse tason rata ja aikajanan ruutu.
4. Muokkaa liikettä X/Y-suunnassa, kiertoa, skaalaa tai peittävyyttä ja paina **Lisää avainruutu**.
5. Siirry seuraavaan ruutuun, muokkaa asentoa ja lisää seuraava avainruutu. **Toista** näyttää liikkeen silmukkana.
6. Valitse siirtymä: Pehmeä, Tasainen tai Pidä asento. Siirtymä koskee kyseisestä avainruudusta seuraavaan kulkevaa liikettä.
7. **Tallenna animaatio** tallentaa rigin ja avainruudut JSON-tiedostoon. Jatka avaamalla sama PSD ja **Avaa animaatio**. PSD-kuvia ei sisällytetä JSONiin.
8. **Vie PNG-kuvasarja** lataa ZIP-tiedoston, jossa on läpinäkyvät ruutukuvat ja FPS-tiedot. Voit käyttää ruutuja videon koostamiseen toisessa ohjelmassa.

**Kumoa** ja **Tee uudelleen** toimivat avainruutujen ja aikajanan asetusten muutoksiin (40 muutosta). Asennon kenttien muokkaus on esikatselu, kunnes painat avainruudun tallennusta. Pelkkä aikajanalla siirtyminen ei tallenna uutta asentoa.

Nykyinen versio animoi tasoja toisistaan riippumatta. Pivot vaikuttaa kiertoon; nivelpisteet ovat rigin määrittelyä eivätkä vielä sido tasoja luurangoksi. Ääni, huulisynkronointi, kameraseuranta ja sisäkkäiset animaatioklipit ovat myöhempiä kehitysvaiheita. Tämä ei vielä vastaa Adobe Character Animatorin koko toiminnallisuutta.

## Rajat

- RGB/harmaasävy, 8-bittinen PSD; ei PSB:tä.
- PSD enintään 100 MiB, kuva 16 MP, 1000 tasoa.
- Animaatio: 1–60 FPS, 2–1800 ruutua.
- PNG-vienti: enintään 300 ruutua, pisin sivu 1080 px ja pakkaamattomien PNG-tiedostojen yhteiskoko 128 MiB.
- Monimutkaiset Photoshop-tehosteet voivat poiketa alkuperäisestä kuvasta. Tasojen näkyvyysmuutokset eivät sisälly animaatio-JSONiin.

## Suojattu käyttö internetissä

Etäkäyttö vaatii Node-palvelinta tukevan hostauksen ja HTTPS:n. GitHub Pages ei riitä. Palvelin on valmisteltu tähän, mutta hostaus on määritettävä erikseen:

- `HAHMOSTUDIO_HOST=0.0.0.0`
- `HAHMOSTUDIO_ORIGIN=https://oma-studio.example`
- `HAHMOSTUDIO_SETUP_TOKEN`: pitkä satunnainen kertakäyttöinen käyttöönottoavain; syötä se ensimmäisen tunnuksen luonnissa.
- `HAHMOSTUDIO_DATA_DIR`: pysyvä yksityinen tallennuskansio.
- `PORT`: palvelimen portti (oletus 4174).

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
Yläpalkin Käyttöohje avaa kuusi ohjesivua: aloitus, nimeäminen, nivelmääritys, animointi, tallennus ja varoitukset. Työvaiheet ovat 1. Tasot, 2. Nivelet ja 3. Animoi. Nimillä ei käynnistetä automaattisia toimintoja. Vanhojen rigitiedostojen JSON-muoto säilyy yhteensopivana.
