# Pilvirenderöinnin käyttöönotto, vaihe vaiheelta

Tämä ohje on kirjoitettu koodin nykytilan mukaan. **Colab-, ComfyUI- ja cloudflared-kohtia (osa C) en ole ajanut itse**; ne voivat muuttua. Muut osat on testattu automaattisilla testeillä, ei oikeaa pilveä vasten.

## Mitä voi tehdä paikallisesti ja mitä ei
| Paikallisesti (omalla koneella) | Vain pilvessä |
|---|---|
| Koodin kehitys, `npm test`, selainkäyttöliittymä, palvelin, mallien lukitus (vain metatieto), tarkistukset, valtuutuskortti, paikallinen testitallennus | GPU-renderöinti ja **kaikki mallipainot** (projektin sääntö: painoja ei omalle koneelle eikä Driveen) |

Ilman GPU-ajoympäristöä kaikki renderöinnit **estyvät oikein** ("RENDER BLOCKED"). Se on odotettu tulos, ei vika.

---
## Osa A: paikallinen ympäristö (10 min)
Vaatii Node.js 22 tai uudemman (suositus 22.18+) ja git.
```bash
git clone https://github.com/aleksipii/hahmostudio.git
cd hahmostudio
git checkout hahmostudio1.0
npm ci
npm test            # odotus: kaikki läpi (yksi ajoajasta riippuva suorituskykytesti voi joskus pätkiä; aja uudelleen)
```
Jos Node on vanhempi kuin 22.18, lisää ennen muita komentoja: `export NODE_OPTIONS=--experimental-strip-types`

### A2. Käyttöliittymä ilman GPU:ta (kokeilu)
```bash
npm run build:private
HAHMOSTUDIO_CLOUD_RENDER=1 HAHMOSTUDIO_STORAGE=local-dev npm run start:private
```
1. Avaa http://127.0.0.1:4176. Ensimmäisellä kerralla luo omistajatunnus (salasana vähintään 12 merkkiä).
2. Tee tai avaa jakso Esitys-työtilassa (käsikirjoitus → jakso), jotta esitys on olemassa.
3. Valikko → **Pilvirenderöinti…** → **Synkronoi säännöistä** → valitse kohtaus → **Hyväksy ja lukitse kohtaus**.
4. **Pyydä ehdotus**: näet tarkistuslistan (✓/✗).
5. **Tarkista valtuutus**: kortti näyttää ESTETTY, koska taustajärjestelmää ei vielä ole. Oikein.
`local-dev`-tallennus kirjoittaa `.private-storage/cloud-render-dev/` -kansioon (vain kehitykseen).

---
## Osa B: mallien lukitus (vain metatietoa, ei lataa painoja)
Tarvitset Hugging Face -tunnuksen (token): huggingface.co → Settings → Access Tokens (read).

Ensimmäinen testi: video (`image_to_video`) Wan2.2 TI2V 5B ‑mallilla. Sen ComfyUI-tiedostot ovat repossa `Comfy-Org/Wan_2.2_ComfyUI_Repackaged` (alkuperäinen `Wan-AI/Wan2.2-TI2V-5B` on pilkottu/.pth-muotoinen eikä ComfyUI lataa sitä suoraan).
```bash
export HF_TOKEN=hf_xxx
PINS_OUT=pins.json node --experimental-strip-types scripts/make-model-pin.ts wan2.2-ti2v-5b \
  Comfy-Org/Wan_2.2_ComfyUI_Repackaged \
  split_files/diffusion_models/wan2.2_ti2v_5B_fp16.safetensors=diffusion_models:unet \
  split_files/text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors=text_encoders:clip \
  split_files/vae/wan2.2_vae.safetensors=vae:vae
cat pins.json       # tarkista: revision on 40 merkkiä, jokaisella tiedostolla sha256
```
Skripti kirjoittaa **Hubin nykyisen** commitin ja tiedostojen SHA-256:t. Älä keksi niitä käsin. Jos virhe on "No SHA-256 for …", polku on väärin tai tiedosto ei ole LFS-tiedosto.

Tee ajoympäristön manifesti (kieltäytyy, ellei malli ole tuotantoturvallinen):
```bash
node --experimental-strip-types scripts/make-provision-manifest.ts wan2.2-ti2v-5b pins.json > manifest.json
```
Tiedostot ovat yhteensä noin 18 Gt. Ilmaisen Colabin T4 (≈15 Gt) muisti voi **loppua tai ajo olla hyvin hidas**; en ole testannut. Jos näin käy, tarvitaan suurempi GPU (silloin ilmaisuus ei täyty ja renderöinti jää estetyksi, ei maksulliseen siirrytä).

FLUX.1-schnell ei ole vielä käyttökelpoinen: sen tekstikooderit ovat toisessa repossa, eikä malli tue kahta reposta.

---
## Osa C: ajoympäristö (Colab tai oma GPU-palvelin)
Tee tämä **pilvessä**, ei omalla koneellasi. Tarkista Colabin käyttöehdot ennen verkkopalvelun julkaisua tunnelilla.

