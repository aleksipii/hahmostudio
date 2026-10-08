# Pilvirenderöinnin käyttöönotto, askel askeleelta (aloittelijalle)

Tämä ohje vie ensimmäiseen oikeaan pilvirenderöintiin: Hahmostudio omalla koneella, mallit ja ComfyUI Google Colabissa, tulokset Google Driveen.

**Mitä on tarkistettu ja mitä ei (2026-10-08):**
- ✅ Komennot, ympäristömuuttujat ja tiedostopolut on tarkistettu koodia vasten (`scripts/make-model-pin.ts`, `scripts/make-provision-manifest.ts`, `cloud/runtime/provision_models.py`, `lib/cloud-render/server.ts`).
- ✅ Wan2.2-mallin kolme tiedostoa on tarkistettu olevan Hugging Facessa oikeilla poluilla (yhteensä noin 18,1 Gt).
- ✅ ComfyUI:n `SaveVideo`-solmun palautusmuoto on tarkistettu ComfyUI:n lähdekoodista, ja siihen liittyvä vika on korjattu (ks. loppu).
- ⚠️ **Kukaan ei ole vielä ajanut tätä oikeasti** Colabissa, oikeaa ComfyUI:ta tai oikeaa Drivea vasten. Kohdat, joissa en ole varma, on merkitty **⚠️ EPÄVARMA**.

> 🔒 **Salaisuudet:** Hugging Face -token, Googlen *client secret*, *refresh token* ja `trycloudflare.com`-osoite ovat salaisuuksia. **Älä liitä niitä keskusteluun Clauden kanssa, GitHubiin, kuvakaappauksiin tai lokeihin.** Jos lähetät virheilmoituksen, peitä ne ensin (esim. `hf_xxx…`). Jos salaisuus vuotaa, mitätöi se heti (ohjeet kunkin vaiheen kohdalla).

---

## 0. Ennen kuin aloitat: lue tämä (päätös)

### ⚠️ Ilmaisen Colabin käyttöehdot
Googlen Colab-FAQ (research.google.com/colaboratory/faq.html, luettu 2026-10-08) sanoo, että **ilmaisissa** Colab-ajoympäristöissä ei saa mm. *"ohittaa muistikirjan käyttöliittymää ja käyttää palvelua pääasiassa web-käyttöliittymän kautta"* eikä käyttää *etäohjausta*, ja että tällaiset ajot voidaan katkaista varoituksetta. Kaikilta Colab-ajoilta on kielletty myös *"verkkopalvelut, jotka eivät liity interaktiiviseen laskentaan"*.

Tämän ohjeen Colab-reitti käynnistää ComfyUI:n ja avaa sille tunnelin, jonka kautta Hahmostudio ohjaa sitä. **Se on hyvin todennäköisesti juuri sitä, mitä ilmaisessa Colabissa ei sallita.** Vaihtoehdot:
1. **Ilmainen Colab:** voit kokeilla, mutta Google voi katkaista ajon tai rajoittaa tiliäsi. Päätös ja riski ovat sinun. En suosittele tätä pitkäaikaiseksi ratkaisuksi.
2. **Maksullinen Colab (Pro tai compute units):** FAQ:n mukaan maksullinen saldo poistaa nämä rajoitukset. Silloin ajo **ei ole ilmainen**, eikä asetusta `HAHMOSTUDIO_COLAB_CLASSIFIED_FREE=yes` saa asettaa (se on sinun lausuntosi siitä, että reitti on ilmainen). Projektin nollakustannussääntö estää silloin renderöinnin, ja maksullisen reitin käyttöönotto vaatii erillisen päätöksen ja koodimuutoksen.
3. **Oma tai vuokrattu Linux-kone, jossa on NVIDIA-näytönohjain:** osat B–F toimivat samoin, osa C tehdään sillä koneella Colabin sijaan. (Mallipainoja ei projektin säännön mukaan ladata omalle työkoneellesi.)

Osat A, B ja D voit tehdä joka tapauksessa; ne eivät käytä Colabia.

### Mitä tarvitset
| Mitä | Mihin | Maksaa |
|---|---|---|
| Oma kone (Mac käy), Node.js 22.18 tai uudempi, git | Hahmostudio-palvelin | – |
| Google-tili | Colab ja Drive | ilmainen |
| Hugging Face -tili (vapaaehtoinen) | Wan2.2-repo ei ole lukittu, joten token ei ole pakollinen. Tarvitaan vain, jos lataus antaa virheen 401/403/429. | ilmainen |
| Google Cloud -projekti ja OAuth-asiakas | Driveen tallennus | ilmainen (ei laskutustiliä tarvita) |

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

