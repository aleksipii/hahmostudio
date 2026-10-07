# Cloud-tehtävä: käsikirjoituksesta valmis animaatiosarja yhdellä painalluksella

> Tämä tiedosto on itsenäinen tehtävänanto Claude Code -pilvi-istunnolle. Lue ensin `AGENTS.md`, tämä tiedosto, `docs/KASIKIRJOITUS-TUNNISTIN.md` ja `KEHITYSMUISTIO.md` (viimeiset osiot 2.0–2.3). Työskentele repossa `aleksipii/hahmostudio`, haarasta `hahmostudio1.0`. Tee työ omaan haaraan (`cloud/kasikirjoitus-sarjaksi`) ja avaa PR haaraan `hahmostudio1.0`. Älä pushaa suoraan `main`- tai `hahmostudio1.0`-haaraan. Älä muuta repon näkyvyyttä äläkä julkaise mitään.

## 1. Tavoite

KILSAT Studion Mac-työpöytäsovelluksessa käyttäjä liittää tai kirjoittaa sääntöpohjaisen käsikirjoituksen (suomi tai englanti) ja painaa **Rakenna jakso**. Sovellus tuottaa heti katsottavan ja muokattavan animaatiojakson (tai usean jakson sarjan), jossa on:

- oikeat **hahmot** oikeissa mittasuhteissa ja paikoissa
- **esineet**, jotka ovat oikeasti kiinni hahmossa: puhelin on kädessä jokaisessa ruudussa ja jokaisessa kuvakulmassa, ei "melkein kädessä"
- **kuvakulmat ja leikkaukset** käsikirjoituksen mukaan
- **taustat ja miljööt**
- **äänet**: repliikit (tuodut tai äänitetyt), äänitehosteet ja taustamusiikki
- **pehmeät, ammattimaiset liikeradat**: ennakointi, hidastus ja kiihdytys, jälkiliike, kaaret, ei nykimistä eikä liukuvia jalkoja

Käyttäjä voi muokata tulosta **palikoilla** (Rive-tyyliin): jokainen käsikirjoituksen tapahtuma on palikka aikajanalla ja tilakoneessa. Palikan voi siirtää, venyttää, poistaa tai sen parametreja voi muuttaa, ja muutos näkyy heti. Tavoite on ammattimainen mutta helppokäyttöinen ja nopea ohjelma.

## 2. Mitä on jo olemassa (älä tee uudelleen)

| Alue | Tiedostot | Tila |
|------|-----------|------|
| Sääntöpohjainen tunnistin (fi/en) | `lib/script-recognizer.ts`, testit `lib/script-recognizer.test.ts`, aineisto `tests/fixtures/scripts/` | Rivitilakone + sanasto: liikkeet, suunta, ilmeet (myös ilo, suru, pelko), katse (hahmo, puhelin, kamera), puhelin, tauot, rajoitukset, kuvat, siirtymät, kestot |
| Tiukka kielioppi | `lib/script-grammar.ts` (`#!kilsat`) | Tarkka komentomuoto, hyväksyy tunnistimen taivutusmuodot |
| Vapaa käsikirjoitus → esitysmalli | `lib/presentation-parser.ts`, `lib/presentation-direction.ts`, `lib/presentation-model.ts` | Tapahtumat (`Event`), osiot, sidokset, vaatimukset |
| Esitys → animaatio | `lib/presentation-compile.ts`, `lib/presentation-motion.ts`, `lib/screenplay.ts`, `lib/locomotion.ts`, `lib/inverse-kinematics.ts`, `lib/phone-actions.ts`, `lib/phone-prop.ts` | Liikkeet, ilmeet, katse, puhelin-IK, kävely (stance-IK profiilissa) |
| Renderöinti ja vienti | `lib/presentation-render.ts`, `lib/scene-render.ts`, `lib/toon-render.ts`, `lib/toon3d.ts`, `lib/mp4-export.ts`, `desktop/export-*.mjs` | 2D-leikkaushahmot, Cutout3D-paperitasot, toon3d, MP4 (H.264/AAC), Macin vientijono |
| Taustat, esineet | `lib/backgrounds.ts`, `lib/environment-library.ts`, `lib/prop-library.ts` | 2D-taustat ja -esineet |
| Hahmokirjasto | `public/library/*.hahmo`, `components/asset-library.tsx`, generaattorit `scripts/create-*.py/.mjs` | Mm. Pipsa, Ville, Taru, Ukko (2D + 3 kuvakulmaa) |
| Ääni | `lib/audio-analysis.ts`, `lib/presentation-audio.ts`, `components/dialogue-recorder.tsx`, Rhubarb-suunliike | Tuodut ja äänitetyt repliikit, suuasennot äänestä; **ei musiikkia, ei äänitehosteita, ei puhesynteesiä** (vaihe E0 lisää vain paikallisen Kokoro-synteesin) |
| Tuotantotyökalut | `lib/studio/*`, storyboard/kuva/aikajana-vaiheet | Hyväksyntä, lukitus, kommentit, revisiot, palautus |
| Käyttöliittymä | `components/studio-shell.tsx`, `components/editor.tsx`, `styles/studio2.css` | Viisi työvaihetta, ⌘K-haku |
| Tilakone- ja käyräeditori | `components/state-editor.tsx`, `components/easing-editor.tsx`, `lib/state-machine-model.ts`, `lib/easing-model.ts` | Perusversio |

