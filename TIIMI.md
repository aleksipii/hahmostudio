# Tiimityön loki — 8.10.2026

Työkopio: `/Users/Aleksi/Documents/Codex/2026-10-08/hahmostudio-tiimityo`.
Lähde: `/Users/Aleksi/hahmostudio`, revisio `d356ad6e7d1ae043d68cb74a3c1bf0143f91d667`.
Alkuperäisessä repossa on käyttäjän untracked-tiedostoja; niitä ei kopioitu tai muutettu. Riippuvuudet luetaan nykyisestä node_modules-kansiosta symbolisen linkin kautta, eikä niitä asenneta tai muuteta.

## Käyttäjän toimeksianto
Lisää 3D-animaation tekninen johtaja/hahmotaiteilija; tee kaikille rooleille promptit ja aloita työ. Roolit hoidetaan tässä yhdellä suorittajalla. Liitteitä käytetään taustana, ei todisteena nykytilasta.

## Nykyinen vaihe
Ensimmäinen tekninen työpaketti toteutettu ja todennettu. Hahmotaiteen hyväksyntä ja laajempi tuotantotodennus avoimia.

| Vastuu | Tila | Tehty / seuraava |
|---|---|---|
| Arkkitehti/sääntömoottori | KARTOITETTU | Presentation/Production säilyy auktoriteettina; formaattien muutos tarkastetaan 3D-tyylikorjauksessa. |
| 2D/hahmografiikka | KARTOITETTU | Generaattorissa FILL-reunat ja yhtenäinen hiha; nykyisiä PSD-tiedostoja ei muuteta. Ääriasentojen visuaalinen tarkistus avoin. |
| 3D/animaatio | TEKNISESTI TESTATTU | Flat/cel-tyylivalinta toteutettu, vanhat profiilit säilyvät. Neljän hahmon neljä näkymää renderöity Electronissa. Ulkoasun hyväksyntä avoin. |
| Full-stack/Electron | OSITTAIN TESTATTU | PSD-ryhmäraja korjattu; FFmpeg/ffprobe-tarkistus ajettu. Paketoidun sovelluksen ja VideoToolboxin todennus avoin. |
| Tekoäly | KARTOITETTU | Desktop cloud-controller, IPC ja AI-paneeli jo olemassa. Liitteiden nykytilateksti vanhentunut; ei uutta pilvi-integraatiota tässä ensimmäisessä korjauksessa. |
| UX | OSITTAIN TESTATTU | Uusi 3D-tyylivalinta testattu oikeassa eristetyssä React/Electron-fixturessa, 600/1440 px. Koko editorin käytettävyyskokeet avoimia. |
| Ääni | KARTOITETTU | Kokoro englanniksi, oma ääni etusijalla; oikea kuuntelu ja malliajo avoimia. |
| QA | ENSIMMÄINEN PAKETTI TESTATTU | 1270/1270 testiä, typecheck, private-build ja Electron-fixture läpäisivät. Taiteellinen hyväksyntä, äänikuuntelu ja pilvi/GPU avoimia. |
| Ideoitsija | KARTOITETTU | Ensisijainen havainto: 2D/3D-tyyliero ja ristiriitainen pilvidokumentaatio. |
| Lopputarkastaja | KATSELMOITU | Ensimmäinen diff ja näyttörajat tarkastettu saman suorittajan erillisessä vaiheessa; ei riippumatonta hyväksyntää. |

## Ensimmäisen muutoksen suunnitelma
`ToonProfile.renderStyle?: flat | cel`: litteä tyyli valitaan eksplisiittisesti Ohjauspöydässä; oletus sekä vanhat profiilit ilman kenttää cel. Renderer kuljettaa tyylin ja reunaviivan leveyden jokaisen kolmion mukana; flat säilyttää mesh-värin eikä piirrä tummaa siluettia. Projektilukija validoi valinnaisen tyylin. Testit tarkastavat renderöinnin, vanhan profiilin, tyylin validoinnin ja tallennus-roundtripin. Luuranko, skinning ja 2D-resurssit säilyvät.
Suunnitelman tarkastus: rajattu ja toteutuskelpoinen; toteutuksen tekijän oma tarkastus, ei riippumattoman agentin hyväksyntä.

Muuttuvat tiedostot: `lib/toon3d.ts`, `lib/toon-render.ts`, `lib/production-model.ts`, uusi `lib/toon-style.test.ts`, dokumentaatio. Yhteinen formaattirajapinta on arkkitehdin vastuun tarkastelussa. Työtä ei julkaista eikä viedä alkuperäiseen repoon tässä vaiheessa.

## Valmiit tuotokset
- Kymmenen itsenäistä promptia: `docs/tiimi/promptit/`.
- Promptien indeksi ja työjärjestys: `docs/tiimi/README.md`.

## Todennuksen rajat
Ei tässä vaiheessa hyväksyttyä hahmon ulkoasua, AI-vertailukuvaa, oikeaa pilvi/GPU-ajoa tai käyttäjän aineiston lähetystä. Ei uusia sovelluksen käyttäjälupia.

## QA-löydös: PSD-tuonnin ryhmäsyvyys
Varmennettu tunnetulla TODO-testillä: `lib/psd-import.ts` tarkistaa myös tyhjän lapsilistan syvyydellä 21. Odotettu: 20 ryhmää hyväksytään; toteutunut: hylätään. Vakavuus: keskitaso. Korjaus kuuluu full-stack/importer-vastuulle: tyhjä lista ei lisää syvyyttä. Testin TODO poistetaan vasta korjauksen jälkeen. Muuttuvat tiedostot: lib/psd-import.ts ja lib/psd-import.test.ts.

## Arkkitehtuurikatselmoinnin tarkennus
Vanha kohtaus voi käyttää toon3d:tä myös ilman tallennettua characterProfiles-kenttää. Siksi globaalien oletusprofiilien muuttaminen flat-tyyliin muuttaisi sen ulkoasua. Säilytetään kirjaston legacy-oletus; litteä tyyli otetaan käyttöön näkyvällä hahmokohtaisella valinnalla Ohjauspöydässä. Muutos käyttää olemassa olevaa change/undo-polkuja. Lisätään components/production-board.tsx UX-vastuun tarkasteluun.

## Ensimmäisen diffin todennus
Korjausten jälkeinen `npm test`: 1270/1270 läpi, ei skippejä eikä TODO-testejä. Myös todellinen FFmpeg/ffprobe-testivideo varmennettu olemassa olevilla paikallisilla binääreillä. Buildin ensimmäinen yritys estyi Viten .vite-temp-kirjoitukseen; seuraava käyttää configLoader runner -asetusta. Typecheck löysi testifixtuurista puuttuvan Event.basis-kentän; se korjattiin ennen uutta buildia.

Electronin CLI latasi puuttuvan Electron-binäärin automaattisesti hyväksytyn GUI-komennon yhteydessä ja täydensi lähderepon jaettua node_modules/electron-asennusta. Alkuperäisen repon lähdekoodia, projekteja tai käyttäjän untracked-tiedostoja ei muutettu. Ensimmäinen preview-ajo käynnistettiin liian aikaisin ennen fixture-buildin valmistumista ja päättyi `Preview did not load` -virheeseen; tämä ei ole tuotantosovelluksen testitulos. Uusi ajoskripti odottaa buildin valmistumista ennen Electronia.

Visuaalisen todennuksen tiedostot: docs/tiimi/preview.html, preview.tsx, scripts/team-preview-vite.config.mjs, team-preview.mjs ja team-preview-run.mjs; package.json saa komennon team:test:preview. Fixtures käyttävät vain kirjastohahmoja.

## Ensimmäisen työpaketin lopputulos

