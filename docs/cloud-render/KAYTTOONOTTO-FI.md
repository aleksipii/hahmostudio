# Pilvirenderöinnin käyttöönotto, askel askeleelta (aloittelijalle)

Tämä ohje vie ensimmäiseen oikeaan pilvirenderöintiin: Hahmostudio omalla koneellasi (selaimessa), video tehdään **Kaggle-muistikirjassa, jonka ajat itse**, ja tulos tallennetaan Google Driveen (tai koneellesi).

**Mitä on tarkistettu ja mitä ei (2026-10-08):**
- ✅ Komennot, ympäristömuuttujat ja tiedostopolut on tarkistettu koodia vasten.
- ✅ Wan2.2-mallin kolme tiedostoa on tarkistettu olevan Hugging Facessa oikeilla poluilla (yhteensä noin 18,1 Gt), ja mallin lukitus (osa B) on ajettu onnistuneesti oikeaa Hugging Facea vasten.
- ✅ Muistikirjan skripti on testattu automaattisesti paikallista vale-ComfyUI:ta vasten: mallien tarkistus, ajoympäristön tarkistus, työnkulun ajo, tulostiedosto ja sen tuonti.
- ⚠️ **Oikeaa Kaggle-ajoa ei ole vielä tehty.** Kohdat, joissa en ole varma, on merkitty **⚠️ EPÄVARMA**.

> 🔒 **Salaisuudet:** Hugging Face -token, Googlen *client secret* ja *refresh token* ovat salaisuuksia. **Älä liitä niitä keskusteluun Clauden kanssa, GitHubiin, kuvakaappauksiin tai lokeihin.** Jos lähetät virheilmoituksen, peitä ne ensin (esim. `hf_xxx…`). Jos salaisuus vuotaa, mitätöi se heti (ohjeet kunkin vaiheen kohdalla).

---

## 0. Ennen kuin aloitat

### Ei maksuja: yksi sääntö
**Älä lisää maksukorttia tai laskutustiliä mihinkään alla olevista palveluista.** Ilman maksutapaa sinua ei voida veloittaa.

| Palvelu | Voiko tulla maksu? |
|---|---|
| Kaggle | Ei. Muistikirjoilla ei ole maksullista tasoa. Kun viikon GPU-kiintiö (noin 30 h) loppuu, GPU:ta ei vain saa ennen seuraavaa viikkoa. |
| Hugging Face (mallin lataus) | Ei. |
| Google Drive | Ei. Ilmaista tilaa on 15 Gt; jos se täyttyy, tallennus epäonnistuu. |
| Google Cloud (Drive-tunnukset, osa D) | Ei, kunhan et lisää laskutustiliä (*billing account*). Ohita ilmaisen kokeilun ehdotukset. |

Hahmostudion nollakustannustila estää lisäksi kaikki maksulliset taustajärjestelmät, eikä maksullista varavaihtoehtoa ole.

### Miksi Kaggle-muistikirja eikä Colab + tunneli
- **Ilmaisen Colabin** ehdot kieltävät palvelun ohjaamisen pääasiassa web-käyttöliittymän kautta ja etäohjauksen.
- **Kagglen** käyttöpolitiikka (Acceptable Use Policy, voimassa 2025-06-22) sallii koneoppimisen. Se kieltää muun muassa *server farming* -käytön ja palvelun rajoitusten kiertämisen.
- Siksi Hahmostudio **ei ohjaa Kagglea etänä**. Se tekee renderöinnistä yhden muistikirjatiedoston, jonka ajat itse Kagglessa. ComfyUI käynnistyy vain muistikirjan sisälle (127.0.0.1): **ei tunnelia, ei palvelinta, ei julkista osoitetta**. Lopuksi lataat tulostiedoston ja tuot sen takaisin.
- Pelisäännöt: käytä vain Kagglen viikkokiintiötä, sammuta istunto kun ajo on valmis, äläkä jaa muistikirjaa tai tuloksia palveluna muille.
- Jos haluat kirjallisen varmuuden, kysy Kagglelta (kaggle.com/contact).

