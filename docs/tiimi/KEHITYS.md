# Ensimmäinen tiimityö: 3D-tyyli ja PSD-tuonnin ryhmäraja

## Koodista todettu

- `lib/toon-render.ts / renderToonCast` käytti kaikille hahmoille tummaa siluettia ja joillekin pinnoille .94-valosävyä. Hahmokohtainen tyyli puuttui.
- `components/production-board.tsx` tallentaa hahmoprofiilin change-polun kautta; uusi tyylivalinta käyttää samaa mekanismia kuin olemassa olevat värimuutokset.
- `lib/production-model.ts / validateProductionDetails` validoi valinnaisen renderStyle-kentän: vain flat/cel. Skeemaversiota ei nostettu; vanha kentätön profiili pysyy luettavana.
- Renderer käyttää myös vanhaa kirjastoprofiilia, kun kohtauksessa ei ole characterProfiles-kenttää. Globaalia oletusta ei muutettu, jotta tällaisen projektin kuva ei muutu hiljaisesti.
- `lib/psd-import.ts / readStructure` kävi tyhjän lapsilistan tarkistuksen syvyydellä 21. Nyt tyhjä lista palautuu ennen syvyysrajaa: täsmälleen 20 sisäkkäistä ryhmää hyväksytään, yli rajan oleva sisältö hylätään.
- `desktop/cloud-controller.mjs`, `desktop/main.mjs`, `lib/cloud-desktop.ts` ja `components/ai-panel.tsx` sisältävät desktopin pilvi-integraation. Juuren AGENTS.md:n väite sen puuttumisesta päivitettiin vastaamaan toteutusta; tämä ei todista oikeaa pilviajoa.

## Toteutetut muutokset

Ohjauspöydän Hahmot · 2D / 3D -näkymään tuli 3D-hahmon tyylivalinta: litteät väripinnat ilman reunaviivoja tai aiempi sävytetty tyyli. Valinta tallentuu hahmoprofiiliin. Litteä tyyli käyttää meshien perusvärejä; kolmioiden samanvärinen .5 px saumanpeitto säilyy antialias-rakojen ehkäisemiseksi, mutta tummaa siluettia ei piirretä. Luurankoa, painoja ja hahmopaketin aineistoja ei muutettu. Eksplisiittisen cel-profiilin outline-leveys huomioidaan; kentättömän vanhan profiilin aiempi 1.3 px leveys säilyy.

PSD:n tunnettu TODO-testi muutettiin tavalliseksi regressiotestiksi korjauksen yhteydessä. Testeille lisättiin litteä/legacy-tyyli, vanha kohtaus ilman profiilia, validointi ja .hahmo-tallennuksen roundtrip.

## Ehdotukset

- Tarkasta hahmot animaation ääriasennoissa ja lopullisessa MP4:ssa ennen ulkoasun hyväksyntää. Staattinen fixture ei osoita liikkeen saumatonta laatua.
- Toon-meshien hiukset/vaatteet ovat yksinkertaistettuja; vastaavuus PSD:n yksityiskohtiin tarvitsee erillisen taiteellisen päätöksen. Renderöintityyli ei ratkaise geometrian eroja.
- Tee AI-vertailukuva vasta hyväksytystä hahmoversiosta ja sido se version/hash-muutoksiin. Nykyistä hyväksyntäpolkua tulee kartoittaa ennen uutta toteutusta.
- Yhtenäistä liitteiden viiden/seitsämän roolin luettelot tämän kymmenen vastuualueen kanssa. Roolit eivät tarkoita kymmentä kokoaikaista työntekijää.

## Avoimet kysymykset ja todennuksen rajat

Kaikille vastuuille on prompti ja nykytilan tarkastelu; koko studion tai kaikkien liitteiden ominaisuuksien toteutusta ei merkitä valmiiksi tämän ensimmäisen muutoksen perusteella. Ei riippumatonta lopputarkastajaa: toteutus ja tämän kierroksen katselmointi ovat saman suorittajan työtä.

Eristetty Electron-fixture käyttää oikeaa komponenttia ja Canvas-rendereriä, ei paketoitua KOETA-sovellusta. Se ei testaa kameraa/mikrofonia, kuuntelua, koko editorin undo-ketjua, VideoToolbox-laitteistoa tai ComfyUI/GPU-ajoa. Kuvakaappaukset ovat tarkastusnäyttöä, eivät käyttäjän hyväksymiä AI-vertailukuvia. Mitään käyttäjän ääntä tai projektia ei lähetetty pilveen.

Työ tapahtuu erillisessä työkopiossa. Ei pushia, PR:ää, julkaisua tai asennetun sovelluksen korvausta. Electronin CLI täydensi hyväksytyssä GUI-ajossa puuttuvan binäärin jaettuun node_modules/electron-asennukseen; lähderepon lähdekoodia ja käyttäjätiedostoja ei muutettu.

## Todennettu tässä kierroksessa

- 1270/1270 testiä, ei ohituksia eikä TODO-testejä. Mukana todellisen FFmpeg/ffprobe-testivideon tarkistus.
- Typecheck ja private-build läpäisivät. Private-buildissa käytettiin `--configLoader runner` välttämään kirjoittaminen jaettuun node_modules-kansioon.
- Oikea Electron 44.5.1 darwin: React-tyylivalinta cel → flat, 600/1440 px ilman vaakaylivuotoa, 20 canvasia ja ei konsolivirheitä. Raportti: `todennus/preview-report.json`.
- `git diff --check` läpäisi. Lokit: `todennus/tests.log`, `typecheck.log`, `build.log`, `preview.log`.

## Kuvallinen avoin löydös

Vertailukuvissa vaatteen helma on sahalaitainen sekä flat- että aiemmassa cel-tyylissä. Meshien päällekkäisyys tai syvyyspiirto on mahdollinen syy, jota ei ole vielä todettu. 3D-hahmojen ulkoasun hyväksyntä pysyy avoimena. Näyttö: `todennus/3d-vertailut.png`. Tyylikorjaus ei ole väite koko hahmogeometrian tuotantovalmiudesta.
