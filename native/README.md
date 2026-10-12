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
hs-render     wgpu-GPU ja CPU-renderöijä, lavasteet, PNG/MP4-vienti
hs-hahmo      nykyisten .hahmo-projektien luku ja 2D-piirto
hs-agents     StudioAgent-trait ja agenttiputki
hs-cli        hahmostudio-cli (headless)
hs-app        hahmostudio (egui/eframe-työpöytäsovellus)
```

## Agenttiputki

| Agentti | Lukee | Kirjoittaa | Tehtävä |
| --- | --- | --- | --- |
| `ScriptParserAgent` | Script | Timeline | Tagit aikajanan tapahtumiksi, rivikohtaiset huomautukset |
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

MP4-vienti käyttää FFmpegiä (`PATH` tai `HAHMOSTUDIO_FFMPEG`). Linuxissa ilman
näytönohjainta GPU-polun voi testata Mesan lavapipellä: `WGPU_BACKEND=vulkan`.

Käsikirjoitusesimerkki:

```text
[tausta studio]
PIPSA: Hei! Tervetuloa mukaan. [vilkuta 2s]
[juokse oikealle 2s]
PIPSA: Laitan viestin. [näpyttele puhelinta 3s]
[tausta kaupunki ilta]
VILLE: Nähdään! [hyppää]
[kuva lähikuva]
PIPSA: Moikka! [nyökkää 2s]
```