**B3.** Tee ajoympäristön manifesti:
```bash
node --experimental-strip-types scripts/make-provision-manifest.ts wan2.2-ti2v-5b pins.json > manifest.json
cat manifest.json
```
✅ Näkyy `"schema": 1`, `"modelId": "wan2.2-ti2v-5b"`, `"repo": "Comfy-Org/Wan_2.2_ComfyUI_Repackaged"`, sama revision ja kolme tiedostoa. Jos näkyy `REFUSED: …`, lue syy (yleensä pins.json puuttuu tai on väärä).

FLUX.1-schnell ei ole vielä käyttökelpoinen (sen tekstikooderit ovat eri repossa, eikä malli tue kahta repoa).

---

## Osa C: ComfyUI Colabissa (noin 45–90 min, enimmäkseen latausta)

Lue ensin kohta 0. Tee tämä **Colabissa**, ei omalla koneellasi.

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

**E1.** Kopioi kuitti (repon juuressa):
```bash
mkdir -p receipts && cp ~/Downloads/provision-receipt.json receipts/
```

**E2.** Pysäytä A3:n palvelin (Ctrl+C) ja aja samassa pääteikkunassa. Salaiset arvot luetaan `read -s` -komennolla, jotta ne eivät jää komentohistoriaan; liitä kukin arvo ja paina Enter.
```bash
export HAHMOSTUDIO_CLOUD_RENDER=1
export HAHMOSTUDIO_MODEL_PINS_FILE="$PWD/pins.json"
export HAHMOSTUDIO_PROVISION_RECEIPTS_DIR="$PWD/receipts"
read -s HAHMOSTUDIO_COLAB_COMFYUI_URL && export HAHMOSTUDIO_COLAB_COMFYUI_URL   # C8:n https://….trycloudflare.com
export HAHMOSTUDIO_COLAB_CLASSIFIED_FREE=yes   # sinun lausuntosi, että tämä reitti on ilmainen (ks. kohta 0)
export HAHMOSTUDIO_COMFYUI_TIMEOUT_MS=1800000  # 30 min; T4 on hidas, oletus 10 min voi loppua kesken
# Drive (D-osa):
export GOOGLE_OAUTH_CLIENT_ID=…                # ei salainen, mutta älä silti jaa
read -s GOOGLE_OAUTH_CLIENT_SECRET && export GOOGLE_OAUTH_CLIENT_SECRET
read -s GOOGLE_OAUTH_REFRESH_TOKEN && export GOOGLE_OAUTH_REFRESH_TOKEN
# TAI ilman Drivea: export HAHMOSTUDIO_STORAGE=local-dev
# valinnainen: export HAHMOSTUDIO_OUTPUT_INSPECTOR=palette
npm run build:private && npm run start:private
```
✅ Näkyy `Hahmostudio: http://127.0.0.1:4176`. Jos palvelin kaatuu heti viestiin `… must be …`, jokin arvo on väärässä muodossa (viesti kertoo minkä).

- Osoitteen pitää alkaa `https://`; muuten taustajärjestelmä jää pois päältä ilman virheilmoitusta.
- Maksullinen laskenta pysyy pois. Älä aseta `HAHMOSTUDIO_ALLOW_PAID_*`-muuttujia.
- Muuttujat ovat voimassa vain tässä pääteikkunassa. Uudessa ikkunassa ne annetaan uudelleen.

---

## Osa F: tarkistus ja ensimmäinen oikea renderöinti (selaimessa)

1. http://127.0.0.1:4176 → jakso → **Pilvirenderöinti…** → **Synkronoi säännöistä** → valitse kohtaus → **Hyväksy ja lukitse kohtaus**.
2. **Hahmojen hyväksytyt vertailukuvat**: lataa jokaiselle kohtauksen hahmolle PNG, JPEG tai WebP (enintään 8 Mt). Video käyttää tätä lähtökuvana.
3. Avaa **Live-todennus** → **Suorita renderöinniton esitarkistus**.
   ✅ Rivi `image_to_video / wan2.2-ti2v-5b` on **✓**. Muiden mallien rivit ovat ✗ (*Model not acceptable…*): **se on odotettua**, koska vain Wan on lukittu.
   ✗ Wan-rivillä: *Node … is not installed* → ComfyUI on liian vanha (aja C2 uudelleen). *Model file … is not provisioned* → C5 ei mennyt läpi. *ComfyUI runtime is unavailable* → tunneli tai ComfyUI on alhaalla tai osoite on väärä.
4. Työnkulku **Image to video** → **Tarkista valtuutus**. ✅ Kortissa: taustajärjestelmä `colab-free`, luokka `free`, hinta €0.00, enimmäishinta €0.00, maksullinen laskenta ja varavaihtoehto POIS, mallin revisio (40 merkkiä), lisenssi apache-2.0, kaupallinen käyttö allowed, **HYVÄKSYTTY**.
5. **Hyväksy ja renderöi.** ⏳ T4:llä tämä voi kestää kymmeniä minuutteja (⚠️ EPÄVARMA, ei mitattu). Pidä Colab-välilehti auki.
   ✅ Valmiin jälkeen tietueessa lukee *Live-todennus: läpäisty* tai lista puuttuvista ehdoista. Video on Drivessa kansiossa `AnimationStudio/Projects/<projekti>/renders/`.
