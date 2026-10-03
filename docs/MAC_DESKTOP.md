# Hahmostudio Macille · 0.7.0

## Käyttöönotto

Avaa toimitettu `Hahmostudio-Mac-arm64.zip`. Siirrä sen Hahmostudio.app esimerkiksi Ohjelmat-kansioon ja avaa sovellus. Tämä paketti on Apple Siliconille (arm64), joka selvitettiin käytettävältä Macilta. Electron-paketin vähimmäisjärjestelmä on macOS 13. Tavallinen käyttö ei tarvitse Nodea, terminaalia tai erillistä palvelinta. Sovellus sisältää Electronin, käyttöliittymän, Oton, taustat, kasvomallin ja Rhubarbin. Intel-Mac tarvitsee oman x64-paketin ja x64-Rhubarbin.

Paketti allekirjoitetaan paikallisesti ad hoc -allekirjoituksella. Se ei ole Developer ID -allekirjoitettu eikä notarisoitu. Jos macOS estää avaamisen, käytä macOSin omaa sovelluskohtaista avaamismenettelyä; älä poista Gatekeeperia tai muuta koko koneen suojausasetuksia. Sovellusta ei julkaista ulkoiseen palveluun.

Työpöytäversio käyttää Macin käyttäjätiliä: se avautuu suoraan studioon. Se ei käytä, poista tai vaihda verkkoversion omistajatunnusta. Macin käyttäjätilille pääsy antaa myös pääsyn sovellukseen; lukitse Mac tarvittaessa.

## Projektit ja tallennus

- Avaa projekti: .hahmo, tai Tuo kuva / PSD: .psd / .png. PNG tuodaan yhtenä kuvatasona, ilman automaattista pilkkomista.
- Tallenna projekti / ⌘S: valitse sijainti ensimmäisellä kerralla. Sen jälkeen tallennus päivittää saman tiedoston.
- Tallenna nimellä / ⇧⌘S: tee uusi tiedosto ja jatka siihen tallentamista. Vanha tiedosto säilyy.
- Viimeksi avatut projektit löytyvät aloitusnäkymästä. Vientiin valitaan oma kohde järjestelmän tallennusikkunassa.
- Tallentamattomasta työstä kysytään suljettaessa. Peruutettu tai epäonnistunut tallennus ei sulje työtä. Tallenna muuttunut .sarja Jaksot / sarja -paneelista ennen sulkemista; projektin ⌘S ei tallenna sarjaa.

Selaimessa aiemmin tehty työ siirtyy tallentamalla .hahmo- tai .sarja-tiedosto ja avaamalla se työpöytäversiossa. Selainistunto, kirjautuminen ja asetukset eivät siirry automaattisesti. Vanhat v1-projektit avautuvat edelleen, v2 avautuu myös; dialogikohtaukset käyttävät uutta v3-muotoa.

Projektit ovat valitsemissasi paikoissa. Teema ja viimeksi avattujen tiedostojen viitteet ovat Electronin käyttäjäkohtaisessa `userData`-kansiossa, tavallisesti `~/Library/Application Support/hahmostudio/`. Sovelluspakettiin ei tallenneta projektidataa. Paketin korvaaminen ei poista asetuksia tai projekteja. Poistettua tai siirrettyä viimeksi avattua tiedostoa ei voi avata ennen kuin valitset sen uudelleen.

## Kamera ja mikrofoni

Käynnistä kamera tai mikrofoni Esitys-työtilan ohjaimista. Lupa pyydetään vasta toiminnon käynnistyessä. Käyttökuvaukset sisältyvät Mac-pakettiin. Sulje kamera kameran pysäytyspainikkeella ja mikrofoni mikrofonin pysäytyspainikkeella. Näppäinohjaus, mikrofoni ja kamera pysyvät erillisinä lähteinä; työtilan vaihto ei sammuta niitä.

