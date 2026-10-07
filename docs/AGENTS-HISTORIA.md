> Täysi alkuperäinen AGENTS.md ennen tiivistystä (2026-10-07). Sisältää kumotut ja ristiriitaiset ohjeet historiana; voimassa oleva sääntöjoukko on repon juuren AGENTS.md.

# Hahmostudio

This is a Finnish, personal-use browser animation editor. Phase 03 includes PSD import, rig definitions, timeline/keyframes, tweening, playback and PNG sequence export. A private Node server protects the editor and assets with a single-owner login. Use React, TypeScript and Vite. Keep the importer, normalized document model, renderer and future rig/controller separate.

- Install dependencies with `npm ci`.
- Check types with `npm run typecheck`.
- Build the private version with `npm run build:private`, then run `npm run start:private`.
- Test with `npm test`.
- Develop with `npm run dev`.
- Keep PSD decoding and all camera/audio analysis local by default.
- The UI is Finnish. Preserve the current editor layout.
- PSD layer naming is optional. Preserve stable PSD IDs, hierarchy and document-space offsets.
- Rig editor includes role assignment, document-space pivot/joint placement and validated portable rig JSON import/export. Preserve PSD import and layer inspection. Animation tracks support translation, rotation around the rig pivot, scale and opacity with linear/smooth/hold interpolation.
- Later stages: rig animation/rendering, timeline, keyframes, tweening, audio track, webcam recording to keyframes, lip sync to mouth track, clips and nested timelines.
- Do not add a backend, accounts or cloud uploads without a requirement.
- The owner now requests single-user private access. GitHub Pages cannot provide the Node login server. Use the private Node server on loopback by default; remote hosting requires an HTTPS origin and setup token. Do not publish the editor to public Pages. Keep PSD processing local.
- GitHub Pages project deployments use `VITE_BASE_PATH=/<repository-name>/`. Private Pages on a unique root domain uses `/`. Asset URLs must respect `import.meta.env.BASE_URL`.

Current limitations: RGB/grayscale 8-bit PSD, no PSB, maximum 100 MiB input, 16 MP document, 48 MP decoded pixels, 1000 layers. Group/vector/clipping masks, adjustments and effects are flagged where unsupported. Working state is in browser memory; complete projects can be saved manually. Rig definitions and animation tracks can be saved as JSON. PNG export is capped to 300 frames and 128 MiB; animation mode uses the scene size, other modes cap the longest edge to 1080 px. Camera capture, two-bone inverse kinematics and local Rhubarb mouth-cue recognition are implemented. Nested clips remain a future stage.

Parts now support optional parentKey links with acyclic validation and stable-ID remapping. Ancestor transforms and animated opacity compose through the chain. Keep PSD draw order and visibility independent of attachment relationships. Old rigs without parentKey remain independent.

Portable .hahmo project archive now contains normalized layer PNGs, visibility, animation/rig and optional audio. Validate import size, layers and PNG dimensions before decoding. Audio stays local. Volume-driven two-mouth animation is not phoneme detection. MP4 export uses local WebCodecs H.264/AAC, 30 fps and scene dimensions (1080x1920, 1920x1080, 1080x1080), max 60 seconds per episode and 128 MiB per output. Five saved episodes can be concatenated into a 1920x1080 compilation; preserve portrait content with side fill. Scene settings persist in .hahmo and episode snapshots persist in .sarja. Cancel must release encoders/canvases/audio contexts.

Walk generation creates editable local rotation tracks with optional attached-body translation/bounce. Preserve unrelated tracks, validate unique parts and attachment chains, and enforce 10000-keyframe limit. It does not pin feet or bend knees automatically. Layer search must preserve hierarchy and visibility.

## Desktop continuity (2026-10-03)

Electron is now a sibling of the existing web version, not a new editor. Keep the shared platform bridge, normalized models, Finnish Hahmo/Esitys/Animointi workspaces and .hahmo v1/v2 / .sarja compatibility. Preserve all user work/assets. The three-workspace layout supersedes the earlier preserve-layout instruction. Keep camera, microphone and keyboard concurrent; no global controller replacement for hand keys. No fake buttons for absent clips/drawing/segmentation. See docs/ROADMAP.md.

