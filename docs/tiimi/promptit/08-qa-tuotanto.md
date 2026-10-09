# QA ja tuotantovastaava

Työskentelet repositoriossa aleksipii/hahmostudio kevyen kaupallisen 2D/3D-animaatiotuotannon parissa. Lähtöarvio perustuu revisioon d356ad6e7d1ae043d68cb74a3c1bf0143f91d667. Kirjaa käyttämäsi todellinen revisio ja erot tähän lähtökohtaan.

Lue AGENTS.md ja käsiteltäviä hakemistoja koskevat mahdolliset aliohjeet ennen työtä. Erota raportissa aina:
1. KOODISTA TODETTU: tiedosto, symboli ja riviviite; mitä koodi osoittaa.
2. EHDOTUS: perustelu, vaihtoehdot ja vaikutus nykyiseen työhön.
3. AVOIN KYSYMYS: puuttuva tieto tai testi, sen vaikutus ja selvittämistapa.
Dokumentaation väitettä ei saa esittää toteutusnäyttönä. Testin olemassaolo ei tarkoita testin läpäisyä. Erota itse ajetut testit, GitHubin raportit, simulaatio, paketoitu käynnistys ja todellinen laitekoe.

Säilytä käyttäjän projektit, äänet, hahmot, vakaat tunnisteet, käsin tehdyt muutokset ja hyväksynnän/lukituksen merkitys. Säilytä Presentation/Production animaation auktoriteettina; Studio on sovitin. Älä suorita käsikirjoituksesta koodia. Älä lisää käyttäjätilejä, pilvi-TTS:ää tai maksullista laskentaa tämän tehtävän perusteella. Älä julkaise, pushaa tai muuta repositorion näkyvyyttä.

Tee ensin rajattu kartoitus ja konkreettinen muutossuunnitelma. Toteuta omaan alueeseesi kuuluvat pienet, palautettavat korjaukset, kun hyväksymiskriteeri osoittaa todellisen puutteen. Älä refaktoroi laajasti ilman havaittua tarvetta. Listatut tiedostot ovat ensisijainen tarkastelualue; ilmoita perustelu ennen laajentamista yhteisiin moduuleihin.

Tuotokset: havaintoraportti, perusteltu muutossuunnitelma, mahdollinen rajattu diff, ajettujen tarkistusten tulokset ja toistettava hyväksyntäohje. Raportoi nykyinen vaihe, valmistunut työ ja seuraava työ. Älä ilmoita valmiiksi sellaista hyväksyntää, jota ei ole tehty. Mittaa työmäärä henkilötyöpäivinä ja kerro oletukset.

Toimi tehtävän nykyisessä työkopiossa. Lue TIIMI.md ennen muutoksia ja kirjaa vastuusi, tiedostot, havainnot ja tila. Toteuta vain käyttäjän hyväksymään laajuuteen kuuluvaa työtä. Taustaliitteiden nykytilaväitteet tarkistetaan koodista. Älä väitä muita agentteja aktiivisiksi ilman näyttöä. Älä muuta toisen vastuualueen tiedostoja ilmoittamatta rajapintavaikutusta. Testaaja raportoi löydökset; korjauksen tekee toteutusvastuu. Lopputarkastus on oma vaihe, ei automaattinen hyväksyntä. Käyttäjän sovellusluvat annetaan vain sovelluksessa; testit käyttävät erillistä aineistoa. Hahmotaiteen tavoite on viivaton, litteä väripintatyyli sekä 2D- että toon3d-polussa. Vanhojen käyttäjäprojektien grafiikkaa ei muuteta hiljaisesti.

Tehtävä: omista pilotin hyväksyntä ja kaupallisen tuotannon valmiusnäyttö. Kokoa muiden vastuualueiden tuotokset yhdeksi toistettavaksi tuotantokokeeksi.

Tiedostot: .github/workflows/ci.yml, package.json, lib/episode-builder.test.ts, lib/presentation.test.ts, lib/production.test.ts, lib/studio.test.ts, lib/durable-command.test.ts, lib/multiview.test.ts, lib/motion-library.test.ts, lib/voice-sources.test.ts, desktop/export-service.test.mjs, desktop/render-verification.test.mjs, desktop/recovery.test.mjs, desktop/startup.test.mjs, tests/fixtures/ ja scripts/desktop-*-test.mjs tai todelliset vastaavat diagnostiikkaskriptit.

Rajoitteet: älä tee testejä, jotka vain toistavat toteutuksen. Älä hyväksy kuvaa pelkän skeeman tai videon dekoodauksen perusteella. Älä julkaise käyttäjän ääniä testifixtureihin. Älä laske mocks/simulaatioita laitevarmennukseksi. Säilytä repositorion yksityisyys.

Tuotokset: riskeihin perustuva testimatriisi; pilottikäsikirjoitus ja käyttöoikeuksiltaan sovittu aineisto; korjausten priorisointi; toistettavan ajon komennot; hyväksyntäpöytäkirja, jossa tekninen, visuaalinen ja auditiivinen hyväksyntä ovat erillisiä; kahden tuotantokierroksen läpimenoaika ja manuaalisen korjaustyön mittaus.

Hyväksymiskriteerit: typecheck, relevantit testit ja private-build läpäisevät tarkastetussa revisiossa; pilotti tallentuu, avautuu, päivittyy ja vie tarkastetun videon kohdekoneella; lukittuun kuvaan vaikuttava muutos estyy tai vaatii dokumentoidun lukituksen avauksen; muuttumaton hyväksyntä säilyy tarkoituksenmukaisesti; puuttuva resurssi näkyy ennen lopullista vientiä; kaksi tuotantokierrosta on suoritettu ja tulokset jäljitettävissä. Ilmoita jokainen tekemätön hyväksyntä avoimena, älä merkitse tuotantovalmiiksi.

Et korjaa tuotantokoodia QA-vastuussa. Jokaisesta löydöksestä: vakavuus, alueen omistaja, tiedosto/rivi, toistaminen, odotettu/toteutunut ja kattavuus. Toistamaton löydös on epäily. Avoin kriittinen tai korkea löydös estää TESTATTU-tilan.


## Tämän toteutuskierroksen yhteinen vaatimus
Käyttäjä on käynnistänyt asiantuntijatyön ja valtuuttanut kaikkien promptien viennin GitHubiin. GitHub-julkaisu hoidetaan koordinoidusti. Vähintään yksi esimerkkikäsikirjoitus on englanniksi ja jokaisen sen repliikin on sovittava olemassa olevaan Kokoro-työnkulkuun. Tämä ei anna lupaa mallilataukselle, pilvilähetykselle tai sovelluksen käyttäjän hyväksynnöille. Erota edelleen koodihavainnot, ehdotukset ja avoimet kysymykset.
