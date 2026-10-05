# KILSAT Studio 0.36 — käsikirjoitussivu ja omat hahmot

## Kehitysvaihe
Käsikirjoitustyönkulun korjaus, kaksikielinen sääntöpohja ja toimiva uusi Kokeile-esimerkki.

## Muutokset
- Käsikirjoitus avautuu omana leveänä sivunaan yläpalkista ja kirjastosta. Sama olemassa oleva PresentationPanel siirretään PanelDockilla, joten teksti, hahmovalinnat ja äänet eivät katoa sivun vaihdossa. Takaisin editoriin säilyttää projektin ja laitteet.
- Korjattu tyhjän projektin ensimmäisen tallennuksen komponentin uudelleenkäynnistys: paneelin key riippuu projektin vaihtumisesta, ei dokumentin nimestä. Ensimmäinen tekstin tallennus loi aiemmin Tuotanto-dokumentin ja vaihtoi paneelin tunnisteen.
- Suomen rinnalla tiukka englannin kielioppi: Character, Scene, Background, Camera/Cut, walks/runs + left/right/forward, waves/nods/jumps/crouches, says, expression, looks at, phone, Wait, Meanwhile/Simultaneously. Sama kohtausmalli ja alkuperäinen rivijälki. Tuntemattomat komennot estävät rakentamisen; vapaa englanninkielinen proosa ei ole yleinen luonnollisen kielen ymmärtäjä.
- Generoitavia liikelauseryhmiä 2 457 600 (64 hahmonimeä × 16 verbimuotoa × 6 suuntaa × 50 kestoa × 8 aikayksikköä). Tämä on kieliopin yhdistelmämäärä, ei väite luonnollisten käsikirjoitusten täydellisestä kattavuudesta.
- Käyttäjän PSD:istä lisätty Kille-Oma ja Handu-Oma. Molemmissa oli jalat. Handun etunäkymän vartalo/pää oli piilotettu. Käyttöpaketeissa on eksplisiittiset olkapää-, pää-, polvi- ja jalkateräkiinnitykset sekä suun kytkinasennot. Killelle pidemmät housuosat/kengät. Suljettu silmä peittää silmämunan, eikä ole vain läpinäkyvä viiva.
- Uudet PSD-kopiot sisältävät alkuperäiset tasot piilotettuina sekä erillisen animoitavan etunäkymän. Alkuperäisiä Desktop/Photoshop-tiedostoja ei muutettu. Handun alkuperäinen sivunäkymä säilyy PSD:ssä, mutta uusi .hahmo-paketti käyttää etunäkymää; sivuprofiilia ei väitetä valmiiksi.
- Kokeile rakentaa kahden oman hahmon esityksen olemassa olevalla compiler/append/render-polulla. Vanha Aino-esimerkki ei enää korvaa uutta esimerkkiä. Esimerkki on 9 sekunnin muokattava liike-esitys ilman repliikkejä tai puheääntä. Käyttäjä voi lisätä käsikirjoitukseen puheet ja tuoda/äänittää niiden oikeat äänet.

## Tarkistukset ja rajat
Uudet testit vertaavat englannin/suomen komentoja, alkuperäisiä lähderivejä, samanaikaista ajoitusta, pronomineja, tuntemattomia rivejä, kaikkia ohjepohjia ja koko generoitavan kieliopin lukumäärää. Kokeile-esimerkki testataan todellisista hahmopaketista: molempien hahmojen animaatioraidat, liitokset, diagnostiikka ja .hahmo-tallennus/avaus.

918 kooditestiä läpäisi; toimituksessa tarkistetaan myös lopullinen build ja paketin runtime. Lähtötilanteen ensimmäinen testi ilman verkkolupaa: loopback-palvelintesti estyi EPERM-virheeseen. Lupien jälkeen olemassa olevat testit toimivat.

Graafista Mac-käynnistystä, todellista hiiren käyttöä, kameraa tai mikrofonia ei ole tämän version yhteydessä kokeiltu. Paketoinnin/runtimen tarkistus erotetaan tästä. Ei uusia kirjastoja. Vanhoja hahmoja, tallennusmuotoja, projekteja tai renderöintimoottoria ei poistettu.

Toimitusvarmennus: 918/918 testiä, TypeScript, Mac-build ja paketoidun Electronin runtime-smoke läpäisivät. Runtime varmisti journalin, atomisen historiatuonnin, palautuksen, revisionsäilön, vientijonon ja paikallisen Rhubarbin. Tämä oli Electronin Node-tilan tarkistus, ei graafinen käynnistys.
