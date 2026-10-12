# Hahmostudio natiivina (Rust)

Puhdas Rust-työtila, johon Hahmostudio siirretään Electronista. Rakenne ottaa
mallia Storytold-ekosysteemistä (esim. FilmCraft): kerroksittaiset cratet, joista
alimmat eivät riipu käyttöliittymästä tai käyttöjärjestelmästä, yksi
käyttöliittymäcrate päällä, ja renderöinnin GPU- ja CPU-polut testataan toisiaan
vasten. Siirron tila ja Electronin poiston ehdot: [PARITEETTI.md](PARITEETTI.md).

```
hs-core       aikapohja (tikit), aikajana, diagnostiikka         ← ei riippuvuuksia UI:hin/OS:ään
hs-script     käsikirjoitusjäsennin (tagit → aikajana)
hs-motion     luuranko, IK, 5-sormiset kädet, kävely/juoksu, toisioliike
hs-character  parametrinen 3D-hahmo (mitat, kasvot, vaatteet)
hs-render     wgpu-GPU ja CPU-renderöijä, ääriviivat, lavasteet, esineet, PNG/MP4-vienti
hs-lipsync    visemit (Adobe Characterin tapaan) äänteistä tai äänestä
hs-voice      Kokoro-82M puhtaalla Rustilla (candle), mallivarasto, välimuisti
hs-audio      toisto, mikrofoni ja reaaliaikainen suu (cpal)
hs-camera     kamera ja pään seuranta (nokhwa, puhdas Rust, offline)
hs-hahmo      nykyisten .hahmo-projektien luku ja 2D-piirto
hs-agents     StudioAgent-trait ja agenttiputki
hs-cli        hahmostudio-cli (headless)
hs-app        hahmostudio (egui/eframe-työpöytäsovellus)
```

## Agenttiputki

| Agentti | Lukee | Kirjoittaa | Tehtävä |
| --- | --- | --- | --- |
| `ScriptParserAgent` | Script | Plan | Tagit riveiksi, rivikohtaiset huomautukset |
| `VoiceAgent` | Plan, CastParams, Voice | Audio | Kokoro-puhe tai oma äänitys riveille; ei arvaa puuttuvaa ääntä |
| `TimingAgent` | Plan, Audio | Timeline | Rivi kestää vähintään puheensa verran; leikkeet miksataan |
| `LipSyncAgent` | Timeline | LipSync | Visemit leikkeittäin (välimuistissa) |
| `CharacterMeshAgent` | Timeline, CastParams | Cast | Hahmot parametreista (rakentaa vain muuttuneet) |
| `ProceduralMotionAgent` | Timeline, Cast | Motion | Tilaton liikefunktio jokaiselle hahmolle |
| `CinematographyAgent` | Motion | Camera | Otokset, leikkaukset, ajot, kolmipistevalo |
| `RustRenderAgent` | Camera, RenderRequest | Output | GPU/CPU-renderöinti ja vienti |

Putki järjestää agentit `reads`/`writes`-paikkojen mukaan ja ajaa vain ne, joiden
syöte muuttui. Uuden agentin voi lisätä `Pipeline::register`-kutsulla.

## Käyttö

```sh
cd native
cargo run --release -p hs-app                       # työpöytäsovellus
cargo run --release -p hs-cli -- renderöi kasikirjoitus.txt -o jakso.mp4
cargo run --release -p hs-cli -- tarkista kasikirjoitus.txt
cargo run --release -p hs-cli -- hahmo ../Esimerkki-kavely.hahmo -o kavely/
cargo run --release -p hs-cli -- mittaa
cargo test --workspace
```

Puhemalli ladataan kerran luvalla (Ääni-välilehti tai `hahmostudio-cli ääni lataa`,
noin 330 MiB, Apache-2.0) tai tuodaan kansiosta (`ääni tuo <kansio>`); sen jälkeen
kaikki toimii ilman verkkoa. Malli tallentuu `~/Library/Application Support/hahmostudio/kokoro`
(muualla XDG-datahakemisto, tai `HAHMOSTUDIO_DATA_DIR`). Linuxissa käännös tarvitsee
`libasound2-dev`-paketin.

MP4-vienti käyttää FFmpegiä (`PATH` tai `HAHMOSTUDIO_FFMPEG`). Linuxissa ilman
näytönohjainta GPU-polun voi testata Mesan lavapipellä: `WGPU_BACKEND=vulkan`.

