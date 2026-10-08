# Käsikirjoituksen tulkintasäännöt

Tämä dokumentti luettelee jokaisen säännön, jolla `lib/script-recognizer.ts` tulkitsee käsikirjoituksen. Tulkinta on täysin sääntöpohjainen: ei tekoälyä, kielimalleja, tilastoja, sumeaa vertailua eikä kynnysarvoja. Jos mikään sääntö ei sovi yksiselitteisesti, rivi jää tunnistamattomaksi ja käyttäjä näkee rivin numeron, syyn ja esimerkin muodosta, jonka sovellus ymmärtää. Käyttäjän tekstiä ei koskaan muuteta (`raw` säilyy sellaisenaan); kaikki tulkinnat ovat johdettuja kenttiä.

Omistaja: agentti 7 (käsikirjoitussääntöjen asiantuntija). Testit: `lib/script-recognizer-rules.test.ts` (jokaiselle säännölle sopiva ja ei-sopiva tapaus, korpus, ominaisuustestit) ja `lib/script-recognizer.test.ts` (vanhemmat tapaustestit). Korpus: `tests/fixtures/script-recognizer/korpus.txt`.

## Takuut (testattu)

1. **Ei vääriä tulkintoja korpuksessa.** Korpuksen jokainen rivi on kirjattu käsin; testi vaatii nolla väärää.
2. **Ei arvaamista.** Jokainen tulkinta tulee alla nimetystä säännöstä. Arvioidut arvot (oletussuunta oikealle, oletuskesto) merkitään `estimated: true` ja näkyvät tarkistuksessa arvioina.
3. **Mitään ei katoa.** Jokainen syöterivi on tuloksessa samalla rivinumerolla ja muuttamattomalla raakatekstillä, joko tunnistettuna tai `unknown`-tilassa syyn kanssa. Hahmoja ei keksitä (pronominit, taivutusmuodot ja "Pipsalle Ville" eivät ole hahmoja).
4. **Determinismi.** Sama syöte antaa saman tuloksen (ei satunnaisuutta, kelloa eikä ympäristöriippuvuutta). LF, CRLF ja CR tulkitaan samoin.
5. **Moniselitteisyys näkyy.** Sääntöjen etusija on alla; aidosti kaksitulkintainen rivi merkitään moniselitteiseksi.

## Etusija (rivitilakone)

Rivi käydään läpi tässä järjestyksessä; ensimmäinen sopiva sääntö voittaa:

1. tyhjä rivi → kommenttilohko (`/* … */`, `[[ … ]]`) → yksirivinen kommentti → `#!kilsat` → tuotanto-ohjeosio
2. resurssi- ja tunnusrivit → jakso-otsikko (`… — S01E01: …`) → ensimmäinen markdown-otsikko → metatieto (`Avain: arvo`)
3. aikakoodi → kohtausotsikko → kohtausnimi → siirtymä → muu markdown-otsikko (kommentti)
4. hahmomääritys → sulkeohje
5. puhujan jälkeinen rivi: lainaus → repliikki; rakenne-rivi (uusi puhuja, kohtaus, siirtymä, kuva) katkaisee repliikin; nimellä alkava ohjeeksi tunnistuva rivi → moniselitteinen; muu → repliikki
6. ryhmäpuhuja (tunnistamaton) → luettelomerkki poistetaan → puhuja → "X sanoo" → ajatusviivarepliikki → CUT TO -otsikkokortti → kuva (+ ohje) → väliotsikko → johdanto → ohjerivi (lauseet)

Ohjerivin lauseessa: kesto rajojen ulkopuolella (tunnistamaton) → rajoitus → huomio → paikallaan-kielto → leikkausrytmi → tausta → otsikkokortti → tauko → puhelin → katse → paikallaanolo (huomio) → liike → ilme → katse toiseen hahmoon → tuntematon.

## Säännöt

Esimerkeissä ✔ = sopii, ✘ = ei sovi (tulos suluissa).

