# Tekoälyasiantuntijan rajattu suunnitelma

## Koodista todettu

- Desktop-pilvisilta on olemassa: `desktop/cloud-controller.mjs`, `lib/cloud-desktop.ts`. Oletus on pois, käyttöönotto ja lähetys vahvistetaan natiivissa dialogissa. Ohjain kirjoittaa checkpointin ennen renderipyyntöä.
- `lib/character-sources.ts` laskee kirjastopaketin SHA-256:n ja lukee tuodun hahmon tunnisteen. `components/cloud-render-dialog.tsx` kuljettaa sen kanoniseen tilaan ja vertailukuvan hyväksyntään. `lib/cloud-render/api.ts` hylkää eri lähdehashin; `pipeline.ts` tarkistaa sen uudelleen referenssien resolvoinnissa. `references.test.ts` sisältää lähdemuutoksen estotestin. Testitulokset kirjataan erikseen ajon jälkeen.
- `REFERENCE_READY_PACKS` on tyhjä: kirjaston kuvia ei ehdoteta automaattisesti ennen hahmotaiteen hyväksyntää.
- `lib/platform.ts` palauttaa `modelPins`-tilan, ja paneelin asetukset näyttävät lukituksen puuttumisen. `lib/ai-status.ts` ei käytä tätä tietoa: ilmaisen taustan vahvistaminen riittää näyttämään kustannusrivin €0,00, vaikka renderi on lukitsemattoman mallin takia estetty.

## Ehdotus ja rajattu diff

Lisätään `AiCloudState`-tyyppiin `modelPins:boolean`. Kustannusrivi pysyy estettynä, jos mallilukitus puuttuu; lisätään samalla selvä eston syy. Paneeli käyttää edelleen todellista pääprosessin tilaa eikä anna lupaa, hyväksy hahmoa tai kutsu palvelua. Testi vertailee samoja vahvistetun ilmaisen taustan tiloja puuttuvalla ja tuodulla lukituksella. Tiedostot: `lib/ai-status.ts`, `lib/ai-status.test.ts`.

## Tietovirta ja rajat

Pääprosessin metatieto → rendererin `CloudStatus` → puhdas `aiStatusRows` → paneelin teksti. Salaisuuksien arvoja ei tarvita. Muutos ei muuta IPC:tä, sääntömoottoria, kanonista tilaa, hahmopaketteja eikä renderöinnin auktorisointia. Zero-cost-politiikka säilyy. Ei pilvikutsuja, mallilatauksia tai käyttäjän puolesta annettuja lupia.

## Testit ja avoimet kysymykset

Ajetaan AI-tilan, desktop-kuljetuksen, lähdehashin ja referenssien paikalliset Node-testit. Oikea GPU, Drive, pakattu Mac ja Keychain jäävät avoimiksi. Paketin hash ei yksin todista 3D-profiilin kaikkien muokkausten sidontaa; 3D-tyylin/profiilin sekä myöhemmin muokattujen rigien kattavuus tarvitsee arkkitehdin kanssa erillisen päätöksen. Tämä havainto ei oikeuta yhteisen hash-mallin muuttamista tässä työpaketissa.

Arvio: 0,25 henkilötyöpäivää rajatulle korjaukselle ja raportoinnille; ei palvelukuluja.