- Kymmenen promptia valmiina, kaikki erottelevat koodista todetut asiat, ehdotukset ja avoimet kysymykset.
- 3D:n tyylivalinta toteutettu olemassa olevan change-polun kautta. Uusi style-kenttä ja .hahmo-roundtrip testattu; kentättömän legacy-profiilin ja ilman profiilia tallennetun kohtauksen vanha rendering säilyy.
- PSD:n täsmälleen 20 ryhmän rajavirhe korjattu, alkuperäinen TODO-testi läpäisee normaalina testinä.
- `npm test`: 1270 testiä, 1270 läpäisi, fail/skip/todo 0. `npm run typecheck`: exit 0. `npm run build:private -- -- --configLoader runner`: exit 0. Buildissa on olemassa olevia chunk-koko/dynamic-import-varoituksia; nämä eivät estäneet buildia.
- `npm run team:test:preview`: exit 0. Electron 44.5.1 darwin; style cel → flat oikealla React-change-tapahtumalla; 20 canvasia sekä 600 että 1440 px näkymässä; ei vaakaylivuotoa eikä konsolivirheitä.
- `git diff --check`: exit 0. Tarkastus kattaa seurattujen tiedostojen diffin; uudet promptit ja testifixture tarkastettu erikseen.
- Todennuslokit ja kuvat: `docs/tiimi/todennus/`. `3d-vertailut.png` katsottu; näyte ei ole AI-vertailukuva eikä taiteellinen hyväksyntä.

## Avoin visuaalinen löydös
Neljän toon-hahmon staattisissa vertailukuvissa näkyy vaatteen helman sahalaita; meshien päällekkäisyys/syvyyspiirto on selvitettävä ennen hahmon hyväksyntää. Ilmiö näkyy myös aiemman cel-tyylin vertailussa. Varmennettu havainto: kuva; tarkka koodisyy on epäily, ei tässä ratkaistu bugidiagnoosi. Vakavuus: keskitaso, vastuu: 3D-animaatio. Lisäksi 3D-meshien hius- ja asuyksityiskohdat tarvitsevat taiteellisen vertailun PSD-versioon.

## Seuraava työ
3D-geometrian nivel-/helmatarkastus ja liikkeen ääriasentojen näytteet → 2D/3D-hahmotaiteen hyväksyntä → version/hash-sidottujen AI-vertailukuvien kartoitus. Sen jälkeen koko editorin undo/vienti ja äänen kuuntelu pilottijaksolla. Näitä ei merkitä valmiiksi tämän kierroksen perusteella.


## Käyttäjän uusi toimeksianto 8.10.2026
Kaikki asiantuntijapromptit GitHubiin, vähintään yksi englanninkielinen Kokoro-esimerkki ja jokainen asiantuntija töihin. Rinnakkaiset agentit käynnistetty: arkkitehti/sääntömoottori (englanninkielinen esimerkki), 3D-animaatio (helman sahalaita/geometria) ja tekoäly (nykytilan suunnitelma ja puutteiden testaus). Koordinoija omistaa GitHub-viennin ja full-stack/integraation. 2D, UX, ääni, QA, ideoitsija ja riippumaton lopputarkastaja käynnistetään seuraavissa työerissä kapasiteetin vapautuessa. Vain koordinoija päivittää TIIMI.md:tä; agentit kirjoittavat omat raporttinsa docs/tiimi/raportit/.


## Rinnakkaisen asiantuntijakierroksen tilanne 9.10.2026

Kaikki kymmenen vastuualueetta ovat tehneet työnsä: yhdeksän erillistä asiantuntija-agenttia sekä koordinoija full-stack/integratiovastuussa. Edellisen päivän käyttörajaan keskeytyneet 2D-, UX- ja äänityöt jatkettiin tallentuneista tiedostoista.

Paikallinen toteutushaara: `codex/asiantuntijat-2026-10-09` (vielä commitoimaton yhteinen diff). GitHub-julkaisu käyttäjän luvalla: `codex/asiantuntijapromptit-2026-10-08`, head `4f83c44a9bbbb602480a9b47934e726a1bba030a`; kymmenen promptia, indeksi ja `public/library/Esimerkki-kokoro-en.md`. Toteutuskoodia ei ole pushettu tai yhdistetty mainiin.

| Vastuu | Tehty | Näyttö / avoimet |
|---|---|---|
| Arkkitehti/sääntömoottori | kokoro-en-pohja, englanninkielinen nykyisten hahmojen esimerkki, determinismi ja äänisuunnitelma | 16/16 kohdennettua testiä; raportti01 |
| 2D/hahmotaide | Todellisten PSD/hahmopakettien viivattomuus, värit, rig-ID:t ja nivelpeitto tarkastettu; ei asset-muutoksia | 12/12 + 6/6 liiketestit; katsottu liike ja taidehyväksyntä avoimia; raportti02 |
| 3D/animaatio | Eksplisiittinen flat/cel-tyyli ja flat-helman leikkaavan geometrian korjaus; legacy säilyy | 23/23 kohdennettua testiä; uusissa kuvissa suuri sahalaita poistui, pienet artefaktit ja taide avoimia; raportti03 |
| Full-stack/Electron | Peruttu encoder ei käynnisty; PSD-syvyysraja koskee ryhmiä myös tyhjinä | encoder+native5/5; PSD9/9; raportti04 |
| Tekoäly | Puuttuva mallilukitus näkyy estettynä; tuotu lukitus erotetaan muista renderöintiporteista | 15/15 paikalliset testit; todellinen pilvi/GPU avoin; raportti05 |
| UX | Cast-fieldset estää kaikki muokkauskentät; AI-lataustila aria-busy/status | SSR3/3 + vanha suite; oikea Electron tarkisti myös disabled- ja modelPins-estotilat600/1440px; VoiceOver/fokuspolku avoimia; raportti06 |
| Ääni/dialogi | English-esimerkki, testimoottorin synteesi/WAV, oma ääni etusijalla, lukitus ja suuajat | 13/13; ei oikeaa Kokoro-inferenssiä tai kuunteluhyväksyntää; raportti07 |
| QA/tuotanto | Testimatriisi ja koko sarjan ajot | Oletusajossa1285/1286: yksi nativeFFprobe-fail; erillinen native3/3pass; koko uusinta käynnissä; raportti08 |
| Ideoitsija | Viisi priorisoitua tuotantopullonkaulaa ehdotuksineen ja htp-haarukoineen | Raportti09; ei automaattista uusien ominaisuuksien toteutusta |
| Lopputarkastaja | Riippumaton tuotantodiffin, legacy-yhteensopivuuden ja näyttörajojen katselmointi | Ei uutta kriittistä/korkeaa löydöstä; loppuhyväksyntä odottaa koko sarjan valmistumista; raportti10 |

Yhteinen typecheck-uusinta exit0. Edellisessä sandbox-ajossa olemassa olevien lähdetiedostojen luvut aikakatkaisivat; suora luku ja Git-vertailu myöhemmin onnistuivat. Electron-fixture exit0: viisi todellista tarkistusta (tyylivaihto, kaikki cast-kentät disabled, cloud modelPins esto,600/1440px). Tämä on eristetty komponentti/Canvas-näyttö, ei paketoitu sovellus, VoiceOver, äänen kuuntelu tai GPU-ajo. Private-build loppurevisiolle käynnissä.

PSD-korjauksen tarkennus: vain `l.children`-ryhmät lisäävät rekursiotason. Leaf ei lisää tyhjää tasoa;20sisäkkäistä ryhmää hyväksytään ja21myös tyhjänä hylätään. Riippumaton lopputarkastaja katselmoi tämän täsmennyksen.


## Ympäristön todennusrajaus 9.10.2026