### `kohtausotsikko`
INT./EXT./INT./EXT./SISÄ./ULKO. + paikka, valinnaisesti " - aika" ja numero alussa. Nollaa pronomini- ja katseviittaukset.
✔ `INT. KEITTIÖ - AAMU` · ✘ `Interiööri on kaunis.` (johdanto)

### `kohtausnimi`
`Kohtaus [n]: nimi` / `Scene: nimi`. ✔ `Kohtaus 2: Koulu` · ✘ `Kohtaus oli hyvä.`

### `aikakoodi`
`0:00–0:05 — Nimi`. ✔ `0:00–0:05 — Alku` · ✘ `Kello 0:05 alkaa.`

### `siirtymä`
Suljettu lista: CUT TO, LEIKKAUS, SMASH/MATCH CUT, DISSOLVE, RISTIKUVA, FADE IN/OUT/TO BLACK, HÄIVYTYS (MUSTAAN/SISÄÄN/ULOS), LOPPU, THE END; koko rivi. ✔ `FADE OUT.` · ✘ `Fade out slowly please`

### `metatieto`
`Avain: arvo`, avain suljetusta listasta (nimi/title, pituus/duration, tarkoitus, miljöö, tekijä, versio, sarja, jakso, kieli, käyttö/katso → info…). ✔ `Pituus: 30 s` · ✘ `Pituudesta: ei`

### `markdown-otsikko`
Ensimmäinen `# …` ennen sisältöä on jakson otsikko; myöhemmät `#`-rivit ovat metatietoa (jos avain sopii) tai väliotsikoita (kommentti). ✔ `# Jakso 1` (otsikko) · ✘ toinen `# Toinen` (kommentti)

### `kommentti`
`//`, `/* … */` (myös monirivinen), `[[ … ]]`, `<!--`. ✔ `// huom` · ✘ `/ ei kommentti`

### `hahmomääritys`
`Hahmo: Nimi`, `Character: Name`, `Hahmo Nimi: kuvaus`. ✔ `Hahmo: Pipsa` · ✘ `Hahmoja: kaksi`

### `puhuja-isot-kirjaimet`
Fountain: enintään kolmen sanan isoilla kirjoitettu rivi (myös laajennus `(V.O.)`, `(jatkuu)` …), jonka **heti seuraava** rivi on tekstiä. Tyhjä rivi välissä estää. ✔ `PIPSA` + `Hei.` · ✘ `PIPSA` + tyhjä + `Hei.`

### `puhuja-kaksoispiste`
`NIMI: repliikki` kun nimi on tunnettu hahmo tai isoilla, tai repliikki on lainausmerkeissä. Avainsanat (Tausta, Kamera, Huom …) eivät ole puhujia. ✔ `PIPSA: Hei.` · ✘ `Huomenna: sataa.`

### `puhuja-yksi-hahmo`
Puhujarivi nimeää aina yhden hahmon. Usean nimen yhteinen puhujarivi (`PIPSA JA VILLE`, `PIPSA & VILLE: …`, `PIPSA, VILLE: …`, `MIRA AND NIKO (V.O.)`; liitossanat JA/SEKÄ/AND, `&` ja pilkku) ei ole puhuja eikä siitä tehdä uutta hahmoa. Rivi jää tunnistamattomaksi syyllä "Usean hahmon yhteistä puhujariviä ei tueta". Myös heti sen alla oleva rivi jää tunnistamattomaksi, koska se voi olla ryhmän repliikki tai ohje: sitä ei anneta kenellekään eikä animoida. Sääntö pätee myös repliikin jälkeen. Kaksoispisteellinen nimi, jossa on ja/sekä/and, ei ole puhuja. ✔ `PIPSA JA VILLE` + `Hei!` (molemmat tunnistamattomia) · ✘ `PIPSA` + `Hei!` (puhuja ja repliikki)

### `puhuja-kaksoispiste-rivi`
`VILLE:` omalla rivillään: puhuja, jos seuraava ei-tyhjä rivi on lainaus (tyhjä rivi saa olla välissä) tai heti seuraava rivi on tekstiä. ✔ `VILLE:` + `Moi.` · ✘ `Huomenna:` + `Moi.` (väliotsikko)