Nykyiset testit: `npm test` (yli 1000, kaikki läpi). Tyypit: `npm run typecheck`. Koonnit: `npm run build`, `npm run desktop:build`.

## 3. Pysyvät rajoitteet (AGENTS.md:stä, älä riko)

- Kaikki käsittely paikallisesti: ei backendiä, tilejä, pilvilatauksia eikä ulkoisia malli-API-kutsuja.
- Älä keksi repliikkejä. Puhesynteesi on sallittu **vain paikallisella Kokorolla** (vaihe E0) ja vain käyttäjän luvalla; pilvipalvelut ja muut synteesimoottorit ovat kiellettyjä. Itse äänitetty tai tuotu repliikki ei koskaan ylikirjoitu synteesillä. Jos ääni puuttuu, jakso rakentuu silti, mutta puuttuva ääni näkyy tarkistuksessa.
- Musiikki ja äänitehosteet: vain omaa, ohjelmallisesti tuotettua (CC0) tai käyttäjän tuomaa. Ei kopioitua tai lisensoimatonta materiaalia.
- `.hahmo` v1–v5 ja `.sarja` pitää edelleen lukea. Vanhoja raitoja, ääniä ja hyväksyntöjä ei saa ylikirjoittaa hiljaa.
- Käsikirjoituksen teksti ei koskaan suorita koodia.
- Electronin turvaraja säilyy: context isolation, sandbox, ei Node-integraatiota renderöijässä, kapea validoitu IPC.
- Kerro rehellisesti, mikä on toteutettu, mikä arvioitu ja mikä puuttuu. Tunnistamatonta ohjetta ei arvata.
- Käyttöliittymä on suomeksi.

## 4. Toteutus vaiheittain

Tee vaiheet järjestyksessä. Jokainen vaihe on oma committinsa testeineen. Päivitä vaiheen jälkeen `KEHITYSMUISTIO.md` (kehitysvaihe, mikä valmis, seuraava työ).

### Vaihe A — Yhden painalluksen rakennus

1. Uusi palvelu `lib/episode-builder.ts`: `buildEpisode(scriptText, library, options) → { presentation, assets, animationPerActor, audioPlan, diagnostics }`.
   - Tunnistin → esitysmalli → automaattinen roolitus: puhuja sidotaan kirjaston hahmoon nimen, `@tunnus → HAHMO` -rivin tai `Resurssi hahmo X: paketti` -rivin perusteella. Muuten käytetään oletuspakettia ja tarkistukseen tulee merkintä.
   - Miljöö: `Tausta:`, `Miljöö:` ja kohtausotsikot (INT. KEITTIÖ) yhdistetään kirjaston taustaan (`environment-library.ts`) synonyymitaulukolla (keittiö, kitchen, olohuone, auto, katu, studio…). Ellei taustaa löydy, käytetään neutraalia taustaa ja tarkistukseen tulee virhe.
   - Esineet: puhelin ja muut kirjaston esineet otetaan käyttöön ohjeista (`puhelin kädessä`, `with her phone`).
2. Käyttöliittymä: Käsikirjoitus-vaiheen **Rakenna jakso** -painike ajaa koko ketjun yhdellä kumottavalla transaktiolla (`DurableCommandGate`). Edistymispalkki näyttää vaiheet (tunnistus, roolitus, liikkeet, ääni, valmis).
3. Usean jakson sarja: `---`-rivi tai `Jakso 2:` -otsikko aloittaa uuden jakson. Jaksot tallennetaan `.sarja`-muotoon.