Run npm test and npm run desktop:build; npm run desktop:package:mac builds the host architecture with local Rhubarb. Electron renderer must keep context isolation, sandbox and no Node integration; use narrow validated IPC. Store projects/settings outside the app. Do not read/change the web owner credentials for desktop. Do not publish, change repo permissions, disable OS security or add auto-updates. Current user asks code tests without browser/visual tests; identify simulated, packaged startup and real device verification separately. Installed .app does not update with source changes: rebuild, close old app and replace only the bundle.

Desktop 0.2.1: never await app.whenReady at ESM module scope. Electron awaits entry-module completion before appCodeLoaded; register an asynchronous ready callback instead. Preserve desktop/startup.test.mjs and its loader fixtures (excluded from production bundle). startup-status.json is a local diagnostic with version/phase/time, no session token or user content.


Desktop 0.3.0: preserve original Otto bytes and the additional original PSD/.hahmo library. Scene has optional validated frame-based cuts and screenplay text. The local screenplay parser appends editable motions and must never erase earlier playback, mouth tracks or audio. Only explicit supported cues are interpreted; no TTS/cloud model is present. Keep script undo atomic for animation and scene. Attached camera heads use zero local translation/unit scale and ±25° rotation before both preview and recording; saved legacy keys stay intact. Resource generators need Pillow only when regenerating artwork, never at app runtime.


0.4.0: QuickProfile.views has disjoint validated semantic maps for original multiview artwork. Preserve old single-view packs and IDs. Root opacity chooses a view, raw editing filters to current bindings, and live mixing hides inactive roots. Manual view changes must undo their profile mappings too. Scene.phone and phoneCues persist and follow the actual active hand transform. ViewLayout only hides mounted panels; never stop devices on a visibility change. Profile gait has stance IK; frontal motion remains a stylized 2D perspective approximation, not 3D.


0.5.0: compact Tiedosto/Muokkaa/Näytä/Ohje menus share existing actions, with native Mac view/help actions. Pane visibility keeps controllers mounted. Panel dimensions are independently validated/clamped and stored locally; desktop flex stage must retain min-height:0 even with a timeline. Keep keyboard/pointer separators and original Roni/Salla paper-cutout 3-view packs, including source PSD and old library assets. No browser/device tests were authorized; report code/runtime checks separately.

0.6.0: preserve deterministic presentation models, original script/source refs, actual voice durations and protected holds. Never invent dialogue or speed audio to meet editorial windows. Keep cast assets separate from the base PSD; do not overwrite old rigs/tracks. .hahmo v3 must still read v1/v2. Preparation drafts and voice blobs must roundtrip. Production undo includes audio. Rebuilding an earlier scene cannot shift later content. Renderer camera changes must not reset actors or props. Record/live sources cannot overwrite linked dialogue mouth tracks in export. Keep Roni/Salla stable PSD IDs when changing draw order.

0.7.0: example scripts must not define production logic. Generic speaker aliases/inflections, direction requirements, profiles, environments, placement, props and constraints are data. Unknown essential cues/resources block final assembly; interpretation estimates require review/acceptance. Motion uses existing screenplay/IK safely, preserving dialogue mouth tracks in active views. Keep shared-world continuity independent of hard camera cuts and title-card expiry. Never run code from script text. Document rule-based interpretation limits; do not claim arbitrary natural-language understanding or synthesis when only imported voices are available.

0.8.0: preserve the original cast and backgrounds alongside Studio additions. Face capture owns mapped eyelids, pupils/gaze, eyebrows and all mouth-image opacities; do not merely scale an invisible mouth. Automatic mouth arbitration gives speech energy priority and returns to camera during silence; explicit camera/microphone choices persist in QuickProfile. Repliikki recording is original local PCM, never synthesis. Studio mouthSmile remains optional for old packs. Cutout3D is optional validated XYZ projection of textured PSD paper planes, shared by preview and export; it is not a volumetric mesh or a 3D skeletal rig. Camera yaw/pitch are scene settings, not animated tracks. All paper planes are parallel after camera projection: sort by plane offset, not average projected vertex Z, to avoid eyes disappearing behind the head. Preserve all previous camera/head attachment, project and audio safeguards.

