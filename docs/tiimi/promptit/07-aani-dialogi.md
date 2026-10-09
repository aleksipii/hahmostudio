# Ääni, dialogi ja huulisynkka

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

Tehtävä: toteuta ja varmista pilotin suomenkielinen dialogi käyttäjän omilla tai tuomilla repliikkiäänillä sekä tarkasta ajoitus, huulisynkka ja miksaus. Älä oleta suomenkielistä Kokoro-tukea.

Tiedostot: lib/voice-sources.ts, lib/kokoro.ts, lib/presentation-audio.ts, lib/presentation-timing.ts, lib/phonetic-speech.ts, lib/speech-animation.ts, lib/soundtrack.ts, lib/shot-audio-envelope.ts, components/dialogue-recorder.tsx, components/voice-check.tsx, desktop/kokoro.mjs ja server/speech-recognizer.mjs sekä löytyvä Rhubarb-kutsuketju.

Rajoitteet: käyttäjän äänet pysyvät paikallisina. Älä korvaa omia tallenteita synteesillä tai nopeuta repliikkejä toimitusikkunan vuoksi. Erota äänenvoimakkuuteen perustuva suu, Rhubarb-visemit ja litterointi. Säilytä repliikkitunnisteet; äänen vaihto, ajoitus, resurssit ja hyväksynnän vanhentuminen ovat yksi eheä muutos.

Tuotokset: repliikkikohtainen äänilista ja lähteet; huulisynkan tarkistusraportti; miksausohje; äänenvaihdon regressioesimerkki; lopullinen kuunteluraportti. QA:n kanssa ehdota ja lukitse ennen testiä mitattava synkkatoleranssi (lähtöehdotus enintään 2 vientiruutua 30 fps:ssa); tämä ei ole koodista todettu vaatimus.

Hyväksymiskriteerit: jokaisella pilotin repliikillä on oikea äänisidonta ja puhuttu sisältö tarkastettuna; äänenvaihto ei jätä vanhaa suun ajoitusta; alkuperäisen äänen palautus käyttää täsmäävää hashia; oma ääni säilyy synteesiyrityksessä; vienti ei leikkaa repliikkien alkuja/loppuja; kuuntelussa ei ole leikkausta tai peittyvää dialogia. Todellisen vientivideon synkka täyttää etukäteen sovitun toleranssin.


## Tämän toteutuskierroksen yhteinen vaatimus
Käyttäjä on käynnistänyt asiantuntijatyön ja valtuuttanut kaikkien promptien viennin GitHubiin. GitHub-julkaisu hoidetaan koordinoidusti. Vähintään yksi esimerkkikäsikirjoitus on englanniksi ja jokaisen sen repliikin on sovittava olemassa olevaan Kokoro-työnkulkuun. Tämä ei anna lupaa mallilataukselle, pilvilähetykselle tai sovelluksen käyttäjän hyväksynnöille. Erota edelleen koodihavainnot, ehdotukset ja avoimet kysymykset.
