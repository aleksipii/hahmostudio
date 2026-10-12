# Pariteettilista: Electron/TypeScript → natiivi Rust

Tämä lista ratkaisee, milloin Electron, `package.json`, `node_modules` ja web-asetukset
voidaan poistaa. **Poisto tehdään vasta, kun jokainen "Pakollinen ennen poistoa"
-rivi on tilassa ✅ ja todennettu oikealla laitteella.** Poisto tehdään omana
committinaan. Tila päivitetään aina, kun natiiviversio etenee.

Merkinnät: ✅ valmis ja testattu · 🟡 osittain · ❌ puuttuu · ➕ uusi natiivissa

## Pakollinen ennen Electronin poistoa

| Alue | Nykyinen toteutus (TS) | Natiivi (Rust) | Tila |
| --- | --- | --- | --- |
| Käsikirjoituksen perussäännöt | `lib/screenplay.ts` | `hs-script` (samat tagit, rajat, ei arvauksia) | ✅ |
| Laaja käsikirjoitustunnistin (FI/EN, ilmeet, katseet, kuvakoot, kameraliikkeet, sanasto) | `lib/script-recognizer*.ts`, `lib/episode/`, `script-grammar.ts` | — | ❌ |
| Palikkaeditori (lohkot, vapaa ajoitus, Alt-pudotus, raahaus) | `lib/blocks.ts`, `components/` | — | ❌ |
| Jaksorakentaja ja korjausehdotukset | `lib/episode-builder.ts`, `review-suggestions.ts` | — | ❌ |
| `.hahmo` v1–v5 luku | `lib/project-file.ts` | `hs-hahmo` (perusrakenne, kuvat, rig, raidat) | 🟡 |
| `.hahmo` kirjoitus, resurssimanifesti, tarkistussummat, historia | `lib/project-file.ts`, `lib/studio/` | — | ❌ |
| `.sarja`-jaksot | `lib/series-archive.ts` | — | ❌ |
| PSD-tuonti (ID:t, hierarkia, rajat 100 MiB / 16 MP / 1000 tasoa) | `lib/psd-import.ts`, `psd.worker.ts` | — | ❌ |
| 2D-rigin muunnokset ja easing (linear/smooth/hold/bezier) | `animation-transform.ts`, `animation-model.ts` | `hs-hahmo` (sama kaava) | ✅ |
| 2D-tasojen piirto | `psd-render.ts` | `hs-hahmo` (normaali sekoitus) | 🟡 ei ryhmäeristystä eikä muita sekoitustiloja |
| Avainruutueditori, liitokset, nivelet | `components/`, `rig-model.ts` | — | ❌ |
| Esitys/Production-malli, lukitukset, hyväksynnät | `presentation-*.ts`, `production-*.ts` | — | ❌ |
| MP4-vienti | WebCodecs + työpöydän ExportQueue (FFmpeg/VideoToolbox) | `hs-render::export` (FFmpeg, 30 fps, 60 s, 128 MiB) | 🟡 ei ääntä, ei VideoToolbox-koetta |
| PNG-sarja (≤300 ruutua) | `animation-export.ts` | `hs-render::export` | ✅ |
| Ääniraita: repliikit, tehosteet, musiikki, kaiku | `presentation-audio.ts`, `soundtrack.ts`, `sound-cues.ts` | — | ❌ |
| Kokoro-puhesynteesi ja vientisynkka | `lib/kokoro.ts`, `desktop/` | — | ❌ |
| Mikrofoni, äänitys, Rhubarb-visemit, whisper.cpp | `microphone.ts`, `desktop/` | — | ❌ |
| Kamera ja kasvojenseuranta (MediaPipe) | `face-motion.ts` | — | ❌ |
| Palautus: autosave, revisiot, keskeytetty renderöinti | `desktop/`, `lib/studio/recovery*.ts` | — | ❌ |
| Pilvirenderöinti (opt-in, nollakustannus) | `lib/cloud-render/`, `desktop/cloud-*.mjs` | — | ❌ |
| Tuotantonäkymät: kommentit, tehtävät, työjono, CSV | `lib/studio/` | — | ❌ |
| Saavutettavuus: näppäimistö, VoiceOver | React-komponentit | egui (AccessKit mahdollinen) | ❌ ei todennettu |
| Mac-paketointi (DMG, arm64/x64) | `scripts/package-*.mjs` | — (`cargo bundle` tms.) | ❌ |

## Natiivissa jo nyt (uutta tai korvaavaa)

| Ominaisuus | Crate | Tila |
| --- | --- | --- |
| Kokonaislukuinen aikapohja (705 600 000 tikkiä/s), sisältöön perustuvat tapahtumatunnisteet | `hs-core` | ✅ |
| StudioAgent-trait ja riippuvuusjärjestetty putki, joka ajaa vain vanhentuneet agentit | `hs-agents` | ✅ ➕ |
| ScriptParserAgent: tagit → aikajana, puhujat, `[näpyttele puhelinta]`, `[kuva …]` | `hs-agents`, `hs-script` | ✅ ➕ |
| CharacterMeshAgent: parametrinen 3D-hahmo (mitat, kasvot, vaatteet) millisekunneissa | `hs-character` | ✅ ➕ |
| ProceduralMotionAgent: kävely/juoksu (lentovaihe, lantion pomppu, olkapäiden vastakierto), vilkutus, hyppy, kyykky, nyökkäys, puhe | `hs-motion` | ✅ ➕ |
| 5-sormiset kädet, CCD-IK saranarajoilla, peukalonäpyttely siniaalloilla ja viiveillä | `hs-motion::hands` | ✅ ➕ |
| Toisioliike: vaimentuvat siniaallot hiuksille ja helmalle (tilaton, selattava) | `hs-motion::secondary` | ✅ ➕ |
| CinematographyAgent: kuvakoot, leikkaukset, seuranta, sisäänajo, 30°/180° säännöt, kolmipistevalo | `hs-agents` | ✅ ➕ |
| RustRenderAgent: wgpu-GPU + CPU-varapolku samalla varjostusmallilla, headless-vienti | `hs-render` | ✅ ➕ |
| 3D-lavasteet nykyisille taustatunnisteille | `hs-render::environment` | 🟡 yksinkertaistetut |
| egui/eframe-työpöytäsovellus: käsikirjoitus, näyttämö, aikajana, hahmosäätimet, agenttien tila, vienti taustalla | `hs-app` | 🟡 |
| Komentorivi: tarkista, renderöi, hahmo, mittaa | `hs-cli` | ✅ |

## Tunnetut rajat (rehellisesti)

- Suun liike on tekstin tavuista johdettu arvio, ei visemejä eikä ääneen sidottu.
- Natiivisovellus ei vielä tallenna projektia `.hahmo`-muotoon; käsikirjoitus ja
  hahmoparametrit säilyvät sovelluksen omissa asetuksissa ja tekstitiedostona.
- GPU-polku on testattu Linuxissa Vulkanilla (lavapipe, ohjelmistopohjainen).
  Metal (Mac) ja oikea näytönohjain ovat todentamatta.
- Käyttöliittymä on testattu Xvfb-ympäristössä kuvakaappauksella, ei Macilla.
