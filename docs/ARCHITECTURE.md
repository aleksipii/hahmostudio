# Yhteinen verkkoversio ja Mac-versio

React/TypeScript/Vite ja nykyinen normalisoitu dokumentti-, nivel-, animaatio-, näyttämö- ja projektimalli säilyvät. Hahmo, Esitys ja Animointi vaihtavat näkymää saman Editor-komponentin sisällä. Ohjauslähteiden yhdistely on yhteinen molemmille ympäristöille. .hahmo v1/v2 ja .sarja ovat edelleen siirrettäviä tiedostoja.

`lib/platform.ts` valitsee selaimen File-/Blob-latausten ja Electronin rajatun sillan välillä. PNG-tuonti on erillinen `lib/png-import.ts`; PSD-worker ja tiedostorajat säilyvät. PNG ei muodosta automaattisesti nivellettyä hahmoa.

Electronin `desktop/main.mjs` omistaa ikkunan, valikot, luvat ja yksittäisen sovellusinstanssin. `desktop/preload.cjs` tarjoaa vain nimetyt tiedosto-, asetus-, valikko- ja puhetoiminnot. IPC tarkistaa oikean pääikkunan ja pääkehyksen. Rendererillä ei ole Node-integraatiota, yleistä komentojen suorittamista tai mielivaltaista tiedostopolkujen avaamista; contextIsolation, sandbox ja webSecurity ovat käytössä. Linkkien avaaminen ulkoiseen alkuperään, uudet ikkunat ja webviewt estetään.

`desktop/files.mjs` pitää valittujen projektien polut pääprosessissa; käyttöliittymä saa vain opaque-tunnisteet, nimet ja tiedostosisällön. Projektipolku otetaan käyttöön vasta onnistuneen tuonnin jälkeen. Tallennus käyttää väliaikaistiedostoa samalla levyllä, fsyncia ja renamea. Vienti ei vaihda projektin tallennuskohdetta. `desktop/close-workflow.mjs` suojaa sulkemista: peruutus, virhe tai tallennuksen aikana muuttunut työ pitää ikkunan auki.

`desktop/service.mjs` on Electronin mukana tuleva utilityProcess, joka käyttää yhteistä yksityistä HTTP-palvelinta ja Rhubarb-tunnistinta. Se kuuntelee vain 127.0.0.1:ssä käyttöjärjestelmän valitsemassa vapaassa portissa. Jokainen käynnistys käyttää satunnaista, HttpOnly/SameSite-cookieen rajattua istuntoa. Tavallinen web-versio käyttää edelleen omistajan salasanaa; desktop-tila ei käsittele omistajatiedostoa. Puhetunnistus kulkee rajatun IPC:n kautta pääprosessiin ja paikalliseen palveluun. Vite on vain kehitystyössä; tuotanto käyttää app.asar-paketin dist-desktopia.

Paketissa on erillinen natiivi Rhubarb Contents/Resources/rhubarb-kansiossa. Käyttäjän tiedostot ja asetukset ovat .app:n ulkopuolella. Lopetus keskeyttää puhetunnistuksen, tuhoaa käyttöliittymän ja pysäyttää palveluprosessin; jumiutuneella prosessilla on lopetuksen aikaraja.

Turvallisuusratkaisut perustuvat Electronin virallisiin ohjeisiin: https://www.electronjs.org/docs/latest/tutorial/security ja https://www.electronjs.org/docs/latest/tutorial/ipc . Build-/paketointiversiot on lukittu package-lock.jsoniin. Kolmannen osapuolen lisenssit ovat THIRD_PARTY_NOTICES.md:ssä ja Electron-/Rhubarb-paketissa.


## 0.3.0 screenplay and original library

`lib/backgrounds.ts` owns six versioned original scenery designs shared by SVG export and canvas video rendering. `Scene.cuts` stores sorted unique frame/design cues and `Scene.screenplay` preserves at most 12000 characters. `readScene` validates optional fields; .hahmo v1/v2 remain compatible. Old readers cannot load newly introduced background IDs; use 0.3.0 for new files.

`lib/screenplay.ts` parses local Finnish/English action cues, previews explicit timing and creates segmented rotation/translation tracks. It appends via `appendTake`, preserving prior playback and unrelated mouth tracks, enforcing 60 seconds/1800 frames/10000 keys. Portraits reject leg-dependent actions. Script application stores scene and animation as one undo entry. No TTS, generative language model, external upload, text captions or multiple puppet composition.