Colab-muistikirjassa (GPU-ajoympäristö valittuna), solu kerrallaan:
```python
!git clone https://github.com/comfyanonymous/ComfyUI /content/ComfyUI
%cd /content/ComfyUI
!pip install -q -r requirements.txt
```
Lataa Colabiin tiedostot `cloud/runtime/provision_models.py` ja `manifest.json` (vasemman reunan tiedostopaneeli → Upload). Sitten:
```python
!python /content/provision_models.py /content/manifest.json --comfy-dir /content/ComfyUI --receipt /content/provision-receipt.json
```
Skripti lataa vain kiinnitetystä revisiosta, tarkistaa SHA-256:n ja poistaa virheellisen tiedoston. **Kuitti** syntyy vasta kun kaikki tiedostot täsmäävät. Lataa se koneellesi:
```python
from google.colab import files; files.download('/content/provision-receipt.json')
```
Käynnistä ComfyUI ja tunneli:
```python
!nohup python main.py --listen 127.0.0.1 --port 8188 > /content/comfy.log 2>&1 &
!wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -O /usr/local/bin/cloudflared && chmod +x /usr/local/bin/cloudflared
!nohup cloudflared tunnel --url http://127.0.0.1:8188 > /content/tunnel.log 2>&1 &
!sleep 10; grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' /content/tunnel.log | head -1
```
Tulostuva `https://….trycloudflare.com` on ComfyUI-osoite. **ComfyUI ei itse tarkista Authorization-otsikkoa**, joten osoite on ainoa salaisuus: älä jaa sitä äläkä liitä sitä lokeihin.

---
## Osa D: Google Drive
1. console.cloud.google.com → uusi projekti → ota käyttöön **Google Drive API**.
2. OAuth consent screen (External, lisää itsesi testikäyttäjäksi) → Credentials → **OAuth client ID** (Desktop app) → tallenna client id ja secret.
3. Hae refresh token: developers.google.com/oauthplayground → rataskuvake → "Use your own OAuth credentials" → syötä id ja secret → scope `https://www.googleapis.com/auth/drive.file` → Authorize → Exchange authorization code → kopioi **Refresh token**.
(Kokeilu onnistuu ensin ilman Drivea: `HAHMOSTUDIO_STORAGE=local-dev`.)

---
## Osa E: palvelin oikeilla asetuksilla
Kopioi kuitti kansioon, jonka kerrot palvelimelle:
```bash
mkdir -p receipts && cp ~/Downloads/provision-receipt.json receipts/
```
```bash
export HAHMOSTUDIO_CLOUD_RENDER=1
export HAHMOSTUDIO_MODEL_PINS_FILE="$PWD/pins.json"
export HAHMOSTUDIO_PROVISION_RECEIPTS_DIR="$PWD/receipts"
export HAHMOSTUDIO_COLAB_COMFYUI_URL="https://….trycloudflare.com"
export HAHMOSTUDIO_COLAB_CLASSIFIED_FREE=yes     # oma lausuntosi: tämä suoritusreitti on ilmainen
# Drive (tai korvaa: export HAHMOSTUDIO_STORAGE=local-dev):
export GOOGLE_OAUTH_CLIENT_ID=… GOOGLE_OAUTH_CLIENT_SECRET=… GOOGLE_OAUTH_REFRESH_TOKEN=…
# valinnainen: export HAHMOSTUDIO_OUTPUT_INSPECTOR=palette
npm run build:private && npm run start:private
```
Maksullinen laskenta pysyy pois päältä; mitään sen sallivaa asetusta ei tarvita eikä kannata asettaa.

---
## Osa F: tarkistus ja yksi oikea renderöinti (selaimessa)
1. Pilvirenderöinti-dialogi → **Synkronoi säännöistä** → valitse kohtaus → **Hyväksy ja lukitse kohtaus**.
2. **Hahmojen hyväksytyt vertailukuvat**: lataa jokaiselle esiintyvälle hahmolle PNG/JPEG/WebP (≤ 8 Mt). Video tarvitsee tämän lähtökuvaksi.
3. Avaa **Live-todennus** → **Suorita renderöinniton esitarkistus**. Rivin pitää olla ✓ (`image_to_video / wan2.2-ti2v-5b`). Jos ✗, lue syy (puuttuva solmu tai malli ei ole ajoympäristössä) ja lähetä se minulle.
4. Valitse työnkulku **Image to video** → **Tarkista valtuutus**. Kortin pitää näyttää: taustajärjestelmä `colab-free`, luokka `free`, hinta €0.00, enimmäishinta €0.00, maksullinen laskenta/varavaihtoehto POIS, mallin revisio (40 merkkiä), lisenssi apache-2.0, kaupallinen käyttö allowed, **HYVÄKSYTTY**.
5. **Hyväksy ja renderöi.** Valmiin jälkeen tietueessa näkyy "Live-todennus: läpäisty" tai lista puuttuvista ehdoista.
6. Vasta tämän jälkeen: työnkulku **Character animation**.

## Jos jokin epäonnistuu, lähetä minulle
- esitarkistuksen rivit (erityisesti ✗),
- renderöintitietueen `blocked`, `errors`, `liveVerification.missing` (dialogi näyttää ne; koko tietue: `GET /api/render/<jobId>`),
- asennusskriptin tuloste ja `comfy.log`:n loppu,
- kuvakaappaus dialogista.
Älä liitä tokeneita, client secretiä tai trycloudflare-osoitetta.