Käsikirjoitusesimerkki:

```text
[tausta olohuone]
[kuva laaja]
KALLE: Hei kaikki, jakso alkaa! [vilkuta 2s]
[kuva kaksikko]
MAIJA: Taasko sinä puhut kameralle? [odota 2s]
[kuva olan yli]
[esine kahvikuppi]
KALLE: Ne rakastavat minua. [nyökkää 2s]
[kuva alakulma]
EETU: Minä haluan olla tähti! [hyppää]
[tausta puisto]
RONJA: Laitan tästä viestin. [näpyttele puhelinta 3s]
```

Taustat: studio, studio valoisa, olohuone, keittiö, luokka, puisto, katu, kaupunki ilta,
autot ja puhelin. Kuvaohjeet: laaja, puolilähi, lähikuva, insertti, kaksikko, olan yli,
alakulma, yläkulma. Esineet: kahvikuppi, pizza, kirja, lahja, pallo, kukat, tölkki,
mikrofoni, pois. Tuntematonta ohjetta ei arvata, vaan siitä tulee rivikohtainen virhe.
Vienti on oletuksena pystymuodossa 1080×1920 (TikTok, Instagram Reels, YouTube Shorts);
`--koko 1920x1080` tekee vaakavideon YouTubeen.

## Natiivin sarjaprojektin tallennus (.koeta)

Tiedosto-valikossa **Uusi sarjaprojekti**, **Avaa sarjaprojekti (.koeta)**,
**Tallenna sarjaprojekti** ja **Tallenna sarjaprojekti nimellä** käsittelevät
koko sarjaa. Samassa valikossa voi nimetä sarjan ja jakson, muuttaa jaksonumeroa,
lisätä jakson ja vaihtaa jaksojen välillä. Jakson vaihto säilyttää nykyisen
jakson tilan muistissa; tallenna koko sarja levylle ennen sulkemista.

Version 1 projekti sisältää käsikirjoitukset, hahmoparametrit ja niiden
Kokoro-äänivalinnat, kuvakoon/fps:n, hyväksytyt puhehuomautukset, omat äänet ja
valmistuneen synteettisen puheen alkuperätietoineen ja foneemeineen. Puhe
säilytetään häviöttöminä f32-näytteinä ja SHA-256 tarkistetaan avatessa.
Mallipainoja, käyttäjän absoluuttisia polkuja tai laiteyhteyksiä ei tallenneta.

Tallennettu puhe voidaan toistaa ja viedä ilman asennettua mallia.
Tekstin, äänen, puhenopeuden tai käytössä olevan malliversion muutos mitätöi
vain siitä riippuvan tallennetun synteesin. Oma ääni on aina etusijalla;
alkuperäinen synteesi säilyy myös oman äänen rinnalla. Käsikirjoituksesta
poistetun rivin äänet säilyvät projektissa, eivätkä saman repliikin eri jaksojen
äänitykset sekoitu keskenään.

Tallennus tehdään taustasäikeessä tarkistettuun väliaikaistiedostoon ja
korvataan atomisesti. Epäonnistunut avaus säilyttää nykyisen projektin,
epäonnistunut tallennus aiemman tiedoston. Sarjan vaihtamisesta ja sovelluksen
sulkemisesta pyydetään tallentamattoman työn päätös. Tämä ei ole automaattinen
sarjan autosave eikä sähkökatkodurabiliteettilupaus. Vanhojen sovellusasetusten
käsikirjoitus/hahmot ja paikalliset äänitykset voidaan tallentaa ensimmäiseksi
.koeta-projektiksi; vanhoja tiedostoja ei poisteta.

`.koeta` on natiivin studion erillinen formaatti. Se ei korvaa eikä väitä
lukevansa vanhaa TypeScript-version `.sarja`-arkistoa tai kirjoittavansa
`.hahmo`-projekteja. V1 ei vielä sisällä tulevaa käsin editoitavaa aikajanaa,
tekstityksiä, kuvaeditoriresursseja tai autosave-historiaa. Kuva, liike ja kamera
rakennetaan nykyisistä käsikirjoitustageista. Formaatti ja rajat:
[hs-project/README.md](crates/hs-project/README.md).
