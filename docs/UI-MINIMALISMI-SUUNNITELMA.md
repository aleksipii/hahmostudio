# Minimalistinen käyttöliittymä: suunnitelma

Tila: **SUUNNITELMA TARKASTETTAVANA** (2026-10-08, UI/UX-suunnittelija). Tämä on suunnitelma, ei toteutus. Koodia ei ole muutettu tämän dokumentin vuoksi. Mitään toimintoa ei poisteta.

Pohjana ovat `docs/KILSAT-APP-SHELL.md`, `lib/studio-feature-map.ts` ja tiimin aiempi `suunnitelmat/ammattistudio-suunnitelma.md`. Tämä dokumentti ei toista niitä. Se kertoo, mitä ruudulla on mitattuna vielä liikaa, ja mihin jokainen asia siirretään.

Tavoite (käyttäjältä): käsikirjoituksesta nopeasti animaatiojakso ja sitä kautta sarja. Ruudulla näkyy vain meneillään olevan vaiheen päätehtävä. Kaikki muu on "Lisää"-valikon, ⌘K-haun tai asetusten takana.

## 1. Nykytila: mikä on liikaa ruudulla

Mittaus: web-versio (`npm run dev`, Chromium, 1440 × 900), Pipsa-3D ladattuna ja esimerkkikäsikirjoitus ladattuna. Laskettu kaikki ruudulla näkyvät painikkeet, kentät, valinnat ja avattavat osiot (suljettujen osioiden sisältö ei ole mukana) sekä näkyvät sanat. Kuvat: `/mnt/project-files/kilsat-tiimi/loki/2-ui-ux-kuvat/ennen-minimalismi/`.

| Vaihe | Hallintoja ruudulla | Sanoja ruudulla | Jakauma |
|---|---:|---:|---|
| Tarina | 53 | 223 | yläpalkki 13, vasen 3, näyttämö 23, oikea 14 |
| Roolitus | 45 | 767 | yläpalkki 13, vasen 8, näyttämö 7, oikea 11, aikajana 6 |
| Storyboard | 40 | 222 | yläpalkki 13, vasen 12, näyttämö 1, oikea 14 |
| Kuvaus | 46 | 231 | yläpalkki 13, vasen 12, näyttämö 7, oikea 14 |
| Leikkaus | 64 | 458 | yläpalkki 13, vasen 13, näyttämö 7, oikea 14, aikajana 17 |
| Työpaja | 57 | 280 | yläpalkki 13, vasen 31, näyttämö 12, oikea 1 |

Mittaus ei ole käyttäjäkoe eikä pakattu Mac-sovellus: Linux-pilvessä ei voi rakentaa Mac-sovellusta, joten katsoin web-versiota. Sama käyttöliittymäkoodi on molemmissa, mutta pakatun sovelluksen näkymä on tarkistamatta.

### Havainnot, tärkeysjärjestyksessä

