# Tekoäly KOETA-työpöytäsovellukseen: suunnitelma

Tekijä: tekoälyasiantuntija (Kilsat Studio -tiimi, agentti 3) · 2026-10-08 · tila: **SUUNNITELMA HYVÄKSYTTY** (lopputarkastaja 2026-10-08, ehdoin alla)
Haara: `claude/tiimi-tekoaly-q1331b` (luotu `origin/hahmostudio1.0`:sta, kohta 6c51b83).

Tämä on pelkkä suunnitelma. Koodia ei muuteta ennen kuin lopputarkastaja merkitsee TIIMI.md:hen SUUNNITELMA HYVÄKSYTTY.

## Hyväksynnän ehdot (lopputarkastaja, 2026-10-08)

1. Pilvirenderöinnin lähetys noudattaa työpöydän palautussääntöä: checkpoint kirjoitetaan ennen dispatchia, ja palautunut renderöinti on `interrupted` ja vaatii käyttäjän uudelleenyrityksen. Kuuluu vaiheeseen 3 ja sen testiin.
2. Kuvaehdotukset käyttävät vain syntaksia, jonka nykyinen tunnistin jo ymmärtää; sanaston lisäys vaatii rivin `tests/fixtures/vocabulary-corpus.txt`:hen. Rivimuutoksen pitää kiertää `blockSentence`-edestakaisin muuttumattomana.
3. `presentation-panel.tsx` ja `components/ai-panel.tsx`: tarkka muutos kirjataan Pyyntöihin ennen tekoa, ja se pidetään kytkentänä; ulkoasu jää UI/UX:lle. Testataan, ettei vaihe 1 näytä pilviriviä toimintona ennen vaihetta 3 (teksti "ei saatavilla", ei painiketta).
4. Pushaus vain omaan haaraan, ei PR:iä.

## 0. Lähtötilanne (tarkistettu koodista)

- **Pilvirenderöinti** (`lib/cloud-render/`, ~2 000 riviä) toimii vain yksityisellä Node-palvelimella (`server/private-server.mjs`, `HAHMOSTUDIO_CLOUD_RENDER=1`). Koko alijärjestelmä rakennetaan funktiolla `createCloudRender(env, dataDir)`, joka lukee kaiken ympäristömuuttujista. Selain puhuu sille HTTP:llä (`/api/health|projects|ai|render|models|backends|compute`). Käyttöliittymä on `components/cloud-render-dialog.tsx`.
- **Työpöytä** (`desktop/main.mjs`): renderer on `contextIsolation:true, sandbox:true, nodeIntegration:false`; preload altistaa jäädytetyn `window.hahmostudio`-olion; jokainen IPC-käsittelijä tarkistaa lähettäjän (`validSender`). Paikallinen palvelu (`desktop/service.mjs`) on `utilityProcess`, joka ajaa samaa `createPrivateServer`-koodia 127.0.0.1:ssä httpOnly-evästeen takana, mutta **ilman** `cloudRender`-parametria.
- **Paikallinen tekoäly työpöydällä:** Rhubarb (suun asennot, aina mukana), whisper.cpp (litterointi, malli ladataan luvalla), Kokoro (englanti, malli ladataan luvalla, `AudioClip.synthetic`-merkintä), MediaPipe (kasvot, kamera). Käsikirjoituksen tulkinta on sääntöpohjainen, ei tekoälyä.
- **Ehdotukset:** `lib/review-suggestions.ts` tuottaa deterministisiä korjausehdotuksia muodossa `{before, after}` ja ne otetaan käyttöön vain vahvistuksella. Pilven `RuleBasedDirector` ehdottaa kuvakokoa/valoa; `LLMDirector` on olemassa mutta sitä ei koskaan rakenneta oletuksena.
- **Vertailukuvat:** `CharacterReferenceSystem` vaatii hyväksytyn kuvan jokaiselle hahmolle videotyönkuluissa; nykyään käyttäjä lataa tiedoston käsin.
- `safeStorage`a tai Keychainia ei käytetä vielä missään.

## 1. Arkkitehtuuri: pilvirenderöinti työpöydälle

### Vaihtoehdot

