# KILSAT Studio 0.35 — työpöytäasettelu ja näyttämön sijainti

## Vaiheet A–F
A: oranssit tokenit, 12 px perusteksti, kompaktit 26–28 px kontrollit. B: jaettavat paneelit, 220 px aikajanan minimikorkeus, rAF-throttle jakajissa, nykyiseen Electron preferences.json -tiedostoon lisätty validoitu ui-osio. C: työtilat yläpalkissa, segmentoidut suunnat ja yksi toistoryhmä. D: videon muoto / ympäristö / sijainti ja koko / tausta omissa pysyvissä accordion-osioissa. E: aikajanan zoom, kiinteät raitanimet, eriväriset kanavat, punainen playhead ja yksi tilapalkki. F: minimi-ikkuna 1200×700, native-menu, Cmd/Ctrl+0 ja +/−, kontekstivalikot sekä tiedostonimi/muutospiste ikkunan otsikossa. Vanhoja lisätiedosto- ja revisiotoimintoja ei poistettu: ne löytyvät Lisätyökalut-valikosta.

## Sijainti ja turvarajat
stage-bounds.ts sisältää yhteisen clampToStage-funktion. Oletukset 40 / 40 / 120 / 220 px. Paneelissa säädettävät turvarajat ja reunakäytös säilyvät .hahmo-tiedoston vapaaehtoisina Scene-kenttinä; vanha muoto luetaan. Vanhojen projektien alkuperäiset vedokset/historia säilyvät: uuden editorin näkyvä sijainti ja piirto rajoitetaan; käyttäjän ensimmäinen muutos tallentaa rajoitetut arvot normaalina komentona.

Pointer Events, setPointerCapture ja kuvan todellinen getBoundingClientRect huomioivat esikatselun zoomin sekä vierityksen. Tarttumiskohta säilyy. Shift lukitsee akselin, nuolinäppäimet 1 px ja Shift 10 px aktiivisella näyttämöllä. Muokkauskentät eivät laukaise siirtoa. Raahaus on vain väliaikainen esikatselu; pointerup kutsuu yhden nykyisen commitAnimation-komennon. Peruutus ei kirjoita projektia. Snap-raja 8 videopikseliä; turvakehys ja magneetit eivät päädy vientiin. Näytä-valikossa on turvakehyksen toiminto.

Kävely ennakoi loppupisteen. Stop pysähtyy reunalla ja säilyttää rivin keston. Shorten lyhentää kävelyn ruutuajan. Turn taittaa reitin takaisin rajalta ja vaihtaa monikulmahahmon vasen/oikea-näkymää. Ilman profiiliresursseja liikesuunta vaihtuu, uusia kuvakulmia ei keksitä. Tilapalkki kertoo ylityksestä. Muu nivel-, animaatio- ja renderöintikoodi säilyy; renderöinnin lisäys rajoittaa ainoastaan sijaintia/kokoa ja samalla kiinnitetyn puhelimen sijaintia.

Tuotantokohtauksissa yhteiset maailmasijainnit rajoitetaan myös samoilla rajoilla. 2D-laajakuvan valmiita hahmoja voi siirtää. Kohdetta seuraavaa lähi-/puolikuvakameraa, toon3D-kameraa tai eri kuvasuhteeseen muunnetun tuotantokohtauksen suoraa raahausta ei aktivoida: niiden kameraseurantalogiikkaa ei muuteta tässä työssä. Tavallisen PSD-näyttämön raahaus toimii kaikilla editorin zoomeilla ja videomuodoilla.

## Testaus
Lähtötilanne 889 testiä; lopputulos 899/899 läpäisi. Uudet rajat, zoom/pan-koordinaatit, Shift, magneetit, kaikki reunakäytökset, oikeat monikulmaresurssit ja .hahmo-roundtrip sekä asetustiedoston restart testataan koodissa. Build ja TypeScript ajettiin vaiheittain. Projektissa ei ole erillistä lint-komentoa; uusia lint-riippuvuuksia ei lisätty.

GUI-diagnostiikka on eristetty --layout-screenshots -lipulla ja omalla testidatakansiolla. Pyydetyt koot 1280×720, 1440×900, 1920×1080, 2560×1440. Suora Electron-käynnistys päättyi tässä ympäristössä exit134 ennen käyttöliittymää. LaunchServices-avauksesta saatiin kLSNoExecutableErr (-10827). Kuvakaappauksia ei vielä saatu, eikä ulkoasun tai Retina-piirron hyväksymistä väitetä tehdyksi. Fyysisiä laitteita ei testattu. Kooditestit, paketointi, allekirjoitus ja paketoitu Node-runtime erotetaan GUI-varmennuksesta loppuraportissa.

Mac ARM64 -paketointi, codesign ja paketoidun Node-runtimen testit läpäisivät. Paikallinen 0.35.app kopioitiin käyttäjän luvalla käyttäjän Ohjelmat-kansioon erillisenä versiona. Myös sen allekirjoitus tarkistettiin. LaunchServices-avauksesta saatiin edelleen -10827; graafista käynnistystä ei voi merkitä onnistuneeksi.