**Hyväksyntä:** `tests/fixtures/scripts/`-aineiston ja `public/library/*.md`-käsikirjoitusten rakennus onnistuu ilman virheitä, jos resurssit ovat olemassa. Rakennus on deterministinen (sama syöte tuottaa saman tuloksen tavu tavulta). 60 sekunnin jakso rakentuu M1-Macilla alle 2 sekunnissa (mittaa ja kirjaa `docs/benchmarks/`).

### Vaihe B — Esineet oikeasti kiinni

1. Esineillä on **tartuntapiste** (grip) ja **suunta** esineen omassa koordinaatistossa, ja kädellä on vastaava tartuntapiste jokaisessa kuvakulmassa (`QuickProfile`-laajennus `grips`, valinnainen, vanhat paketit toimivat ilman).
2. Esineen muunnos lasketaan joka ruudussa käden lopullisesta maailmanmatriisista (`animationTransforms`) eikä arvioidusta paikasta. Sama polku esikatseluun, vientiin ja toon3d:hen.
3. Käden ja esineen piirtojärjestys: sormet esineen päällä edessä olevassa kädessä.
4. Kirjastoon vähintään: puhelin, kahvikuppi, kirja, laukku ja sateenvarjo, kukin 2D:nä ja kolmena kuvakulmana.

**Hyväksyntä:** testi, joka käy läpi jokaisen ruudun kaikissa kuvakulmissa ja tarkistaa, että esineen tartuntapisteen ja käden tartuntapisteen etäisyys on alle 0,5 px (dokumentin koordinaatistossa) koko ajan, kun esine on "kädessä". Testi myös puhelimen siirrolle kädestä toiseen ja pöydälle laskulle.

### Vaihe C — Ammattimaiset liikeradat

1. Liikekirjasto `lib/motion-library.ts`: jokainen liike (kävely, juoksu, vilkutus, nyökkäys, osoitus, istuminen, hyppy, kyykky, reaktiot) koostuu vaiheista **ennakointi → toiminta → jälkiliike → asettuminen**, ja niillä on omat Bezier-käyrät (`easing-model.ts`).
2. Päällekkäinen toiminta: pää, kädet ja vartalo eivät ala samassa ruudussa (2–4 ruudun porrastus). Kaaret kyynärpäälle ja ranteelle.
3. Siirtymät liikkeiden välillä: liikkeen loppuasento sulautuu seuraavan alkuun (ei hyppyä nolla-asentoon). Lepo-hengitys ja silmänräpäykset luonnollisin välein, ellei ohje kiellä.
4. Kävely: jalat eivät liu'u (stance-IK myös etunäkymässä), askelpituus suhteessa hahmon kokoon, kävelynopeus siirtymän ja keston mukaan.
5. Laatumittarit testeinä: nivelen kulmanopeuden jatkuvuus avainruutujen saumassa (ei porrasta), kulmakiihtyvyyden yläraja (jerk), jalan tukivaiheen liukuma alle 1 px, ei kahta näkyvää kuvakulmajuurta samassa ruudussa.

**Hyväksyntä:** mittarit läpäistään kaikille kirjaston hahmoille ja kaikille liikkeille. Visuaalinen tarkistus: renderöi kustakin liikkeestä kuvasarja (`scripts/render-motion-sheets.ts`) ja liitä PR:ään.

### Vaihe D — Oikeat mittasuhteet ja sommittelu

1. Jokaiselle hahmopaketille vertailukorkeus (pää–jalkapohja) ja hahmotyyppi (lapsi, aikuinen, robotti). Näyttämö skaalaa hahmot yhteiseen mittakaavaan (esim. aikuinen 1,0, lapsi 0,72).
2. Esineet skaalataan käden koon mukaan ja taustat lattiaviivan ja horisontin mukaan. Hahmojen jalat ovat lattiaviivalla.
3. Kuvakoot: laaja, puolikuva ja lähikuva rajaavat hahmon pään ja silmien mukaan (kolmanneksen sääntö, katsesuuntaan tilaa). Kahden hahmon kohtauksessa 180 asteen sääntö säilyy.

**Hyväksyntä:** testit hahmojen jalkojen y-koordinaatille lattiaviivalla (±2 px), esineen ja käden kokosuhteelle sekä lähikuvan silmälinjalle (±5 % kuvan korkeudesta).