Jos lupa puuttuu, tarkista Järjestelmäasetukset → Tietosuoja ja suojaus → Kamera / Mikrofoni. Sovellus ei voi myöntää lupaa puolestasi. Sulkeminen tuhoaa käyttöliittymän ja sulkee paikallisen puhepalvelun; keskeneräinen tunnistus keskeytetään.

Äänen äännetunnistus tehdään paikallisella Rhubarbilla: suomi käyttää phonetic-tunnistinta, englanti pocketSphinx-tunnistinta. Se ei ole puheen tekstiksi litterointi. Live-mikrofonin suun avaus perustuu äänen voimakkuuteen. Kamera- ja ääniaineistoa ei lähetetä pilveen.

## Kehityskomennot

Avaa projektin lähdekoodikansio Codexille. Kehittäjä tarvitsee Node >=22.13 ja npm:n:

```sh
npm ci
npm test
npm run typecheck
npm run desktop:dev
npm run desktop:build
npm run desktop:package:mac
npm run desktop:test:package
```

`desktop:dev` avaa Electronin ja paikallisen Vite-kehitystilan portissa 5179; sulkeminen lopettaa molemmat. `desktop:build` tekee erillisen dist-desktop-kansion. `desktop:package:mac` rakentaa ensin ja paketoi `release/Hahmostudio-darwin-arm64/Hahmostudio.app` sekä `release/Hahmostudio-Mac-arm64.zip` (arkkitehtuuri vaihtuu koneen mukaan). Paketointi tarvitsee paikallisen arkkitehtuurin Rhubarbin `.private-runtime/rhubarb/`-kansiossa ja sen res-/lisenssitiedostot. Electron ladataan ensimmäisen buildin aikana; valmis sovellus toimii offline. Kasvomalli on mukana lähdekoodissa ja tarkistetaan SHA-256:lla; vain puuttuva malli ladataan buildissa.

Verkkokomennot säilyvät: `npm run dev`, `npm run build:private`, `npm run start:private`. Työpöytäbuild ei korvaa webin dist-kansiota. Kehitys ja paketointi voivat tarvita internetiä riippuvuuksien lataamiseen, tavallinen käyttö ei.

## Päivittäminen ja Codex

Lähdekoodin muuttaminen ei päivitä asennettua .app-sovellusta. Testaa lähdekoodi, paketoi uudelleen, sulje vanha sovellus ja korvaa vain .app. Säilytä projektit ja käyttäjäkohtainen asetuskansio. Automaattista päivityspalvelua ei ole.

Paikallinen Codex: avaa sama lähdekoodikansio, pyydä muutos, aja kooditestit ja desktop:dev, ja paketoi uusi versio Macilla. Laitetestit tehdään erikseen omalla Macilla.

Codex Cloud: käytä halutessasi yksityistä Git-repositoriota, tee muutokset ja tarkista/yhdistä ne, päivitä lähdekoodi Macille ja paketoi paikallisesti. Cloud ei varmista Macin fyysisiä laitteita eikä Mac-paketointia. Tämä työ ei luo repositoriota eikä julkaise sitä.

## Varmennuksen rajat

Kooditestit kattavat vanhat projektimuodot, tasot, nivelet, animaation, äänen, ohjauslähteiden yhdistämisen, mikrofonin simuloidun elinkaaren, IPC:n rajauksen, tiedostojen atomisen tallennuksen ja sulkemispäätökset. Paketista tehdään lisäksi piilotettu käynnistystesti erillisellä testiasetuskansiolla, jos suoritusympäristö sallii GUI-käynnistyksen. Tässä ympäristössä se estyi macOSin sovellusrekisteröinnissä. `npm run desktop:test:package` tarkistaa paketin mukana tulevalla runtimella resurssit ja Rhubarbin ilman GUI:ta tai laitteita. Katso toteutunut testitulos toimituksen TEST_RESULTS.md-tiedostosta.