### `sulkeohje`
`(…)` kokonaisena rivinä; sisältö tulkitaan puhujan ohjeena, tuntematon sisältö on huomio. ✔ `(hymyilee)` · ✘ `(hymyilee` (repliikkiä)

### `repliikki-puhujan-jälkeen`
Puhujan alla oleva rivi on repliikki (myös käskymuoto "Istu alas!"). Repliikki jatkuu tyhjään riviin tai sulkeutuvaan lainausmerkkiin asti. ✔ `PIPSA` + `Istu alas!` · ✘ tyhjän rivin jälkeen (ei puhujaa)

### `repliikki-vai-ohje`
Puhujan alla oleva rivi, joka alkaa hahmon nimellä perusmuodossa tai nominatiivipronominilla ja tunnistuu kokonaan ohjeeksi, on **moniselitteinen** → tunnistamaton, ohjeena "erota tyhjällä rivillä". ✔ `PIPSA` + `Pipsa vilkuttaa.` (moniselitteinen) · ✘ `PIPSA` + `Pipsa on kiva.` (repliikki)

### `sanoo-repliikki`
`Nimi sanoo/kysyy/vastaa/huutaa/kuiskaa/toteaa (says/asks/…) [Puhuteltava]: "…" [kesto]`. Puhuja on tunnettu hahmo perusmuodossa, nominatiivipronomini (hän, she …) tai yksi uusi isolla kirjoitettu nimi; puhuteltava on tunnettu hahmo missä tahansa sijassa. Kesto (`2 s`, `2 seconds`) ei kuulu repliikkiin. ✔ `Pipsa sanoo Villelle: "Tule." 2 s` · ✘ `Pipsalle Ville sanoo: "Tule."`

### `ajatusviivarepliikki`
`– repliikki Nimi sanoo/kysyy.` (suomalainen proosarepliikki, puhuja lopussa). Ilman puhujaa rivi jää tunnistamatta, puhujaa ei arvata. ✔ `– Hei! Pipsa sanoo.` · ✘ `– Hei!`

### `kuva`
Kuvakoko, kameraliike tai kuvakulma suljetusta sanastosta. Englannin lyhenteet (CU, WS, PAN…) vain isoilla; suomen yhdyssanat (lähikuva, puolikuva) missä tahansa kirjainkoossa. `Kamera:`/`CUT`/`LEIKKAUS` + kohde. ✔ `LÄHIKUVA PIPSA` · ✘ `Pipsa takes a cu of coffee`

### `kuva-kaksoispiste-toiminta`
`Kuvatermi: lause, jossa on verbi` → kuva ja lauseen toiminta (toiminta ei katoa). Jos lausetta ei tunnisteta, rivi on tunnistamaton. ✔ `Tracking shot: Niko walks forward.` · ✘ `CUT TO: NIKO MEDIUM` (pelkkä kuva)

### `tekijä`
Liikkeen, ilmeen, katseen ja puhelintoiminnon tekijä on yksi hahmon nimi **perusmuodossa ja isolla alkukirjaimella** (tai isoilla) tai nominatiivipronomini ennen verbiä. Taipunut nimi ("Pipsan kissa", "Villelle"), objektipronomini ("hänen") tai tuntematon sana ("kissa", "The cat", "Vanha ukko") ennen verbiä estää tulkinnan, eikä lause peri edellistä hahmoa. Kaksi eri nimeä ilman sidesanaa on moniselitteinen. ✔ `Pipsa hyppää.` · ✘ `Pipsan kissa hyppää.`

### `tekijä-omistus`
Poikkeus tekijään: "Pipsalla on …" (omistus) ja "Pipsan katse …" (katse). ✔ `Pipsalla on puhelin kädessä.` · ✘ `Pipsalle tulee puhelin.`

