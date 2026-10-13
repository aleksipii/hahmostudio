# Koetan itsenäinen Mac / DMG-julkaisu

Tarkistettu 13.10.2026. Nykyinen paketoija rakentaa `.app`-rakenteen ja käyttää
Macissa `hdiutil`-työkalua DMG:n luomiseen ja tarkistukseen. Linuxin
paketointitestit ovat rakennetestejä; oikeaa Mac-pakettia ei ole tällä
ympäristöllä rakennettu tai hyväksytty. Pelkkä onnistunut DMG-luonti ei takaa
sovelluksen toimivuutta toisella koneella.

## Julkaisua estävät tehtävät

| Kohde | Nykytila | Konkreettinen seuraava tehtävä |
| --- | --- | --- |
| Itsenäinen MP4-vienti | FFmpeg/FFprobe etsitään ympäristömuuttujista tai PATHista | Valitse ja lisensoi toimitettavat Mac-binäärit, pakkaa tarvittavat kirjastot ja toteuta haku appin resursseista. Tarkista koodekit ja vienti Macissa ilman Homebrewta. |
| Finderin projektiavaukset | `.koeta`-assosiaatio Info.plistissä; CLI-polku luetaan | Toteuta macOS:n tiedostonavaustapahtumien käsittely myös jo käynnissä olevalle sovellukselle; suojaa tallentamattomat muutokset ja testaa kaksoisklikkaus. |
| Luotettu jakelu | Valinnainen codesign ja strict verify | Toteuta hardened runtime, tarvittavat kamera-/mikrofonioikeudet, Developer ID -allekirjoitus, notarisaatio ja staple. Nykyinen allekirjoitusvalinta ei tee näitä kaikkia. |
| Kohdearkkitehtuuri | Apple Silicon oletus, Intel erillisenä targetina | Rakenna ja testaa tuetut arkkitehtuurit macOS SDK:lla. Päätä erilliset paketit tai universal-jakelu. |
| Sovelluksen metadata | Nimi, tunniste ja käyttöoikeuskuvaukset olemassa | Lisää oma `.icns`-kuvake ja todellisuudessa tuettu macOS:n minimiversio; varmista versiointi ja lisenssit. |
| Asennuskokemus | DMG tehdään app-hakemistosta | Tee jakelukuva, jossa sovellus ja Applications-oikotie; testaa kopiointi, ensimmäinen käynnistys ja päivitys. |
| Laitteet ja puhe | Linux-testit; oikea Kokoro-lataus ollut proxy-403:n takana | Testaa oikea Kokoro-synteesi ja kuuntelu, kamera ja mikrofoni oikeassa Macissa. |

Pidä mallipainot, käyttäjän äänet ja projektit sovellusdatassa, erillään
allekirjoitetusta appista. Älä lisää sertifikaatteja tai notarisaatiotunnuksia
Gitiin. Sovelluksen poistaminen tai päivittäminen ei saa poistaa käyttäjädataa.

## Mac-hyväksyntä ennen julkaisua

1. Rakenna release-paketti paketoijan ohjeella. Tarkista `file`- ja `otool -L`
   -työkaluilla suoritettavat tiedostot ja kirjastot: ei kehittäjän koneen
   absoluuttisia polkuja tai puuttuvia ulkoisia riippuvuuksia.
2. Allekirjoita lopullinen sisältö oikeassa järjestyksessä, notarisoit ja staple.
   Tarkista `codesign --verify --deep --strict --verbose=2 Koeta.app`,
   `xcrun stapler validate Koeta.app` ja
   `spctl --assess --type execute --verbose=2 Koeta.app`.
   Tarkista myös lopullisen DMG:n notarisaatio/staple ja `hdiutil verify`.
3. Lataa lopullinen paketti puhtaalle tuetulle Macille normaalisti selaimella.
   Testaa Gatekeeper ja asennus muuttamatta käyttöjärjestelmän turva-asetuksia.
4. Käynnistä Finderista ilman terminaalin PATH-asetuksia. Tarkista Metal-kuva,
   skaalaukset, projektivalitsimet sekä `.koeta`-avaus uudella ja jo käynnissä
   olevalla sovelluksella. Älä hukkaa tallentamattomia muutoksia.
