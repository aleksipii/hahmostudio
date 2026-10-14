# Pariteettilista: Electron/TypeScript → natiivi Rust

Käyttäjän päätös 13.10.2026: Electron, React/TypeScript-sovellus ja Node-palvelin
poistettiin ennen täyttä ominaisuuspariteettia. Tämä on jäljellä olevien puutteiden
kehityslista, **ei poiston lupa- tai hyväksyntäportti**. Vanhojen TS-polkujen
viittaukset tarkoittavat Git-historiaa (viimeinen versio `3b275e6`), eivät
nykyisen repositorion tiedostoja. Poisto ei merkitse puuttuvia ominaisuuksia valmiiksi.

Merkinnät: ✅ valmis ja testattu · 🟡 osittain · ❌ puuttuu · ➕ uusi natiivissa

## Jäljellä olevat ominaisuuspuutteet

| Alue | Nykyinen toteutus (TS) | Natiivi (Rust) | Tila |
| --- | --- | --- | --- |
| Käsikirjoituksen perussäännöt | `lib/screenplay.ts` | `hs-script` (samat tagit, rajat, ei arvauksia) | ✅ |
| Laaja käsikirjoitustunnistin (FI/EN, ilmeet, katseet, kuvakoot, kameraliikkeet, sanasto) | `lib/script-recognizer*.ts`, `lib/episode/`, `script-grammar.ts` | `hs-script`: tarkat EN/FI-tagit, ilmeet ja katseet | 🟡 ei koko TS-sanastoa |
| Palikkaeditori (lohkot, vapaa ajoitus, Alt-pudotus, raahaus) | `lib/blocks.ts`, `components/` | `hs-edit::script`, `hs-app::blocks_ui`: lähderivien muokkaus/järjestys | 🟡 lähderivien järjestysraahaus, aikajanakorttien tarkistettu aloitusraahaus ja [at]-päällekkäisyys toteutettu; keston reunan raahaus toteutettu; puheen/liikkeen erillinen alku ja kesto toteutettu; kamera-/taustakorttien raahaus ja ryhmäsiirto lisätty; samalle hahmolle erillisten kehokanavien kerrostus; Alt-pudotus ja vapaasti ristiriitaiset toiminnat puuttuvat |
| Jaksorakentaja ja korjausehdotukset | `lib/episode-builder.ts`, `review-suggestions.ts` | `hs-script` diagnostiikka, `hs-app::script_assist_ui` ohje-ehdotukset | 🟡 rajatun ohjekielen ehdotukset; vanha jaksorakentaja puuttuu |
| `.hahmo` v1–v5 luku | `lib/project-file.ts` | `hs-hahmo` (perusrakenne, kuvat, rig, raidat) | 🟡 |
| `.hahmo` kirjoitus, resurssimanifesti, tarkistussummat, historia | `lib/project-file.ts`, `lib/studio/` | `hs-hahmo::archive`: tarkistettu luku/kirjoitus, SHA256, historia, tuntemattoman metadatan säilytys | 🟡 nykyiset aineistot; vanhat esitystilat eivät kaikki renderöidy |
| `.sarja`-jaksot | `lib/series-archive.ts` | `hs-project`: erillinen natiivi `.koeta` tallentaa useita jaksoja ja ääniresursseja | 🟡 vanhan `.sarja` v1 tuonti lisätty; jokainen alkuperäinen .hahmo säilyy .koeta-resurssina |
| PSD-tuonti (ID:t, hierarkia, rajat 100 MiB / 16 MP / 1000 tasoa) | `lib/psd-import.ts`, `psd.worker.ts` | `hs-image::psd`: RAW/RLE, RGB/harmaa 8 bit, ID/hierarkia/offsetit | 🟡 rasterimaskit, eristettyjen ryhmien opacity ja kahdeksan blend-tilaa lisätty; vector maskit ja efektit hylätään |
| 2D-rigin muunnokset ja easing (linear/smooth/hold/bezier) | `animation-transform.ts`, `animation-model.ts` | `hs-hahmo` (sama kaava) | ✅ |
| 2D-tasojen piirto | `psd-render.ts` | `hs-hahmo` (normaali sekoitus) | 🟡 ei ryhmäeristystä eikä muita sekoitustiloja |
| Avainruutueditori, liitokset, nivelet | `components/`, `rig-model.ts` | 2D-rigin nivelsuhteet/avaimet sekä natiivien 3D-luurankojen avainruudut | 🟡 rajattu, kontaktien kanssa saman hahmon avaimet estetään |
| Esitys/Production-malli, lukitukset, hyväksynnät | `presentation-*.ts`, `production-*.ts` | projektin sisältöön sidottu tarkistus/hyväksyntä ja paikallinen lukitus | 🟡 ei monen käyttäjän palvelinta |
| MP4-vienti | WebCodecs + työpöydän ExportQueue (FFmpeg/VideoToolbox) | `hs-render::export` (FFmpeg, 30 fps, 60 s, 128 MiB, AAC-ääni) | 🟡 ei VideoToolbox-koetta |
| PNG-sarja (≤300 ruutua) | `animation-export.ts` | `hs-render::export` | ✅ |
| Ääniraita: repliikit, tehosteet, musiikki, kaiku | `presentation-audio.ts`, `soundtrack.ts`, `sound-cues.ts` | `hs-agents::voice`, `hs-edit`: repliikit, WAV-musiikki/tehosteet, häivytys ja ducking | 🟡 kaiku puuttuu |
| Kokoro-puhesynteesi ja vientisynkka | `lib/kokoro.ts`, `desktop/` | `hs-voice` (Kokoro-82M puhtaalla Rustilla: candle + loqui-g2p, Metal Macilla; samat ohjesäännöt, välimuisti, oma ääni etusijalla; lataus luvalla, tuonti, poisto) | 🟡 aitoa mallia ei ole ajettu (pilvi estää Hugging Facen); kuuntelu Macilla |
| Mikrofoni, äänitys, Rhubarb-visemit, whisper.cpp | `microphone.ts`, `desktop/` | `hs-audio` (cpal: toisto, äänitys), `hs-lipsync` (10 visemiä äänteistä tai äänestä, Adobe Characterin tapaan) | 🟡 whisper.cpp puuttuu; mikrofoni testaamatta oikealla laitteella |
| Kamera ja kasvojenseuranta (MediaPipe) | `face-motion.ts` | `hs-camera` (nokhwa-kaappaus, pään kääntö/nyökkäys/kallistus ihonvärin ja CamShiftin avulla) | 🟡 ei kasvopisteitä (silmät, kulmat); kamera testaamatta oikealla laitteella |
| Palautus: autosave, revisiot, keskeytetty renderöinti | `desktop/`, `lib/studio/recovery*.ts` | `hs-project::recovery`: kaksi autosavea, nimetyt revisiot, palautus kopiona | 🟡 renderöintityön palautus puuttuu |
| Pilvirenderöinti (opt-in, nollakustannus) | `lib/cloud-render/`, `desktop/cloud-*.mjs` | — | ❌ |
| Tuotantonäkymät: kommentit, tehtävät, työjono, CSV | `lib/studio/` | lähderiviin sidotut kommentit, tehtävät ja ratkaiseminen | 🟡 työjono/CSV puuttuvat |
| Saavutettavuus: näppäimistö, VoiceOver | React-komponentit | egui + AccessKit käytössä | 🟡 VoiceOverin oikea Mac-koe tekemättä |
| Mac-paketointi (DMG, arm64/x64) | `scripts/package-*.mjs` | `native/scripts/package-macos.py`: .app, valinnainen codesign/DMG | 🟡 Linux-fixturet testattu; oikea Mac avoin |

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
| Komentorivi: tarkista, renderöi, hahmo, mittaa, ääni (tila/lataa/tuo/poista), sano, huulisynkka | `hs-cli` | ✅ |
| VoiceAgent, TimingAgent, LipSyncAgent: puhe pidentää rivit, leikkeet miksataan, visemit leikkeittäin | `hs-agents` | ✅ ➕ |
| Rigattu suu (ylähuuli, suupielet, hampaat, kieli, leuka) ja visemien muodot | `hs-motion::face`, `hs-character` | ✅ ➕ |
| Ääni- ja Esitys-välilehdet: rivikohtainen äänitys/WAV-tuonti, mikrofonista suu ja kamerasta pää reaaliajassa | `hs-app` | 🟡 testattu Xvfb:ssä ilman laitteita |
| Sarjakuvaääriviivat (käänteinen kuori) GPU:lla ja CPU:lla | `hs-render` | ✅ ➕ |
| Sarjan perhe (Kalle, Maija, Eetu, Ronja): isot päät ja silmät, pipo, lippis, lasit, vatsa | `hs-character` | ✅ ➕ alkuperäisiä hahmoja |
| Kuvaohjeet kaksikko, olan yli, alakulma, yläkulma; laaja kuva rajaa koko joukon; keskustelijat kääntyvät toisiaan kohti | `hs-agents::cinematography` | ✅ ➕ |
| Esineet käteen `[esine kahvikuppi]` ym. (8 esinettä), lavasteet keittiö, luokka, puisto, katu | `hs-render`, `hs-script` | ✅ ➕ |