0.9.0: the latest request authorizes a targeted UI preview alongside code checks. Layer raster operations, nondestructive masks, simple vector geometry and local content transforms persist in .hahmo v4; read v1–v3 and retain stable layer keys/crops/rigs. ExportQueue uses immutable project bytes, one isolated BrowserWindow renderer, acknowledged frame writes, FFmpeg child processes and atomic finalization. VideoToolbox must pass an actual allow_sw=0 probe; OpenH264 is the explicit fallback. Local whisper.cpp/base transcription is separate from RMS activity and Rhubarb visemes; do not fabricate words or speaker identity. Bundle arm64 runtimes/models/licenses/source archives. Keep honest device, language, GUI and hardware test limits in DEVELOPMENT-0.9.md and the test report. No publication or permission changes are authorized.

0.10: preserve production source spans/revision, manual overrides/order, independent reaction locks and stable reconciled IDs. No silent audio retention for changed dialogue. .hahmo v5 reads v1–v4. Roni/Salla toon meshes are actual skinned volumes, marked review; original 2D and paper assets stay intact. Match anatomical hand roles to PSD (left is screen right). Phone IK preserves mouth tracks; table release requires a reachable library table. Background/prop library is 2D; report camera mismatch. No semantic backend or final demo audio is present; do not label the whole request finished. Read DEVELOPMENT-0.10.md before continuing, including remaining acceptance work.

2026-10-04: the user explicitly authorizes pushing current source changes to aleksipii/hahmostudio and requests SOVELLUSKUVAUS.md covering UI/UX, functionality and logic. This supersedes the earlier no-push restriction for this source upload only. Do not change repository visibility, deploy Pages, publish releases or include local credentials, owner state, device recordings or generated app bundles. Keep the document honest about implemented and unfinished features.

0.11: user requests KILSAT Studio UI redesign in the existing Electron app, with visual preview explicitly authorized. Preserve package name/bundle ID/data path, controllers across workspace docking, all assets and v1–v5 formats. PanelDock moves persistent portal hosts. No new push/deployment authorization is inferred. Read DEVELOPMENT-0.11.md.

0.12: original Mr.Kille/Mr.Handu cutout assets and backgrounds are additive. Preserve optional QuickProfile.switchDefaults and AudioClip.mouth.viseme, with legacy three-mouth fallback. Normalized cutout pivots use an optional pivotFrame to retain the specified numbers while anchoring the neck/shoulders anatomically. Never publish user dialogue voices in source/app bundles. Read DEVELOPMENT-0.12.md; SVG demo and editable legacy presentation are distinct render paths.

0.13: Studio domain is an adapter; Presentation/Production remain animation authority. Preserve common tick timebase and source IDs. Voice replacement commits timing, mouth tracks, voice resources and approval invalidation as one undo transaction. Drafts may have missing resources and exceed the committed timeline; committed scenes remain strict. Optional resource-manifest.json extends .hahmo v1–v5, never downgrade checksum validation silently. Recovery owns only its two bounded snapshots; never overwrite user project files. Actual worker preflight and video decode QC precede publication. Read DEVELOPMENT-0.13.md for explicit limits.


## 0.14 — revisioarkisto ja palautuva vientijono

Säilytä Scene.studioProjectId ja .hahmo-yhteensopivuus. Nimetyt revisiot ovat erillisiä kahdesta palautusvedoksesta; älä poista niitä automaattisesti kiintiön täyttyessä. Native-arkiston checkpoint on kirjoitettava ennen renderin dispatchia. Palautunut render on interrupted ja vaatii käyttäjän uudelleenyrityksen; vedoksen tarkistussumma ja renderin versiosopimus säilyvät. Review-komennot ovat metadataa nykyisessä adapterissa, eivät uusi moottori. Sisältömuutos vanhentaa hyväksynnän, lukittu kuva estää konservatiivisesti koko esityksen muutoksen. Katso DEVELOPMENT-0.14.md ja durable-storage/studio-testit.