| | Kuvaus | Hyvää | Huonoa |
|---|---|---|---|
| A | Lisätään `cloudRender` nykyiseen paikalliseen palveluun (`service.mjs`); renderer kutsuu `/api/*` suoraan evästeellä kuten webissä | Vähiten koodia, sama UI kuin webissä | Renderer saa laajan HTTP-pinnan (kaikki reitit) ilman IPC-validointia; salaisuudet samassa prosessissa kuin puhepalvelu; pilvi käynnissä aina kun palvelu on |
| B | Ajetaan `createCloudRender` suoraan pääprosessissa | Ei uutta prosessia | Pitkät verkkokutsut ja raskas TS-moduuli pääprosessissa (kaatuminen kaataa sovelluksen); pääprosessin hyökkäyspinta kasvaa |
| **C (valinta)** | **Erillinen `utilityProcess` "KOETA · pilvipalvelu"**, joka käynnistetään vasta opt-inin jälkeen. Se **ei avaa porttia**: puhuu vain pääprosessille `parentPort`-viesteillä. Pääprosessi tarjoaa kapean `studio:cloud-*`-IPC:n, jonka jokainen syöte validoidaan `desktop/cloud-policy.mjs`:ssä | Renderer pysyy sandboxissa ja näkee vain sallitut toiminnot; salaisuudet vain pääprosessissa ja pilviprosessissa; pilvi ei ole olemassa ennen opt-iniä; kaatuminen ei kaada editoria; sama `lib/cloud-render`-koodi ja validoinnit kuin webissä | Uusi prosessi ja viestiprotokolla; desktop-build pitää paketoida `lib/cloud-render` (TS) |

**Perustelu:** C on ainoa, jossa kaikki vaatimukset täyttyvät yhtä aikaa: renderer ilman laajaa verkkopintaa, salaisuudet vain kahdessa luotetussa prosessissa, pilvi pois päältä fyysisesti (prosessia ei ole) ennen opt-iniä. Pilviprosessi käyttää olemassa olevaa `createCloudRender`-funktiota sellaisenaan, joten validoinnit, kustannusportti, `PaidComputeFirewall` ja tulosten tarkistus ovat samat kuin webissä eikä niitä kirjoiteta uudelleen. Uutta backendia tai tiliä ei lisätä.

### Tietovirta

```
Renderer (sandbox)          Pääprosessi (main.mjs)                  Pilvipalvelu (utilityProcess)       Ulkoinen
──────────────────          ──────────────────────                  ─────────────────────────────       ────────
window.hahmostudio.cloud*  → ipcMain.handle('studio:cloud-*')
                             1 validSender
                             2 cloud-policy.mjs: tiukka skeema,      
                               koko- ja tunnisterajat
                             3 opt-in päällä? muuten virhe
                             4 lähtevä data → natiivi lupadialogi
                               (mitä, minne, kustannus €0,00)
                             5 postMessage({id, op, args})        →  createCloudRender(config, dataDir)
                                                                     RenderService: validoi → portti
                                                                     → firewall → ComfyUI/Kaggle      → https-tunneli / Drive
                             6 vastaus: redact() + skeema         ←  {id, ok, body}
                    ← vain redaktoitu näkymä
```

- Salaisuudet kulkevat vain suuntaan pääprosessi → pilviprosessi (käynnistysviestissä), eivät koskaan rendereriin päin.
- Pilviprosessille ei anneta `process.env`-ympäristöä; konfiguraatio rakennetaan sallitulista avaimista (`HAHMOSTUDIO_COLAB_COMFYUI_URL`, `HAHMOSTUDIO_COMFYUI_BEARER`, `GOOGLE_OAUTH_*`, `HAHMOSTUDIO_*_CLASSIFIED_FREE`, aikakatkaisut, `HAHMOSTUDIO_MODEL_PINS_FILE`, `HAHMOSTUDIO_PROVISION_RECEIPTS_DIR`).
- **Kustannus:** työpöydällä kustannuspolitiikka on aina `ZERO_COST_POLICY`. Maksullisen laskennan muuttujia (`HAHMOSTUDIO_ALLOW_PAID_COMPUTE`, `HAHMOSTUDIO_MAX_COST_EUR`) ei välitetä lainkaan, joten työpöytä on tiukempi kuin web. Paneeli näyttää aina "€0,00" tai "estetty".

### IPC-pinta (koko lista, ei muita)