Private-build exit0 ja oikea Electron-fixture exit0. Koko normaali testisarja1285/1286, nativeFFprobe-fail; sama native-testi yksin3/3pass. Normaalin uusinnan FFmpegpass, mutta UI-testimoduuli odotti tiedostolukua. Concurrency2-uusinta odotti cloud-secrets-testin synkronista git grep -aliprosessia; ei pass-väitettä. QA lopetti nämä Documents-ajot.

Sama lähdekoodi materiaalistettu `/private/tmp/hahmostudio-20261009-verification`: HEAD purettu paikallisista Git-objekteista ja26 tämän työn muuttunutta/uutta lähdetiedostoa verrattu SHA-256:lla. Manifesti verification-source-hashes.json. Väliaikainen Git-indeksi ja sama dependencylinkki sallivat alkuperäiset testit ilman skippejä. Oikeat paikalliset FFmpeg/ffprobe-binäärit kopioitu. QA:n riippumaton kokoajo käynnistyy tässä kopiossa; lopullinen raportti palautuu varsinaiseen työkopioon. Työtilan read/mmap-timeout ei ole peruste muuttaa tuotantokoodia tai löysätä testejä.


## Valmistuneet työt ja GitHub-vienti 9.10.2026

QA:n normaali npm test varmennetussa tmp-kopiossa: **1286/1286 läpäisi, exit0**, ei skippejä eikä TODO-testejä. Typecheck,tmp-typecheck,private-build ja Electron-fixture exit0. Kaikki kymmenen vastuualueetta ovat tehneet työnsä ja raporttinsa. Riippumaton katselmointi ei löytänyt uutta kriittistä/korkeaa regressiota, mutta katselmoijan päätöstekstin päivitys jäi agentin käyttörajaan; sitä ei esitetä uutena riippumattomana hyväksyntänä.

Käyttäjä pyysi kaikkien valmistuneiden töiden vientiä GitHubiin. Julkaisuhaara codex/asiantuntijat-2026-10-09. Koottu todennus ja avoimet hyväksynnät: docs/tiimi/todennus/VARMENNUS-2026-10-09.md. Aidon Kokoron kuuntelu, taiteellinen liikehyväksyntä, paketoitu toimituskoe ja GPU/pilvi pysyvät avoimina.


## GitHub-vienti valmis 9.10.2026

Kaikki valmistunut toteutus, testit, kymmenen promptia, raportit, vertailukuvat ja täydelliset lopulliset todennuslokit julkaistu GitHub-haarassa `codex/asiantuntijat-2026-10-09`. Koodi ei ole yhdistetty main-haaraan eikä asennettua KOETA-sovellusta korvattu. GitHub-haaran sisältö varmennetaan pushin jälkeen.


## Yhteinen Codex/Claude-integraatio 9.10.2026 — TYÖSSÄ

Käyttäjä valtuutti sovelluksen kehityksen jatkamisen sekä valmiiden haarojen yhdistämisen molempiin päähaaroihin. Työhaara `codex/yhteinen-jatko-2026-10-09`. Yhdistettyjen lähtöhaarojen SHA:t: asiantuntijat3b5aeb1,ClaudeAI746d21d,käsikirjoitus a2087dc,hahmografiikka23e2edf ja UI9ece0d5. Dokumentaatiohistoriat säilytetty. UI:n Näkymä-valikko siirtyi Projekti-valikkoon; tekoälypaneeli ja toimintohaku säilytettiin. 3D-lavasteet yhdistetty, mutta legacy-profiilien cel-ulkoasua ei muutettu hiljaisesti. Flat-pinnat ja helmakorjaus säilyvät.

Tyypintarkistus läpäisi ensimmäisen integraation. Koko testisarjan1383testistä1381läpäisi; epäonnistumiset olivat cold-startin5sraja ja20krivin kuormitusaikaraja. Uusinta rajatulla konkurenssilla ja erillisellä suorituskykymittauksella ennen johtopäätöksiä; testirajoja ei löysätä.

Jatkokehitys: AI-dialogin Tab/Shift+Tab-fokusrajaus ja fokuksen palautus toteutettu; oikean koko editorin GUI-testi valmisteilla. CLAUDE.md luotu ja yhteinen handoff-sääntö AGENTS.md:hen, jotta kumpikin työkalu jatkaa samaa työtä Gitin kautta.


## Codex → Claude: valmis yhdistetty lähde 9.10.2026

Nykyinen vaihe: VALMIS PÄÄHAAROIHIN. Integraatiohaara codex/yhteinen-jatko-2026-10-09. Koodi yhdistää Codexin asiantuntijatyön ja säilytettyjen neljän Claude-haaran tarkastetut lähtöpäät (AI746d21d,script a2087dc,gfx23e2edf,UI9ece0d5); historia säilyy. Ristiriidat ratkaistu säilyttäen kaikki kehitysmuistiot, uusi kiintiösääntö ja vanhojen projektien ulkoasu. Uusi fokuksen rajaus/eristys ja palautus on katsottu todellisessa GUI:ssa.

Lopullinen npm test 1383/1383pass,ei skippejä/TODOja,exit0. Typecheck ja private-build exit0. Electron9/9checks,600/1440px sekä koko editorissa että3D-fixturessa; ei konsolivirheitä. Npm-testin concurrency2hallinta ei muuta testejä tai aikarajoja. Täydet lokit ja kuvat: docs/tiimi/todennus/INTEGRAATIO-2026-10-09.md.

Käyttäjä on valtuuttanut valmiin työn yhdistämisen mainiin ja hahmostudio1.0-haaraan; sama testattu commit päivitetään atomisesti molempiin. Koneeseen asennettua KOETA.appia ei korvata Git-pushilla. Kiintiön viimeinen vaihehavainto13%jäljellä; valmista lähdettä tallennetaan ennakoivasti ennen10%rajaa.

Seuraava työ Claudelle tai Codexille: fetch/HEAD-tarkistus → kokoro-en-pohja hyväksytyllä olemassa olevalla paikallisella mallilla erillisessä pilottiprojektissa → kaksi kuunneltua repliikkiä → tallennus/uudelleenavaus → MP4:n katsottu synkka. Älä aloita uudelleen jo yhdistettyjä sääntö/UI/3D-korjauksia. Paketoitu Mac,taiteellinen liikehyväksyntä,VoiceOver jaGPU ovat edelleen avoimia. AGENTS.md ja CLAUDE.md sisältävät yhteiset säännöt.


## Checkpoint: Codex → Claude 9.10.2026 — JULKAISTU

Varmistettu sovelluslähde `0c3236a5633e65600746fb4a8bb0997fad4ce782` julkaistu atomisesti sekä mainiin että hahmostudio1.0-haaraan. Tämä sisältää kaikki tämän integraation tarkastetut Claude-haarat ja Codexin korjaukset; merge-historia säilyy. Lopullinen npm test 1383/1383,typecheck,private-build ja 9 Electron-checkiä läpäisivät; ei testien ohituksia tai aikarajojen löysäämistä. Lokit: docs/tiimi/todennus/INTEGRAATIO-2026-10-09.md.

Kiintiön varmennettu seuraava havainto: 5 tunnin ikkunasta 8 % jäljellä (92 % käytetty),checkpointRecommended=true. 10 %:n sääntö on lauennut. Sovelluskoodi oli juuri tallennettu molempiin päähaaroihin; tämä dokumentaatiocheckpoint julkaistaan samaan tapaan. Ei uusia suuria toteutusvaiheita ennen jatkajaa.

Jatkaja (Claude tai Codex): fetch main/hahmostudio1.0 ja tarkista paikallinen työ; lue AGENTS.md,CLAUDE.md ja docs/tiimi/JATKO-CODEX-CLAUDE.md. Seuraava konkreettinen tehtävä on oikea englanninkielinen Kokoro-kuuntelu ja MP4:n katsottu synkka erillisessä pilottiprojektissa käyttäjän jo hyväksytyllä mallilla. Älä aloita uudelleen yhdistettyjä korjauksia. VoiceOver,paketoitu toimituskoe,taiteellinen liikehyväksyntä jaGPU/pilvi ovat edelleen avoimia; testimoottorin ääntä ei esitetä aidon Kokoron hyväksyntänä.