## 0.15 — kuvakohtainen vaikutustarkistus

0.14:n koko esityksen lukitusrajan korvaa lib/studio/shot-impact.ts:n varovainen riippuvuusvertailu. Vertaa komentojen lähtö ja tulos samalla compilerilla. Lukittuun kuvaan vaikuttava muutos tai poisto estää transaktion; muut muuttumattomat hyväksynnät siirtyvät uuteen revisioon. Säilytä vanhat studioskeemat ja undo. Älä rajaa riippuvuuksia vain kuvan sisäisiin tapahtumiin: edeltävä tila ja rajaa seuraava interpolointiavain voivat vaikuttaa kuvaan. Ei väitettä täydellisestä resurssien vaikutusgraafista. Katso DEVELOPMENT-0.15.md.


## 0.16 — paikalliset tarkistuskommentit

StudioMetadata.reviewComments on valinnainen skeema-1-laajennus; vanhat projektit ilman kommentteja säilyvät. Kuvan sisäinen tick-offset seuraa ajoitusta. Poistetun kuvan kommenttia ei poisteta tai siirretä automaattisesti toiseen kuvaan; lyhentyneen kuvan navigointi rajataan, alkuperäinen offset säilyy. Review-metadata ei muuta sisältörevisiota. Avoimet kommentit estävät uuden hyväksynnän/lukituksen. Kommentti tai uudelleenavaus vanhentaa hyväksytyn kuvan hyväksynnän, mutta lukitusta ei avata automaattisesti. Kommentin käsittely on oma kumottava transaktio. Ei tiimikäyttäjäidentiteettejä tai ilmoituksia. Katso DEVELOPMENT-0.16.md.


## 0.17 — tuotantotilanteen koonti

lib/studio/production-overview.ts on read-only-projektio nykyisestä esityksestä. Älä lisää toista hyväksynnän/kommenttien totuuslähdettä. Teknisesti tarkistettavissa ei tarkoita hyväksyttyä, renderöityä tai oikean ääniblobin todennusta; varsinaiset tiedostot tarkistetaan edelleen export preflightissa. Tyhjä tapahtumamalli ei luo koontiin valmista kuvaa. Säilytä kommenttiorvot, lukitukset ja yhteinen valinta/toistokohta. Katso DEVELOPMENT-0.17.md.


## 0.18 — työjonon vastuut ja määräajat

StudioMetadata.shotTasks on valinnainen skeema-1-laajennus. assignShotTask on kumottava metadatakomento; säilytä animaatio, hyväksyntä, lukitus ja sisältörevisionumero. Määräpäivä on validoitu YYYY-MM-DD ilman kellonaikaa, vertailu käyttää eksplisiittistä kalenteripäivää ja UI Macin paikallista päivää. Määräpäivänä ei olla myöhässä. Hyväksytyt/lukitut ongelmattomat kuvat eivät ole keskeneräistä työjonoa. Orpotiedot säilyvät mutta eivät kerry aktiivisiin työjonomääriin. Vastuuhenkilö on vapaa paikallinen teksti, ei tilin identiteetti tai ilmoitusvastaanottaja. Katso DEVELOPMENT-0.18.md.

Käyttäjä pyytää jokaisessa jatkokehityksen päivityksessä kertomaan nykyisen kehitysvaiheen, mikä on valmis ja seuraavan työn.


## 0.19 — työjonon CSV-vienti

