# Full-stack, Electron ja tuotantoinfrastruktuuri

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

Tehtävä: varmista pilotin tallennus, uudelleenavaus, palautuminen, renderin jäädytys ja turvallinen vienti paketoidussa sovelluksessa. Aloita nykyisestä paikallisesta arkkitehtuurista.

Tiedostot: lib/project-file.ts, lib/studio/durable-command.ts, lib/studio/render-contract.ts, lib/studio/recovery.ts, lib/studio/project-history.ts, desktop/delta-journal.mjs, desktop/project-chunks.mjs, desktop/recovery.mjs, desktop/export-service.mjs, desktop/export-queue.mjs, desktop/durable-export-queue.mjs, desktop/render-verification.mjs, desktop/encoder.mjs, desktop/main.mjs, desktop/preload.cjs, server/private-server.mjs ja scripts/package-mac.mjs.

Rajoitteet: säilytä Electronin sandbox ja context isolation, rajattu IPC ja projektit sovelluspaketin ulkopuolella. Älä lisää yhteiskäyttöpalvelua, tilejä, automaattipäivityksiä tai uutta pilvi-infraa. Älä sekoita SIGKILL-palautusta fyysisen sähkökatkon kestoon. Älä ylitä olemassa olevia vientirajoja hiljaisesti.

Tuotokset: tallennus/vientiketjun kaavio; nykyisten rajojen vertailu web/desktop; toistettava paketointi- ja palautusohje; todellisen kohdekoneen testiraportti tai avoin laitetestilista; rajatut korjaukset. Selvitä erityisesti AGENTS.md:n 60 s MP4-rajauksen ja desktopin preset-validaattorin enintään 1200 s arvojen ero: jäljitä koko kutsuketju ennen johtopäätöstä.

Hyväksymiskriteerit: pilotin projekti avautuu uudelleen samana sisältönä ja resursseina; virheellinen tallennuskuittaus ei julkaise muutosta; vienti käyttää jäädytettyä revisiota; keskeytys vapauttaa resurssit; onnistunut video dekoodautuu ja täyttää manifestin ruutumäärän, mitat, fps:n ja ääniraidan; epäonnistunut vienti ei korvaa aiempaa onnistunutta tiedostoa. Paketoitu käynnistys, oikea enkooderi ja palautus varmennetaan erikseen.


## Tämän toteutuskierroksen yhteinen vaatimus
Käyttäjä on käynnistänyt asiantuntijatyön ja valtuuttanut kaikkien promptien viennin GitHubiin. GitHub-julkaisu hoidetaan koordinoidusti. Vähintään yksi esimerkkikäsikirjoitus on englanniksi ja jokaisen sen repliikin on sovittava olemassa olevaan Kokoro-työnkulkuun. Tämä ei anna lupaa mallilataukselle, pilvilähetykselle tai sovelluksen käyttäjän hyväksynnöille. Erota edelleen koodihavainnot, ehdotukset ja avoimet kysymykset.