Asennettua KOETA.app-bundlea ei korvattu lähdekoodin Git-yhdistämisellä. Käyttäjän omat projektit,äänet,mallit ja paikalliset keskeneräiset muutokset säilyvät.


## Claude: UI-minimalismi V7 ja V8 — 9.10.2026, TYÖHAARASSA

Työhaara `claude/project-thread-ojgcol`, pohjana main = hahmostudio1.0 = `0219edd`. Ei yhdistetty päähaaroihin tällä kierroksella.

Tehty:
- V7: alapalkissa Tekoäly-painike (`components/editor.tsx`, `lib/ai-status.ts` `aiChipLabel`). Teksti on "Tekoäly: paikallinen", ja työpöydällä lisäksi "pilvi pois/päällä" vain pääprosessista luetusta tilasta; tila luetaan uudelleen paneelin sulkeuduttua. Painike avaa saman Tekoäly-paneelin kuin Projekti → Näkymä → Tekoäly… ja ⌘K.
- V7: "Vie tekoälyrenderöitynä…" ⌘K-komentona (yksityinen palvelin ja työpöytä) sekä työpöydän vientidialogissa (`components/export-panel.tsx`, prop `cloud`). Avaa olemassa olevan pilvirenderöintidialogin; uutta pilvitoimintoa ei lisätty. Ominaisuuskartassa koti `cloud-export`.
- V8: Asetukset → Asiantuntijatila (`components/expert-settings.tsx`, `lib/expert-mode.ts`), oletus pois, näkymäasetus localStoragessa (ei projektidataa). Pois ollessa `expert-detail`-tiedot piilotetaan CSS:llä: versioiden SHA-256, viennin render-revisio, tuotannon resurssiviitteet ja tuotantokomentojen loki. Mitään ei pureta eikä poisteta.
- Kapea ruutu (≤ 600 px): alapalkki rivittyy, joten Tekoäly-painike ei leikkaudu.

Testattu (Linux-pilvi, Node 22):
- `npm run typecheck` exit 0; `npm run build:private` exit 0 (vanhat chunk/dynamic-import-varoitukset).
- `npm test`: 1388 testiä, 1387 pass, 0 fail, 1 skip (todellinen FFmpeg-testi: natiivi FFmpeg puuttuu pilviympäristöstä; ei koodiohitus). Uudet testit: `lib/expert-mode.test.ts`, `aiChipLabel` `lib/ai-status.test.ts`:ssä, V7-kytkennät `server/ai-panel.test.mjs`:ssä.
- Selain (Vite dev, Chromium, web-tila ilman bridgeä) 390/600/820/1440 px: painike näkyy alapalkin sisällä, avaa paneelin, fokus menee dialogiin ja Esc palauttaa sen painikkeeseen; asiantuntijatila asettaa `data-expert=on` ja tallentuu; ei vaakavieritystä eikä konsolivirheitä. Kuvat: `docs/tiimi/todennus/ui-v7-v8/`.

Avoimet hyväksynnät: vientidialogin "Vie tekoälyrenderöitynä…" ja pilvitilan teksti oikeassa Electron/Mac-sovelluksessa (ei ajettu; stub-bridge-kokeilu ei käynnistänyt editoria, eikä sitä esitetä todennuksena). VoiceOver, paketoitu Mac ja aiemmat avoimet hyväksynnät (Kokoro-kuuntelu, MP4-synkka, taiteellinen liike, GPU/pilvi) ennallaan.

V5 jatko (toinen commit samassa haarassa): Roolituksen hahmokortissa näkyy kuva, nimi, "Valitse" ja "Tiedot". Kuvaus, laatuteksti ja PSD/hahmopaketin lataus ovat Tiedot-osion sisällä, kuvaus myös kortin vihjeenä; luonnoksilla puuttuvat ominaisuudet näkyvät edelleen. Painikkeen saavutettava nimi on yhä "Valitse <hahmo>" (ui-census toimii). Mitattu web-versiossa (Chromium, 1440 px): hahmokirjaston näkyvät sanat 107 → 39, koko sivun 288 → 220; ei vaakavieritystä 390/1440 px. Kuvat `roolitus-ennen/jalkeen-*.png`. Typecheck, build:private ja npm test (1387 pass, 1 skip FFmpeg) ajettu uudelleen tämän jälkeen.

Seuraava konkreettinen työ: V5:n Esitys-korttien siirto, vasemman paneelin siivous lukituissa vaiheissa (`components/editor.tsx`, `styles/koeta-minimal.css`), sitten V7:n Tarkastelijan Tekoäly-välilehti. Kiintiö: Claude ei näe omaa käyttörajaansa tässä ympäristössä; Codexin mittaria ei käytetty.


## Claude: agenttikierros UI-minimalismi V2/V5/V6 — 9.10.2026

Käyttäjä hyväksyi edellisen työn viennin ("Vie nyt"): main ja hahmostudio1.0 → `c7c22bd` atomisesti ilman force-pushia. Sen jälkeen käyttäjän pyynnöstä kolme rinnakkaista agenttia omissa worktreissään; koordinoija yhdisti haarat haaraan `claude/project-thread-ojgcol` merge-commiteilla (historia säilyy).

- `claude/agentti-vasen-paneeli` @ `379624e` (V2): Storyboard/Kuvaus/Leikkaus-vaiheiden vasen paneeli näyttää yhden rivin "Muokkaa Tarinassa" (`goFlowStep('script')`); lukittu banneri, tapahtumakopio ja valmistelulomake piilotetaan CSS:llä (`styles/minimal-vasen.css`, `presentation-panel--locked`). Tarina ennallaan, lukituksen ollessa pois ei piiloteta mitään.
- `claude/agentti-roolitus-tyopaja` @ `bc1911f` (V5 loppu + Työpaja): Roolitus avautuu Näyttämö-välilehdelle (`lib/workspace.ts`), laitekortit Esitys-välilehdellä; kameran käynnistys ja paluu kameran ollessa päällä vievät Esitykseen. Valekameralla todennettu, että kamera ja mikrofoni eivät pysähdy välilehden tai vaiheen vaihdossa. Työpajan tasopuun ryhmät alkavat suljettuina, valittu taso avautuu; harvinaiset "Lisää"-osioon (`styles/minimal-roolitus.css`).
- `claude/agentti-aikajana` @ `51ba52d` (V6): aikajanan kontrollit yhdelle riville, Mittaus/toinen kumoa/asetukset "Lisää ⋯" -osioon (`components/animation-panel.tsx` barTarget/moreTarget, `styles/minimal-aikajana.css`); alapalkin Sulje kamera/mikrofoni mahtuvat 26 px palkkiin.
- Yhdistämisen ristiriidat: editor.tsx (lisätty `onEditScript`-prop roolitushaaran versioon) ja main.tsx (kaikki kolme tyyli-importtia). V2:n testi vaati minimal-vasen.css:n olevan viimeinen import; muutettu vaatimaan, että se ladataan koeta-minimal.css:n jälkeen.

Testattu yhdistetyllä lähteellä (Linux-pilvi): `npm run typecheck` 0, `npm run build:private` 0, `npm test` 1389 testiä, 1388 pass, 0 fail, 1 skip (natiivi-FFmpeg puuttuu ympäristöstä). Selain (Vite dev, Chromium) kaikki kuusi vaihetta 1440/820/390 px: ei vaakavieritystä eikä konsolivirheitä; "Muokkaa Tarinassa" täsmälleen lukituissa vaiheissa. Hallintolaskuri (1440×900) ennen → jälkeen: Tarina 42 → 42, Roolitus 53 → 54, Storyboard 41 → 35, Kuvaus 48 → 42, Leikkaus 45 → 50, Työpaja 58 → 37 (budjetissa). Sanat laskivat kaikissa paitsi Tarinassa. Kuvat `docs/tiimi/todennus/ui-agentit/`.