exportProductionCsv on read-only-projektio nykyisestä productionOverviewsta. Vie suodatuksen kaikki sivut, älä vain näkyvää 24 korttia. CSV sisältää UTF-8 BOMin, puolipiste-erottimen, CRLF-rivit ja pilkun sekuntien desimaalierottimena; tarkat tick-sarakkeet säilyvät. Lainaa tekstisolut, suojaa kaavaprefiksit ja rajaa tiedostonimi turvalliseksi Unicode-lehdeksi. Käytä saveFile kind:export -polkua; älä adoptoi vientiä projektiksi tai tyhjennä projektin dirty-tilaa. CSV ei ole projektivarmuuskopio eikä import-muoto. Katso DEVELOPMENT-0.19.md.

## 0.20 — työjonon yhteismuokkaus
assignShotTasks validoi koko ID-joukon ennen commitia. Omitted kenttä säilyy kuvakohtaisena, tyhjä merkkijono tyhjentää vain oman kentän. Yksi update/undo, ei sisältörevision tai hyväksynnän muutosta. UI käyttää koko suodatettua tulosta kaikilta sivuilta ja vahvistaa määrän ja muutokset. Säilytä orpotiedot. Katso DEVELOPMENT-0.20.md.

## 0.21 — tarkistusnavigointi
productionIssues on read-only. Globaalia tai poistettuun tapahtumaan osoittavaa ilmoitusta ei saa arvata ensimmäisen kuvan virheeksi. Navigointi ratkaistaan nykyisistä ID:istä ja käyttää selectShot/yhteistä playheadia, näyttää oikean sivun suodatuksesta riippumatta. Puuttuva AudioClip-viite on erillinen tarkistus, ei blob-todennus. Ehdotukset eivät ole automaattikorjauksia. Katso DEVELOPMENT-0.21.md.

## 0.22 — tarkistuslista ja vientivalmius
Kuvan hyväksyntä, viitteen saatavuus ja tekninen snapshot-preflight ovat eri asioita. Käytä freezeRender-polkua, älä tee rinnakkaista resurssitodennusta. Tarkistuksen tulos kuuluu Episode-viitteeseen ja profiilin sisältöön; piilota vanha tulos muutoksessa. Esitarkistus ei ole render/QC tai automaattihyväksyntä eikä kirjoita tiedostoa. Katso DEVELOPMENT-0.22.md.

## 0.23 — hakunäkymät
Hakunäkymät ovat schemaVersion 1 -localStorage-asetuksia, eivät projektidataa tai undo-komentoja. Säilytä haku/suodatus, älä tallenna kohdekuvia tai playheadia. Virheellinen/uudempi skeema ei saa ylikirjoittua automaattisesti. Päivitä lista vasta onnistuneen kirjoituksen jälkeen. Katso DEVELOPMENT-0.23.md.

## 0.24 — työjonon lajittelu
Lajittelu on näkymä, ei ajoitusmuutos. Suodata ennen lajittelua ja sivuta sen jälkeen. Puuttuvat arvot viimeiseksi, tasatilanne jakson järjestyksessä. SavedShotView.sort on valinnainen skeema-1-kenttä; puuttuva tarkoittaa timeline. Kohdenavigointi palauttaa lajittelun timeline-tilaan ennen jaksojärjestyksen sivun laskentaa. Katso DEVELOPMENT-0.24.md.

## 0.25 — tuotantopolun integraatio ja työjono
Käänteinen työjonolajittelu säilyttää puuttuvat arvot viimeisenä ja tasatilanteessa jakson järjestyksen. descending on valinnainen boolean hakunäkymän skeemassa 1. Kohdenavigointi nollaa suunnan. Seuraava tarkistuskohde rajataan nykyiseen hakuun/vakavuuteen ja ohittaa globaalit/orpotargetit. 500 rivin datatesti ei ole 500 kuvan GUI/render-kuormitustesti. Katso DEVELOPMENT-0.25.md.

## 0.26 — tuotantokomennot ja resurssit
commandJournal on valinnainen validoitu max100 audit-kenttä, ei replay/WAL. Käytä yhteistä executeProductionCommand-rajaa tuotannon muokkauksiin. Alkuperäisen äänen palautus edellyttää tarkkaa audio-SHA256-viitettä ja samoja tavuja; muuta ääntä ei saa hyväksyä alkuperäisenä. Guardaa async palautus mallin vaihdolta. Approve/lock vaatii nykyisen valmistelun kaikki sidotut resurssit; unlock ei. Säilytä vanhat palautusvedokset/revisiot ja .hahmo-yhteensopivuus. Katso DEVELOPMENT-0.26.md.