### Hyvä tietää
- Pilvirenderöinti toimii **yksityisellä web-palvelimella selaimessa** (`npm run start:private`), ei työpöytäsovelluksessa. Projektisi pysyvät ennallaan työpöytäsovelluksessa.
- Yksi muistikirja = yksi renderöinti. *Character animation* tekee yhden klipin kerrallaan, eli jokaisesta klipistä tulee oma muistikirja.
- Jos Hahmostudion palvelin käynnistetään uudelleen ennen kuin tulos on tuotu, työ katoaa ja se aloitetaan alusta (mallit on silloin jo ladattu Kagglessa vain, jos sama istunto on yhä auki).

### Mitä tarvitset
| Mitä | Mihin | Maksaa |
|---|---|---|
| Oma kone (Mac käy), Node.js 22.18 tai uudempi, git | Hahmostudio-palvelin | – |
| Kaggle-tunnus ja vahvistettu puhelinnumero | GPU ja internet muistikirjassa | ilmainen |
| Google-tili | Drive | ilmainen |
| Hugging Face -tili (vapaaehtoinen) | Wan2.2-repo ei ole lukittu, joten token ei ole pakollinen. | ilmainen |
| Google Cloud -projekti ja OAuth-asiakas | Driveen tallennus | ilmainen (ei laskutustiliä) |

Aikaa kuluu ensimmäisellä kerralla noin 2–3 tuntia, josta suurin osa on odottamista.

---

## Osa A: Hahmostudio omalle koneelle (noin 15 min)

Avaa **Pääte** (Mac: Finder → Ohjelmat → Lisäohjelmat → Pääte).

**A1.** Tarkista Node:
```bash
node --version
```
✅ Pitäisi näkyä `v22.18.0` tai suurempi (esim. `v24.x`). Jos näkyy `v22.13`–`v22.17`, aja jokaisen uuden pääteikkunan alussa:
```bash
export NODE_OPTIONS=--experimental-strip-types
```
Jos `node` ei löydy tai versio on alle 22.13, asenna Node osoitteesta nodejs.org (LTS).

**A2.** Hae koodi ja asenna:
```bash
git clone https://github.com/aleksipii/hahmostudio.git
cd hahmostudio
git checkout hahmostudio1.0
npm ci
npm test
```
✅ `npm test` päättyy riveihin, joissa `fail 0`. (Yksi ajoajasta riippuva suorituskykytesti voi joskus epäonnistua; aja silloin uudelleen.)

**A3.** Kokeile käyttöliittymää ilman GPU:ta:
```bash
npm run build:private
HAHMOSTUDIO_CLOUD_RENDER=1 HAHMOSTUDIO_STORAGE=local-dev npm run start:private
```
✅ Päätteeseen tulee `Hahmostudio: http://127.0.0.1:4176`. Jätä pääte auki (palvelin pyörii siinä; pysäytys: Ctrl+C).

1. Avaa selaimella http://127.0.0.1:4176. Ensimmäisellä kerralla luo omistajatunnus (salasana vähintään 12 merkkiä).
2. Tee tai avaa jakso Esitys-työtilassa (käsikirjoitus → jakso).
3. Paina **Pilvirenderöinti…** → **Synkronoi säännöistä** → valitse kohtaus → **Hyväksy ja lukitse kohtaus**.
4. **Pyydä ehdotus** → näet tarkistuslistan (✓/✗).
5. **Tarkista valtuutus** → kortti näyttää ESTETTY. ✅ **Tämä on oikein**, koska GPU-ympäristöä ei vielä ole.

`local-dev` kirjoittaa kansioon `.private-storage/cloud-render-dev/` (vain kokeiluun).

---

## Osa B: mallin lukitus omalla koneella (noin 5 min)

Tämä hakee Hugging Facesta vain **tiedon** siitä, mikä mallin versio ja tiedostojen tarkistussummat ovat. Painoja ei ladata koneellesi.

**B1. (Vapaaehtoinen) Hugging Face -token.** Tarvitset sen vain, jos B2 antaa virheen `401`, `403` tai `429`.
1. Kirjaudu huggingface.co → oikean yläkulman profiilikuva → **Settings** → **Access Tokens** → **Create new token**.
2. Token type: **Read** → nimi esim. `hahmostudio` → **Create token**.
3. Kopioi token (`hf_…`) heti talteen salasanojen hallintaan; sitä ei näytetä uudelleen.
4. Ota se käyttöön vain tähän pääteikkunaan (ei tiedostoon, ei keskusteluun):
```bash
read -s HF_TOKEN && export HF_TOKEN
```
(Liitä token ja paina Enter; mitään ei näy, se on tarkoitus.)
Vuodon sattuessa: samassa Access Tokens -näkymässä token → **Invalidate/Delete**.

