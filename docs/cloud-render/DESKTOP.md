# Pilvirenderöinti työpöytäsovelluksessa (KOETA, Electron)

Tila 2026-10-08: toteutettu ja testattu simuloidusti sekä oikeassa Electronissa Linuxilla. **Oikeaa Macia (Keychain, natiivit dialogit), pakattua .appia ja oikeaa Kaggle-, ComfyUI-, Drive- tai GPU-ajoa ei ole vielä ajettu.** Käyttäjän ohje: [KAYTTOONOTTO-FI.md](KAYTTOONOTTO-FI.md), osa G. Suunnitelma ja perustelut: [TEKOALY-SUUNNITELMA-FI.md](TEKOALY-SUUNNITELMA-FI.md).

## Periaate

- Pilvi on **oletuksena pois**. Se otetaan käyttöön natiivissa vahvistusdialogissa (Näytä → Tekoäly… → Ota pilvirenderöinti käyttöön…). Ennen sitä pilviprosessia ei ole eikä yksikään pilvikutsu mene läpi.
- Kustannuspolitiikka on työpöydällä aina `ZERO_COST_POLICY` (jäädytetty). Ympäristöön ei koskaan välitetä maksullisen laskennan muuttujia. Taustan ilmaisuus on käyttäjän oma ilmoitus natiivissa dialogissa ("Vahvista … ilmaiseksi"); ilman sitä taustaa ei käytetä.
- Renderer (hiekkalaatikko, ei Nodea) ei näe salaisuuksia eikä valitse reittiä, taustaa, mallia, parametreja tai politiikkaa.
- Rule-based Presentation pysyy auktoriteettina. Tekoälyn tuotos on epäluotettava syöte, joka validoidaan deterministisesti (`lib/cloud-render`) eikä koskaan kirjoita kanonista tilaa.

## Rakenne

| Osa | Tiedosto | Tehtävä |
|---|---|---|
| Pääprosessi | `desktop/main.mjs` | 10 IPC-kanavaa (`studio:cloud-*`), natiivit dialogit, valikko Näytä → Tekoäly… |
| Ohjain | `desktop/cloud-controller.mjs` | opt-in, prosessin elinkaari, lähtevän datan lupa, checkpoint, mallien lukitus, tulosten tuonti ja muistikirjan tallennus |
| Reitit | `desktop/cloud-policy.mjs` | `cloudRoute`: 13 sallittua toimintoa, tiukat kentät; `egressConsent`; `buildCloudEnv` (sallitulista) |
| Salaisuudet | `desktop/cloud-secrets.mjs` | `safeStorage` → `userData/cloud-secrets.bin` (0600). Ei selväkielistä varaa; Linuxin `basic_text` hylätään |
| Työloki | `desktop/cloud-jobs.mjs` | checkpoint levylle ennen dispatchia; keskeneräinen → `interrupted` |
| Pilviprosessi | `desktop/cloud-service.mjs` | `utilityProcess` ("KOETA · pilvipalvelu"), ei porttia; ajaa saman `createCloudRender`-koodin kuin yksityinen palvelin |
| Käyttöliittymä | `components/ai-panel.tsx`, `components/cloud-render-dialog.tsx`, `lib/cloud-desktop.ts` | tilat ja asetukset; dialogin HTTP-kutsut kartoitetaan IPC-toiminnoiksi |

Tietovirta: renderer → `window.hahmostudio.cloudCall(op,args)` → pääprosessi validoi (`cloudRoute`) → tarvittaessa natiivi lupa → `postMessage` pilviprosessille → `lib/cloud-render` → vastaus peitetään (`redactBody`: salaisuudet ja osoitteet `***`) → renderer.

## Salaisuudet

Sallitut avaimet: `HAHMOSTUDIO_COLAB_COMFYUI_URL`, `HAHMOSTUDIO_COMFYUI_BEARER`, `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REFRESH_TOKEN`.

- Ne annetaan leikepöydältä (pääprosessi lukee leikepöydän itse) tai `KEY=VALUE`-tiedostosta (pääprosessin tiedostodialogi; tuntemattomat avaimet ohitetaan ja niistä palautetaan vain nimet).
- Tallennuksen vahvistus näyttää vain avaimen nimen ja tunnelin palvelimen nimen. Tällä estetään kaapatun rendererin yritys vaihtaa tunneli huomaamatta.
- Arvot eivät kulje IPC:ssä, lokeissa, virheviesteissä, projektitiedostoissa eikä gitissä. `npm run desktop:test:cloud` tarkistaa tämän merkkijonolla koko datakansiosta, DOMista ja IPC-vastauksista.
- Selaimen yksityisen palvelimen omistajatunnuksia ei lueta eikä muuteta.

## Mitä lähtee koneelta ja milloin

| Toiminto | Kysytäänkö lupa | Mitä lähtee |
|---|---|---|
| Renderöinti | aina, natiivi dialogi | lukittu kohtaus (kanoninen tila) ja hyväksytyt vertailukuvat valittuun ilmaiseen taustaan |
| Synkronointi, vertailukuva | vain Drive-tallennuksella | kanoninen tila / yksi kuva Driveen |
| Kaggle-muistikirja | tallennus omalla dialogilla | ei mitään: käyttäjä ajaa muistikirjan itse |

Äänet, PSD-tiedostot ja käsikirjoitus eivät lähde. Ilman Drive-tunnuksia tallennus on paikallinen (`userData/cloud-render`).

## Palautuminen

Checkpoint (`cloud-render-jobs.json`, enintään 50 kirjausta) kirjoitetaan ennen kuin työ lähetetään pilviprosessille. Kun sovellus käynnistetään uudelleen tai pilviprosessi päättyy, keskeneräiset työt merkitään `interrupted`. Mitään ei lähetetä uudelleen automaattisesti: käyttäjä aloittaa renderöinnin uudelleen.

## Vertailukuvat

Vertailukuva sidotaan hahmon grafiikan tunnisteeseen (hahmopaketin SHA-256, `lib/character-sources.ts`). Jos grafiikka muuttuu, vanha kuva vanhenee ja pakollinen syöte estyy syyllä `reference-stale`. Hyväksyntä on aina käyttäjän toiminto. Kirjastopaketin oman kuvan ehdotus on käytössä vain `REFERENCE_READY_PACKS`-listan paketeille; lista on tyhjä, kunnes hahmon grafiikka on hyväksytty valmiiksi.

## Paketointi

`scripts/package-mac.mjs` kopioi `lib/cloud-render`, `lib/studio/hash.ts` ja `cloud/runtime` (ei testejä, testifixtuureja eikä `__pycache__`ia). Pilviprosessi tuo `.ts`-tiedostot suoraan; Electronin Node 24 poistaa tyypit, ja tämä on todennettu myös asar-paketin sisällä. Malleja tai painoja ei paketoida.

## Todennus

| Komento | Taso | Tulos 2026-10-08 |
|---|---|---|
| `npm test` (mm. `desktop/cloud-*.test.mjs`, `lib/cloud-render/*.test.ts`) | simuloitu | läpi |
| `npm run desktop:test:cloud` | oikea Electron, IPC ja utilityProcess, ei verkkoa | 24/24 Linuxissa (xvfb, root-ajossa `--no-sandbox` suoraan electronille) |
| `npm run desktop:test:package` | pakattu sovellus | ei ajettu tässä työssä |
| Mac: Keychain, natiivit dialogit, pakattu .app | oikea laite | ei ajettu |
| Kaggle/ComfyUI/Drive/GPU | oikea pilviajo | ei ajettu |
