# Riippumaton lopputarkastus — 9.10.2026

Vaihe: tuotantodiffin ja asiantuntijanäytön katselmointi tehty; integraatioajojen lopputulos odottaa vahvistusta. Katselmoija on toteutusagenteista erillinen agentti. Omistettu tiedosto on vain tämä raportti. HEAD `d356ad6e7d1ae043d68cb74a3c1bf0143f91d667`; arvio koskee sen päällä olevaa muuttuvaa työkopiodiffiä, ei julkaistua koodirevisiota. Luettu AGENTS.md, TIIMI.md, lopputarkastajan prompti ja raportit 01–07 sekä 09. QA-raporttia ei vielä ollut ensimmäisessä tarkastuksessa.

## KOODISTA TODETTU

- `lib/toon3d.ts:3,11–13`, `ToonProfile` ja `buildToonAsset`: renderStyle on valinnainen; helman laajennus koskee vain eksplisiittistä flat-tyyliä. Profiilittomat vanhat kohtaukset ja kentättömät profiilit käyttävät kirjaston ennallaan säilyvää cel-oletusta. Luut ja vanha cel-geometria säilyvät. `lib/toon-render.ts:3,9,13,19` sisällyttää koko profiilin cache-avaimeen, käyttää flatissa mesh-värejä ja poistaa tumman siluetin; kentättömän profiilin historiallinen 1,3 px reunamitta säilyy. Explicit cel käyttää profiilin outline-arvoa tarkoituksella.
- `lib/production-model.ts:37`, `validateProductionDetails`: vain puuttuva, flat tai cel hyväksytään. `lib/toon-style.test.ts` kattaa värit/reunat, legacy-profiilin, profiilittoman kohtauksen, validoinnin ja .hahmo-draftin roundtripin. `lib/toon-hem.test.ts` kattaa helman polygonisen sisältymisen ja legacy-geometrian yhtäläisyyden. Näiden testien sisältö ei osoita kaikkien animaatioasentojen taiteellista hyväksyttävyyttä.
- `lib/psd-import.ts:18–20,29`, `readStructure`: vain ryhmän children-kenttä aiheuttaa rekursion; lehden puuttuva lapsilista ei lisää tasoa. Myös tyhjä ryhmä lasketaan syvyyteen, joten täsmälleen 20 ryhmää hyväksytään ja 21 hylätään. Syvyys-, määrä- ja pikselirajat säilyvät. PSD-ID-, järjestys- tai asset-muunnosta ei lisätty. Koordinoijan jälkikorjaus ja tyhjien ryhmien uusi regressio katselmoitu erikseen; raportoitu kohdennettu 9/9 exit 0.
- `components/production-board.tsx:24`: native disabled-fieldset estää hahmoryhmän kontrollit yhdessä. Tyylivalinta kulkee olemassa olevan update/change-polun kautta ja näkyy toon3d-esitystavassa. `components/ai-panel.tsx:7–9`: aria-busy ja status-rooli kuvaavat latausta. SSR ei todista VoiceOverin käyttäytymistä.
- `lib/ai-status.ts:11,48–49`: modelPins vaikuttaa kustannusrivin estoon; lukituksen tuonti erotetaan validoinnista ja oikeasta live-todennuksesta. Ei uutta palvelukutsua tai käyttäjän puolesta annettua lupaa.
- `desktop/encoder.mjs:2`, `runEncoder`: valmiiksi peruttu signaali hylätään ennen spawnia. `desktop/encoder.test.mjs` tarkistaa outputin puuttumisen ja progress/virhepolut Node-fixturellä; tämä ei ole FFmpeg-, VideoToolbox- tai toimitusvideotesti.
- `lib/episode-templates.ts:11`, `kokoro-en`: kaksi englanninkielistä repliikkiä ja eksplisiittiset Pipsa/Ville-resurssit. `lib/kokoro-example.test.ts` vertaa pohjaa ja jaettavaa tiedostoa, determinismiä, tulkintavirheitä ja olemassa olevan Kokoron kieli-/äänisuunnitelmaa. `lib/tiimi-kokoro-workflow.test.ts` käyttää siniaaltoista testimoottoria; se ei todista sanojen synteesiä tai Rhubarb-analyysiä.

Diffissä ei löytynyt uutta kriittistä tai korkeaa regressiota. Käyttäjän lähdeassetteja tai äänitiedostoja ei muutettu. Valinnainen formaattikenttä, legacy-oletukset ja eksplisiittinen ulkoasun vaihto suojaavat vanhoja projekteja tässä rajauksessa; tämä ei ole kaikkien historiallisten projektitiedostojen täydellinen migraatiokoe.

## Todellinen tarkistusnäyttö

Itse ajettu: `git diff --check`, exit 0. En käynnistänyt rinnakkaista raskasta testisarjaa, typecheckiä tai Electron-ajoa.

Muiden asiantuntijoiden raportoidut paikalliset ajot: arkkitehti 16/16; 2D:n asset/liikeregressiot 12/12 ja liikekirjasto 6/6; 3D kohdennettu yhteisajo 23/23; AI 15/15; ääni 13/13; UX 3/3 viimeisimmässä rajatussa uusinnassa. Ne eivät ole minun itse ajamiani testejä. Lopullinen koko sarja on ensisijainen integraationäyttö.