**B2.** Repon juuressa (`hahmostudio`-kansio):
```bash
PINS_OUT=pins.json node --experimental-strip-types scripts/make-model-pin.ts wan2.2-ti2v-5b \
  Comfy-Org/Wan_2.2_ComfyUI_Repackaged \
  split_files/diffusion_models/wan2.2_ti2v_5B_fp16.safetensors=diffusion_models:unet \
  split_files/text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors=text_encoders:clip \
  split_files/vae/wan2.2_vae.safetensors=vae:vae
cat pins.json
```
✅ Komento ei tulosta mitään, ja `cat pins.json` näyttää suunnilleen tämän:
```
{
 "wan2.2-ti2v-5b": {
  "revision": "<40 merkkiä 0-9a-f>",
  "files": [
   { "path": "split_files/diffusion_models/wan2.2_ti2v_5B_fp16.safetensors", "sha256": "<64 merkkiä>", "comfyFolder": "diffusion_models", "role": "unet" },
   ...kolme tiedostoa yhteensä
```
Arvot tulevat Hubista; **älä muokkaa niitä käsin**. `pins.json` ei ole salaisuus, mutta älä lisää sitä gitiin.

**B3.** Tarkista, että malli kelpaa ajoon (tekee myös manifestin, jota Colab-liite käyttää; Kaggle-reitti ei tarvitse tiedostoa, koska palvelin upottaa manifestin muistikirjaan):
```bash
node --experimental-strip-types scripts/make-provision-manifest.ts wan2.2-ti2v-5b pins.json > manifest.json
cat manifest.json
```
✅ Näkyy `"schema": 1`, `"modelId": "wan2.2-ti2v-5b"`, `"repo": "Comfy-Org/Wan_2.2_ComfyUI_Repackaged"`, sama revision ja kolme tiedostoa. Jos näkyy `REFUSED: …`, lue syy (yleensä pins.json puuttuu tai on väärä).

FLUX.1-schnell ei ole vielä käyttökelpoinen (sen tekstikooderit ovat eri repossa, eikä malli tue kahta repoa).

---

## Osa C: Kaggle-tunnus (noin 10 min, kerran)

**C1.** Mene kaggle.com → **Register** → kirjaudu Google-tilillä.

**C2.** Oikean yläkulman profiilikuva → **Settings** → **Phone verification** → anna puhelinnumero → syötä tekstiviestin koodi.
✅ Settings-sivulla lukee, että puhelin on vahvistettu. Ilman tätä GPU ja internet eivät ole käytettävissä muistikirjassa.

**C3. Kokeile asetukset** (ei vielä renderöintiä): vasen valikko **+ Create** → **New Notebook**. Oikeassa reunassa on **Session options** (tai *Notebook options*):
- **Accelerator** → **GPU T4 x2** (tai **GPU P100**)
- **Internet** → **On**

✅ Kumpikin valinta onnistuu. Jos ne ovat harmaina, puhelinvahvistus ei ole vielä voimassa. Samassa paneelissa näkyy jäljellä oleva GPU-kiintiö.
Sulje kokeilu: oikean yläkulman **Stop session** (virtapainike).

⚠️ EPÄVARMA: Kagglen valikkonimet voivat poiketa hieman tästä.

---

## Osa D: Google Drive -tunnukset (noin 20 min)

Voit ohittaa tämän ensimmäisellä kerralla ja käyttää `HAHMOSTUDIO_STORAGE=local-dev` (tulokset jäävät koneellesi). Huom: ilman Drive-tunnuksia ja ilman `local-dev`-asetusta palvelin yrittää Drivea ja jokainen tallennus estyy.

Googlen konsolin valikot on nimetty uudelleen vuonna 2025; nimet alla ovat uudet, sulkeissa vanhat. ⚠️ EPÄVARMA: valikot voivat näyttää hieman erilaisilta.