Fyysistä kameraa ja mikrofonia, aitoa puhetta, Macin lupadialogeja, oikeaa Safaria, ulkoasua pienellä näytöllä tai kaikkia natiiveja tiedostoikkunoita ei ole tämän toimituksen yhteydessä käsin testattu käyttäjän kooditestausrajauksen vuoksi. Simulaatio ei todista niiden toimivuutta.

### Jos vanha 0.2.0 ei vastaa
Sulje vanha Hahmostudio tarvittaessa Apple-valikon Pakota lopettamaan -toiminnolla. Käytä korjattua versiota 0.2.1. Käynnistyksen vaihe näkyy asetuskansion startup-status.json-tiedostossa. Korjaus ei muuta projektimuotoa tai poista käyttäjän asetuksia.


0.3.0 lisää alkuperäisen kirjaston ja käsikirjoituksen. Tallenna projekti ja sarja, sulje vanha sovellus ⌘Q ja avaa ZIP:stä purettu uusi sovellus. Käynnissä oleva .app ei päivity lähdekoodia muuttamalla. Projektien tiedostoja ja selaimen omistajatunnusta ei muuteta.


0.4.0: valitse yläreunasta Hahmot ja esineet → Hahmot → Aino tai Otto · eri kuvakulmat. Liike-riviltä valitaan kävely tai juoksu ja suunta. Esineet-välilehdeltä valitaan puhelimen kuvakulma ja kiinnitys. Kuvausympäristöt-välilehdeltä löytyvät autotaustat ja studio. Näkymä-valikko näyttää ja piilottaa paneeleja; paneelin piilottaminen ei sammuta kameraa tai mikrofonia. Kolme piirrettyä hahmon kuvakulmaa ovat edestä, vasen profiili ja oikea profiili; kyse on 2D-animaatiosta.


0.5.0: Tiedosto/Muokkaa/Näytä/Ohje löytyvät sekä sovelluksen että Macin valikkoriviltä. Näytä → Keskity näyttämöön, Sovita koko näyttämö ja Palauta paneelien koot selkeyttävät työtilaa. Vedä sivupaneelien sisäreunoja ja aikajanan yläreunaa; Tab + nuolinäppäimet ovat vaihtoehto. Hahmot ja esineet → Hahmot → Roni/Salla tuo uuden oman paperileikkaushahmon kolmesta kuvakulmasta. Sulje vanha .app ja korvaa 0.5.0-paketilla.

## Päivittäminen 0.6.0:aan

Tallenna työ .hahmo-tiedostoksi ja sulje vanha Hahmostudio kokonaan (⌘Q). Pura Hahmostudio-Mac-0.6.0-arm64.zip. Korvaa aiemmin Lataukset- tai Ohjelmat-kansioon siirtämäsi Hahmostudio.app uudella ja avaa se. Lähdekoodin päivitys ei päivitä asennettua .app-tiedostoa automaattisesti. Omat projektit ja käyttäjäasetukset säilyvät. Ohje → Tietoja näyttää version.

Uusi dialogityökalu löytyy Käsikirjoitus → Dialogi ja leikkaukset. Valitse esimerkki, tarkista Roni/Salla ja lisää omat repliikkiäänet. Katso DIALOGUE.md ja sovelluksen käyttöohje.

## 0.7.0

Yleinen jaksotyökalu löytyy Käsikirjoitus → Dialogi ja leikkaukset. Ohjaussuunnitelma näyttää vaatimukset ja arviot. Valitse itse puhujien hahmot, tuo äänet ja tarkista tulkinta. KILSAT ja Aamu autossa ovat esimerkkejä. Päivitä sulkemalla sovellus (⌘Q), purkamalla Hahmostudio-Mac-0.7.0-arm64.zip ja korvaamalla vanha .app. Omat projektit säilyvät; asennettu sovellus ei päivity automaattisesti.