### `tekijä-jatkuu`
Lause ilman sanoja ennen verbiä (tai vain sallittuja sanoja: sitten, nyt, hitaasti, ja, on, ei …) jatkaa edellisen tekijän. Tekijän estänyt lause katkaisee ketjun. Ilmesanan jälkeinen nimi perusmuodossa on tekijä ("Täysin ilmeetön Handu"). ✔ `Pipsa hymyilee.` + `Katsoo kameraan.` · ✘ `Pipsan kissa hymyilee.` + `Katsoo kameraan.`

### `pronomini`
hän/he/she viittaa edelliseen tekijään tai puhujaan **samassa kohtauksessa**; he/molemmat/kaikki/they/both kaikkiin, kun hahmoja on useampi. ✔ `Pipsa hymyilee.` + `Hän istuu.` · ✘ kohtausotsikon jälkeen `Hän istuu.`

### `yhteinen-tekijä`
"Pipsa ja Ville hyppäävät", "Ville, Pipsa ja Taru …": jokainen nimi perusmuodossa. Jos joukossa on muu kuin hahmo, lause jää tunnistamatta. ✔ `Pipsa ja Ville hyppäävät.` · ✘ `Pipsa ja kissa hyppäävät.`

### `pilkku-uusi-tekijä`
Pilkku jakaa lauseen, kun molemmissa osissa on verbi ja pilkun jälkeen alkaa uusi tekijä. ✔ `Pipsa juoksee, Ville kävelee.` · ✘ `Niko walks left, two seconds.` (yksi lause)

### `yksi-liike-per-lause`
Kaksi eri liikeverbiä samassa lauseessa ilman erotinta → tunnistamaton (ei arvata kumpi). Saman liikkeen kaksi sanaa ("puristaa nyrkkinsä") on yksi liike. ✔ `Pipsa hyppää juoksee.` (tunnistamaton) · ✘ `Pipsa puristaa nyrkkinsä.` (nyrkki)

### `kielto`
Kieltosana (ei, älä, not, never, without, ilman …) kumoaa seuraavat sanat lauseen loppuun tai vastakohtasanaan (vaan, mutta, but, instead). ✔ `Pipsa ei enää ikinä juokse.` (ei liikettä) · ✘ `Pipsa ei juokse vaan hyppää.` (hyppy)

### `liike-suunta`
Suljettu verbisanasto taivutusmuotoineen (kävelee, juoksee, hyppää, kyykistyy, istuu, vilkuttaa, nyökkää, osoittaa, nyrkki, pysähtyy, hämmästyy; walks, runs …) ja suunnat (vasemmalle, oikealle, suoraan, kohti kameraa; *vasemmalta* = liike oikealle). Ilman suuntaa kävely/juoksu on oikealle **arvioituna**. ✔ `Pipsa kävelee vasemmalle 2 s.` · ✘ `Pipsa kävelee.` (arvio)

### `ilme`
Vihainen, huolestunut, hämmentynyt, loukkaantunut, pokerinaama, kulmat ylös, iloinen, surullinen, peloissaan (myös adverbinä "huolestuneena"). ✔ `Pipsa on surullinen.` · ✘ `Pipsa on väsynyt.`

### `katse`
katsoo/vilkaisee/tuijottaa/looks/glances + kohde: hahmo (isolla alkukirjaimella, missä tahansa sijassa, tai pronomini), puhelin tai kamera/katsoja. ✔ `Pipsa katsoo Villeä.` · ✘ `Pipsa katsoo villeä.` (pieni alkukirjain)

### `puhelin`
Puhelin-sana + toiminto: pitää, näyttää, napauttaa, korvalle, pöydälle, toiseen käteen, esiin/pois. Ilman toimintoa ei tulkintaa. ✔ `Pipsa napauttaa puhelinta.` · ✘ `Pipsan puhelin soi.`

### `tauko`
Pieni/pitkä tauko, hiljaisuus, pidä, odota, beat, pause, hold (+ kesto). Beat/pieni tauko = 0,5 s, pitkä tauko = 1,5 s. ✔ `Pieni tauko.` · ✘ `Tauon jälkeen.`