`attachedHeadPose` constrains only newly captured live camera samples for parented heads before preview and recording. Existing saved keys remain intact. Original PSD generators create Aino, Leo, blank guides and two mouth packs; source PSDs and semantic parent/quick roles are included in portable packs. Otto files remain unchanged. Artwork provenance is CC0 and externalAssets is empty.


## 0.4.0 views, gait and phone props

QuickProfile.views is an optional validated map of disjoint semantic role bindings per front/left/right drawing. Original assets remain immutable; new Aino/Otto multiview packs contain 75 parts with three independent body roots. Animated root opacity chooses one view; default raw-layer editing filters to the current role map. Live mixer hides inactive roots without removing timeline data. View selection history stores the prior quick mapping, and camera defaults refresh only when angle changes are allowed (camera off).

Locomotion uses stance/swing foot targets and two-bone IK for profile legs. The stance target counteracts horizontal root translation. Frontal locomotion is a stylized 2D depth approximation through size/vertical placement, not a 3D skeleton. Phone props and timed phone-angle cues are validated optional Scene fields. Phone placement resolves the actually active view and transforms the hand pivot through the rig chain; screen props are independent. Node tests verify generated stance frames, unique active view roots and roundtrip data.

ViewLayout is a local validated UI preference. Visibility uses hidden attributes on existing components; it must not unmount camera/microphone or reset project state. The permanent library button restores the left panel.


0.5.0: pane sizing is UI state, never part of .hahmo. readSizes/resizePanel validate and clamp widths and timeline height, fitPanels reserves central stage width; CSS flex with min-height:0 leaves actual available stage height to ResizeObserver. AppMenu uses native disclosure + button semantics and Escape/arrow navigation. PanelResizer uses pointer capture (cleanup on cancel/loss) and semantic keyboard separators. Roni/Salla use their own source art and accepted controller asset IDs; no format version changes.

## 0.6.0 dialogue production

Presentation is a validated deterministic model with source refs, stable event IDs, bindings, shared world/phone, sections, original audio links, editable mouth cues and per-actor existing Animation tracks. Parsing never invents dialogue. Timing uses measured audio duration, preserves protected holds and reports conflicts. compilePresentation resolves semantic roles without changing the original document/rig/tracks. Renderer draws actors directly in the shared world (avoiding PSD canvas clipping), with instantaneous camera transforms and a persistent phone. Export and preview use the same scene renderer.

.hahmo v3 embeds child .hahmo cast assets and original voice blobs; v1/v2 remain readable. Scene.presentationDraft persists unfinished setup. Append is atomic for animation, scene and mixed PCM audio; undo restores all three. Rebuild replaces matching IDs, retaining locks and refusing changed earlier durations that would shift later scenes. Saved compiled actor animations are validated against their own rigs. Frame-rate changes preserve seconds and retime actor tracks.

Local audio decode/trim and 48 kHz PCM mixing retain real durations. Optional local Rhubarb maps cues to available three mouth shapes; volume gating closes silent gaps. No TTS, external account or cloud dependency. Source recorded overlays face tracks only, preserving linked audio mouths; live is first-actor preview only. Safety holds override both. Roni/Salla profiles now paint near arms after the torso with original semantic PSD IDs preserved.

## 0.7.0 general production direction

Optional Presentation.direction holds target min/max, per-speaker traits/relationships/delivery/intensity and source-linked requirement categories. Parse arbitrary named characters rather than named-example aliases; library binding is user-selected. Environment/placement/prop/constraint are validated event kinds. General actions compile through existing buildScreenplay/IK into actor timelines, and expressions/mouths resolve the active view at each event time. World state persists independently from camera state. Title cards expire; rendering uses selected library scenery. No script execution or cloud model.

Unknown essential instructions and resources block readiness. Interpretation estimates require user acceptance at append. Exact locked section windows fail on duration conflicts; flexible windows warn. Freeze constraints protect face poses while imported dialogue mouths remain active. New blank projects may start at frame 0; existing project contents are appended and preserved. Optional fields remain readable for older v3 archives. Tests exercise a second screenplay with unrelated names, backgrounds, durations, actions and ending plus roundtrip/renderer/constraints/SSR.