## 0.27 — palautusjournal ja hahmoresurssit
Macin commit-record on snapshotin ja oman checksuminsa avulla validoitu itsenäinen palautuskohde. Älä palauta pelkkiä orposnapshotteja tai mielivaltaisia polkuja. Max20/512MiB, säilytä vanha kahden vedoksen yhteensopivuus. Autosave-replay ei ole per-command WAL/durability. Hahmopaketin vaihto ei ylikirjoita vanhaa resurssia; säilytä readRig/readAnimationin yksiselitteinen PSD-ID/avain+polku-mapping, vanhat radat ja undo-resurssikartta. Älä structuredClone DOM-mediaolioita. Raw PSD→paketti ja eri skeletonin automaattinen retarget eivät ole valmiita. Katso DEVELOPMENT-0.27.md.

## 0.28 — journal-kuittaus ennen julkaisua
Säilytä DurableCommandGate:n järjestys validate→persist→publish. Historian commit/pop ja projektin React-julkaisu vasta kuittauksen jälkeen. Macin komento-ID/hash/size-ack pitää tarkistaa; eri komentoja ei deduplikoida samojen tavujen vuoksi. SaveRecovery ilman command-kenttää on edelleen autosave. Älä väitä snapshot-journalia semanttisen payloadin replayksi tai kaikkien suoran setState-reittien kattamiseksi. ProductionPanel update/parser/undo käyttävät persistProposal-palvelua, lomakkeet odottavat async-onnistumista. DOM-resursseja ei kloonata. Katso DEVELOPMENT-0.28.md.

## 0.29 — yhteinen levypohjainen projektiundo ja sisältöpalat
Projektihistoria on yksi editorin totuuslähde, enintään16 viitettä /384MiB. Säilytä historia autosave/baseline-komentojen mukana ja journal-prunessa; vain validoidut omat snapshot-viitteet, kuittaus ennen undo-julkaisua. Tavallinen tiedoston avaus aloittaa uuden historian, Palauta työ palauttaa journal-historian. Macin ProjectChunks rekonstruoi täsmälleen alkuperäisen .hahmo-arkiston ja tarkistaa jokaisen palan sekä koko hashin. Älä kutsu tätä semanttiseksi komentodeltaksi. Raw text on UI-luonnos kunnes komento kuitataan; dirty/sulkeminen ei saa piilottaa sitä. PSD mapping edellyttää jokaista vanhaa osaa eri olemassa olevaan uuteen tasoon; säilytä parent/pivot/track/QuickProfile ja sama canvas. Ei arvaavaa anatomia-retargetia. Katso DEVELOPMENT-0.29.md.

0.30: immutable resource bytes/hash/ZIP record caches; fixed stored-ZIP timestamps and order. Semantic JSON path deltas carry before/after and baseline/result metadata hashes alongside verified full checkpoints. Array edits are atomic. Portable editor history is optional in .hahmo, max16 states and128MiB total; never silently trim portable history. Prepare imports into local journal before publication. Prepared .hahmo relink retains target rig and scales motion from corresponding chain lengths; mapping proposals use semantic QuickProfile roles, reject ambiguous IDs/topology. Raw PSD mapping scales pivots/joints/translations axis-wise for different canvas sizes. This is not arbitrary skeleton topology/FK-IK retargeting. Read DEVELOPMENT-0.30.md.