Avoimet: Roolitus ja Leikkaus ovat yhä yli hallintobudjetin (Leikkauksen kasvu johtuu aikajanan näkyviin mahtuvista raitariveistä; laskuri tarvitsee raitojen erillisen säännön). Tarina-vaihetta ei käsitelty. Mac-sovellus, Electron, VoiceOver ja Lisää ⋯ -osion toimintojen ajo (kumoa, fps-tallennus, asetukset) tarkistamatta.

Seuraava työ: Roolituksen Näyttämö-välilehden päällekkäiset kentät (X/Y/Koko, `components/scene-panel.tsx`), Tarina-vaiheen hallinnot, census-sääntö aikajanan raidoille, V7 Tarkastelijan Tekoäly-välilehti.


## Claude → Codex: toinen agenttikierros ja handoff — 9.10.2026

Nykyinen vaihe: VALMIS OSA PÄÄHAAROISSA, YKSI TYÖ KESKEN. Integraatiohaara `claude/project-thread-ojgcol`; sama testattu commit viedään mainiin ja hahmostudio1.0:aan (SHA tämän kirjauksen commit; tarkista `git log -1 origin/main`). Edellinen julkaisu `6d733ac`.

### Tehty ja yhdistetty (agenttihaarat säilytetty GitHubissa)
- `claude/agentti-nayttamo` @ `7c35512`: Näyttämö-välilehden X/Y/Koko/"Sovita keskelle" suljetun "Tarkka sijainti" -osion taakse (`components/scene-panel.tsx`, `styles/minimal-nayttamo.css`). Koskee Roolitusta ja Kuvausta.
- `claude/agentti-laskuri` @ `7e0e7a3`: `scripts/ui-census.mjs` erottaa sisällön (`CONTENT_RULES`: aikajanan raidat, kuvakortit, kirjastokortit, käsikirjoitusrivit, tasopuu) budjetin kuormasta, tulostaa vyöhykkeet, `--json`, `--list`; testi `server/ui-census.test.mjs`. Leikkauksen kuorma 37 sekä 900 että 1200 px korkeudella.
- `claude/agentti-tekoaly-valilehti` @ `5386cfe`: Tekoäly-välilehti Tarkastelijaan (`components/ai-panel.tsx` `AiContent`/`AiInspectorTab`, editor.tsx `openAi()`); yli 850 px ja oikea paneeli näkyvissä → välilehti, muuten dialogi (Tarina, Storyboard, kapeat ruudut). Pilvitoiminnot ja natiivivahvistukset siirretty muuttamattomina. `styles/minimal-tekoaly.css`.
- Yhdistämisen ristiriidat vain main.tsx:n tyyli-importeissa (kaikki säilytetty).

### Testattu yhdistetyllä lähteellä (Linux-pilvi, Node 22)
- `npm run typecheck` 0, `npm run build:private` 0, `npm test` 1397 testiä: 1396 pass, 0 fail, 1 skip (natiivi-FFmpeg puuttuu ympäristöstä).
- Selain (Vite dev, Chromium) kaikki kuusi vaihetta 1440/820/390 px: ei vaakavieritystä, ei konsolivirheitä.
- Hallintolaskuri 1440×900 (kuorma/sisältö/sanat): Tarina 34/26/1089, Roolitus 44/8/302, Storyboard 29/6/245, Kuvaus 40/2/314, Leikkaus 37/13/482, Työpaja 30/8/97. Vain Työpaja on budjetissa (`--check` epäonnistuu viidellä vaiheella).

### Kesken (ei päähaaroissa)
- `claude/agentti-tarina` @ `aa13c13`: Tarina-vaiheen keventäminen (script-command-palette, script-compose-editor, script-guide, studio-feature-map, `styles/minimal-tarina.css`, ui.test). Agentti commitoi sen, mutta raportti ja koordinoijan tarkistus puuttuvat käyttäjän pyytäessä vientiä. Ennen yhdistämistä: lue diff `git diff 6d733ac claude/agentti-tarina`, aja typecheck/test/build ja hallintolaskuri, katso Tarina 1440/820/390 px tyhjänä ja esimerkillä, ja tarkista, että jokaisella piilotetulla toiminnolla on koti tai ⌘K-komento. Odotettu ristiriita: main.tsx:n tyyli-importit.

### Tarkistamatta (kaikki agenttikierrokset)
- Työpöytä/Electron ja paketoitu Mac: Tekoäly-välilehden pilviohjaimet ja natiivivahvistukset, työpöydän valikon Tekoäly… → välilehti, vientidialogin "Vie tekoälyrenderöitynä…", Whisper/Kokoro-tilat.
- Aikajanan "Lisää ⋯" -osion toimintojen ajo (kumoa, fps-tallennus, asetukset); VoiceOver.
- Aiemmat avoimet: aito Kokoro-kuuntelu ja MP4-synkka, taiteellinen liikehyväksyntä, GPU/pilvi.

### Seuraava konkreettinen työ
1. Tarkista ja yhdistä `claude/agentti-tarina` (yllä).
2. Budjetit: Roolitus (oikea 10, vasen 9, aikajana 6), Kuvaus (vasen 19: äänitys ja palikkaeditori → Tarkastelija suunnitelman mukaan), Leikkaus 37/35, Storyboard 29/25 (vasen paneeli piiloon oletuksena).
3. Työpöydän todennus oikealla Macilla: `npm run desktop:package:mac`, Tekoäly-välilehti ja pilviohjaimet.

Omistetut tiedostot tällä kierroksella: components/scene-panel.tsx, components/ai-panel.tsx, components/editor.tsx (inspector-tabs, openAi), scripts/ui-census.mjs, styles/minimal-*.css. Kiintiö: Claude ei näe omaa käyttörajaansa tässä ympäristössä; Codexin 5 tunnin mittaria ei käytetty eikä esitetä Clauden kiintiönä.


## Codex → Claude: Tarina ja vaihebudjetit — 9.10.2026

Lähtö: molemmat GitHub-päähaarat `0dc572e52f710454b34613e33c7545628ea0bdf5`.
Tarina-haara `aa13c1365470a8552df60701bd39a6969c097606` yhdistettiin työhaaraan (merge `898f591`); molempien käyttöliittymäkerrosten tyylit ja testit säilytettiin.

Koodista todettu ja toteutettu:
- Roolituksen tarkat näyttämöasetukset ja näkymävalinnat avautuvat erikseen. Aikajana ei vie tilaa suljettuna.
- Kuvakäsikirjoitus avautuu ilman kirjastosivupalkkia; käyttäjä voi palauttaa sen Näkymä-valikosta.
- Lukituissa tuotantovaiheissa lohko- ja äänityökalut ovat Tarkastelijan avattavissa ryhmissä. Äänityksen käynnissä oleva ohjaus siirtyy pysyvään isäntään, jotta pysäytys ei katoa vaihetta vaihdettaessa. Tämän tallennuspolun oikea mikrofonitesti jää avoimeksi.
- Valitsemattoman osan muunnos ja avainruudun easing eivät vie oletusnäkymän tilaa.
- Laskuri käyttää näkyviä tekstialueita: suljetut details-sisällöt ja valitsemattomat select-vaihtoehdot eivät kuulu näkyvään UI-sanakuormaan. Käyttäjän sisältösanat raportoidaan erikseen `contentWords`-kentässä; budjettirajat eivät muuttuneet.