## Tunnetut rajat (rehellisesti)

- Huulisynkka on ääneen sidottu, kun rivillä on Kokoro-puhe tai oma äänitys; muuten suu liikkuu tekstin äänteiden mukaan.
- Kokoro puhuu vain englantia (kuten Electron-versiossa); suomenkieliset rivit äänitetään itse.
- Kameran pään seuranta perustuu ihonväriin: se ei tunnista silmiä tai kulmia, ja
  valaistus tai ihonvärinen tausta voi häiritä. Kalibrointi ja herkkyys säädetään Esitys-välilehdellä.
- Natiivisovellus tallentaa sarjan `.koeta`-muotoon: käsikirjoitukset, hahmot/äänivalinnat,
  omat ja tuotetut puheet sekä nykyiset vientiasetukset. `.hahmo`-kirjoitus ja vanhan
  `.sarja`-muodon tuonti puuttuvat. Nykyisten leikkausasetusten, tekstitysten,
  kuvaeditoriresurssien ja autosave-historian tallennus on sittemmin toteutettu
  `.koeta` V2 -integraatiossa (ks. alla); tämä ei poista muita pariteettirajoja.
- GPU-polku on testattu Linuxissa Vulkanilla (lavapipe, ohjelmistopohjainen).
  Metal (Mac) ja oikea näytönohjain ovat todentamatta.