### Vaihe E0 — Paikallinen puhesynteesi (Kokoro), ennen äänitehosteita ja musiikkia

Tee tämä vaihe ennen vaihetta E. Se kumoaa aiemman ehdottoman puhesynteesikiellon **vain Kokoron osalta** (ks. AGENTS.md, merkintä E0).

1. **Moottori ja malli.** Puhesynteesi tehdään paikallisella Kokoro-moottorilla. Malli **ladataan käyttäjän nimenomaisella luvalla sovelluksen tietokansioon** (ei projektikansioon). Mallia ei lisätä sovelluspakettiin (`.app`), repoon, `.hahmo`-/`.sarja`-tiedostoihin eikä `public/`-kansioon. Lataus on ainoa verkkoyhteys, ja se alkaa vain käyttäjän vahvistuksesta (näytä lähde, koko ja lisenssi). Tarkista ladatun tiedoston tarkistussumma ja kirjaa malliversio. Lataus on peruttavissa ja mallin voi poistaa asetuksista. Ilman mallia kaikki muu toimii ennallaan.
2. **Merkintä.** Jokainen syntetisoitu rivi merkitään näkyvästi **Kokoro · synteettinen** (aikajana, repliikkilista, tarkistuslista ja vientiraportti). Merkintä ja malliversio tallentuvat `AudioClip`-metatietoon (valinnainen kenttä; vanhat projektit ilman sitä pysyvät luettavina).
3. **Suoja äänitettyä ja tuotua ääntä vastaan.** Itse äänitetty tai tuotu repliikki ei koskaan ylikirjoitu synteesillä: synteesi luo vain rivin, jolla ei vielä ole ääntä, tai erillisen uuden version, jonka käyttäjä hyväksyy erikseen. Palautus alkuperäiseen toimii (nykyinen SHA-256-polku). Synteesi on kumottava transaktio.
4. **Tuntemattomat tunteet ja ohjeet.** Tunteet ja lausumisohjeet, joita Kokoro ei osaa (esim. `(whispers)`), **näytetään huomautuksena eikä niitä arvata tai approksimoida**. Rivi syntetisoidaan neutraalisti vain, jos käyttäjä hyväksyy huomautuksen. Kielituki tarkistetaan mallin dokumentaatiosta (esim. suomen kielen tuki ei saa olla oletus): tukematon kieli estetään huomautuksella eikä ääntä arvata.
5. **Testit.** Testeissä käytetään **korvaavaa testimoottoria** (deterministinen, ei verkkoa, ei mallitiedostoa), jotta pilvi-ympäristö ei lataa mallia. Testaa: lupa ennen latausta, vanhan ääniresurssin säilyminen, merkintä, tukemattoman tunteen huomautus, `.hahmo`-roundtrip ja peruutus.
6. **Mittaus.** Muistin ja nopeuden mittaus jää käyttäjän Macille. Pilvessä niitä ei mitata eikä niille anneta lukuja; kirjaa ne `docs/benchmarks/`-kansioon todentamattomina, kunnes käyttäjä on ajanut ne.
7. **Rajaus.** Ei pilvisynteesiä, ei äänen kloonausta, ei muita moottoreita ja ei keksittyjä repliikkejä. Synteesi toimii vain olemassa olevista repliikkiriveistä.

**Hyväksyntä:** testimoottorilla syntetisoitu rivi saa merkinnän, ei ylikirjoita äänitettyä tai tuotua ääntä, tukematon tunne tuottaa huomautuksen, eikä mikään testi tee verkkopyyntöä. Mallin lataus, muisti ja nopeus ilmoitetaan todentamattomina Macilla.

### Vaihe E — Äänet ja musiikki

1. Äänitehostekirjasto: ohjelmallisesti tuotetut (Web Audio, offline-render) askeleet, ovi, puhelimen värinä ja soitto, napautus, whoosh ja istuutuminen. Tunnistin liittää tehosteet liikkeisiin ja esineisiin automaattisesti (askel kävelyn tukivaiheeseen).
2. Taustamusiikki: ohjelmallinen, alkuperäinen (CC0) musiikkigeneraattori tunnelmilla (iloinen, jännittävä, rauhallinen, surullinen) ja `Musiikki: iloinen` -ohje käsikirjoitukseen, tai käyttäjän tuoma tiedosto. Ducking: musiikki hiljenee repliikkien alle.
3. Miksaus vientiin: repliikit, tehosteet ja musiikki omina raitoinaan (`AudioClip` + uusi `soundCues`-kenttä, valinnainen).
4. Repliikit: tuodut, äänitetyt tai vaiheen E0 paikallisella Kokorolla syntetisoidut (merkintä **Kokoro · synteettinen**). Mikään muu synteesi ei ole sallittu.