Todennus:
- `npm test`: **1401/1401 läpi**, ei ohituksia (Mac, Node 24).
- `npm run typecheck`: läpi.
- `VITE_BASE_PATH=/ VITE_PRIVATE_SERVER=true npm run build -- --configLoader runner`: läpi (npm run build:private ei välitä Viten runner-argumenttia oikein; käytä tätä komentoa).
- `node_modules/.bin/electron scripts/census-fixture.mjs`: oikean Chromiumin suljettu/avattu details ja select-valinta läpi.
- `node_modules/.bin/electron scripts/team-census.mjs`: sama laskentalogiikka kuin ui-census, eristetty sisäänrakennettu esimerkki, 1440/820/390 × 900. Kaikki kuusi vaihetta budjetissa. 1440 px hallinnat/UI-sanat: Tarina 20/110, Roolitus 30/93, Kuvakäsikirjoitus 23/97, Kuva 24/116, Aikajana 33/144, Työpaja 27/81. JSON, kuvat ja toimintatestien raportit: `docs/tiimi/todennus/codex-handoff/`.
- Lisää ⋯: 120 ruutua/24 fps → 5,0 s, 30 fps → 4,0 s; Kumoa → 5,0 s ja Tee uudelleen → 4,0 s. Testi odottaa muutosten ryhmittelyikkunan loppumista. Aloituspohjat → Try English example lataa englanninkielisen lähteen; oikeaa Kokoro-inferenssiä ei tehty.
- `npm run desktop:test:cloud`: läpi; oikea Electron/IPC/utilityProcess ja työpöydän Tekoäly-välilehden pilviohjaimet, synteettinen eristetty suostumus. Mallilukituksen puuttuessa kustannustila on oikein **estetty**. Ei oikeaa palvelupyyntöä eikä käyttäjän pilvilupaa.
- Mac-koepaketti: `electron_config_cache=/Users/Aleksi/Library/Caches/electron node scripts/package-mac.mjs` sekä `npm run desktop:test:package` läpi. Natiivit ajokomponentit testattu paketista; ei asennetun sovelluksen korvaamista eikä laite-/GUI-hyväksyntää. Pakkaaja varoitti puuttuvasta .icon-muodosta; .app ja ZIP valmistuivat.

Avoimet hyväksynnät: VoiceOver, paketoidun sovelluksen käyttöliittymä ja oikeat kamera/mikrofoni, käynnissä olevan äänityksen vaiheenvaihto, oikea Kokoro-inferenssi/huulisynkka, taiteellinen hahmojen hyväksyntä sekä GPU-/palvelinajo. Selainmittaus tai simuloitu testisuostumus ei sulje näitä.

Seuraava työ: testaa yllä oleva äänityksen vaiheenvaihto ja Mac GUI erillisellä testidatalla, tee VoiceOver-kuunteluhyväksyntä, sitten Kokoron oikea englanninkielinen ajo olemassa olevan luvallisen mallin kanssa. Älä lisää uusia pilvilupia tai korvaa käyttäjän asennettua sovellusta.

Kiintiön viimeinen vahvistettu havainto ennen julkaisuvaihetta: ensisijainen 300 minuutin ikkuna **16 % jäljellä**, viikko 71 %. Kynnys 10 % koskee ensimmäistä; uusi tarkistus tarvitaan seuraavan työvaiheen alussa.

Viimeinen kiintiötarkistus ennen GitHub-pushia: **11 % jäljellä / 300 min**, viikko 70 %. Tekstitodennukset tallennettu .txt-muodossa, koska .log kuuluu projektin ignore-sääntöihin.


## Claude: 390 px vaiherivi ja Tarinan tarkistus-/palikkarivien selaintesti — 9.10.2026

Lähtö: main = hahmostudio1.0 = `305d5c0` (Codexin Tarina-viimeistely ja todennusaineisto). Codexin haaroissa (`codex/*`) ei ollut yhdistämätöntä työtä. Työhaara `claude/project-thread-62aw80`; sama testattu commit viedään main- ja hahmostudio1.0-haaroihin (tarkista `git log -1 origin/main`).

Tehty:
- 390 px:n vaiherivi (testaajan kierros 9, kosmeettinen): ≤ 480 px:ssä vaiheiden sivutäyte 7 → 6 px ja Työpaja pelkkä kuvake; nimi säilyy `aria-label="Työpaja"` (`components/studio-shell.tsx`, `styles/koeta-responsive.css`). Kaikki viisi vaihetta mahtuvat 390 px:iin ilman vieritystä. Vielä kapeammalla (320 px) rivi vierii, ja valittu vaihe vieritetään nyt näkyviin.
- Samassa mediakyselyssä Näyttämön otsikkorivin "Hahmon kuvakulma" -teksti piilotetaan (select säilyttää aria-labelin), koska valinta leikkautui oikeasta reunasta.
- Löydös selaintestissä ja korjaus: "Näytä palikkaeditori" (Työkalut /) avasi editorin käsikirjoituksen alle näkymän ulkopuolelle (1440 px: y = 1001), joten mitään ei näyttänyt tapahtuvan. Avattaessa editori vieritetään nyt näkyviin (`components/presentation-panel.tsx`).
- Korjausehdotusten otsikko ei enää ala reunasta tarkistuksen ollessa auki (`styles/minimal-tarina.css`).

Testattu (Linux-pilvi, Node 22):
- `npm run typecheck` 0; `npm test` 1402 testiä, 1401 pass, 0 fail, 1 skip (natiivi-FFmpeg puuttuu ympäristöstä); `npm run build:private` 0. Uusi testi `server/ui.test.mjs` (puhelinleveys…).
- Selain (Vite dev, Playwright-Chromium, `docs/tiimi/editor-preview.html`), rakennettu esimerkkijakso, 1440/820/390 px: Tarkistus ja ohjaus -rivi näkyy (2 ehdotusta), avaa ja sulkee tarkistuksen (`aria-expanded`); Työkalut / sisältää "Näytä tarkistus ja ohjaus" ja "Näytä palikkaeditori"; palikkaeditori aukeaa (16 painiketta) näkyviin ja sulkeutuu "Piilota palikkaeditori"; Kuvaus-vaiheessa palikkaeditori on Tarkastelijan suljettu ryhmä. Ei vaakavieritystä, ei konsolivirheitä. Skripti ja kuvat: `docs/tiimi/todennus/claude-390-palikat/`.
- `scripts/ui-census.mjs --check` 1440×900 ja 390×900: kaikki kuusi vaihetta budjetissa (1440: Tarina 20, Roolitus 30, Storyboard 23, Kuvaus 24, Leikkaus 33, Työpaja 27).

Avoimet hyväksynnät ennallaan: VoiceOver, paketoitu Mac-sovellus ja oikeat laitteet, äänityksen aikainen vaiheenvaihto, aito Kokoro-inferenssi ja huulisynkka, taiteellinen hyväksyntä, GPU/pilvi. Palikoiden muokkausta (raahaus, Samalla-pudotus) ei ajettu selaimessa.

Seuraava konkreettinen työ: palikkaeditorin muokkaustoimintojen selaintesti (valinta, raahaus, Alt-pudotus repliikille, kumoa), sitten Codexin listaama äänityksen vaiheenvaihto ja Mac GUI. Omistetut tiedostot: components/studio-shell.tsx, styles/koeta-responsive.css (480 px -lohko), presentation-panel.tsx:n palikkaeditorin vieritys. Kiintiö: Claude ei näe omaa käyttörajaansa tässä ympäristössä; Codexin mittaria ei käytetty.


## Codex → Claude: Mac GUI ja repliikkitallennuksen vaiheenvaihto — 10.10.2026

