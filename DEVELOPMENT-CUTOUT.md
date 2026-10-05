> Historiallinen ensimmäinen toteutusvaihe. Nykyinen editorikytkentä, SVG-renderöijä, uudet hahmopaketit ja esimerkkivideo on kuvattu [0.12-muutosmuistiossa](DEVELOPMENT-0.12.md).

# KILSAT Studio: sääntöpohjainen kartonkianimaatio ja toimitetut äänet

Lisäävä kehitysvaihe 2026-10-04. Nykyistä editoria, tallennusmuotoja, hahmoja tai renderöintiä ei korvattu.

## Äänellinen KILSAT-esimerkki

`create-voiced-kilsat.ts` tuottaa nykyiseen editoriin avattavan .hahmo-projektin paikallisesta, käyttäjän toimittamasta ääniluettelosta. Little Dude II on Kille ja Ziggy Mr.Handu. Uudessa esimerkissä on 16 repliikkiä, 1080×1920 näyttämö ja 25,914 sekunnin todellinen puhekesto. Nykyiset Roni-Studio ja Salla-Studio toimivat hahmopohjina. Kaikki 16 paikallista WAV-ääntä pakataan projektiin; alkuperäisiä MP3-tiedostoja ei muuteta eikä ladattu GitHubiin.

Käyttäjä hyväksyi keskustelun mukauttamisen repliikkien mukaan, koska tiedostot eivät olleet keskustelujärjestyksessä. Järjestys perustuu repliikkien sisältöön. Whisperin paikallinen litterointi on tarkistettava: esimerkiksi ensimmäisen repliikin “mileage lock” saattaa olla “mileage log”. Tekstiä ei korjattu kuulematta. Puheääniä ei syntetisoitu, leikattu eikä nopeutettu.

Suu liikkuu tässä projektissa paikallisesti lasketun RMS-voimakkuuden perusteella. Se ei ole foneemien tunnistus. Projekti käyttää nykyistä kolmen suun esitysmoottoria. Projektin tallennus ja uudelleenavaus tarkistettiin koodissa: 16 repliikkiääntä säilyi, koostaminen ei palauttanut diagnostiikkavirheitä. Tämä ei vahvista graafista esikatselua tai MP4-vientiä.

## Kuuden moduulin ensimmäinen toteutus

Uusi erillinen `lib/cutout` ei vielä ole editorin käytössä eikä korvaa nykyisiä moottoreita:

1. `parser.ts`: eksplisiittiset SCENE/ACTION/EMOTION/CAMERA/HOLD-komennot, puhujat, repliikit ja yhdistetyt komentolistat. Tuntematon komento tai puuttuva hahmo estää koostamisen. Kestot annetaan mitatusta äänestä tai käyttäjän hyväksymistä arvoista; tekstin pituudesta ei arvata ajoitusta.
2. `lip-sync.ts`: validoidut Rhubarb A–H/X -ajoitukset → pyydetty yhdeksän suun kartta, 24 fps, välittömät kytkinvaihdot. Pyydetty A→REST poikkeaa nykyisen Rhubarb-ohjauksen A=huulet kiinni -tulkinnasta. MBP on hahmopohjissa, mutta annetun kartan mikään Rhubarb-arvo ei valitse sitä. Nykyinen huulisynkronointi säilyy.
3. `hierarchy.ts`: dokumenttitilan nivelpisteet, vanhempien matriisien koostaminen, kerrosjärjestys ja kytkintilat. Luuston tunnisteet, kiertävät suhteet ja nivelpisteet validoidaan.
4. `motion.ts`: twos/threes/kolme–kaksi-pidot, tunnisteesta johdetut toistettavat kahden ruudun räpäytykset, kävely/juoksu, vilkutus ja puheen pään mikroliike. Ei satunnaislukuja. Tämä on tyylitelty liikepohja, ei valmis anatominen kävelyanimaatio tai automaattinen jalkojen kiinnitys.
5. `camera.ts`: ortografiset WIDE_SHOT/MEDIUM_TWO_SHOT/CLOSE_UP-matriisit ja kartonkivarjon parametrit. Taustojen visuaalinen koostaminen ei vielä kuulu moduuliin.
6. `renderer.ts`: kahden tai useamman hahmon ruututila, kerrosmatriisit ja kytkinläpinäkyvyydet, koko tapahtuma-akselin ruutu-JSON-vienti. Kävelyn päätepiste säilyy myös eleen jälkeen. Tämä tuottaa tilatiedon; se ei vielä piirrä SVG:tä/Canvasia eikä ole turvallinen tuntemattoman JSON-tiedoston tuontirajapinta.

## Vektoripohjat

`public/library/cutout/Kille.svg` ja `Mr.Handu.svg` ovat koodilla tuotettuja alkuperäisiä etunäkymäpohjia. Mukana ovat .rig.json-tiedostot, normalisoidut nivelpisteet, vanhempisuhteet, yhdeksän suuta, neljä silmätilaa ja kolme käsitilaa. Hahmon 550 px korkeus / 220 px pää = 2,5 pään korkeutta. Ääriviiva 3 px ja varjo 1/2/1,5/0,25. Ei tekoälykuvia eikä olemassa olevia South Park -hahmoja.

Nämä SVG-pohjat eivät vielä ole .hahmo-kirjastovalintoja. Sivukulmat, kävelykulmakohtainen grafiikka, SVG:n rasterointi editorin kerroksiksi, PSD-versiot ja kuuden moduulin käyttöliittymäkytkentä ovat keskeneräisiä. Äänellinen esimerkki käyttää yhteensopivia nykyisiä hahmoja. Puuttuvia ominaisuuksia ei merkitty valmiiksi käyttöliittymässä.

## Tarkistukset

168 kooditestiä läpäisi, mukaan lukien kuusi uutta testiä: parseri, mitattu ajoitus ja kahden hahmon determinismi, vanhemman nivelmuunnos, ruutupito/räpäytys, kävelyn jatkuvuus ja suu-/kytkintilat. TypeScript-tarkistus läpäisi. Graafista käynnistystä, fyysisiä laitteita, uutta Mac-paketointia tai äänellisen esimerkin vientiä ei tässä vaiheessa vahvistettu. Aiempi 0.11 Mac-ZIP säilytetään; lähdekoodin lisäys ei päivitä sitä automaattisesti.