### `kesto-rajat`
Lauseen kesto on yli 0 ja enintään 60 s (jakson enimmäispituus, `MAX_CLAUSE_SECONDS`). Miinusmerkkinen kesto (`-3 s`, `−2 s`), nolla ja yli 60 s jättävät lauseen tunnistamattomaksi syyn kanssa; miinusmerkkiä ei pudoteta eikä kestoa rajata hiljaa. Väli `1–2 s` ei ole miinusmerkki. Jakson rakennus näyttää syyn varoituksena (`unrecognized-line`) eikä tee lauseesta tapahtumaa. ✔ `Pipsa odottaa -3 s.`, `Pipsa odottaa 99999 s.` (tunnistamaton) · ✘ `Pipsa odottaa 2 s.` (tauko 2 s)

### `hiljaisuus`
Tauko on `silence`, kun lauseessa on hiljaisuus (missä tahansa sijassa: hiljaisuutta), silence tai "ei dialogia". ✔ `Pidä 0,7 sekuntia hiljaisuutta.` · ✘ `Pidä 0,7 sekuntia.` (pause)

### `rajoitus`
Kieltolause alussa (Ei, Älä, Do not …): kamera paikallaan, ei dialogia, ei liikettä, kovat leikkaukset, ei ylimääräistä rekvisiittaa, pienet eleet. ✔ `Älä liikuta kameraa.` · ✘ `Kamera on uusi.`

### `tausta`
`Tausta:/Background:/Miljöö:/Setting: nimi [kesto]`; kesto ei kuulu nimeen. ✔ `Tausta: keittiö 2 seconds` · ✘ `Taustalla keittiö.`

### `otsikkokortti`
`Otsikkokortti:/Title card:/Lopetus:/Ending: teksti [kesto]`. ✔ `Otsikkokortti: Loppu 2 s` · ✘ `Otsikko näkyy.`

### `luettelomerkki`
Ohjerivin alun `1.`, `2)`, `*`, `•` poistetaan ennen tulkintaa (ei repliikeistä). ✔ `1. Pipsa hyppää.` · ✘ `Kohdat 1. ja 2.`

### `johdanto`
Ennen ensimmäistä kohtausta, puhujaa tai ohjetta oleva proosa, josta ei tunnistu ohjetta, on esipuhetta (kommentti). ✔ `Tämä on johdanto.` ennen kohtausta · ✘ sama lause kohtauksen jälkeen (tunnistamaton)

Muut vanhemmat apusäännöt (kestot, kielen tunnistus, tuotanto-ohjeosio, `discoverActors`) on kuvattu tiedostossa `docs/KASIKIRJOITUS-TUNNISTIN.md`; `discoverActors` ei enää lisää tunnetun tai toisen löydetyn nimen taivutusmuotoa uudeksi hahmoksi.

## Tunnistamattoman rivin viesti

`RecognizedLine.reason` (syy) ja `hint` (ymmärretty muoto); `explainUnknownLine()` muodostaa viestin "Rivi N: “teksti”. Syy. Sovellus ymmärtää muodon: esimerkki." Jakson rakennuksen tarkistus (`lib/episode/recognize.ts`) näyttää syyn rivinumeron kanssa, ja marginaaliannotaatio saa saman tekstin kenttään `reason`.

Syyt: ei sääntöä, tekijä ei yksiselitteinen (taipunut muoto / tuntematon sana / useampi hahmo / pronomini ilman edeltäjää), ei tekijää, useampi liike, moniselitteinen repliikki/ohje, ajatusviivarepliikki ilman puhujaa, usean hahmon yhteinen puhujarivi ja sen alla oleva rivi, kesto rajojen ulkopuolella (negatiivinen, nolla tai yli 60 s).

## Tulokset (korpus 36 tapausta, 233 riviä)

