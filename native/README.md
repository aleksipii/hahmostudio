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
