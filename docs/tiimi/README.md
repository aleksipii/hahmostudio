# Tiimin promptit ja työjärjestys

Kaikki kymmenen promptia sisältävät yhteiset rajat ja oman tehtävän, tiedostot, tuotokset sekä hyväksymiskriteerit. Ne on laadittu käyttäjän liitteistä ja koodin tarkistetusta nykytilasta. Työ alkaa TIIMI.md:n nykytilasta. Roolit ovat vastuita. Käyttäjän pyynnöstä rinnakkainen asiantuntijatyö on käynnistetty 8.10.2026; agentit työskentelevät rajatuilla tiedostoalueilla ja QA sekä lopputarkastus seuraavat toteutusta.

- [01-arkkitehti-saantomoottori](promptit/01-arkkitehti-saantomoottori.md)
- [02-2d-animaatio-hahmotaide](promptit/02-2d-animaatio-hahmotaide.md)
- [03-3d-animaatio-hahmotaide](promptit/03-3d-animaatio-hahmotaide.md)
- [04-full-stack-electron](promptit/04-full-stack-electron.md)
- [05-tekoaly-mallien-integraatiot](promptit/05-tekoaly-mallien-integraatiot.md)
- [06-ui-ux](promptit/06-ui-ux.md)
- [07-aani-dialogi](promptit/07-aani-dialogi.md)
- [08-qa-tuotanto](promptit/08-qa-tuotanto.md)
- [09-ideoitsija](promptit/09-ideoitsija.md)
- [10-lopputarkastaja](promptit/10-lopputarkastaja.md)

Järjestys: nykytilan testit → rajattu havainto → korjaussuunnitelma → kohdennettu korjaus → QA → erillinen loppukatselmointi. AI:n uusi pilvi-integraatio suunnitellaan ja tarkastetaan ennen toteutusta. Hahmon hyväksyntä edeltää vertailukuvan hyväksyntää. Pilvi- ja malliluvat antaa vain sovelluksen käyttäjä.

## Ensimmäisen työn todennus

- `npm test`: koko testisarja.
- `npm run build:private -- -- --configLoader runner`: private-build ilman yhteiseen node_modules-kansioon kirjoittavaa config-bundlea.
- `npm run team:test:preview`: eristetty oikea Electron/Canvas-testi ja tyylivalinnan käyttö; tallentaa leveän/kapean näkymän ja vertailut kansioon `docs/tiimi/todennus/`. Tämä ei ole paketoidun KOETA-sovelluksen tai pilvi/GPU:n testi.
- [Työn rajaus ja havainnot](KEHITYS.md).

Hahmotaiteen hyväksyntä ja AI-vertailukuvat ovat edelleen avoimia. Testien läpäisy ei anna taiteellista hyväksyntää.

## Rinnakkaisen kierroksen raportit

Kaikki kymmenen vastuualueetta työskentelivät käyttäjän pyynnöstä 8.–9.10.2026. Raportit erottelevat koodista todetut asiat, ehdotukset ja avoimet kysymykset:

- [01-arkkitehti](raportit/01-arkkitehti.md)
- [02-2d](raportit/02-2d.md)
- [03-3d](raportit/03-3d.md)
- [04-full-stack](raportit/04-full-stack.md)
- [05-ai-suunnitelma](raportit/05-ai-suunnitelma.md)
- [05-tekoaly](raportit/05-tekoaly.md)
- [06-ui-ux](raportit/06-ui-ux.md)
- [07-aani](raportit/07-aani.md)
- [08-qa](raportit/08-qa.md)
- [09-ideat](raportit/09-ideat.md)
- [10-lopputarkastus](raportit/10-lopputarkastus.md)

GitHubissa ovat promptit ja englanninkielinen esimerkkiteksti haarassa `codex/asiantuntijapromptit-2026-10-08`. Valmistunut toteutus, testit, promptit, raportit, vertailukuvat ja todennuslokit on julkaistu GitHub-haarassa `codex/asiantuntijat-2026-10-09`. Lopullinen koko testisarja läpäisi 1286/1286 testiä hash-varmennetussa kopiossa; typecheck, private-build ja Electron-tarkistukset läpäisivät. [Koottu todennus ja avoimet hyväksynnät](todennus/VARMENNUS-2026-10-09.md).
