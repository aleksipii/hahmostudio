# UX ja editorityönkulku

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

Tehtävä: tee pilottituotannon työnkulusta selkeä nykyisen editorin sisällä: käsikirjoitus → roolitus → ohjeiden korjaus → repliikkiäänet → esikatselu → tarkistus → vienti.

Tiedostot: components/editor.tsx, components/script-compose-editor.tsx, components/episode-panel.tsx, components/presentation-panel.tsx, components/studio-shot-board.tsx, components/production-board.tsx, components/production-validation-panel.tsx, components/voice-check.tsx, components/export-panel.tsx, lib/studio-flow-scope.ts, lib/studio-feature-map.ts, lib/studio/validation-navigation.ts sekä käytettyihin komponentteihin liittyvät styles/-tiedostot.

Rajoitteet: säilytä suomenkielinen UI ja nykyiset projektimuodot. Älä tee näennäisiä painikkeita puuttuville toiminnoille. Erota tekninen tarkistus, hyväksyntä ja renderöity tulos. Älä vaihda koko teemaa tai rakenna editoria uudelleen. Älä laajenna teknisiin ydintiedostoihin ilman perusteltua integraatiotarvetta.

Tuotokset: pilotin vaihekohtainen käyttäjäpolku; viisi vakavinta havaittua esteettä näyttöineen; pienet UI-korjaukset; selkeät virhe- ja tilatekstit; käsikirjoitus käyttäjätestille. Tuota konkreettinen testipaketti ennen mahdollista GUI-testiluvan tarvetta.

Hyväksymiskriteerit: käyttäjä löytää olennaisen tunnistamattoman ohjeen ja sen lähderivin; näkee puuttuvat äänet ja resurssit; pystyy muuttamaan pilotin yhtä kuvaa ja arvioimaan vaikutukset lukituksiin; näkee milloin työ on tallennettu ja milloin vienti on oikeasti valmis; pystyy viemään pilottijakson sovitun ohjeen avulla. Kirjaa käyttäjätestin todelliset havainnot ja puuttuvat testit.


## Tämän toteutuskierroksen yhteinen vaatimus
Käyttäjä on käynnistänyt asiantuntijatyön ja valtuuttanut kaikkien promptien viennin GitHubiin. GitHub-julkaisu hoidetaan koordinoidusti. Vähintään yksi esimerkkikäsikirjoitus on englanniksi ja jokaisen sen repliikin on sovittava olemassa olevaan Kokoro-työnkulkuun. Tämä ei anna lupaa mallilataukselle, pilvilähetykselle tai sovelluksen käyttäjän hyväksynnöille. Erota edelleen koodihavainnot, ehdotukset ja avoimet kysymykset.