6. Vasta tämän jälkeen: työnkulku **Character animation**.

**Tärkeää:** esitarkistuksen tulos pidetään palvelimen muistissa ja on voimassa 24 tuntia. **Älä käynnistä palvelinta uudelleen kohtien 3 ja 5 välissä.** Jos käynnistät (tai tunnelin osoite vaihtuu), tee kohta 3 uudelleen ennen renderöintiä.

---

## Yleisimmät virheet

| Missä | Mitä näkyy | Korjaus |
|---|---|---|
| A1/A3 | `ERR_UNKNOWN_FILE_EXTENSION ".ts"` | Node on alle 22.18: `export NODE_OPTIONS=--experimental-strip-types` tai päivitä Node. |
| B2 | `Hugging Face returned 401/403/429` | Tee token (B1) ja aja uudelleen. |
| B2 | `No SHA-256 for …` | Polku on kirjoitettu väärin. Kopioi komento tästä ohjeesta sellaisenaan. |
| B2 | `bad spec …` / `bad role …` | Rivin muoto on `polku=kansio:rooli`, esim. `…=vae:vae`. |
| B3 | `REFUSED: …` | Aja B2 ensin samassa kansiossa; tarkista, että `pins.json` on olemassa. |
| C1 | `NVIDIA-SMI has failed` / *Cannot connect to GPU backend* | GPU ei valittuna tai ilmaista kiintiötä ei juuri nyt ole. |
| C5 | `checksum mismatch …` | Lataus korruptoitui tai Hubin tiedosto muuttui; aja C5 uudelleen. Jos toistuu, tee B2–B3 uudelleen ja lataa uusi manifesti. |
| C5 | `HTTP Error 401/403` | Tee C4 (token). |
| C5 | `No space left on device` | Colabin levy loppui; **Runtime → Disconnect and delete runtime** ja aloita C1:stä. |
| C5–F5 | *Your session crashed after using all available RAM* | Ilmaisen Colabin muisti ei riitä (ks. C-osan varoitus). |
| C8 | tyhjä rivi | Odota 10 s ja aja grep-rivi uudelleen; katso `!cat /content/tunnel.log`. |
| D4 | `Error 400: redirect_uri_mismatch` | Asiakas on Desktop-tyyppinen tai paluuosoite puuttuu/on väärin (D3). |
| D4 | `Error 403: access_denied` | Oma osoite ei ole testikäyttäjänä (D2 kohta 3). |
| F | `Google Drive authorization failed` | Refresh token vanheni (7 päivää) tai on väärin; tee D4 uudelleen. |
| F | `Google Drive credentials are not configured` | D-muuttujat puuttuvat, eikä `HAHMOSTUDIO_STORAGE=local-dev` ole asetettu. |
| F3 | ei rivejä lainkaan, vain estosyy (esim. taustajärjestelmä pois päältä tai hinta tuntematon) | `HAHMOSTUDIO_COLAB_COMFYUI_URL` puuttuu, ei ala `https://`:llä, tai `HAHMOSTUDIO_COLAB_CLASSIFIED_FREE` ei ole `yes`. |
| F5 | `Render cancelled or timed out.` | Nosta `HAHMOSTUDIO_COMFYUI_TIMEOUT_MS` (enintään 3600000) tai lyhennä videota. |
| F5 | `ComfyUI rejected the prompt.` / `ComfyUI reported a render error.` | Aja Colabissa `!tail -n 40 /content/comfy.log` ja lähetä tuloste. |

## Jos jokin epäonnistuu, lähetä
- esitarkistuksen rivit (erityisesti ✗),
- renderöintitietueen `blocked`, `errors` ja `liveVerification.missing` (dialogi näyttää ne; koko tietue: `GET /api/render/<jobId>`),
- asennusskriptin tuloste ja `comfy.log`:n loppu,
- kuvakaappaus dialogista.

**Älä liitä** Hugging Face -tokenia, client secretiä, refresh tokenia tai trycloudflare-osoitetta. Peitä ne, jos ne näkyvät tulosteessa.

## Tähän ohjeeseen liittyvät koodimuutokset (2026-10-08)
- ComfyUI:n `SaveVideo` palauttaa tuloksissaan myös lipun `animated: [true]`. Aiemmin taustajärjestelmä tulkitsi sen kelvottomaksi tiedostoksi ja hylkäsi **jokaisen** oikean videorenderöinnin virheellä *Runtime returned a disallowed file*. Nyt vain tiedosto-objektit käsitellään; tiedosto-objekti ilman nimeä hylätään edelleen.
- Uusi valinnainen `HAHMOSTUDIO_COMFYUI_TIMEOUT_MS` (60000–3600000, oletus 600000 = 10 min), koska hidas GPU voi ylittää 10 minuuttia.