**D1. Projekti ja Drive API**
1. console.cloud.google.com → yläpalkin projektivalitsin → **New project** → nimi esim. `hahmostudio` → **Create**. Varmista, että uusi projekti on valittuna yläpalkissa.
2. Hakukenttään `Google Drive API` → avaa se → **Enable**.
✅ Sivulla lukee *API enabled*.

**D2. OAuth-suostumusnäkymä**
1. Vasen valikko **APIs & Services → OAuth consent screen** (uusi nimi: **Google Auth Platform**) → **Get started**.
2. App name `Hahmostudio`, support email = oma osoitteesi → Audience: **External** → yhteystieto = oma osoitteesi → hyväksy ehdot → **Create**.
3. **Audience**-sivu → **Test users → Add users** → lisää oma Gmail-osoitteesi → **Save**.

**D3. OAuth-asiakas** (tärkeä korjaus aiempaan ohjeeseen: tyypin pitää olla **Web application**, koska OAuth Playground vaatii oman paluuosoitteensa, eikä Desktop app -tyyppiin voi lisätä sitä)
1. **Clients** (vanha: Credentials → Create credentials → OAuth client ID) → **Create client**.
2. Application type: **Web application**, nimi `hahmostudio-playground`.
3. **Authorized redirect URIs → Add URI** → `https://developers.google.com/oauthplayground` (tarkalleen näin, ei kauttaviivaa loppuun).
4. **Create** → kopioi **Client ID** ja **Client secret** salasanojen hallintaan.
⚠️ Google näyttää secretin uusissa asiakkaissa vain luontihetkellä; jos se katosi, luo uusi secret asiakkaan sivulta.

**D4. Refresh token OAuth Playgroundissa**
1. Avaa developers.google.com/oauthplayground.
2. Oikean yläkulman **rataskuvake** → rasti **Use your own OAuth credentials** → liitä Client ID ja Client secret → sulje.
3. Vasemmalla kenttään *Input your own scopes* kirjoita `https://www.googleapis.com/auth/drive.file` → **Authorize APIs**.
4. Valitse Google-tilisi. Näet varoituksen *Google hasn't verified this app* → **Continue** (tämä on oma sovelluksesi) → salli.
5. **Exchange authorization code for tokens** → kopioi **Refresh token** (alkaa yleensä `1//`) salasanojen hallintaan.

`drive.file`-oikeus näkee vain Hahmostudion itse luomat tiedostot, ei muuta Driveasi. Tiedostot tulevat Driveen kansioon `AnimationStudio/Projects/<projektin tunnus>/`.

⚠️ **Refresh token vanhenee 7 päivässä**, niin kauan kuin sovelluksen tila on *Testing* (Googlen OAuth-dokumentaatio). Vaihtoehdot: hae uusi token D4:llä viikoittain, tai **Audience → Publish app** (tila *In production*). Julkaisu ei tee sovelluksesta julkista; `drive.file` ei ole Googlen "arkaluonteinen" oikeus. ⚠️ EPÄVARMA: Google voi silti pyytää vahvistusta tai näyttää varoitussivun; omaan käyttöön se on ohitettavissa.

Vuodon sattuessa: Clients → asiakas → **Reset secret** tai poista asiakas; refresh token mitätöityy myös myaccount.google.com → Security → *Third-party apps* → Hahmostudio → **Remove access**.

---

## Osa E: palvelin oikeilla asetuksilla (omalla koneellasi, noin 5 min)

Pysäytä A3:n palvelin (Ctrl+C) ja aja samassa pääteikkunassa repon juuressa. Salaiset arvot luetaan `read -s` -komennolla, jotta ne eivät jää komentohistoriaan; liitä kukin arvo ja paina Enter.
```bash
export HAHMOSTUDIO_CLOUD_RENDER=1
export HAHMOSTUDIO_MODEL_PINS_FILE="$PWD/pins.json"
export HAHMOSTUDIO_NOTEBOOK_CLASSIFIED_FREE=yes   # sinun lausuntosi: Kaggle-muistikirja on ilmainen (ei maksukorttia)
# Drive (osa D):
export GOOGLE_OAUTH_CLIENT_ID=…                   # ei salainen, mutta älä silti jaa
read -s GOOGLE_OAUTH_CLIENT_SECRET && export GOOGLE_OAUTH_CLIENT_SECRET
read -s GOOGLE_OAUTH_REFRESH_TOKEN && export GOOGLE_OAUTH_REFRESH_TOKEN
# TAI ilman Drivea: export HAHMOSTUDIO_STORAGE=local-dev
# valinnainen: export HAHMOSTUDIO_NOTEBOOK_TIMEOUT_MS=86400000   # kauanko tulosta odotetaan (10 min – 48 h, oletus 24 h)
npm run build:private && npm run start:private
```
✅ Näkyy `Hahmostudio: http://127.0.0.1:4176`. Jos palvelin kaatuu heti viestiin `… must be …`, jokin arvo on väärässä muodossa (viesti kertoo minkä).