Lähtö `d54d93ba4eb89d22c7d2d24824bd5d020049dcb2`; Clauden 390 px:n korjaukset säilytetty. Työhaara `codex/mac-recording-2026-10-10`. Julkaistun kirjauksen commit on molempien päähaarojen sama pää; tarkista `git log -1 origin/main`.

Koodista todettu ja korjattu:
- Pysyvä recording-tools-overlay-host ja PresentationPanelin recordingTarget-prop olivat olemassa, mutta editori ei välittänyt viitettä. Nyt recordingTarget={recordingToolsTarget} kytkee tallentimen pysyvään isäntään. Testi löysi alkuperäisen puuttuvan kytkennän.
- Äänityksen aikana kelluvassa paneelissa näkyvät vain Ääninäyttelijän työpiste ja sen ohjaimet; muut äänityökalut säilyvät mounted ja palaavat tallennuksen päättyessä. Repliikin valinta säilyy, pysäytys ja hylkäys pysyvät käytettävissä.
- Alapalkin Mikrofoni ei enää ilmoita “pois” repliikkitallennuksen aikana, vaan “repliikin tallennus”. Tämä kattaa myös tallennuksen käynnistämisen; se ei väitä fyysisen laitteen lupaa saaduksi ennen käynnistystä.
- Uusi `npm run desktop:test:workflow` ja `-- --packaged`: uusi eristetty datakansio joka ajolle, vanha raportti poistetaan, oikean appin --workflow-gui-test-tila. Käynnistysvirheet kirjoittavat uuden epäonnistuneen raportin. Paketista ajettu tulos vaatii packaged=true.

Testattu lopullisella lähteellä (Mac arm64, Node 24 / Electron 44.5.1):
- `npm test`: **1402/1402 läpi**, ei ohituksia, 33,6 s.
- `node --experimental-strip-types --test server/ui.test.mjs server/ai-panel.test.mjs`: 53/53 läpi. Käynnistys ja permission-policy: 5/5 läpi.
- `VITE_BASE_PATH=/ VITE_PRIVATE_SERVER=false npm run build -- --outDir dist-desktop --configLoader runner`: läpi, sisältää tsc --noEmit.
- `npm run desktop:test:workflow`: läpi. Kuusi vaihetta kahdella leveydellä, ei vaakaylivuotoa. Raportissa todellinen koko (macOS rajoittaa korkeuden työalueeseen).
- `electron_config_cache=/Users/Aleksi/Library/Caches/electron node scripts/package-mac.mjs`: erillinen koepaketti valmistui. app.asar:n main.mjs, workflow-diagnostic.mjs ja buildin index.html vastasivat nykyistä lähdettä tavuittain.
- `npm run desktop:test:workflow -- --packaged`: läpi **oikeasta .app-paketista**. Kuvaus → Storyboard → Roolitus → Leikkaus → Työpaja → Tarina äänityksen aikana: sama tallennin ja portaali, sama elävä äänivirta (yksi hankinta), pysyvä isäntä, käytettävissä ja näkyvä pysäytys sekä elementFromPoint-osumatesti. Tilateksti säilyy; Hylkää sulkee ääniraidan ja palauttaa tilan.
- `npm run desktop:test:package`: paketin natiivit ajokomponentit läpi.

Rajaus: äänisyöte oli testissä generoitu 220 Hz virta oikean AudioWorkletin läpi. Ei mikrofonin lupaa, fyysistä mikrofonia tai käyttäjän ääntä. Tallenne hylättiin; Lopeta ja käytä repliikki -toiminnon äänen liittäminen ja alkuperäisen äänen säilyminen, Rhubarb ja vientisynkka eivät saaneet uutta hyväksyntää. VoiceOver, kamera/mikrofoni oikeilla laitteilla, aito Kokoro-inferenssi, taiteellinen hyväksyntä ja GPU/pilvi jäävät avoimiksi. Asennettua sovellusta ei korvattu.

Todennusaineisto ja täsmälliset komennot: `docs/tiimi/todennus/mac-workflow-20261010/README.md`, erilliset source/ ja packaged/ JSON-raportit ja kuvat sekä .txt-lokit. Koneen kuormituksessa yksi kehitysvaiheen ajo ylitti paikallisen palvelun 15 s käynnistysrajan; rajoja ei väljennetty. Testin alkuperäiset DOM-kohdistukset korjattiin tuotantoportaalin tallentimeen, koska AudioAnalysis käyttää samaa DialogueRecorder-komponenttia ja portaali muuttaa elementtien järjestystä. Pakkaajan .icon-varoitus säilyy (sama kuin aiemmin), paketti ja testit valmistuvat.

Seuraava konkreettinen työ: testaa tallenteen **käyttäminen** repliikkina eristetyllä generoidulla syötteellä ja projektin palautus/undo (ei käyttäjän omaa ääntä); sen jälkeen Kokoron aito englanninkielinen ajo olemassa olevalla luvallisella mallilla ja runtimeilla. Palikkaeditorin raahaus/Alt-pudotus sekä VoiceOver-kuunteluhyväksyntä ovat vielä avoimia.

Omistetut tiedostot: components/editor.tsx, components/presentation-panel.tsx (recordingActivity), styles/minimal-budjetit.css (vain aktiivinen tallennus), desktop/main.mjs (eristetty testitila), desktop/workflow-diagnostic.mjs, scripts/desktop-workflow-test.mjs, package.json (testikomento). Kiintiö ennen julkaisua: viiden tunnin ikkunassa **58 % jäljellä**, viikko 63 %. 10 % checkpoint ei lauennut.


## Codex → Claude: DMG-toimitus ja Mac-kehitysohje — 10.10.2026

Lähtö `69e759bebcaa45ebe70389c8195d1f9fd3aaeb74`, työhaara `codex/mac-dmg-2026-10-10`. Sovelluksen runtime-koodia ei muutettu. DMG sisältää edellisen kirjauksen testatun KOETA.app-paketin (0.36.0, arm64), jonka app.asar SHA-256 on `49dc85ff07e91eb0f88b67898a170ab32ff6a95f3c2ae1e4728453ee0035e29b`.

Tehty:
- `scripts/package-dmg.mjs`: tarkistaa lähde-.app:n allekirjoituksen ja version, tekee pakatun vain luku -DMG:n, Applications-linkin ja suomenkielisen asennusohjeen. Filename sisältää version, arkkitehtuurin ja todellisen app.asar-tarkistussumman alun. .sha256 ja .json ovat toimituksen vieressä. Uusia riippuvuuksia ei lisätty.
- `npm run desktop:package:dmg` rakentaa ja paketoi koko sovelluksen; `npm run desktop:dmg` käärii jo testatun .app:n.
- `npm run desktop:test:dmg -- <tiedosto>` liittää levyn vain luku -tilassa, varmistaa tarkistussummat, Applications-linkin ja .app:n syvän allekirjoituksen ja irrottaa levyn. Sovellusta ei asenneta.
- desktop-build ja desktop-dev käyttävät Viten configLoader runneria; desktop:build-komento testattiin kokonaisena, sisältää typecheckin. Tämä välttää config-väliaikaistiedoston kirjoittamisen symlinkatun node_modules-kansion kautta toiseen projektiin.
- docs/MAC_DESKTOP.md päivitettiin nykyiseen KOETA/DMG-kehitys- ja päivitystapaan; vanhat hahmot, 0.7-ohje ja väite Mac GUI:n estymisestä korvattiin nykytilalla. README:n aktiivinen pakettipolku korjattiin.

Todennus: `npm run desktop:build` läpi; DMG:n luonti ja hdiutil verify läpi; DMG:n liittäminen/Applications-linkki/app.asar-hash/codesign --verify --deep --strict/irrotus läpi. Lokit docs/tiimi/todennus/dmg-20261010/. Hostin hdiutil ilmoitti deprecation-varoituksen, komennot toimivat; Mac-yhteensopivaa API-siirtymää voi käsitellä myöhemmin erikseen. Sovelluskoodin aiemmat 1402 testiä ja paketoitu Mac GUI säilyvät samalle muuttumattomalle sovelluspaketille; koko sarjaa ei toistettu pelkkää toimituskäärettä varten.