- Käyttöliittymä on testattu Xvfb-ympäristössä kuvakaappauksella, ei Macilla.
- macOS-käännöstä ei voitu tarkistaa pilvessä (nokhwa ja candle-Metal tarvitsevat Macin SDK:n).
  Paketoija lisää Info.plistiin `NSMicrophoneUsageDescription` ja
  `NSCameraUsageDescription`; oikeudet ja laitteet pitää hyväksyä oikeassa Macissa.


12.10.2026 Codex/Claude-integraatio: natiivi `.koeta` V2 säilyttää kuvaeditorin,
äänileikkauksen, tekstitysasetukset ja äänitysten tekstisidokset. `hs-subtitle`
polttaa tekstitykset renderöityihin ruutuihin ja tuottaa SRT/VTT:n.
MP4-työnkulku on testattu oikealla FFmpegillä, simuloiduilla puheäänillä.
Tästä ei seuraa aitoa Kokoro-, Mac- tai Adobe-pariteettihyväksyntää.


## Nykyinen järjestys (14.10.2026, omistajan ohje)

Ominaisuudet ensin; Mac-hyväksyntä ja keveysmittaukset vasta niiden jälkeen.
Sovellus on alustavasti henkilökohtaiseen käyttöön, joten notarisaatio ei ole
ominaisuuksien valmistumisen ehto.

Lisätty koodiin: lasku/pudotus tuetulle alustalle/lattialle, oven kahvakontakti,
portaat/jalkakontaktit, saman hahmon erillisten kehokanavien kerrostus,
ryhmäsiirto ja itsenäisten kamera-/taustakorttien raahaus, .sarja v1 tuonti,
.hahmo kirjoitus/historia, laajempi rasteri-PSD, 2D/3D-avainruudut,
kommentit/tehtävät/hyväksyntä/lukitus sekä AccessKit.

Uusi [3D-AOV → PSD](RENDER-PASSES.md): ohjelmistosäteenseuranta, base color,
AO, specular, depth ja world normals omilla tasoillaan.

Yhä rajattu: koko kehon ja mielivaltaisen maailman törmäysfysiikka,
automatisoitu lattialle kumartuminen/lasku, mikä tahansa rig-retargettaus,
Photoshopin vector maskit/efektit ja vanhojen esitystilojen täydellinen renderöinti.
Tukematon tai ulottumaton kontakti annetaan virheenä. Linux-testitulokset ja
GUI-todennus kirjataan TIIMI.md:hen; pelkkä koodin lisäys ei ole Mac-hyväksyntä.

Viimeiseksi: aito Kokoro-kuuntelu, pilotti, Mac/Metal, laitteet, Finder,
itsenäinen DMG sekä release-koko/CPU/RAM/energia. Julkista jakelua varten
allekirjoitus/notarisaatio arvioidaan erikseen. Pilvirenderöinti pysyy erillisenä
käyttäjän valitsemana paikallisesta tuotannosta riippumattomana toimintona.

Poistettuja ominaisuuksia ei korvattu tekaistuilla Rust-vastineilla.