- Maksullinen laskenta pysyy pois. Älä aseta `HAHMOSTUDIO_ALLOW_PAID_*`-muuttujia.
- Muuttujat ovat voimassa vain tässä pääteikkunassa. Uudessa ikkunassa ne annetaan uudelleen.

---

## Osa F: ensimmäinen oikea renderöinti

**F1. Hahmostudio (selain)**
1. http://127.0.0.1:4176 → jakso → **Pilvirenderöinti…** → **Synkronoi säännöistä** → valitse kohtaus → **Hyväksy ja lukitse kohtaus**.
2. **Hahmojen hyväksytyt vertailukuvat**: lataa jokaiselle kohtauksen hahmolle PNG, JPEG tai WebP (enintään 8 Mt). Video käyttää tätä lähtökuvana.
3. Työnkulku **Image to video** → **Tarkista valtuutus**.
   ✅ Kortissa: taustajärjestelmä `kaggle-notebook`, luokka `free`, hinta €0.00, enimmäishinta €0.00, maksullinen laskenta ja varavaihtoehto POIS, mallin revisio (40 merkkiä), lisenssi apache-2.0, kaupallinen käyttö allowed, **HYVÄKSYTTY**.
4. **Hyväksy ja renderöi.** Tilaksi tulee *Renderöidään* ja näkyviin tulee **Lataa Kaggle-muistikirja**. Paina sitä.
   ✅ Selain lataa tiedoston `hahmo-rj_….ipynb` (noin 1–15 Mt).

(Live-todennus-kohdan esitarkistusta ei tarvita: muistikirja tekee saman tarkistuksen Kagglessa.)

**F2. Kaggle**
1. kaggle.com → **+ Create** → **New Notebook**.
2. Valikko **File → Import Notebook** → valitse ladattu `.ipynb` → **Import**.
   ✅ Muistikirjassa on ohjesolu ja yksi koodisolu (pitkä, älä muokkaa).
   ⚠️ EPÄVARMA: jos Import ei hyväksy tiedostoa (esim. koko), kerro siitä, niin teen vaihtoehtoisen tavan.
3. Oikea paneeli → **Session options**: **Accelerator** = GPU T4 x2 (tai P100), **Internet** = On.
4. (Vain jos tarvitset tokenia) Valikko **Add-ons → Secrets** → **Add secret** → nimi `HF_TOKEN`, arvo = token → rasti tälle muistikirjalle. Muistikirja lukee sen sieltä itse. Wan-malli ei tarvitse tokenia, joten yleensä ohita tämä.
5. **Run All** (tai ▶ koodisolun vierestä).
   ⏳ Ensimmäinen ajo asentaa ComfyUI:n ja lataa noin 18 Gt; edistymispalkkia ei näy. Renderöinnin aikana tulostuu rivi `…renderöidään (N min)` minuutin välein. ⚠️ EPÄVARMA: kokonaisaikaa T4:llä/P100:lla ei ole mitattu.
   ✅ Lopussa: `✅ VALMIS: hahmo-rj_…-tulos.json`.
6. Oikea paneeli → **Output** (tai *Data → Output*) → `hahmo-rj_…-tulos.json` → **Download**.
7. **Stop session** (virtapainike), jotta kiintiötä ei kulu.

**F3. Takaisin Hahmostudioon**
1. Pilvirenderöinti-dialogissa (sama työ, tila *Renderöidään*) → **Tuo tulos** → valitse ladattu `-tulos.json`.
   ✅ Viesti *Tulos hyväksytty*, tila etenee *Tulosteen tarkistus* → *Tallennetaan Driveen* → **Valmis**. Video on Drivessa kansiossa `AnimationStudio/Projects/<projekti>/renders/` (tai `local-dev`-kansiossa).
   ✅ Tietueessa: *Live-todennus: läpäisty (ajoympäristön ilmoittama)*.
