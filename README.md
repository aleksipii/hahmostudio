# Hahmostudio — Codex-projekti

Tässä on ensimmäisen vaiheen PSD-editorin lähdekoodi tavallisena React + TypeScript + Vite -projektina. Projekti ei tarvitse Sites-, Cloudflare- tai ChatGPT-palvelinta. PSD:t käsitellään selaimessa.

## Nettisivu

[Avaa Hahmostudio GitHub Pagesissa](https://aleksipii.github.io/hahmostudio/)

Julkaisu odottaa GitHub Pagesin käyttöönottoa. Linkki toimii, kun Pages on otettu käyttöön ja julkaisu onnistunut.

Editorissa voit avata oman PSD-tiedoston tai kokeilla tasotestiä. PSD-tiedostot käsitellään paikallisesti selaimessa. Avoimen editorin tila säilyy vain nykyisessä välilehdessä.

## Aloita omalla koneella

1. Pura ZIP ja avaa `hahmostudio`-kansio Codexissa tai VS Codessa.
2. Käytä Node.js 22.13+ (tai uudempaa yhteensopivaa versiota).
3. Suorita projektikansiossa:

```sh
npm ci
npm run dev
```

Avaa terminaalin ilmoittama paikallinen osoite. `npm run build` tuottaa staattisen sivuston `dist`-kansioon. `npm run preview` näyttää kootun sivuston paikallisesti.

Codexille aloitustehtävä:

> Jatka tätä Hahmostudio-projektia. Lue AGENTS.md. Vaihe 1 on PSD importer + layer viewer. Toteuta seuraavaksi rig editor: tasojen roolien määritys, pivot- ja nivelpisteiden sijoittaminen hahmon päälle sekä rigin tallennus ja avaaminen JSON-tiedostona. Säilytä nykyinen PSD-tuonti ja käyttöliittymä. Älä toteuta vielä timelinea. Tarkista tyypit ja tuotantokoonti.

## GitHub: pidä lähdekoodi yksityisenä

Luo tyhjä GitHub-repositorio nimellä `hahmostudio` ja valitse **Private**. Voit lisätä tämän kansion GitHub Desktopissa paikalliseksi repositorioksi ja julkaista sen yksityisenä. Vaihtoehtoisesti käytä terminaalia:

```sh
git init
git add .
git commit -m "PSD importer and layer viewer"
git branch -M main
git remote add origin https://github.com/OMA-TUNNUS/hahmostudio.git
git push -u origin main
```

Vaihda `OMA-TUNNUS` omaan tunnukseesi. Kirjaudu GitHubin normaalia kirjautumista käyttäen; älä lisää tunnuksia tai tokeneita lähdekoodiin.

Codex Cloudissa valitse GitHub-repositorio pilviympäristöön ja anna pääsy juuri tähän repositorioon. Omalla koneella kansiota voi kehittää ilman GitHubia.

## GitHub Pagesin yksityisyys

**Private-repositorio ei yksin tee julkaistusta Pages-sivusta yksityistä.** Yksityinen Pages-julkaisu vaatii GitHub Enterprise Cloud -organisaation ja sen omistaman private/internal-projektirepositorion. Henkilökohtaisen tavallisen tilin Pages ei tarjoa tätä pääsynhallintaa.

Repositoriossa on automaattinen julkaisu `.github/workflows/pages.yml`. Kun GitHub Pages on otettu käyttöön asetuksella **Source: GitHub Actions**, muutokset `main`-haaraan rakentavat ja julkaisevat editorin. Nykyinen yksityinen repositorio vaatii Pagesia tukevan maksullisen tilauksen; maksuttomalla tilillä repositorion on oltava julkinen.

Jos sinulla on yksityiseen Pagesiin oikeuttava organisaatio:

1. Vie koodi sen private-repositorioon.
2. Aseta Pages-julkaisu GitHub Actionsin kautta ja muuta Pagesin näkyvyys **Private**.
3. Lisää rakennusvaiheiksi `npm ci` ja `npm run build`.
4. Julkaise `dist` käyttäen GitHubin `upload-pages-artifact`- ja `deploy-pages`-actioneita.
5. Yksityisen Pagesin erillisessä root-domainissa käytä oletusarvoa `VITE_BASE_PATH=/`.

Jos tarkoituksella julkaiset julkisen projektisivun osoitteeseen `https://tunnus.github.io/hahmostudio/`, rakenna se muuttujalla `VITE_BASE_PATH=/hahmostudio/`. Sivun näkyvyys pitää silti ratkaista erikseen. Omaan käyttöön vaihtoehtona on paikallinen selainkäyttö tai nykyinen yksityinen Hahmostudio-julkaisu.

Viralliset ohjeet:
- https://docs.github.com/en/enterprise-cloud@latest/pages/getting-started-with-github-pages/changing-the-visibility-of-your-github-pages-site
- https://developers.openai.com/codex/cloud
- https://vite.dev/guide/static-deploy.html#github-pages

## Toteutettu

PSD-tuonti, sisäkkäiset tasoryhmät, näkyvyys, tasotiedot, PNG-/ZIP-vienti, zoomaus, alkuperäinen PSD-esikatselu ja tasotesti. Tasojen näkyvyys ja valinnat eivät vielä tallennu. Monimutkaiset Photoshop-tehosteet voivat poiketa tasoesikatselussa.

Seuraava vaihe on rig editor. Tarkempi jatkuvuusohje on `AGENTS.md`-tiedostossa.
