# KOETA Macille: DMG, kehitys ja päivitykset

DMG on asennuslevy, jonka sisällä on KOETA.app. Lähdekoodiprojekti ja asennettu sovellus ovat eri asioita. DMG ei muuta kehitystapaa eikä sisällä automaattista päivityspalvelua.

## Asennus ja päivitys

1. Tallenna avoimet .hahmo-projektit ja .sarja-tiedostot ja sulje KOETA kokonaan (⌘Q).
2. Avaa uusi KOETA-…-arm64.dmg. Tämä paketti on Apple Siliconille (M-sarja). Intel-Mac tarvitsee x64-paketin ja sen arkkitehtuurin natiivit ajokomponentit.
3. Vedä KOETA.app asennuslevyn Applications-linkin päälle. Finder voi pyytää lupaa korvata vanha KOETA.app.
4. Käynnistä KOETA Ohjelmat-kansiosta ja poista asennuslevy käytöstä Finderissa.

Tavallinen käyttö ei tarvitse Nodea tai kehityspalvelinta. DMG-tiedostoa ei vedetä Ohjelmat-kansioon; sen sisältämä sovellus vedetään.

Omat .hahmo- ja .sarja-tiedostot ovat valitsemissasi sijainneissa. Sovelluksen asetukset, palautustiedot ja luvallisesti ladatut Kokoro-mallit ovat käyttäjäkohtaisessa tietokansiossa sovelluspaketin ulkopuolella. Korvaa vain KOETA.app. Säilytä tietokansio ja omat projektit; tee tärkeistä projekteista varmuuskopiot.

Paketti on paikallisesti ad hoc -allekirjoitettu. Se ei ole Apple Developer ID -allekirjoitettu eikä notarisoitu. Jos macOS estää avaamisen, noudata [Applen sovelluskohtaista avaamisohjetta](https://support.apple.com/102445). Koko koneen suojausasetuksia ei muuteta. DMG-muoto ei itsessään lisää Developer ID -allekirjoitusta tai notarisaatiota. Laajemman jakelun notarisaatio on erillinen työ: [Apple Developer](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution).

## Jatka kehitystä lähdekoodista

Avaa Codexille tai Claudelle `/Users/Aleksi/hahmostudio`. Lue ensin AGENTS.md ja TIIMI.md:n viimeinen kirjaus. Sopikaa sama työhaara tai erilliset työhaarat; älä anna molempien muuttaa samoja tiedostoja yhtä aikaa. DMG:tä tai Ohjelmat-kansion KOETA.app-pakettia ei muokata lähdekoodina.

Sulje asennettu KOETA ennen kehitysversion avaamista. Tarkista työhaara ja paikalliset muutokset ennen Git-päivitystä. Jos työ on puhtaassa main-haarassa:

```sh
cd /Users/Aleksi/hahmostudio
git status
git pull --ff-only origin main
npm run desktop:dev
```

Node >=22.13 ja npm tarvitaan vain kehitykseen. Asenna riippuvuudet `npm ci` -komennolla ensimmäisellä kerralla tai riippuvuuksien muuttuessa. Native-runtime- ja Rhubarb-tiedostot tarvitaan paikalliseen paketointiin; ne ovat .private-runtime-kansiossa, eivät Gitissä. Kokoron valinnainen runtime valmistellaan erikseen `npm run kokoro:prepare` -komennolla; mallien lataus vaatii sovelluksessa käyttäjän luvan.

React-käyttöliittymän muutokset päivittyvät Viten kehitystilassa. Electronin pääprosessin, preloadin tai paikallisen palvelun muutosten jälkeen sulje kehitysversio ja käynnistä desktop:dev uudelleen. Kehitystila ei päivitä Ohjelmat-kansion sovellusta.

## Tee uusi DMG muutosten jälkeen

Testaa ja tallenna muutokset Gitiin. Main- ja hahmostudio1.0-haaroihin yhdistetään sama testattu versio. Nosta package.json:n versionumeroa, kun nimeät uuden julkaisuversion. DMG:n nimessä on lisäksi sovellusarkiston tarkistussumman alku, jotta saman versionumeron eri buildit erottuvat.

```sh
npm run typecheck
npm test
npm run desktop:package:dmg
npm run desktop:test:package
# Tarkista myös DMG: npm run desktop:test:dmg -- release/KOETA-….dmg
npm run desktop:test:workflow -- --packaged
```

`desktop:package:dmg` rakentaa käyttöliittymän, paketoi KOETA.app:n ja tekee DMG:n. Tulos on `release/KOETA-<versio>-<arkkitehtuuri>-<build-tunniste>.dmg`. Samassa kansiossa ovat .sha256 ja .json tarkistussummineen sekä .app ja ZIP. Jos testattu .app on jo valmis, pelkkä `npm run desktop:dmg` tekee siitä DMG:n rakentamatta sovellusta uudelleen.

Mac-paketointi voi ladata Electronin ensimmäisellä kerralla. Jo olemassa olevaa Electron-välimuistia voi käyttää näin:

```sh
electron_config_cache="$HOME/Library/Caches/electron" npm run desktop:package:dmg
```

DMG ja muut release-tiedostot ovat Gitin ulkopuolisia build-tuotoksia. Niitä ei viedä lähdekoodin mukana GitHubiin. Säilytä tarvitsemasi julkaisut erillisessä toimituskansiossa.

Kun uusi DMG on valmis, päivitä asennettu KOETA yllä olevilla Finder-ohjeilla. Päivitys ei tapahdu Git-pullilla, Codexin koodimuutoksella tai DMG:n rakentamisella; uusi KOETA.app täytyy vielä kopioida paikalleen sovelluksen ollessa suljettuna.

## Nykyinen todennus ja avoimet työt

Paketoidun Mac-sovelluksen työvaiheet, repliikkitallentimen säilyminen vaiheenvaihdossa ja peruutus on testattu oikealla Electronilla ja generoidulla äänivirralla. Natiivit ajokomponentit on testattu paketista. Katso docs/tiimi/todennus/mac-workflow-20261010/ ja TIIMI.md.

Vielä tarvitaan fyysisen kameran ja mikrofonin kokeilu, tallenteen liittäminen repliikkiin ja palautus/kumoa, oikea Kokoro-ajo sekä huulisynkan ja MP4:n kuuntelu, VoiceOver, palikkaeditorin raahaus ja Alt-pudotus sekä hahmojen taiteellinen hyväksyntä. Oikea GPU/pilviajo on erillinen hyväksyntä. DMG ei poista näitä sovelluksen hyväksyntätarpeita.

Automaattisia päivityksiä ei ole lisätty. Manuaalinen DMG-päivitys on nykyinen toimintatapa; päivityspalvelu, allekirjoitus ja notarisaatio voidaan suunnitella erikseen, jos sovellusta myöhemmin jaetaan laajemmin.