2. Vasta tämän jälkeen: työnkulku **Character animation** (yksi muistikirja per klippi).

Tuonti hylätään, jos tiedosto on toisesta työstä tai paketista, mallin kuitti ei täsmää lukitukseen, tiedoston tarkistussumma ei täsmää tai mukana on kielletty tiedostotyyppi. Hylkäys ei peru työtä: voit tuoda oikean tiedoston.

---

## Yleisimmät virheet

| Missä | Mitä näkyy | Korjaus |
|---|---|---|
| A1/A3 | `ERR_UNKNOWN_FILE_EXTENSION ".ts"` | Node on alle 22.18: `export NODE_OPTIONS=--experimental-strip-types` tai päivitä Node. |
| B2 | `Hugging Face returned 401/403/429` | Tee token (B1) ja aja uudelleen. |
| B2 | `No SHA-256 for …` | Polku on kirjoitettu väärin. Kopioi komento tästä ohjeesta sellaisenaan. |
| B2 | `bad spec …` / `bad role …` | Rivin muoto on `polku=kansio:rooli`, esim. `…=vae:vae`. |
| B3 | `REFUSED: …` | Aja B2 ensin samassa kansiossa; tarkista, että `pins.json` on olemassa. |
| C3 | GPU tai Internet harmaana | Puhelinvahvistus (C2) puuttuu tai ei ole vielä voimassa. |
| D4 | `Error 400: redirect_uri_mismatch` | Asiakas on Desktop-tyyppinen tai paluuosoite puuttuu/on väärin (D3). |
| D4 | `Error 403: access_denied` | Oma osoite ei ole testikäyttäjänä (D2 kohta 3). |
| F1 | kortissa ESTETTY, taustajärjestelmä pois päältä | `HAHMOSTUDIO_NOTEBOOK_CLASSIFIED_FREE=yes` puuttuu, tai `HAHMOSTUDIO_MODEL_PINS_FILE` ei osoita `pins.json`-tiedostoon. |
| F2 | `❌ GPU ei ole käytössä` / `❌ Internet ei ole käytössä` | Session options: Accelerator GPU ja Internet On, sitten Run All uudelleen. |
| F2 | `❌ Levytilaa ei ole tarpeeksi` | Kaggle ei antanut tarpeeksi tilaa; aloita uusi istunto. ⚠️ EPÄVARMA, ei vielä nähty. |
| F2 | `checksum mismatch …` | Lataus korruptoitui tai Hubin tiedosto muuttui; aja uudelleen. Jos toistuu, tee B2 uudelleen ja aloita renderöinti alusta. |
| F2 | `❌ Ajoympäristön tarkistus epäonnistui` | Lähetä listan rivit minulle (solmu puuttuu = ComfyUI-versio; malli puuttuu = lataus). |
| F2 | `❌ ComfyUI hylkäsi työnkulun` / `ilmoitti renderöintivirheestä` | Lähetä virheteksti minulle. |
| F2 | istunto kaatuu tai katkeaa | Muisti tai aikaraja; kerro, mitä näkyi. Aloita renderöinti Hahmostudiossa alusta. |
| F3 | *This job is not waiting for a notebook result* | Palvelin käynnistettiin uudelleen, työ peruttiin tai aikaraja täyttyi; aloita renderöinti uudelleen. |
| F3 | *different job* / *different package* | Väärä tulostiedosto tähän työhön. |
| F3 | *provision receipt does not match* | `pins.json` muuttui renderöinnin aloittamisen jälkeen; aloita uudelleen. |
| F3 | `Google Drive authorization failed` | Refresh token vanheni (7 päivää) tai on väärin; tee D4 uudelleen. |
| F3 | `Google Drive credentials are not configured` | D-muuttujat puuttuvat, eikä `HAHMOSTUDIO_STORAGE=local-dev` ole asetettu. |

## Jos jokin epäonnistuu, lähetä
- muistikirjan solun loppu (❌-rivi ja sitä edeltävät rivit),
- renderöintitietueen `blocked`, `errors` ja `liveVerification.missing` (dialogi näyttää ne),
- kuvakaappaus dialogista.