5. Testaa mikrofonin ja kameran luvan antaminen ja epääminen, laitteiden
   vaihtaminen ja samanaikainen käyttö. Tarkista kuvan, suun ja äänen toisto.
6. Tee kahden hahmon englanninkielinen jakso eri Kokoro-äänillä. Kuuntele
   oikea synteesi; tarkista huulisynkka, repliikkien kestot ja kuvakulmat.
   Testaa mallin luvallinen lataus ja sen jälkeen offline-käyttö.
7. Tallenna sarjaprojekti omine ja synteettisine äänineen, sulje ja avaa uudelleen.
   Muuttumattomat äänet eivät saa generoitua uudelleen. Testaa myös palautus.
8. Vie MP4 ilman erillistä FFmpeg-asennusta. Tarkista FFprobella ja oikeassa
   videosoittimessa kuva, ääni ja englanninkieliset tekstitykset. Vie myös oma ääni
   ja taustaäänet; kokeile puuttuvaa resurssia ja vientivirheestä palautumista.
9. Testaa päivitys, sovelluksen poistaminen ja uudelleenasennus käyttäjädata
   säilyttäen. Kirjaa laitteet, macOS-versiot ja testatun commitin SHA TIIMI.md:hen.

## Kevyt sovellus: nykyiset ratkaisut ja mittaus

Natiivi UI ei käynnistä Chromiumia tai Nodea. GPU-esikatselu jakaa eframen
laitteen; muuttumattomalle ruudulle käytetään samaa tekstuuria. Kuvan koko,
aika, tuotannon resurssit, aikajana ja live-esitys mitätöivät välimuistin.
Kädessä olevien esineiden verkkovälimuisti rajataan nykyisiin hahmoihin.
Kokoro-malli ladataan erikseen; 32 400 liikevarianttia muodostetaan pohjista,
ei pakata kymmeninä tuhansina tiedostoina. Release-profiili käyttää thin LTO:ta,
yhtä codegen-yksikköä ja symbolien strip-toimintoa.

Kokoro/candle on yhä käännetty sovellukseen. Lopullinen binäärikoko, RAM ja
energiankulutus pitää mitata ennen uusia riippuvuus- tai pakkauspäätöksiä;
Linuxin debug-binääri ei ole Mac-julkaisun kokomittaus. Mittaa release-versiosta:

- `.app` ja pakattu DMG sekä erillinen ladattu malli; erittele FFmpeg ja kirjastot.
- Käynnistysaika, levossa CPU/RAM/energia, 3D-toiston ruutuaika sekä minimointi.
- Kokoron ensimmäinen lataus, synteesi ja toisto; MP4-viennin huippumuisti.
- Toistuvat hahmon, esineen ja projektin vaihdot: muistin on tasaannuttava.

Kirjaa käytetty Mac, resoluutio, jakson sisältö, commit ja mittausmenetelmä.
Numeerista keveyttä tai Mac-valmiutta ei pidä luvata ennen näitä mittauksia.

## Clauden yhdistetty työ

Git ja TIIMI.md osoittavat muun muassa seuraavat Clauden yhteiskirjoitetut
muutokset (commit-viestien Co-Authored-By, ei oletusta keskusteluhistoriasta):

- `34722fa`: paikallinen Rust-Kokoro, puhevälimuisti, ajoitus ja visemit.
- `da98931`: äänentoisto, mikrofoni, kamera ja Esitys-/Ääni-työkalut.
- `85abb99`, `c1839dc`: perhehahmot, tyylit, esineet ja uudet lavasteet.
- `2e226c6`: puhemoottorin virhe- ja välimuistitarkennukset, englannin puhesäännöt.
- `1f31bc9`: sarjatallennuksen ensimmäinen versio. Nykyinen ensisijainen
  tallennus on myöhemmin integroitu siirrettävä `.koeta` v2; vanhan hakemiston
  tuonti säilyy eikä aiempaa työtä poisteta.
- `9dd3fb4`: tekstitysten ja automaattitallennuksen ensimmäinen integraatio.

Tarkistuksen lähtötilassa `main` oli `7e1f1a7b139a951510add82e5b2808b70e83536c`;
uusia Clauden muutoksia ei ollut etähaarassa. Macin oikea laitehyväksyntä on
edelleen avoin riippumatta commit-viestin onnistumisilmoituksesta.