1. **Oikea paneeli on sama joka vaiheessa.** Kuvauksessa ja Leikkauksessa (ja Storyboardissa) oikealla on "Ääni · aaltomuoto ja puheen teksti", "Ääni ja videovienti", "Animaation työkalut" ja "Muunnos · liike ja avainruudut" sekä lomake (Liike X/Y, Kierto, Koko, Peittävyys, Siirtymä, kolme painiketta), vaikka mitään tasoa ei ole valittu. Kentät ovat käyttökelvottomia, mutta vievät puolet paneelista. Lisäksi samat toiminnot ovat vaiheessa, jonka päätehtävä on aivan muu (Storyboard: kuvakortit, mutta oikealla äänityskenttiä).
2. **Vasen paneeli näyttää käsikirjoituksen työkalut vaiheissa, joissa käsikirjoitus on lukittu.** Storyboard, Kuvaus ja Leikkaus näyttävät "Tuo tekstitiedosto", "Esimerkit", "Uusi kohtaus", "Tallenna käsikirjoitusteksti", "Syntaksi", "Esimerkki-animaatio", kaksi selittävää laatikkoa ("lukittu tässä työvaiheessa", "Laajempi näkymä: työvaihe Tarina") ja pienen kopion käsikirjoituksesta. Kaikki tämä on luettavaa mutta ei käytettävää. Bannerit selittävät rakennetta, eivät auta tekemään.
3. **Roolitus on tekstimuuri.** 767 sanaa: pitkä kappale hahmotasoista, jokaisen hahmokortin kuvaus ja laatuteksti ("3 kulmaa · 5 suuta · koko vartalo"), "Lataa ja muokkaa" jokaisessa kortissa. Oikealla samaan aikaan Kamera/Mikrofoni/Näppäimet-kortit, kameraseuranta, "Valmiit liikkeet" ja äänipuolen lomakkeet.
4. **Yläpalkissa on 13 hallintaa.** Projektivalikko, viisi vaihetta, Työpaja, haku, kumoa, tee uudelleen, Näytä, Tallenna ja Vie. Vie on kirkas painike joka vaiheessa, vaikka vienti kuuluu vain Leikkaukseen.
5. **Aikajana on liian pieni juuri silloin, kun sitä tarvitaan.** Leikkauksessa aikajana saa noin kolmanneksen korkeudesta ja siitä näkyy kaksi raitaa; "Pilota aikajana", "Valmis", toisto, "Kohtaus", "Mittaus", kumoa/tee uudelleen toisen kerran ja "Aikajanan asetukset" ovat omilla riveillään.
6. **Tekoäly ei löydy.** Tämä on se, minkä käyttäjä huomasi. Syyt koodista:
   - Web-versiossa "Pilvirenderöinti…" on vain projektivalikon alimpana rivinä (kirjaudu ulos -painikkeen yläpuolella) ja vain yksityisellä palvelimella (`VITE_PRIVATE_SERVER=true`). Sitä ei ole ⌘K-haussa (49 komentoa, ei yhtään tekoälyyn liittyvää), Näytä-valikossa eikä ominaisuuskartassa (`lib/studio-feature-map.ts`).
   - Työpöytäsovelluksessa tekoäly oli tekoälyasiantuntijan mukaan vain macOS:n valikkorivillä. Sovelluksen oma käyttöliittymä ei kerro tekoälystä mitään.
   - Tekoälyasiantuntija on jo tehnyt omassa haarassaan (`claude/tiimi-tekoaly-q1331b`) tilapaneelin `components/ai-panel.tsx` ja ilmoittanut TIIMI.md:ssä, että asettelu ja sijainti ovat minun päätettäviäni. Kohta 5 vastaa siihen.