Toimitus: `KOETA-0.36.0-arm64-49dc85ff.dmg`, noin 463 MiB, kopio käyttäjän Codex-työkansiossa `/Users/Aleksi/Documents/Codex/2026-10-08/`. DMG ja sidecarit ovat release/build-tuotoksia Gitin ulkopuolella. Lähdekoodi ja jatko-ohje julkaistaan samoihin main/hahmostudio1.0-päihin. Asennettua KOETA.app:a ja käyttäjän omaa Päivitä KOETA.command -tiedostoa ei muutettu.

Kehitys jatkuu Git-projektissa /Users/Aleksi/hahmostudio. Lähdekoodin päivitys ja uusi DMG eivät päivitä asennettua sovellusta: tallenna työ, ⌘Q, vedä uusi KOETA.app Ohjelmat-kansioon ja korvaa vanha. Projektit, asetukset ja luvallinen Kokoro-malli pysyvät paketin ulkopuolella. Ei automaattipäivityksiä, Developer ID -allekirjoitusta tai notarisaatiota; näitä ei myönnetä DMG:n ominaisuudeksi. Notarisaatio ja automaattipäivityspalvelu tarvitsevat erillisen toteutuksen.

Avoimet hyväksynnät ja seuraava konkreettinen sovellustyö säilyvät edellisestä kirjauksesta: tallenteen käyttäminen repliikkina + palautus/undo, oikea Kokoro-ajo ja vientisynkka, fyysiset laitteet, VoiceOver sekä palikkaeditorin raahaus/Alt-pudotus. Kiintiön viimeinen havainto ennen DMG-työtä: 51 % / 300 min, viikko 62 %; 10 % kynnys ei ollut saavutettu.


## Codex → Claude: äänitestien välitallennus — 10.10.2026 (KESKEN)

Työhaara `codex/audio-acceptance-2026-10-10`, lähtö `8d142c4`. Repliikkitallenteen PCM:n liittäminen, ajoitus/suu, undo/redo ja reload-palautus läpäisivät lähde-Electronissa generoidulla virralla. Palautettu ääni näkyy myös editorissa. Ei fyysistä mikrofonia.

Kokoron aito paikallinen inferenssi onnistui olemassa olevalla hyväksytyllä mallilla: af_heart, 24 kHz, 4,825 s, RMS 0,06864, ensimmäinen ajo noin 34,8 s. WAV on käyttäjän Codex-kansiossa Kokoro-englanti-test.wav, ei Gitissä. .private-runtime/kokoro:n koodiriippuvuudet asennettu. Kokoro-mallipainoja ei ladattu eikä lisätty pakettiin. 56 asennetun runtime-riippuvuuden lisenssitekstit lisättiin licenses/kokoro/THIRD_PARTY.txt:hen ja notices-generointiin.

Testi löysi index.html:n Google Fonts -pyynnön, jonka desktop-CSP esti reloadissa. Ulkoiset fonttilinkit poistettiin (paikalliset varafontit säilyvät). Suojauskäytäntöä ei väljennetty. Workflow-testin tarkka virheraportti säilytetään startup-catchissa. Kokoron vanhan testin 20 ms oletus korvattiin synteesin käynnistymisen signaalilla, ehtoja ei väljennetty.

Keskeneräistä: regressioiden lopullinen ajo, Kokoron IPC-testi ja uusi Mac-paketti, jossa runtime mukana. Pakkausta käynnistettiin ennen kuin runtime-notices valmistui; tarkista sisältö tai paketoi lopullinen lähde uudelleen. Vientisynkka, fyysiset laitteet ja VoiceOver edelleen avoimia. Käyttäjälle esitetty kysymys omasta mikrofonista/VoiceOver-kokeesta on vielä vastaamatta. Älä merkitse näitä hyväksytyiksi.

Omistus: index.html, desktop/main.mjs (testiraportti), desktop/workflow-diagnostic.mjs, desktop/kokoro.test.mjs, scripts/desktop-workflow-test.mjs, scripts/kokoro-real-test.mjs, scripts/desktop-notices.mjs, package.json, notices/licensing ja docs/tiimi/todennus/audio-20261010. Käytä npm run desktop:build ennen uutta paketointia. Tarkista source/ ja packaged/ raporttien ok sekä Kokoro IPC:n realInference ja vertaa paketin lisenssitekstejä. Viimeinen kiintiö 15 % / 300 min, viikko 57 %.


## Checkpoint 6 %: äänen hyväksynnän tilanne — 10.10.2026

Koko lopullinen regressioajo: **1402/1402 läpi**, ei ohituksia (146 s kuormitetulla Macilla). npm run desktop:build sisältäen typecheckin läpi. Repliikin liittäminen/PCM/ajoitus/suu/undo/redo/reload-palautus/editorin linkitetty ääni läpi lähde-Electronissa ilman konsolivirheitä. Kokoron aito paikallinen synteesi läpi (4,825 s); ei ihmisen kuunteluhyväksyntää tai vientisynkan hyväksyntää.

Uusi Kokoro-runtime-paketti epäonnistui codesignin kohtaan “invalid destination for symbolic link in bundle”. Konkreettinen korjaus on työhaarassa: kopioi runtime stagingiin dereference=true, rajaa .cache ja .onnx pois, paketoi staging/kokoro. Korjaus ei ole vielä paketointitestattu. Runtime-lisenssit mukana lähteessä. Mallipainot pysyvät sovelluksen tietokansiossa, eivät paketissa.

Viimeisin Kokoro-IPC-lisätesti päättyi jo esimerkkijakson rakentamisen aikakatkaisuun, joten IPC:n realInferencea ei hyväksytty. Sen jälkeen levytila loppui: shell ei voinut luoda edes heredoc-väliaikaistiedostoa. Poistettiin vain oman epäonnistuneen paketoinnin tmp-rqGXjE (1,1 GiB); vapaata nyt noin **1,4 GiB**. Käyttäjältä pyydetty levytilan vapauttamista (tavoite noin 4 GiB) ja omia mikrofonin/VoiceOver-havaintoja. Kumpaankaan ei vielä vastausta.

**Koodin jatkohaara:** codex/audio-acceptance-2026-10-10. Päähaaroihin viedään vain tämä jatkokirjaus; niiden sovelluskoodi pysyy viimeisessä varmennetussa 8d142c4-lähteessä. Vanha toimitettu DMG ei sisällä uutta Kokoro-runtimea. Älä ilmoita uutta DMG:tä valmiiksi.

Seuraava: vapaa levytila → lue työhaaran diff → suorita äänen IPC-testi yksin → paketoi dereferoidulla runtimella ja varmista allekirjoitus/lisenssit/ei Kokoro-painoja → paketoitu tallenteen ja Kokoro-IPC:n hyväksymistesti → DMG ja hdiutil/hash/codesign-tarkistus. Sitten vasta yhdistä testattu sovelluskoodi main/hahmostudio1.0. Fyysiset laitteet, VoiceOver ja MP4-synkka säilyvät erillisinä hyväksyntöinä. Kokoro-englanti-test.wav on käyttäjän Codex-kansiossa, ei Gitissä.

Viiden tunnin vahvistettu kiintiö **6 % jäljellä**, viikko 55 %. Tallennuskynnys laukesi, ei erillistä päiväkiintiötä. Keskeneräinen työ tallennetaan työhaaraan; päähaarat saavat varmennetun sovelluskoodin päälle vain jatko-ohjeen.