| Kanava | Suunta | Syöte (validoitu) | Palauttaa |
|---|---|---|---|
| `studio:cloud-status` | lue | – | opt-in, prosessin tila, mitkä asetukset on annettu (kyllä/ei, ei arvoja), taustajärjestelmät, politiikka (vain luku) |
| `studio:cloud-enable` / `-disable` | kirjoita | – | Päälle vain natiivin vahvistusdialogin jälkeen (pääprosessi näyttää, renderer ei voi ohittaa). Pois heti ilman dialogia |
| `studio:cloud-secret-paste` | kirjoita | avaimen nimi sallitulista | Pääprosessi lukee arvon leikepöydältä (`clipboard.readText`), validoi (esim. `https://`-osoite), tallentaa. Arvo ei kulje rendererin kautta |
| `studio:cloud-secret-import` | kirjoita | – | Pääprosessin tiedostodialogi, `KEY=VALUE`-tiedosto, vain sallitut avaimet |
| `studio:cloud-secret-clear` | kirjoita | avaimen nimi tai `all` | – |
| `studio:cloud-sync` | kirjoita | `CanonicalState` (≤ 2 MiB, sama `parse` kuin palvelimella) | projectId, revisio |
| `studio:cloud-lock` / `-unlock` | kirjoita | projectId, sceneId (`safeId`) | lukon hash |
| `studio:cloud-direct` | lue | projectId, sceneId | ehdotus + validoinnin tulos (aina `RuleBasedDirector` vaiheissa 1–6) |
| `studio:cloud-preflight` | lue | `RenderRequest` (`parseRenderRequest`) | valtuutuskortti |
| `studio:cloud-render` | kirjoita | sama + `authorizationFingerprint` | jobId; **ennen lähetystä natiivi lupadialogi** |
| `studio:cloud-job` / `-cancel` | lue / kirjoita | jobId | tila |
| `studio:cloud-reference-*` | ks. kohta 5 | | |

`studio:cloud-*`-pyynnöt, joissa on politiikan näköisiä kenttiä, hylätään kuten palvelimella (HTTP 400 → IPC-virhe).

### Salaisuudet

- Tallennus: `safeStorage.encryptString` (macOS: Keychainin avain) → `userData/cloud-secrets.bin`, tila 0600. Jos `safeStorage.isEncryptionAvailable()` on epätosi, tallennus **estetään** (ei selväkielistä varavaihtoehtoa).
- Ei koskaan: projektitiedostoon (.hahmo/.sarja), `preferences`/`ui-settings`iin, `startup-status.json`iin, lokeihin, virheilmoituksiin, rendereriin, gittiin.
- Virheviestit kulkevat `redact()`-funktion läpi, joka korvaa tunnetut salaisuusarvot ja URL-osoitteiden polun/kyselyn (`https://xxx.trycloudflare.com/...` → `https://***`).
- Web-omistajan tunnuksia (yksityisen palvelimen `dataDir`, setup-token, omistajan salasana) ei lueta eikä kirjoiteta. Testi varmistaa, ettei desktop-koodi viittaa web-palvelimen datakansioon.

### Uhkamalli

| Uhka | Torjunta |
|---|---|
| Renderer kaapataan (esim. haitallinen käsikirjoitusteksti → XSS) | Ei pääsyä salaisuuksiin (ei IPC:tä niiden lukuun); opt-in ja jokainen lähetys vaativat natiivin dialogin, jota renderer ei voi painaa; IPC-syötteet skeemavalidoitu |
| Renderer yrittää muuttaa kustannuspolitiikkaa | Politiikka kovakoodattu pilviprosessin käynnistyksessä; ei kirjoitusreittiä |
| Salaisuus vuotaa lokiin, virheeseen, projektiin | `redact()`, salaisuudet vain kahdessa prosessissa, vuototesti (kohta 6) |
| Tunnelin osoite (ComfyUI ei tarkista bearer-otsaketta) vuotaa | Osoite käsitellään salaisuutena; ohjeistus Kaggle-reitistä (ei tunnelia) säilyy ensisijaisena |
| Haitallinen tai rikki tausta palauttaa väärää dataa | Nykyinen `validateOutput` (tyyppi, magic bytes, koko, painotiedostot), paletti-inspektori valinnainen |
| Tekoälyn ehdotus yrittää lisätä hahmoja/esineitä/repliikkejä | Nykyiset kerrokset 1–7 (`HALLUCINATION_PREVENTION.md`) ennen kuin mitään näytetään hyväksyttävänä |
| Pilviprosessi kaapataan | Sillä on salaisuudet (hyväksytty jäännösriski); sillä ei ole pääsyä projektitiedostoihin eikä ikkunaan, vain sille lähetettyyn dataan |
| Leikepöytä: muut sovellukset näkevät liitetyn arvon | Käyttäjä kopioi arvon itse; sovellus ei tyhjennä leikepöytää kysymättä. Dokumentoidaan |