0.31: Mac ordinary editor mutations use saveProjectRecovery/recoveryTransaction and delta-journal.mjs. Only a new project/import/cache miss establishes a baseline; subsequent commits carry typed semantic path/splice deltas and changed content-defined resource chunks. Preserve legacy RecoveryStore snapshots and browser fallback. A delta reference hash is a state/Merkle hash; materialized archives expose archiveHash separately. Do not compare those as if both were ZIP hashes. All history states import in one commit, after current image decoding, with no partial visible history. History v2 shares chunks and reads v1; max16/384MiB expanded/128MiB package. Normalized editor rig/animation validation results are frozen; edit copies. Chain retarget bakes FK/IK/contact/constraint results for explicitly anchored 2D chains, not arbitrary 3D anatomy or a replacement of live/gait engines. Keep real process SIGKILL tests separate from actual power loss. GUI attempt exit134 and missing Computer Use permissions/hardware mean GUI and physical device tests remain unverified. Read DEVELOPMENT-0.31.md and benchmark scope before claiming production readiness.

## 0.47 — pilvirenderöinti (tekoälyohjaaja)

The owner explicitly requires a cloud AI render add-on; this is the requirement that AGENTS' "no backend/cloud" rule asked for. It is opt-in (`HAHMOSTUDIO_CLOUD_RENDER=1`, private server only) and additive in `lib/cloud-render/`; PSD/audio/camera processing stays local and the desktop app does not use it. The rule-based Presentation stays the authority: `canonical-adapter.ts` is a read-only projection, AI output is untrusted, validated deterministically and never writes canon. Zero-cost policy is server-env only, frozen, with no paid fallback; provider calls need a PaidComputeFirewall token. No model weights locally or in Drive (tests enforce). Do not claim live ComfyUI/Drive/Colab verification until run. Files under `lib/cloud-render` reachable from components must avoid generic arrow functions (server/ui.test.mjs transpiles .ts as TSX). Read docs/cloud-render/*.md.

## 2026-10-07 — puhesynteesi Kokorolla
Käyttäjä sallii paikallisen Kokoro-puhemoottorin englanninkielisille repliikeille. Tämä korvaa aiemman ehdottoman "ei puhesynteesiä" -linjauksen vain Kokoron osalta. Ei pilvi-TTS:ää (ElevenLabs hylätty). Kokoro-repliikit merkitään synteettisiksi, ja käyttäjän äänittämät tai tuomat repliikit ovat aina etusijalla eikä niitä ylikirjoiteta. Malli ladataan käyttäjän luvalla sovelluksen tietokansioon, ei pakettiin eikä repoon. Katso docs/CLOUD-TEHTAVA-KASIKIRJOITUKSESTA-SARJAKSI.md, vaihe E0.

## 2.4–2.10 — Rakenna jakso, esineet, liikekirjasto, sommittelu, ääni ja palikat (haara cloud/kasikirjoitus-sarjaksi)
`lib/episode-builder.ts` on deterministinen eikä kaadu: jokaisella rivillä lopputulos, tunnistamaton näkyy tarkistuksessa, ei arvausta. Tapahtumatunnisteet perustuvat rivin sisältöön (ei rivinumeroon), jotta äänet/hyväksynnät/lukitukset säilyvät rivejä siirrettäessä. Käsikirjoitusteksti on palikoiden totuuslähde; palikkamuutos kirjoittaa vain vastaavan rivin ja `blockSentence`-lauseiden pitää tunnistua takaisin samoiksi (testi). Esine piirretään käden maailmamatriisista käsikerroksen alle (`held-props.ts`); `QuickProfile.grips` on valinnainen. Liikkeet `motion-library.ts`: säilytä mittaritestit (kiihtyvyys/jerk, tukijalka < 1 px, yksi kuvakulma, kova kuvakulman vaihto). Sommittelu ei saa ristiriitaa turva-alueen rajauksen kanssa. `Presentation.soundCues` on valinnainen ja ankkuroitu tapahtumiin; tehosteet ja musiikki ovat ohjelmallista CC0:aa tai käyttäjän tuomaa; repliikkien puhesynteesi kulkee vain Kokoro-linjauksen (E0) kautta. Kerro M1/VideoToolbox/laitetestit todentamattomiksi. Katso KEHITYSMUISTIO 2.4–2.10, docs/KASIKIRJOITUS-KIELIOPPI.md, docs/DESIGN-PALIKKAEDITORI.md.
