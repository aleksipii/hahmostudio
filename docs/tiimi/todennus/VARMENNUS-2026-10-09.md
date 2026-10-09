# Toteutetut työt ja todennus — 9.10.2026

## Valmistunut rajattu toteutus

- Kymmenen itsenäistä asiantuntijapromptia ja kymmenen vastuualueen raportit; yhdeksän erillistä agenttia sekä koordinoijan full-stack-työ.
- Englanninkielinen Kokoro-esimerkki ja kokoro-en-aloituspohja; vanha englanninkielinen pohja säilyy.
- Hahmokohtainen 3D flat/cel-tyyli; vanhat kentättömät ja profiilittomat kohtaukset säilyttävät cel-ulkoasun. Flat-helman leikkaava geometria korjattu.
- PSD-tuonti hyväksyy20 sisäkkäistä ryhmää ja hylkää21 myös tyhjinä; leaf ei lisää keinotekoista syvyystasoa.
- Tekoälypaneeli näyttää puuttuvan mallilukituksen estettynä; tuotu lukitus ei väitä mallia tai renderiä valmiiksi.
- Lukittu hahmoryhmä estää myös esitystavan ja värien muokkauksen; AI-latauksella aria-busy/status.
- Valmiiksi peruttu vienti ei käynnistä encoder-prosessia.
- Uudet regressiot: todelliset PSD/hahmopaketit, englanninkielinen rakennus, testimoottorin ääni/WAV/suuajat, legacy-tyylit, geometry, estotilat ja encoder-peruutus.

## Varmennettu

QA:n normaali npm test SHA-256-varmennetussa /private/tmp/hahmostudio-20261009-verification-kopiossa:1286/1286 pass, fail/cancelled/skipped/todo 0, exit 0. Sama HEAD ja26 muuttunutta/uutta tiedostoa verrattu; source-hashes-2026-10-09.json.

Typecheck exit 0 sekä työkopion sallivassa uusinnassa että varmennuskopiossa. Private-build exit 0. Oikea Electron 44.5.1 darwin-fixture: tyylivaihto, lukitun hahmoryhmän esto, puuttuvan mallilukituksen estotila sekä600/1440 px ilman ylivuotoa; ei konsolivirheitä. Vertailukuvat ja preview-report.json samassa todennus-kansiossa. FFmpeg/ffprobe toimi lopullisessa kokoajossa.

Documents-työtilan aiemmissa ajoissa native FFprobe epäonnistui kerran ja lähdetiedosto/Git-lukuihin tuli odotuksia; niitä ei merkitty läpäisseiksi. Tmp-kopio ratkaisi ajon odotukset. QA-raportin tekstissä ollut testin etsintämerkki poistettiin, koska se aiheutti dokumentaatio/fixture-konfliktin; tuotantokoodia tai testiä ei löysätty.

## Katselmoinnin tila ja avoimet hyväksynnät

Riippumaton lopputarkastaja katselmoi koodidiffin, legacy-yhteensopivuuden ja PSD-tarkennuksen eikä löytänyt uutta kriittistä/korkeaa regressiota. Hänen viimeinen päätöksensä oli palautus koko sarjan loppuvahvistukseen. QA toimitti myöhemmin yllä olevan1286/1286/exit 0-näytön, mutta lopputarkastajan agentti osui käyttörajaan ennen päätöstekstin päivittämistä. Tämä loppunäyttö on koordinoijan lisäämä, ei väite uudesta riippumattomasta hyväksyntäpäätöksestä.

Aito Kokoro-inferenssi ja kuuntelu, Rhubarb- ja vientisynkan katsottu hyväksyntä,2D/3D-liikenäytteiden taiteellinen hyväksyntä, VoiceOver/fokuspolku, paketoidun sovelluksen toimituskoe ja oikea pilvi/GPU-ajo ovat edelleen avoimia. Äänitestissä käytettiin determinististä siniaaltoista testimoottoria. Näyttö ei osoita koko kaupallista studiota valmiiksi.

## Julkaisu

Käyttäjä valtuutti9.10.2026 kaikkien valmistuneiden töiden viennin GitHubiin. Toteutus, testit, promptit, raportit, todennuksen yhteenvedot ja vertailukuvat julkaistaan erillisessä codex/asiantuntijat-2026-10-09-haarassa. Asennettua sovellusta tai main-haaraa ei korvata tällä julkaisulla.