**Älä liitä** Hugging Face -tokenia, client secretiä tai refresh tokenia. Peitä ne, jos ne näkyvät tulosteessa.

## Tähän ohjeeseen liittyvät koodimuutokset (2026-10-08)
- **Kaggle-muistikirja-ajo:** uusi taustajärjestelmä `kaggle-notebook` (`lib/cloud-render/notebook-backend.ts`) ja muistikirjan skripti (`cloud/runtime/hahmo_notebook.py`). Palvelin ei ota yhteyttä ajoympäristöön; tuotu tulos tarkistetaan (työ, paketin hash, mallin kuitti, tarkistussummat, tiedostotyypit) ennen tavallista tulosten tarkistusta, tallennusta ja auditointia. Live-todennus perustuu muistikirja-ajossa ajoympäristön omaan tarkistukseen ja kuittiin, ja tietueeseen merkitään *ajoympäristön ilmoittama*.
- ComfyUI:n `SaveVideo` palauttaa tuloksissaan myös lipun `animated: [true]`; aiemmin se kaatoi jokaisen oikean videorenderöinnin. Korjattu.
- Uusi valinnainen `HAHMOSTUDIO_COMFYUI_TIMEOUT_MS` (Colab/oma GPU -reitti).

---

## Liite: Colab + tunneli (ei suositella)

> ⚠️ Ilmaisen Colabin FAQ kieltää palvelun ohjaamisen pääasiassa web-käyttöliittymän kautta ja etäohjauksen; tämä reitti on todennäköisesti sitä. Käytä tätä vain omalla tai maksullisella GPU-koneella, jossa ehdot sallivat sen. Silloin palvelimelle asetetaan osan E sijaan `HAHMOSTUDIO_COLAB_COMFYUI_URL`, `HAHMOSTUDIO_COLAB_CLASSIFIED_FREE=yes` (vain jos reitti on oikeasti ilmainen), `HAHMOSTUDIO_PROVISION_RECEIPTS_DIR` (kuitti kopioidaan sinne) ja tarvittaessa `HAHMOSTUDIO_COMFYUI_TIMEOUT_MS`, ja esitarkistus ajetaan dialogin Live-todennus-kohdasta ennen renderöintiä.

Tee tämä **Colabissa**, ei omalla koneellasi.

**C1. Uusi muistikirja ja GPU**
1. Mene colab.research.google.com → **New notebook** (Uusi muistikirja).
2. Valikko **Runtime → Change runtime type** (suomeksi suunnilleen *Suoritusympäristö → Vaihda suoritusympäristön tyyppiä*) → **T4 GPU** → **Save**.
3. Lisää solu (**+ Code**), liitä komento ja aja se (▶ tai Shift+Enter). Jokainen alla oleva laatikko on oma solunsa.
```python
!nvidia-smi
```
✅ Taulukossa näkyy `Tesla T4` ja muistia noin `15360MiB`. Jos tulee `command not found` tai `NVIDIA-SMI has failed`, GPU ei ole valittuna (palaa kohtaan 2) tai ilmaista GPU:ta ei juuri nyt ole saatavilla (kokeile myöhemmin).

**C2. ComfyUI**
```python
!git clone https://github.com/comfyanonymous/ComfyUI /content/ComfyUI
%cd /content/ComfyUI
!pip install -q -r requirements.txt
```
✅ Kestää muutaman minuutin. Lopussa saattaa näkyä punaisia `pip's dependency resolver…`-varoituksia; ne ovat yleensä harmittomia, kunhan viimeinen rivi ei ole `ERROR:`.
⚠️ EPÄVARMA: jos pip vaihtaa Colabin torch-version ja myöhemmin tulee CUDA-virhe, valitse **Runtime → Restart session** ja aja C2:n `%cd`-rivi uudelleen.

**C3. Lataa kaksi tiedostoa Colabiin**
1. Vasemman reunan **kansiokuvake** (Files) → **Upload**-kuvake (nuoli ylös).
2. Valitse koneeltasi `hahmostudio/manifest.json` ja `hahmostudio/cloud/runtime/provision_models.py`.
3. ✅ Tiedostot näkyvät listassa `/content`-kansion alla (Colab varoittaa, että ne poistuvat istunnon päättyessä: se on oikein).

