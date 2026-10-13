# Koetan 2 000 liikevariaatiota

Kirjasto sisältää **20 pohjaa × 4 hahmoa × 25 kestoa = 2 000 klippiä**.
18 pohjaa on yksittäisiä liikkeitä ja kaksi kahden liikkeen sarjoja:
käänny ja osoita sekä kohauta olkapäitä ja pudista päätä. Kesto on 1,0–3,4 s
per vaihe, 0,1 s välein. Sarjan kokonaiskesto on kaksi kertaa vaiheen kesto.
Kalle, Maija, Eetu ja Ronja saavat omiin mittasuhteisiinsa lasketut animaatiot.

Tämä on variaatiokirjasto toteutetuista liikkeistä, **ei 2 000 erilaista
perustoimintoa eikä liikkeenkaappausaineisto**. Jokainen klippi sisältää oikeat
lasketut nivelkierrot ja siirtymät, ei pelkkää nimeä tai kuvausta.

## Käyttö Koetassa

Käsikirjoitus-välilehden **Liikeaineistot · 2 000 variaatiota** -valitsimessa
valitaan hahmo, liike ja vaiheen kesto. Esikatselu näyttää yhden tai kaksi
lisättävää riviä. Hyväksyntä lisää ne käsikirjoituksen loppuun. Vanha repliikki
ja nykyiset rivinvaihdot säilyvät; koko lähdetekstin muutos mitätöi esikatselun.
Kokoraja ja 60 s jaksonraja tarkistetaan myös hyväksyttäessä.

Koeta tuottaa liikkeen sarjan nykyiselle hahmoprofiilille alkuperäisen ohjeen
pohjalta. Ulkoisesti muokatun glTF:n tuontia takaisin sovellukseen ei vielä
ole toteutettu. Vienti käyttää alla kuvattuja vakiohahmoja.

## Valmiin glTF-aineiston luominen

```sh
cd native
cargo run --locked -p hs-cli -- motion-assets -o /polku/uuteen/liikeaineistoon
```

Kansion on oltava uusi; olemassa olevia käyttäjän aineistoja ei korvata.
`motion-catalog` tulostaa saman 2 000 kohteen luettelon JSON:na.

Tuotos:

- `kalle.gltf`, `maija.gltf`, `eetu.gltf`, `ronja.gltf`: kukin sisältää
  yhden oikean 3D-hahmon, painotetun luurankosidonnan ja **500 nimettyä animaatiota**.
- Vastaavat `.bin`-tiedostot sisältävät verkon, nivelpainot ja leivotut avainruudut.
  Pidä glTF ja bin samassa kansiossa; ne muodostavat yhden aineiston.
- `catalog.json` yhdistää klippitunnisteen hahmotiedostoon, alkuperäiseen
  käsikirjoitusohjeeseen, kestoihin ja näytteenottotaajuuteen.

Animaatiot leivotaan 30 näytteellä sekunnissa, tarkka loppupiste mukaan lukien.
Juuren liike ja jokaisen muuttuvan nivelen kierto/siirtymä viedään. Vakioarvoiset
kanavat tiivistetään ilman vaihtelevien avainruutujen hävittämistä.
Kierrot ovat normalisoituja kvaternioneja. Pituusyksikkö on metri; pystyakseli Y.

Klippien nimet ovat vakaita, esimerkiksi `clap-kalle-2000ms` ja
`turn-point-maija-1500ms`. glTF-yhteensopivassa editorissa valitaan nimetty
animaatio hahmon animaatioluettelosta. glTF:n yleinen PBR-varjostus poikkeaa
Koetan omasta sarjakuvatyylistä; native-ääriviivashaderia ei sisällytetä glTF:ään.

## Rajat

Klipit ovat alkuperäistä proseduraalista aineistoa nykyisestä Rust-moottorista.
Ne eivät sisällä käyttäjän ääniä, Kokoro-mallia, taustoja tai ulkopuolisia malleja.
Tuoli ja puhelin tarvitsevat oman esinekontaktinsa, joten niiden toiminnot eivät
kuulu tähän itsenäiseen aineistoon. Taputus on yksi taputus per klippi.
Juuren siirtyvät liikkeet eivät ole paikallaan tehtyjä in-place-klippejä eikä
kaikkia klippejä ole tarkoitettu saumattomaan silmukkaan.

GlTF:t käyttävät Koetan omaa luurankoa. Toisen hahmon luurankoon sovittaminen
(retargetointi) on erillinen työ; siihen ei luvata yleistä automaattista ratkaisua.
Fyysinen lavastekontakti, vaatteen törmäykset ja lopullinen kuvallinen laatu
vaativat edelleen katselmoinnin. Ovet, portaat, esineen luovutus ja kahden
hahmon kontaktit eivät synny tämän kirjaston variaatioiden määrästä.