## 2. Tekoäly-paneeli (tehtävä 1)

- **Logiikka (minun):** `lib/ai-status.ts`: puhdas funktio, joka kokoaa jokaisen ominaisuuden rivin olemassa olevista tiloista (`kokoroStatus`, `audioModel`, kameran lupa, `cloud-status`). Rivi: nimi, sijainti (paikallinen / pilvi / pois), lupa (annettu / ei / ei tarvita), mitä dataa lähtee minne ("ei mitään" paikallisille), kustannus (€0,00 tai "estetty"), viimeisin tulos (aikaleima + lyhyt kuvaus, istunnon muistissa, ei projektiin).
- Rivit vain olemassa oleville ominaisuuksille: Rhubarb-suut, whisper.cpp-litterointi, Kokoro-puhe (vain Mac), MediaPipe-kasvot, kuvakulmaehdotukset (kohta 3), pilvirenderöinti. Käsikirjoituksen tulkinta näytetään alaviitteenä "sääntöpohjainen, ei tekoälyä", ei omana ominaisuutena.
- **Näkymä:** `components/ai-panel.tsx` toteutetaan nykyisillä luokilla (`performance-panel`, `panel-note`, `secondary`) ja avataan Näytä-valikosta "Tekoäly" (`desktop/main.mjs` → `action('ai')`). Asettelu ja ulkoasu: pyyntö UI/UX-suunnittelijalle TIIMI.md:ssä (sijainti PanelDockissa ja viimeistely). Webissä paneeli näyttää vain web-ominaisuudet; työpöydän rivit näkyvät vain työpöydällä.

## 3. Tekoälyn ehdotukset editoriin (tehtävä 3)

- **Mitä ehdotetaan:** vain asiat, joille Presentationissa on jo vastine: kuvakoko (`laaja` / `puolikuva` / `lähikuva`), kuvakulma ja -liike niiltä osin kuin `cameraInstruction` ne tunnistaa. Muut ehdotettavat (valo, tunnelma, tyyli, `over_shoulder`, `dolly_in`…) eivät ole Presentationin käsitteitä, joten ne näytetään **vain pilvirenderöinnin valtuutuskortissa** renderöintiparametreina eivätkä tallennu projektiin.
- **Lähde:** deterministinen `RuleBasedDirector` (laajennetaan kuvakohtaiseksi: esim. kahden hahmon repliikki → puolikuva, tunnereaktio → lähikuva). `LLMDirector` ei ole käytössä työpöydällä tässä työssä (ei uutta palveluntarjoajaa, ei tiliä). Ehdotus kulkee aina `parseSuggestion` → `validateSuggestion`.
- **Muoto:** samanlainen kuin `review-suggestions.ts`: tarkka rivimuutos `{line, before, after}` käsikirjoitukseen (käsikirjoitus on palikoiden totuus). Esimerkki: `Kamera: puolikuva Pipsa` → `Kamera: lähikuva Pipsa`, tai uusi rivi ennen repliikkiä.
- **Käyttöönotto:** vain painamalla "Ota käyttöön", olemassa olevaa käsikirjoituksen atomista undo-polkua pitkin (yksi kumottava transaktio; työpöydällä levyhistorian journal validate → persist → publish). Suojattuja (`protected`/`locked`) tai lukittujen kuvien tapahtumia ei ehdoteta muutettavaksi (impact check estää).
- **Hylkäys:** ehdotus elää vain Reactin tilassa; hylkäys tai paneelin sulkeminen ei kirjoita projektiin, historiaan, `commandJournal`iin eikä autosaveen mitään. Testi vertaa projektin tavuja ennen ja jälkeen.