7. **Kapea ruutu**: korjattu aiemmin (PR #17). Ei toistoa.

Mikä on jo hyvin: Tarina-vaihe (kirjoitusalue vie keskustan), Kuvaus-vaiheen näyttämö (hahmo isona keskellä), ⌘K kattaa 49 toimintoa ja ominaisuuskartan testi valvoo, ettei mikään putoa pois.

## 2. Periaatteet

1. **Yksi päätehtävä per vaihe, yksi aksenttipainike.** Painike on seuraava looginen askel ("Roolitus →", "Rakenna kuvakortit", "Vie jakso"). Muut painikkeet ovat hiljaisia.
2. **Kolme kerrosta.** (a) Näkyy aina: päätehtävä. (b) Yksi klikkaus: Tarkastelija näyttää vain valitun asian tiedot; ilman valintaa tyhjä tila. (c) "Lisää ⋯" (jokaisessa vaiheessa yksi) ja ⌘K: harvinaiset ja tekniset.
3. **Ei lomakkeita ilman kohdetta.** Liike/Kierto/Koko-kentät näytetään vasta, kun taso on valittu. Muuten paneelissa on yksi rivi: "Valitse hahmo tai osa näyttämöltä."
4. **Ei bannereita, jotka kertovat mitä ei voi tehdä.** Lukittua käsikirjoitusta ei näytetä muokkaustyökaluina lainkaan; sen tilalla on vaiheen oma sisältö. Yksi pieni rivi "Muokkaa Tarinassa" riittää.
5. **Paneelit pysyvät mounted.** AGENTS.md vaatii: piilotus tehdään `hidden`-attribuutilla ja PanelDockin persistent-hosteilla, ei purkamalla. Siksi kaikki tässä suunnitelmassa on "näkymättömäksi", ei "poistettu komponentti".
6. **Mittari vartioi.** Lisätään DOM-laskuri (kohta 8), joka epäonnistuu, jos vaiheen näkyvien hallintojen määrä ylittää budjetin.

### Budjetit (ehdotus, 1440 × 900, oletustila)

| Vaihe | Hallintoja yhteensä | Sanoja |
|---|---:|---:|
| Tarina | ≤ 25 | ≤ 150 |
| Roolitus | ≤ 30 | ≤ 200 |
| Storyboard | ≤ 25 | ≤ 150 |
| Kuvaus | ≤ 30 | ≤ 150 |
| Leikkaus | ≤ 35 | ≤ 150 |
| Työpaja | ≤ 40 | ≤ 200 |

Yläpalkki enintään 9 hallintaa joka vaiheessa. Luvut ovat lähtötaso mittauksesta; tarkennan ne ensimmäisen toteutuksen jälkeen.

## 3. Yläpalkki

Nyt 13, tavoite 9:

`[KOETA · projektivalikko ▾]  Tarina · Roolitus · Storyboard · Kuvaus · Leikkaus  |  Työpaja  |  ⌘K  |  ↶ ↷  |  [aksenttipainike]`

- **Näytä-valikko** siirtyy projektivalikkoon ("Näkymä" -alivalikko) ja ⌘K:hon. Sisältö säilyy: paneelien näyttö, aikajana, keskity näyttämöön, palauta koot, sovita, ulkoasu.
- **Tallenna** siirtyy projektivalikkoon (⌘S säilyy). Tallennustila näkyy projektivalikon pisteenä (jo nyt oranssi piste = tallentamaton) ja tekstinä valikossa. Tallennus on silti yhden klikkauksen päässä ja ⌘S.
- **Aksenttipainike on vaiheen seuraava askel**, ei aina "Vie…": Tarina "Rakenna jakso", Roolitus "Storyboardiin", Storyboard "Kuvaukseen", Kuvaus "Leikkaukseen", Leikkaus "Vie". Painikkeen toiminta on olemassa olevat funktiot (vaiheen vaihto, rakennus, vienti); mitään uutta toimintoa ei keksitä.
- Kumoa/Tee uudelleen pysyvät (ammattityökaluissa aina näkyvissä).

## 4. Vaihekohtaiset näkymät

Sarakkeet: **Näkyy oletuksena** (kerros a) · **Tarkastelijassa** (kerros b) · **Lisää ⋯ / ⌘K** (kerros c). Nykyiset komentotunnisteet ja kodit ovat `lib/studio-feature-map.ts`:ssä; tämä taulukko on sen kehityssuunta, ei uusi rinnakkainen kartta.

### 1 Tarina
- Näkyy: käsikirjoitus isona kirjoitusalueena, merkintäreunat, "Työkalut /".
- Vasen: ei mitään paitsi Dialogi/Yhden hahmon liikkeet -kytkin. Esimerkit ja Tuo tiedosto siirtyvät "Työkalut /" -palettiin ja tyhjän tilan painikkeisiin (jo olemassa).
- Tarkastelijassa: tunnistuksen tarkistus ja korjausehdotukset valitulle riville.
- Lisää/⌘K: syntaksiohje, uusi kohtaus (säilytä nykyinen), tallenna käsikirjoitusteksti, keskittymistila.
- Aksentti: "Rakenna jakso".

### 2 Roolitus
- Näkyy: hahmokortit pienenä ruudukkona (kuva + nimi + yksi painike), puhuja → hahmo -taulukko, kuvausympäristön valinta.
- Poistuu ruudulta (säilyy): selittävä kappale, korttien kuvaukset ja laatuteksti (siirtyvät kortin vihjeeseen ja Tarkastelijaan), "Lataa ja muokkaa" (korttien ⋯), Luonnokset (kiinni, kuten nyt), live-esityksen kamera/mikrofoni/näppäimet-kortit ja kameraseuranta (siirtyvät tämän vaiheen Tarkastelijaan välilehdelle "Esitys" ja Kuvaukseen).
- Aksentti: "Storyboardiin".

### 3 Storyboard
- Näkyy: kuvakortit koko keskialueella (jo nyt), korttien järjestys, hyväksyntä.
- Vasen ja oikea paneeli: piilossa oletuksena (näytä ⌘ + paneelinäppäimellä tai Näkymä-valikosta). Kortin valinta avaa oikealle Tarkastelijan: kuvan tiedot, kommentit, tehtävät.
- Lisää/⌘K: työjono ja tehtävät, tarkistuskommentit, CSV-vienti.
- Aksentti: "Kuvaukseen".

### 4 Kuvaus
- Näkyy: valittu kuva näyttämöllä (jo nyt), kuvanauha, kuvakulma, keskitys/zoom näyttämön alla.
- Vasen: kuvanauha / kohtauslista. Käsikirjoituksen työkalut pois (kohta 1, havainto 2).
- Tarkastelija: **vain valitulle osalle**: liike, ilme, kamera, ääni (repliikin äänitys). Ilman valintaa: "Valitse hahmo tai osa näyttämöltä."
- Lisää/⌘K: liiketyökalut (käyrä, tilakone, kävely, IK, suu), näyttämön muoto/turva-alue, live-ohjaus.
- Aksentti: "Leikkaukseen".

### 5 Leikkaus
- Näkyy: esikatselu + **aikajana vähintään 40 % korkeudesta**, toista/tauko, ajanilmaisin.
- Vasen: jaksot ja sarja (jo oma välilehti). Käsikirjoitus pois.
- Tarkastelija: valitun raidan/leikkeen asetukset, ääni ja musiikki.
- Lisää/⌘K: Aikajanan asetukset, Mittaus, PNG-kuvasarja, CSV, tuotantotilanne.
- Aksentti: "Vie jakso" (MP4), jakson jälkeen "Lisää sarjaan".

### Työpaja
Pysyy erillisenä osastona. Vasemmassa paneelissa 31 hallintaa → tasopuu + haku (tavoite ≤ 12); piirto/nivelet/tuonnin tarkistus ovat näyttämön työkalupalkissa kuten nyt. Suupaketit ja nivelehdotukset Lisää ⋯:an.

## 5. Tekoäly

Periaate: tekoäly näytetään **tilana ja ehdotuksina siellä, missä sitä käytetään**, ei omana pelottavana osastona. Vain todelliset toiminnot; ei valepainikkeita (AGENTS.md).

1. **Pysyvä tila alapalkissa.** Kamera / Mikrofoni / Näppäimet -chipien viereen chip "Tekoäly: paikallinen" tai "Tekoäly: pilvi pois / päällä". Klikkaus avaa tilapaneelin. Tämä korjaa sen, ettei tekoäly näy.
2. **Tilapaneeli (`components/ai-panel.tsx`, tekoälyasiantuntijan sisältö).** Ensimmäisessä toteutuksessa dialogi, kuten nyt. Sitten Tarkastelijan välilehti "Tekoäly" PanelDockin persistent-hostilla, jotta se on auki viereisen työn kanssa. Sisältö ja tekstit ovat tekoälyasiantuntijan; asettelu ja luokat minun.
3. **Kolme sisäänkäyntiä.** Näytä → Tekoäly (projektivalikon Näkymä-alivalikko), ⌘K "Tekoäly: tilat ja pilvi" ja alapalkin chip. Sama funktio kaikissa.
4. **Konteksti.** Korjausehdotukset (Tarina) ja kuvaehdotukset (Kuvaus) näkyvät olemassa olevassa Korjausehdotukset-näkymässä "Ota käyttöön" -painikkeella. Pilvirenderöinti on Leikkauksen vientivalikossa: "Vie tekoälyrenderöitynä…" (avaa nykyisen dialogin). Käyttäjä ei tarvitse tietää, mikä on "pilvirenderöinti" etsiäkseen sitä.
5. **Pilvi on opt-in.** Mitään ei lähetetä ilman lupaa (AGENTS.md). Käyttöliittymä näyttää aina, onko pilvi pois päältä, ja jos on, miten sen saa päälle (yksi rivi + painike, ei ohjetta tekstimuurina).
6. **Avoin kysymys käyttäjälle ja tekoälyasiantuntijalle.** AGENTS.md sanoo yhä: "the desktop app does not use [cloud render]". Tekoälyasiantuntijan haara lisää pilvirenderöinnin työpöydälle. Jos käyttäjä käyttää Mac-sovellusta, tämä ratkaisee, näkyykö tekoäly siellä lainkaan. Päätös on kirjattava ennen kuin käyttöliittymä lupaa sen.

## 6. Pikanäppäimet

Nykyiset säilyvät: ⌘K haku, ⌥1–⌥5 vaihe, ⌥6 Työpaja, ⌘S, ⌘Z, ⇧⌘Z, välilyönti toisto. Lisäys: **⌥→ / ⌥←** seuraava/edellinen vaihe (sama kuin aksenttipainike) ja **⌘\\** piilota/näytä Tarkastelija. Kaikki ilmestyvät ⌘K-haun riveille ja painikkeiden vihjeteksteihin, jotta ne löytyvät ilman oppaan lukemista.

## 7. Tyhjä, lataus, virhe ja onnistuminen

Nyt tilat ovat hajallaan (osa bannereita, osa lomakkeita ilman kohdetta). Yksi malli koko sovellukseen:

| Tila | Näkyy | Esimerkki |
|---|---|---|
| Tyhjä | Yksi lause + yksi painike | Tarina: "Vedä käsikirjoitus tähän" + "Kokeile esimerkkiä" (jo hyvä). Kuvaus ilman valintaa: "Valitse hahmo näyttämöltä." |
| Lataus | Paikalla pysyvä luuranko tai "Ladataan…" ja peruutus, jos yli ~2 s | PSD-tuonti, esimerkin lataus, vienti |
| Virhe | Mitä tapahtui + mitä tehdä + yksi painike ("Yritä uudelleen" / "Avaa tarkistus") | Tuonnin virhe → "Tarkista tuonti" |
| Onnistuminen | Hetkellinen rivi alapalkissa; ei modaalia | "Tallennettu", "Jakso rakennettu: 12 kuvaa" |
| Estetty | Syy yhdellä rivillä painikkeen vieressä, ei bannerina | "Vie: hyväksy ensin 2 kuvaa" |

## 8. Mittari ja testit

- **Hallintolaskuri** (`scripts/ui-census.mjs`, Playwright): sama laskenta kuin kohdan 1 taulukossa, ajettavissa `npm run` -skriptinä; epäonnistuu budjetin ylityksestä. Ei kuulu `npm test`:iin ennen kuin se on vakaa, koska se tarvitsee selaimen.
  - **Sisältösääntö (9.10.2026):** käyttäjän sisältö ei kuulu budjettiin. Laskuri erottaa omaan "sisältö"-sarakkeeseensa aikajanan raidat, avainruudut ja kuvanauhan kuvat (`.animation-tracks`, `.block-lane`, `.presentation-track`, `.shot-timeline-track`), storyboardin kuvakortit (`.resolve-shot-card`), hahmokirjaston kortit (`.character-card`), käsikirjoituksen rivit ja tapahtumalistan (`.script-line-field`, `.production-source-list`) sekä tasopuun (`.layer-tree`). Tunnistus vain luokilla, ei sijainnilla; lista on `scripts/ui-census.mjs`:n `CONTENT_RULES`. Budjettiin lasketaan "kuorma" = muut hallinnat. Tuloste näyttää myös vyöhykkeet (yläpalkki, vasen, näyttämö, oikea, aikajana); `--json` ja `--list` (jokainen hallinta luokituksineen). Puhtaat apufunktiot testataan `server/ui-census.test.mjs`:ssä (`npm test`, ei selainta). Leikkauksen kuorma on 37 sekä 1440×900 että 1440×1200; muissa vaiheissa korkeampi ikkuna näyttää vielä oikeita käyttöliittymähallintoja vierityksen alta (esim. Storyboardin sivutus ja tarkistusosiot), ja ne lasketaan tarkoituksella.
- **Ominaisuuskartan testi** (`lib/studio-feature-map.test.ts`) säilyy ja laajenee: jokaisella uudella sisäänkäynnillä (Tekoäly-chip, Vie tekoälyrenderöitynä) on koti ja ⌘K-tunniste. Testaajan alue; teen vain omalle uudelle koodilleni tarvittavat päivitykset ja kirjaan ne.
- **Ensimmäisen jakson reitti**: tyhjästä esikatseluun enintään 4 toimintoa (Kokeile esimerkkiä → Rakenna jakso → Toista → Vie). Mitataan skriptillä web-versiossa. Pakatussa Mac-sovelluksessa tarkistamatta, kunnes joku ajaa sen.
- **Saavutettavuus**: kosketusalue ≥ 36 px kapeassa, näppäimistökulku kaikissa uusissa kohdissa, kontrasti tokenien kautta (`--s2-*`).

## 9. Toteutusjärjestys (vaiheittain, sovellus toimii jokaisen jälkeen)

| # | Muutos | Tiedostot (pääosin) | Riski |
|---|---|---|---|
| V0 | Hallintolaskuri ja lähtötaso | `scripts/ui-census.mjs` (uusi) | Ei vaikutusta käyttäjälle |
| V1 | Tyhjät tilat: Tarkastelija ei näytä lomakkeita ilman valintaa | `components/animation-panel.tsx` (vain renderöinnin ehto) | Pieni. Tämä on logiikan rajalla: muutan vain näytetäänkö lomake, en mitä se tekee. Ilmoitan TIIMI.md:ssä ennen muutosta |
| V2 | Vasen paneeli: käsikirjoituksen työkalut pois lukituissa vaiheissa (`hidden`, ei unmount) | `components/editor.tsx`, `styles/koeta-responsive.css` | Keskikokoinen; PanelDock-hostit säilytettävä |
| V3 | Oikea paneeli vaihekohtaiseksi: vain vaiheen välilehdet | `components/editor.tsx`, tyylit | Keskikokoinen |
| V4 | Yläpalkki 13 → ≈11, aksenttipainike = seuraava vaihe, Näytä ja Tallenna projektivalikkoon | `components/studio-shell.tsx`, `components/editor.tsx` | Keskikokoinen; testit `server/ui.test.mjs` päivitettävä |
| V5 | Roolitus: kompakti kortti, tekstit vihjeiksi | `components/asset-library.tsx`, tyylit | Pieni |
| V6 | Leikkaus: aikajana ≥ 40 %, kontrollit yhdelle riville | tyylit, `components/block-timeline.tsx`/aikajanan kuori | Pieni–keskikokoinen |
| V7 | Tekoäly: alapalkin chip, Näytä-sisäänkäynti, ⌘K, Vie tekoälyrenderöitynä; paneeli Tarkastelijan välilehdeksi | `components/ai-panel.tsx` (asettelu), `components/editor.tsx` | Riippuu tekoälyasiantuntijan haarasta; sovitaan TIIMI.md:ssä |
| V8 | Asiantuntijatila asetuksiin (tarkistussummat, journaali, palautuspisteet pois oletuksesta) | `components/accessibility-settings.tsx` | Pieni |

Jokaisen vaiheen jälkeen: kuvakaappaukset 1440/820/390, laskuri, `npm run typecheck`, `npm test`, kirjaus TIIMI.md:hen.

### Toteutustilanne 9.10.2026 (Claude)
- V7 osittain: alapalkin Tekoäly-painike (`aiChipLabel`, pilvi mainitaan vain luetusta tilasta), ⌘K "Vie tekoälyrenderöitynä…" (yksityinen palvelin ja työpöytä) ja sama painike työpöydän vientidialogissa. Näkymä-valikon Tekoäly… ja ⌘K-tilakomento olivat jo integraatiossa. Toisella agenttikierroksella Tarkastelijaan tuli Tekoäly-välilehti (ks. alla).
- V8: Asetukset → Asiantuntijatila (oletus pois). Pois ollessa `expert-detail`-luokan tiedot (versioiden SHA-256, viennin render-revisio, resurssiviitteet, tuotantokomentojen loki) piilotetaan CSS:llä; komponentit pysyvät mounted.
- V5: hahmokortti = kuva, nimi, Valitse ja Tiedot (kuvaus, laatu ja lataukset Tiedot-osiossa). Hahmokirjaston sanat 107 → 39 (1440 px).
- Agenttikierros (3 rinnakkaista agenttia, yhdistetty): V2 lukittujen vaiheiden vasen paneeli = yksi rivi "Muokkaa Tarinassa"; V5 Roolitus avautuu Näyttämö-välilehdelle ja laitekortit ovat Esitys-välilehdellä, Työpajan vasen paneeli 33 → 12; V6 aikajanan kontrollit yhdelle riville ja harvinaiset "Lisää ⋯" -osioon.
- Hallintolaskuri yhdistetyssä versiossa (1440×900, hallintoja/sanoja): Tarina 42/1089, Roolitus 54/306, Storyboard 35/245, Kuvaus 42/313, Leikkaus 50/481, Työpaja 37/96 (budjetissa). Lähtötaso samana päivänä: 42/1089, 53/775, 41/936, 48/1004, 45/1177, 58/327.
- Toinen agenttikierros (yhdistetty, main): Roolituksen/Kuvauksen Näyttämö-välilehden X/Y/Koko/Sovita keskelle suljetun "Tarkka sijainti" -osion taakse; V7 Tekoäly-välilehti Tarkastelijaan (yli 850 px ja oikea paneeli näkyvissä → välilehti, muuten dialogi; yhteinen `AiContent`); hallintolaskuri erottaa sisällön (raidat, kuvakortit, kirjastokortit, käsikirjoitusrivit, tasopuu) budjetista. Uusi lukema 1440×900 (kuorma/sisältö): Tarina 34/26, Roolitus 44/8, Storyboard 29/6, Kuvaus 40/2, Leikkaus 37/13, Työpaja 30/8 (vain Työpaja budjetissa).
- Kesken: Tarina-vaiheen keventäminen haarassa `claude/agentti-tarina` (`aa13c13`), ei yhdistetty eikä koordinoijan tarkistama.
- Jäljellä (vanha lista): vasemman paneelin siivous, V7 Tarkastelijan välilehti, hallintalaskurin budjetit.

### Yhteistyö ja ristiriitariski
`components/editor.tsx` on yhteinen tiedosto: tekoälyasiantuntija lisää siihen tilaa ja ⌘K-komennon omassa haarassaan. V2, V3, V4 ja V7 koskevat samoja rivejä. Ehdotus: V7 tehdään vasta, kun tekoälyasiantuntijan haara on yhdistetty hahmostudio1.0:aan (yhdistämisestä päättää käyttäjä), tai tehdään se heidän haarassaan heidän kanssaan. Muut vaiheet voivat edetä omassa haarassani, mutta yhdistämisessä editor.tsx-konflikteja on odotettavissa.

## 10. Mitä tämä suunnitelma ei lupaa

- **"ToonBoom-, Rive- ja Adobe-tasoinen" ei synny käyttöliittymästä yksin.** Käyttöliittymä voi tehdä työnkulusta selkeän ja nopean. Lopputuloksen laatu riippuu moottorista ja sisällöstä: hahmo- ja liikekirjaston laadusta, kameran avainruuduista, liikesumennuksesta, siirtymistä ja valo/värimäärittelystä (ks. `suunnitelmat/ammattistudio-suunnitelma.md` kohta 5, ehdotuksia eikä nykyisiä ominaisuuksia). En väitä tämän ottavan niitä kiinni; mittaan vain sen, mitä käyttöliittymä voi todistaa: askelmäärän, ruudun kuormituksen ja sen, että jokainen toiminto löytyy.
- Pakattua Mac-sovellusta, M1/VideoToolbox-vientiä tai oikeaa laitetta en ole tarkistanut. Mittaus on web-versiosta.
- Käyttäjäkoetta ei ole tehty. Budjetit ovat ehdotuksia, jotka tarkennetaan yhdessä ensimmäisen toteutuksen jälkeen.