**C4. (Vain jos B1:ssä tarvittiin token) Token Colabin Secrets-paneeliin**
1. Vasemman reunan **avainkuvake** (Secrets) → **Add new secret** → Name `HF_TOKEN`, Value = token → kytke **Notebook access** päälle.
2. Aja:
```python
import os
from google.colab import userdata
os.environ['HF_TOKEN'] = userdata.get('HF_TOKEN')
```
Älä koskaan kirjoita tokenia suoraan soluun: muistikirja tallentuu Driveen.

**C5. Lataa ja tarkista mallit**
```python
!python /content/provision_models.py /content/manifest.json --comfy-dir /content/ComfyUI --receipt /content/provision-receipt.json
```
⏳ Noin 18 Gt. **Skripti ei näytä edistymispalkkia**: solu näyttää pyörivän pitkään, ja jokaisen valmiin tiedoston kohdalla tulee rivi. Odota.
✅ Lopuksi kolme riviä:
```
verified /content/ComfyUI/models/diffusion_models/wan2.2_ti2v_5B_fp16.safetensors
verified /content/ComfyUI/models/text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors
verified /content/ComfyUI/models/vae/wan2.2_vae.safetensors
```
(Toisella ajokerralla samassa istunnossa: `ok (cached) …`.) Kuitti syntyy vain, jos kaikki kolme täsmäävät.

**C6. Lataa kuitti koneellesi**
```python
from google.colab import files; files.download('/content/provision-receipt.json')
```
✅ Selain lataa tiedoston `provision-receipt.json` (Mac: Lataukset-kansio). Se ei sisällä salaisuuksia.

**C7. Käynnistä ComfyUI**
```python
!nohup python main.py --listen 127.0.0.1 --port 8188 > /content/comfy.log 2>&1 &
```
Odota noin minuutti ja aja:
```python
!tail -n 5 /content/comfy.log
```
✅ Lopussa näkyy `To see the GUI go to: http://127.0.0.1:8188`. Jos ei vielä, odota ja aja uudelleen. Jos näkyy `Traceback`, kopioi rivit (ei salaisuuksia niissä yleensä ole) ja lähetä ne.

**C8. Tunneli**
```python
!wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -O /usr/local/bin/cloudflared && chmod +x /usr/local/bin/cloudflared
!nohup cloudflared tunnel --url http://127.0.0.1:8188 > /content/tunnel.log 2>&1 &
!sleep 10; grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' /content/tunnel.log | head -1
```
✅ Tulostuu yksi rivi `https://jotain-sanoja.trycloudflare.com`. **Tämä osoite on salaisuus**: ComfyUI ei tarkista kirjautumista, joten kuka tahansa osoitteen tietävä voi käyttää GPU-istuntoasi. Kopioi se vain seuraavaan vaiheeseen.
Jos tyhjä rivi: aja viimeinen rivi uudelleen 10 sekunnin päästä.

**C9. Tarkista tunneli omalta koneeltasi** (uusi pääteikkuna):
```bash
read -s COMFY_URL && curl -s "$COMFY_URL/system_stats" | head -c 300; echo
```
✅ Näkyy JSONia, jossa on `"devices"` ja `"name": "cuda:0 Tesla T4…"`.

**Pidä Colab-välilehti auki** koko renderöinnin ajan. Ilmainen istunto katkeaa, jos välilehti on pitkään käyttämättä tai noin 12 tunnin jälkeen; silloin kaikki tiedostot katoavat ja C2–C8 tehdään uudelleen (B-osaa ja kuittia ei tarvitse tehdä uudelleen, ellei pins.json muutu). **Tunnelin osoite vaihtuu joka kerta.**

⚠️ EPÄVARMA, muisti: ilmaisessa Colabissa on noin 12–13 Gt keskusmuistia ja T4:ssä 15 Gt näyttömuistia; mallitiedostot ovat yhteensä 18 Gt. ComfyUI siirtää osia muistien välillä, mutta istunto voi kaatua (`Your session crashed after using all available RAM`) tai ajo voi olla hyvin hidas. Jos näin käy, tarvitaan isompi kone (kohta 0).