## 4. Paikalliset tekoälyt samaan työnkulkuun (tehtävä 4)

- "Puuttuvat repliikkiäänet" -osio (`presentation-panel.tsx`) tarjoaa jo Kokoron. Lisätään logiikkakerros `lib/voice-sources.ts`: yksi järjestyssääntö (oma äänitys > tuotu > synteettinen), joka ratkaisee, mitä riville saa tehdä. Kokoro ei koskaan korvaa olemassa olevaa ei-synteettistä klippiä (testi).
- **Litterointi** (whisper.cpp, paikallinen): uusi toiminto samassa osiossa: "Tarkista äänitys" vertaa käyttäjän äänityksen litteraattia repliikin tekstiin ja näyttää eron. Litteraatti ei koskaan kirjoita käsikirjoitukseen eikä luo repliikkiä (ei keksittyjä sanoja), se on vain tarkistus.
- Ei pilvi-TTS:ää. Synteettinen merkintä pysyy datassa (`AudioClip.synthetic`).
- Osio on UI/UX:n tiedostossa: kirjaan ennen muutosta pyynnön/ilmoituksen TIIMI.md:hen ja teen vain painikkeiden kytkennän nykyisillä komponenteilla.

## 5. Vertailukuvat uusille hahmoille (tehtävä 5)

- **Ehdotus:** hahmopaketin oma esikatselu (nykyinen kirjaston esikatselu / `shot-thumb`-renderöinti) piirretään paikallisesti PNG:ksi (neutraali asento, etukuva, läpinäkyvä tausta). Ehdotus sisältää hahmon lähdetiedostojen SHA-256-tiivisteen (`.hahmo`/`.psd`).
- **Hyväksyntä:** vain käyttäjä sovelluksessa ("Hyväksy vertailukuvaksi"). Hyväksytty kuva tallennetaan sovelluksen datakansioon tiivisteen kanssa, ei projektiin eikä repoon. Automaattista hyväksyntää ei ole.
- **Vanheneminen:** jos hahmon lähdetiivisteen arvo muuttuu (hahmografiikan asiantuntijan työ), vanha vertailukuva merkitään "ei kelpaa: hahmon grafiikka on muuttunut" ja `preflight` estää renderöinnin syyllä `reference-stale`. Uusi ehdotus tehdään uudelleen.
- **Tiimiportti:** tuotan ehdotuksia (ja niiden testidataa) vain hahmoille, joiden hahmografiikan työ on TIIMI.md:ssä tilassa HYVÄKSYTTY. Sitä ennen toteutus testataan erillisellä testihahmolla.
- Vertailukuvan lähetys pilveen on datan lähetystä ja kulkee saman natiivin lupadialogin kautta.

## 6. Todennus ja valmiusraportti

| Skripti | Mitä todentaa | Taso |
|---|---|---|
| `npm test` (uudet `desktop/cloud-*.test.mjs`, `lib/ai-status.test.ts`, `lib/voice-sources.test.ts`, `lib/shot-suggestions.test.ts`) | IPC-validointi, opt-in oletuksena pois, politiikka aina zero-cost, ehdotuksen käyttöönotto = yksi undo, hylkäys ei muuta tavuja, ääni-etusija, vertailukuvan vanheneminen | simuloitu |
| `npm run desktop:test:cloud` (uusi) | Pilviprosessi oikeana `utilityProcess`ina vale-ComfyUI:ta vasten loopbackissa (Kaggle/ComfyUI-mock): sync → lukko → ehdotus → preflight → estetty ilman lukittua mallia / ilman vertailukuvaa oikealla syyllä | simuloitu (Electron) |
| `npm run desktop:test:secrets` (uusi) | Testisalaisuus (tunnistettava merkkijono) syötetään; skannataan IPC-vastaukset, rendererin DOM ja `window`, lokit, `startup-status.json`, tallennettu `.hahmo`, `userData`n selväkieliset tiedostot ja `git grep` → ei osumia | simuloitu (Electron) |
| `npm run desktop:test:ai-panel` (uusi, GUI-diagnostiikka kuten `screenplay-gui`) | Paneeli näyttää todelliset tilat; pilvirivi "pois" ennen opt-iniä; ei valenappeja | oikea Mac (vaatii käyttäjän ajon) |
| `desktop:test:package` laajennus | Pakattu .app: pilviprosessin moduuli löytyy, käynnistyy vain opt-inin jälkeen | pakattu sovellus (Mac) |
| Käyttäjän oma ajo | Oikea ComfyUI-GPU / Kaggle | oikea ComfyUI-GPU: **ei väitetä tehdyksi**, ellei ajeta |