**Hyväksyntä:** vienti tuottaa MP4:n, jossa on kolme miksattua lähdettä. Testit tehosteiden ajoitukselle (askel ±1 ruutu tukivaiheen alusta) ja duckingille.

### Vaihe F — Palikkaeditori (Rive-tyyliin)

1. Jokainen esitystapahtuma on **palikka**: liike, ilme, katse, esine, kamera, tausta, ääni ja tauko. Palikat ovat raidoilla hahmoittain ja tyypeittäin aikajanalla.
2. Palikan voi vetää (ajoitus), venyttää (kesto), kopioida ja poistaa. Inspector näyttää parametrit (suunta, voimakkuus, käyrä, kohde) ja esikatselu päivittyy alle 100 ms:ssa.
3. **Kaksisuuntainen synkronointi**: palikan muutos päivittää käsikirjoitustekstin vastaavan rivin (säilyttäen käyttäjän muotoilun), ja tekstin muutos päivittää palikat. Ristiriidat näytetään, eikä niitä ratkaista hiljaa.
4. Tilakonenäkymä (`state-editor.tsx`): hahmon lepo-, puhe-, kävely- ja reaktiotilat ja siirtymäehdot, kuten Riven state machinessa.
5. Kirjasto-paneeli: vedä uusi palikka (esim. "Vilkuta") aikajanalle.
6. Kaikki muutokset ovat kumottavia yhteisessä projektihistoriassa.

**Hyväksyntä:** testit palikka → teksti → palikka -kierrokselle (identtinen tulos), ajoituksen siirrolle ja lukitun kuvan suojaukselle. Pikanäppäimet ja saavutettavuus (näppäimistöllä siirto, ruudunlukijan nimet).

### Vaihe G — Nopeus ja viimeistely

1. Esikatselu 60 fps kahdella hahmolla 1080×1920-näyttämöllä (mittaa `npm run playback:benchmark`). Raskas laskenta workeriin.
2. Rakennus alle 2 s per 60 s jakso, vienti reaaliaikaa nopeampi VideoToolboxilla.
3. Ensikäyttö: tyhjästä projektista valmiiseen jaksoon kolmella toimenpiteellä (Esimerkki → Rakenna jakso → Vie).

## 5. Esimerkkisyöte, jonka pitää toimia lopussa

```text
Jakso 1: Pysäköintisakko
Musiikki: rauhallinen

INT. KEITTIÖ - AAMU
Mira seisoo ikkunan vieressä puhelin kädessä.

MIRA:
“Siirsitkö auton eilen?”

Niko kävelee sisään vasemmalta kaksi sekuntia.
Hän pysähtyy ja katsoo Miraa.

LÄHIKUVA MIRA
Mira näyttää Nikolle puhelinta.
Niko istuutuu ja näyttää surulliselta.
Mira hymyilee ja katsoo kameraan.
HÄIVYTYS MUSTAAN
```

Odotettu tulos: keittiötausta, Mira vasemmalla puhelin kädessä joka ruudussa, Niko kävelee oikealle jalat liukumatta, lähikuva rajautuu Miran silmälinjaan, puhelimen näyttäminen IK:lla kättä ojentaen, Niko istuu pehmeästi, surusuu ja hymy-suu, katse kameraan ja häivytys. Rauhallinen musiikki hiljenee repliikin alle. Jokainen tapahtuma näkyy palikkana ja on muokattavissa.

## 6. Raportointi

- Jokaisen vaiheen PR-kuvaukseen: mitä tehtiin, testien määrä ennen ja jälkeen, mittaustulokset ja kuvakaappaukset tai kuvasarjat sekä mitä jäi kesken.
- Erottele kooditestit, simuloidut tarkistukset ja oikealla Macilla tehdyt tarkistukset. Pilvessä ei voi testata Macin kameraa, mikrofonia tai VideoToolboxia; merkitse ne todentamattomiksi.
- Älä väitä vapaan luonnollisen kielen ymmärrystä. Tunnistin on sääntöpohjainen.