| | Oikein (tunnistettu) | Oikein (jätetty tunnistamatta) | Väärin | Tunnistamaton |
|---|---|---|---|---|
| Ennen (2026-10-08) | 158 | 15 | 34 | 8 |
| Jälkeen (kierros 1, 34 tapausta / 215 riviä) | 184 | 30 | 0 | 1 |
| Jälkeen (kierros 2, 36 tapausta / 233 riviä) | 192 | 40 | 0 | 1 |

Kierros 2 lisäsi lopputarkastajan löytämät tapaukset 35 (ryhmäpuhuja "PIPSA JA VILLE") ja 36 (kesto -3 s, −2 s, 0 s, 99999 s, 2 s, 60 s). Ennen korjausta ensimmäinen teki hahmon "PIPSA JA VILLE" ja toinen tauon 3 s; molemmat ovat nyt tunnistamattomia syyn ja esimerkin kanssa.

Raportit: `tests/fixtures/script-recognizer/lahtotaso-ennen.txt` ja `tulos-jalkeen.txt`.

## Muuttuneet tulkinnat olemassa olevissa käsikirjoituksissa

Vertailu `tests/fixtures/script-recognizer/olemassa-olevat-ennen.json` (projektin 16 käsikirjoitusta) ennen ja jälkeen:

- `public/library/YouTube-kartonki-jaksot-1-5.md` r3–5: `# Käyttö: …`, `# tuo …`, `# Katso: …` eivät enää ole jakson otsikoita (info, kommentti, info). Peruste: vain ensimmäinen markdown-otsikko on otsikko.
- `tests/fixtures/scripts/feature-en.fountain` r48: `Tracking shot: Niko walks forward.` saa kuvan lisäksi liikkeen walk-front (ennen liike katosi). Esitykseen tulee yksi uusi kävelytapahtuma.
- `tests/fixtures/long-fi.md` r10, 19, 28, 37, 46, 55: `Pidä 0,7 sekuntia hiljaisuutta.` on `silence` eikä `pause` (sama kuin englanninkielisessä versiossa).
- Mallipohja `english` r5, 9, 10: `Background: studio 0.5 seconds` → tausta `studio`; `Kille says: "Are you ready?" 2 seconds` → repliikki `Are you ready?` (ennen kesto ja lainausmerkki päätyivät repliikkiin). Mallipohja ajetaan `#!kilsat`-tilassa, joten muutos koskee marginaalia ja palikoita.

Muiden käsikirjoitusten jokaisen rivin tulkinta ja esityksen tapahtumat ovat ennallaan.

## Tunnetut rajoitukset

- Pienellä kirjoitettua nimeä ("pipsa katsoo villeä") ei tunnisteta tekijäksi eikä katseen kohteeksi, jotta yleisnimi ("vanha ukko") ei osu samannimiseen hahmoon. Puhujana (`pipsa: hei`) tunnettu nimi tunnistetaan.
- Monisanaisia nimiä ("Mr. Kille") ei tunnisteta ohjerivien tekijäksi; puhujarivinä ne toimivat.
- Kuvarivillä tuntemattomat sanat ("AINO MEDIUM, right three-quarter view") jätetään huomiotta; vain kuvakoko ja kohde tulkitaan.
- Ajatusviivarepliikki vaatii puhujan lopussa preesensissä ("Pipsa sanoo"); "huusi Pipsa" ja käänteinen järjestys eivät toimi.
- Repliikin jatkoriviä, joka alkaa nimellä ja näyttää ohjeelta, ei ratkaista: se merkitään moniselitteiseksi.
- Tukemattomat toiminnot (herää, avaa oven, kääntyy ilman kohdetta) jäävät tunnistamatta.
- "Kissa hyppää" rivin alussa voi tehdä Kissasta hahmon `discoverActors`-säännöllä (isolla alkava sana + tunnettu verbi, sana ei esiinny muualla pienellä). Hahmo näkyy roolituksessa, joten tämä ei ole hiljainen.
- Tauon tekijä (`hold`) seuraa vanhaa sääntöä: ensimmäinen nimi missä tahansa sijassa tai edellinen hahmo.
- Korpus kattaa 233 riviä; laajempaa kattavuutta ei ole mitattu.