Testit käyttävät erillistä testidataa (`HAHMOSTUDIO_TEST_DATA_DIR`) eivätkä anna lupia käyttäjän oikeissa asetuksissa.

## 7. Vaiheistus (pienet kokonaisuudet)

Kukin vaihe on oma paikallinen haaransa (`tekoaly/vaihe-N`), joka yhdistetään vuorollaan tiimihaaraan `claude/tiimi-tekoaly-q1331b` ja pushataan vain sinne. Jokaisessa: testit, `npm run typecheck`, `npm test`, KEHITYSMUISTIO.md-merkintä.

1. **Tila ja paneelin logiikka:** `lib/ai-status.ts` + testit, Näytä → Tekoäly -valikko, paneeli nykyisillä komponenteilla (pilvirivi näyttää "pois, ei saatavilla työpöydällä" kunnes vaihe 3 on valmis).
2. **Salaisuusvarasto:** `desktop/cloud-secrets.mjs` (safeStorage, redact, leikepöytä/tiedostotuonti), IPC-validointi `desktop/cloud-policy.mjs`, vuototesti.
3. **Pilvipalveluprosessi:** `desktop/cloud-service.mjs`, viestiprotokolla, opt-in-dialogi, lupadialogi ennen lähetystä, desktop-buildin paketointi, `desktop:test:cloud`.
4. **Kuvakohtaiset ehdotukset:** `lib/shot-suggestions.ts` + kytkentä, undo-testi, hylkäystesti.
5. **Äänet ja litterointi:** `lib/voice-sources.ts`, "Tarkista äänitys".
6. **Vertailukuvat:** ehdotus, hyväksyntä, vanheneminen, preflight-este. Tuotetaan oikeille hahmoille vasta hahmografiikan HYVÄKSYTTY-tilan jälkeen.
7. **Valmiusraportti:** `docs/cloud-render/DESKTOP.md`, KAYTTOONOTTO-FI.md:n työpöytäosio, raportti TIIMI.md:hen.

## 8. Riskit

- **TS pilviprosessissa:** `lib/cloud-render` on TypeScriptiä; desktop-build (`scripts/desktop-build.mjs`) pitää laajentaa paketoimaan se (esbuild-tyyppinen niputus). Jos paketointi ei onnistu siististi, vaihe 3 pysähtyy ja kirjaan sen.
- **Ei Macia tässä ympäristössä:** safeStorage/Keychain, GUI ja pakattu .app todentuvat vain käyttäjän Macilla. Linuxin `safeStorage` käyttää eri taustaa; testit merkitsevät tämän.
- **Hahmojen ulkoasu muuttuu kesken työn:** siksi vertailukuvat sidotaan lähdetiivisteeseen ja tehdään vasta HYVÄKSYTTY-tilan jälkeen.
- **Päällekkäisyys UI/UX:n kanssa:** `presentation-panel.tsx` ja uusi paneeli. Kirjaan muutokset ennen tekoa ja pyydän viimeistelyn.
- **Colabin ehdot:** ComfyUI-tunneli ilmaisessa Colabissa on todennäköisesti ehtojen vastainen (2.23). Työpöydän ohje suosittaa Kaggle-muistikirjareittiä; tunnelireitti jää käyttäjän päätettäväksi.
- **Ehdotusten hyöty:** deterministinen ohjaaja on konservatiivinen; ehdotuksia tulee vähän. Tämä on tarkoituksellista (ei arvailua).

## 9. Mitä en tee

Ei maksullista laskentaa tai varavaihtoehtoa, ei uusia tilejä tai palveluntarjoajia, ei pilvi-TTS:ää, ei mallipainoja repoon tai pakettiin, ei .psd-muutoksia, ei käyttäjän lupien antamista hänen puolestaan, ei julkaisua, ei PR:iä, ei yhdistämistä, ei haarojen poistoa.