Itse luettu `/private/tmp/hahmostudio-20261009-preview.log`: eristetty oikea Electron 44.5.1 / darwin, React cel→flat, disabled-kontrollit, mallilukituksen estotila sekä 600/1440 px näkymät läpäisevät, errors=[] ja vaakaylivuotoa ei havaittu. Tämä on komponentti- ja Canvas-fixture, ei paketoitu sovellus tai GPU/pilvi. Kuvien taiteellista hyväksyntää en tehnyt.

Koordinoijan typecheck-uusinta `/private/tmp/hahmostudio-20261009-typecheck-retry.log`: ilmoitettu exit 0, loki luettu ja siinä ei tyyppivirheitä. Koordinoija katsoi uuden `3d-vertailut.png`: suuren helmasahalaitan poistuminen todettu, pienet kulmakohtaiset artefaktit ja taiteellinen hyväksyntä avoimia; tämä on koordinoijan havainto, ei oma kuvahyväksyntäni.

Koko sarjan `/private/tmp/hahmostudio-20261009-qa.log` odottaa QA:n loppudiagnoosia/uusintaa: luetussa lopussa on warning-tiedostolista eikä hyväksyttävää läpäisysummarya. Aiemmat 1270/1270 ja vanhat kuvat eivät korvaa tämän diffin uusinta-ajoa. QA:n `08-qa.md` luettu; sen vanha PSD-kuvaus koskee ennen koordinoijan viimeistä tarkennusta tehtyä toteutusta ja tulee päivittää.

## Päätös

**PALAUTETTU integraation loppuvahvistukseen.** Rajattu tuotantodiffi on katselmoinnin perusteella hyväksyttävä, mutta työpaketin teknistä hyväksyntää ei vielä anneta ilman tämän diffin koko testisarjan lopputulosta. Typecheck ja eristetty Electron-fixture ovat läpäisseet. Palautuksen syy on puuttuva lopullinen testinäyttö, ei löytynyt toteutusbugi. Koordinoija täydentää tulokset ja ilmoittaa katselmoijalle; hyväksyntä sidotaan samaan diffiin.

GitHub-haarassa `codex/asiantuntijapromptit-2026-10-08` ovat toimeksiannon mukaan promptit ja englanninkielinen esimerkkiteksti. Tuotantokoodia ei ole julkaistu; en varmistanut etähaaraa verkkokutsulla eikä paikallinen origin ole GitHub vaan alkuperäinen paikallinen repo. Tämä raportti ei ole push- tai merge-hyväksyntä.

## EHDOTUS

Seuraava toimitusnäyttö on kahden repliikin oikea paikallinen Kokoro-pilotti, tallennus/avaus ja katsottu/kuunneltu MP4 sekä Pipsa/Ville 2D/toon3d-liikenäytteet. AI-vertailukuvan hyväksyntä sidotaan täsmälliseen hyväksyttyyn grafiikkaan vasta tämän jälkeen. Älä regeneroi assetteja pelkkien numeeristen testien perusteella.

## AVOIMET KYSYMYKSET

- Hahmotaiteen hyväksyntä, helman kuvallinen lopputulos kaikissa kulmissa ja ääriasentojen saumat/törmäykset.
- Oikea Kokoro-inferenssi, sanojen kuuntelu, huulisynkka ja vientimiksauksen laatu. Manifestin olemassaolo ja siniaalto eivät täytä tätä.
- Paketoidun sovelluksen käynnistys, käyttäjän koko työnkulku, oikea laitevienti ja VideoToolbox. Eristetty Electron-fixture ei täytä tätä.
- Oikea GPU/Drive/ilmainen tausta ja live-ledger. Simuloitu palvelu ja UI:n €0 eivät täytä tätä.
- Hyväksytyn vertailukuvan version sidonta muokattuun toon3d-profiiliin/rig-muutoksiin. Tämä on erillinen tietovirtaselvitys ennen laajaa AI-hyväksyntää.
- AI-modalissa olemassa oleva fokusrajaus/palautus puuttuu (`components/ai-panel.tsx:47–49`); ei tämän diffin regressio. Erillinen näppäimistö/VoiceOver-korjaus ja oikea GUI-testi tarvitaan.

Arvio loppunäytön tarkastuksen täydennykselle 0,1 henkilötyöpäivää, kun integraatioajot valmistuvat. Taiteellinen, audio-, pakkaus- ja pilvihyväksyntä ovat erillisiä työpaketteja; niitä ei merkitä valmiiksi teknisen katselmoinnin perusteella.


## Koordinoijan loppunäyttö 9.10.2026

QA toimitti lopullisen normaalia npm test -komentoa käyttäneen SHA-256-varmennetun tmp-ajon:1286/1286pass,fail/skip/todo0,exit0. Typecheck ja private-build sekä oikea Electron-fixture läpäisivät. Katselmoijan agentti osui käyttörajaan ennen riippumattoman päätöstekstin päivittämistä. Tämä lisäys on koordinoijan raportointia; edellä oleva riippumattoman katselmoijan päätöshistoria säilyy. Katso todennus/VARMENNUS-2026-10-09.md avoimille hyväksynnöille.
