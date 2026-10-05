# KILSAT Studio 0.32 – käsikirjoitus ja toisto

## Vaiheet
0. Nykyinen React/TypeScript/Electron-rakenne tutkittiin; analyysi docs/analyysi.md. Lähtötilanteen 292 testiä läpäisi.
1. Valinnainen #!kilsat-kieli tuottaa jäljitettävän kohtausmallin ja adapterin nykyiseen Presentation-kääntäjään. Tuntemattomat rivit estävät rakentamisen ja näyttävät korjausehdotuksen. Vanha kieli ja .hahmo säilyvät.
2. Kellosta ajoitettu murto-osaruudun näytteenotto, pehmeä 2D-kamera ja kevennetty esikatselu. Aikajanan staattiset rivit välimuistitetaan; React-näkymä päivittyy toistossa 10 Hz, Canvas requestAnimationFrame-kutsussa.
3. Kahdeksan tilan toistonohjain, automaattinen kohtausvaihto, tauko/jatka/pysäytä/seek/alusta. Tilakaavio docs/tilakone.md. Visuaalinen hahmon tilakaavio on erillinen eikä tällä muutoksella ohjaa motion-blendtree-toistoa.
4. ARM64 Mac-paketti nykyisellä Electron-paketoinnilla; mukana paikalliset työkalut. Ei uusia kirjastoja.

## Todennus
875 kooditestiä läpäisi; TypeScript ja Mac-build läpäisivät. Paketoidun Electron/Node-runtimen testi sekä codesign --verify --deep --strict läpäisivät. ZIP-tiedostojen CRC ja versionumerot tarkistetaan toimituksessa.  500 käsikirjoituksen odotettu kohtausmalli ja nykyisen animaatiokääntäjän tulos tarkistetaan oikeilla kirjastohahmoilla. Äänitestien metadata on synteettistä; tämä ei todista kuultavan puheen tai kuvapikselien vastaavuutta.
Generaattori: 27 sanastoalkiota / 28 sanaa, 8 sääntöperhettä, 64 nimen, 16 verbimuodon, 3 suunnan, 50 keston ja 8 aikayksikön rajattu liikeperhe. 1 228 800 lauseasua jäsennettiin: 100 %, tuntemattomia 0. Kaikki eivät ole erillisiä animaatioita. Raportti docs/grammar-coverage.json.

## Suorituskyky ja rajat
In-app-selaimen 9,125 s esimerkkitoiston rAF-mittaus ilman testiajoja: 30,1 fps, p95 83,3 ms. 55/60 fps -hyväksymisraja EI täyty. Mittaus ei ole GPU-present- eikä paketoidun Electronin mittaus. Esikatselun optimointi ei muuta viennin resoluutiota. Yleistä kontaktien blendingiä tai 3D-kvaternioiden siirtymiä ei lisätty.
Tuettu kieli on rajattu ja eksplisiittinen; istuminen, nousu, ylä-/taka-/olankuva ja vapaa luonnollinen kieli eivät ole tämän kieliopin tuettuja komentoja. Niistä annetaan virhe. Kameran pehmennys koskee strict-kielen 2D-kameraa; Leikkaus-komento tekee kovan leikkauksen. Fyysisen kameran/mikrofonin ja puhtaan toisen Macin käynnistystä ei varmennettu. Kehitysversion graafinen selainkäynnistys ja esimerkin automaattinen loppuun toisto onnistuivat.

## Käynnistys
Pura Hahmostudio-Mac-0.32.0-arm64.zip, siirrä KILSAT Studio.app Ohjelmat-kansioon ja avaa. Sulje vanha versio ensin. Lataukset-kansion aikaisempi sovellus ei päivity automaattisesti.

## Avoin käyttöliittymävirhe
Kehitysselaimen lokissa esiintyi Maximum update depth exceeded -varoituksia. Esimerkin automaattinen loppuun toisto onnistui, mutta varoituksen lähdettä ei varmistettu. Se voi vaikuttaa suorituskykyyn ja on korjattava ennen tuotantohyväksyntää.
