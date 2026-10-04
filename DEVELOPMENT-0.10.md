# Hahmostudio 0.10 · käsikirjoituksen ohjauspöytä ja 3D-toon

## Toteutettu yhteinen polku

Nykyinen React/TypeScript-editori ja Electron-sovellus säilyvät. Esitys-työtilan ohjauspöytä käyttää samaa validoitua Presentation-mallia kuin aikajana, PSD-rig-adapteri, esikatselu ja vienti. Alkuperäinen käsikirjoitus, repliikit ja vanhat tasot säilyvät. Uusi .hahmo-v5 lukee edelleen versiot 1–4; 0.9 ei lue v5:tä. Tallenna päivitys uudella nimellä.

Teksti tuodaan .txt/.md-tiedostona tai liitetään kenttään. Käsittely tapahtuu keskeytettävässä Workerissa; vanha ajo ei voi korvata uutta. Sääntöparseri tunnistaa nimettyjen hahmojen repliikit, myös `Aino sanoo “...”` / `Oskar replies “...”`, kohtausotsikot, laajan/puoli-/lähikuvan, sivu/viisto/takanäkymän, ylä/alakulman, zoomauksen, panoroinnin, tauot ja nykyiset liikkeet. Yhdistä puhuja paikalliseen .hahmo-hahmoon ja liitä repliikkiääni. Suun auki/kiinni-tila perustuu todelliseen ääneen; Rhubarb sovittaa äänteet kolmeen suumuotoon. Arvioitu puhekesto ei ole huulisynkronointia.

Ohjauspöydän tekstivalinta, kuvakortit, reaktiot ja toistopää on synkronoitu. Kortin kuva renderöidään projektin todellisista asseteista. Kameran rajaus ja katsekohde ovat muokattavissa myös esikatselua napauttamalla. Kuvakortin siirto kuljettaa sen tapahtumaryhmää ja hylkää rikkoutuvan riippuvuuden, kohtausrajan ylityksen tai absoluuttisesti lukitun ajan muutoksen. Hiljainen lisäodotus ei venytä ääntä. Kumoa/tee uudelleen kattaa ohjausmuutokset ja käsikirjoituksen uudelleenrakennuksen; alkuperäiset audioblobit pysyvät paikallisessa resurssivarastossa.

ScriptRevision + tekstialue yhdistää tapahtuman alkuperäiseen kohtaan. Päivitys kohdistaa järjestyksen ja sisällön ankkurit, säilyttää olemassa olevan identiteetin sekä ohitukset ja raportoi poistuvan lukituksen. Muuttuneen repliikin vanha ääni poistetaan linkistä, muuttumaton ääni säilyy. Uudet tapahtumat saavat UUID:n; ensimmäisen deterministisen parseriajon legacy-tunniste on vain lähtöidentiteetti, sitä ei lasketa uudelleen säilytetylle tapahtumalle. Erikseen lisätty käyttäjän odotus säilyy uudelleenrakennuksessa. Lukitukset: sisältö, kesto, absoluuttinen alku ja suhteellinen rytmi. Suhteellinen 0,7 s reaktio siirtyy aiemman puheen mukana; mahdoton absoluuttinen alku ilmoitetaan ristiriitana.

Sarjan nimi, ohjausmuistiot, kamera paikallaan -sääntö sekä tallennetut kameravaihtoehdot säilyvät projektissa. Vaihtoehdosta hyväksytään yksittäinen kuva ilman dialogin korvaamista. Tunnettu arkikielinen käsky pidentää taukoa tai pysäyttää kameran; muu käsky ei muuta projektia. Muistioteksti ei automaattisesti tulkitse luonnetta uudelleen.

## Roni ja Salla · oikea tilavuusgeometria

`lib/toon3d.ts` tuottaa suljetuista ellipsoideista/loft-pinnoista kolmiulotteisen mallin, hierarkkisen luurangon ja jatkuvat nivelpainot. Se ei ole kuva tasolla tai pursotettu PSD-levy. Alkuperäiset Roni-/Salla-Studio-PSD:t ja 2D/2.5D-polut säilyvät. `public/library/roni-toon.json` ja `salla-toon.json` sisältävät mallin, materiaalit, luurangon, painot, suumuodot ja otteet. Assetti 1.0.0 on merkitty **review**, ei taiteellisesti lopulliseksi.

Valitse Hahmot · 2D / 3D -näkymästä esitystapa. Kanoninen profiili, versio ja ihon/hiusten/paidan/housujen/kenkien värit tallentuvat puhujaa kohden. Kaikki kamerakulmat käyttävät samoja materiaalimäärityksiä ja geometriaa. Housuissa on yhteinen vyötärö ja nivelpainotetut lahkeet; peitettyä kokonaista kehoverkkoa ei piirretä vaatteiden alle. Silmien sulkeutuminen, pupillit, kulmat, pää, puheen suumuodot ja nykyiset raajatrackit muunnetaan samaan 3D-rigiin. Mallin anatominen vasen käsi vastaa PSD:n vasenta kättä, joka on etukuvassa katsojan oikealla.

Renderöinti on Canvasin CPU-kolmiorenderöinti: ortografinen kamera, kaksi hillittyä väripintaa ja siluettireunat. Kameralla saa etu/sivu/viisto/taka/ylä/alakulman. Tämä ei ole GPU-renderöintiä. Syvyys käyttää kolmioiden järjestystä, ei täyttä z-bufferia; vaativat läpäisevät poset tarvitsevat lisätyötä. Vapaata mallin topologian/tekstuurien editointia, vaatteen fysiikkaa tai mielivaltaista 3D-assetin tuontia ei ole. Profiilien värit ja olemassa olevat rig/keyframe-ohjaukset ovat muokattavia.

Puhelin käyttää kolmiulotteista runkoa, näyttöä, molempien käsien grippejä ja sormipintoja. IK-klipit: pitäminen, katse, napautus, näyttäminen toiselle/kameralle, korva, pöytä ja käden vaihto. Pöydälle laskeminen vaatii näkyvän kirjastopöydän käden ulottuvilla. Omistaja ja käsi toistetaan aikajanalta; irrotuksen hetken pose jää maailmaan ja leikkaus ei nollaa sitä. Vaihdon molemmat kädet kohtaavat samassa pisteessä. Käsien liike ei korvaa suun raitoja. Puhelimen näytön vapaa teksti-/videotoimitus ja monimutkainen sormien artikulaatio eivät vielä kuulu tähän versioon.

## Kirjasto

32 erillistä paikallista vektoritaustaa (10 aiempaa + 22 uutta) ja 20 erillistä vektoriesinettä. Uudet studio-, toimisto-, koti-, kahvila-, luokka-, kirjasto-, palvelu-, katu-, aukio-, pysäkki-, puisto-, metsä-, ranta-, parkki-, autotalli- ja esittelymiljööt eivät ole saman kuvan väriversioita. SVG:t on paketoitu `public/library`-kansioon, geometria on yhteinen esikatselulle ja viennille. Hakeminen, valinta, esineen paikka/koko ja näkyvyyden aikaväli ovat ohjauspöydässä. Esineiden määrä/sijainti ei muutu kameraleikkauksessa. Valkoisessa KILSAT-studiossa ei ole ylimääräistä rekvisiittaa.

Kaikki tämän kirjaston ympäristöt ja yleisesineet ovat **2D**, eivät vapaasti kierrettäviä 3D-miljöitä. Ympäristörekisterissä ovat luokka, mittakaava, etukamerasuositus, valaistuksen oletus ja sijoittelualue. Vinossa kamerassa tausta ei kierry hahmojen kanssa; tämä kerrotaan tarkistuksessa. Omien ympäristöjen käyttö toimii nykyisen kuvan/PSD:n tuonnin kautta; ohjauspöydän erillistä ympäristöpakettien tuontia tai valaistuseditoria ei vielä ole. Omat alkuperäiset vektorit/3D-mallit: CC0-1.0, ei ulkopuolisia kuvapankkeja.

## Todelliset rajat ja tulkinta

- 60 000 merkkiä, enintään 4 hahmoa, 2 500 tapahtumaa, 200 osiota ja 1 000 repliikkiääniklippiä. Kokonainen .hahmo-arkisto enintään 128 MiB; yksittäinen repliikkiaudio 25 MiB, miksattu jaksoaudio 116 MiB. JSON- ja keyframe-rajat tarkistetaan myös vanhassa yhteisessä importerissa. Näiden ylittyminen on virhe, ei tekstin katkaisu.
- Pitkä tuotanto: enintään 1 200 s / 72 000 ruutua yhteisessä mallissa ja Mac-vientijonossa; ruutumääräraja voi rajoittaa aikaa kuvataajuuden mukaan. Vanha web-MP4 säilyttää 60 s rajansa. Mac-jonon väliaikaiskuvat enintään 4 GiB ja ääni 100 MiB; yli rajan vienti peruuntuu atomisesti. Pitkiä jaksoja voi joutua viemään osina.
- Testifixture `tests/fixtures/long-fi.md`: 1 062 sanaa; `long-en.md`: 1 489. Kummassakin 6 kohtausta ja 12 pitkää alkuperäistä repliikkiä, oma odotettu repliikkiluettelo ja kuusi suojattua taukoa. Tämä ei ole tuhat sanaa toistettua täytettä. Automaattitestit tarkistavat määrä-, sisältö-, järjestys-, lähdeviite-, tila- ja uudelleenrakennuksen.
- Semanttista mallia ei ole valittu eikä ladattu. `backend: unavailable`, `explicit-rules-only` on näkyvä. Epäselvä proosa pysyy ratkaisemattomana eikä sitä esitetä ymmärrettynä. Kaikkia pronomineja, lauseiden vaikutusalueita, valaistusta, suhteita tai vapaan proosan ohjausta ei ratkaista. Ei ulkoisia lähetyksiä, maksullisia kutsuja tai käsikirjoituksesta suoritettavaa ohjelmakoodia.
- Kameran koko/kulma/liike ovat erillisiä kenttiä. 2D-näkymien käsikirjoituskameran kulma ei vielä vaihda kaikkia PSD-rooleja, joten se antaa resurssivaatimuksen; nykyinen 2D-kävelyn kuvakulmapolku säilyy. 3D-olkapääkuva on rajattu kahden hahmon ortografinen sommittelu, ei täydellinen vapaa 3D-ohjaamo.

## Demo ja tarkistuksen erot

`node --experimental-strip-types scripts/create-production-demo.ts OUTPUTDIR` tekee 71,5 s muokattavan **valmisteluprojektin** ja kuvakäsikirjoituksen. KILSAT-osuus säilyttää kaikki 18 alkuperäistä englanninkielistä repliikkiä ja 0,7 s loppureaktion. Se on tekstiajoitettu, ei lopullinen ääneen vahvistettu jakso.

KILSAT-repliikkiääniä ei ole työtilassa. Käyttäjä valitsi oman äänen tallentamisen Hahmostudiossa. `KILSAT-oma-aanitys.hahmo` on tätä varten erillinen valmistelu, jossa 18 muuttamatonta repliikkiä ja 3D-hahmosidokset ovat valmiina. `/usr/bin/say` käynnistyy tässä Codex-suoritusympäristössä mutta raportoi `sandbox_extension_issue_file failed`; sen AIFF-tiedostoissa on **0 PCM-näytettä**. Niitä ei hyväksytty ääneksi. Täysi 60–90 s ammattimainen esittelyvideo on edelleen tekemättä: se tarvitsee oikeat 18 repliikkiääntä ja todellisen UI-tallenneosuuden. Valmistelun UI-kortti on nimenomaan puuttuvan tallenteen merkintä, ei tekaistu käyttöliittymä. Älä julkaise valmistelua valmiina demona.

Käsikirjoituskameran muuttunut ohje regeneroi automaattiset kentät; käyttäjän muuttamat kamerakentät säilyvät. Päällekkäinen suora kameraliike ja paikallaan-pitämisen ohje antaa näkyvän ristiriitavaroituksen.

Kulmia ja puhelintoimintoja tarkistetaan lisäksi todellisella 18 s / 432 ruudun / 1920×1080 / 24 fps liikejaksolla. Sen ääni on tarkoituksella pois ja se on **liiketarkistus**, ei lopullisen demon korvike. Browser-esikatselu ja kooditestit eivät todista fyysisen mikrofonin/kameran tai Safarin toimintaa. Paikallisen Electronin GUI-käynnistys tässä työympäristössä päättyi exit 134; paketin Node-smoke ei todista GUI-käynnistymistä käyttäjän koneella. OS-turva-asetuksia ei muutettu.

## Kehitys ja paketointi

```sh
npm ci
npm run typecheck
npm test
npm run dev
npm run build:private
npm run start:private
npm run desktop:build
npm run desktop:package:mac
npm run desktop:test:package
```

Lähde: `/Users/Aleksi/Documents/Codex/2026-10-02/vie/work/hahmostudio`. Asennettu/Lataukset-kansiossa oleva vanha .app ei päivity lähdekoodista. Uusi Mac-ZIP puretaan paikalliseen Ohjelmat-kansioon vanhan sovelluksen sulkemisen jälkeen. Ei automaattipäivitystä, GitHub-pushia, julkaisua tai käyttöoikeusmuutoksia.

Alkuperäinen 0.10-toimitus tehtiin ilman GitHub-siirtoa. Käyttäjä pyysi tämän jälkeen 4.10.2026 nykyisen lähdekoodin viemistä `aleksipii/hahmostudio`-repositorioon ja sovelluskuvauksen kirjoittamista. Tämä erillinen lähdekoodin siirto ei muuta repositorion yksityisyyttä, julkaise Pages-sivustoa tai päivitä asennettua Mac-sovellusta.

## Jatkotyö · älä merkitse kokonaispyyntöä valmiiksi

Aito semanttinen paikallinen tulkitsija, kattavat ohjeiden vaikutusalueet/pronominit, suora posejen manipulointi esikatselussa, laajempi sarjaprofiilin assetti-/ääni-/rigikirjasto, omien ympäristöpakettien tuonti ja valoprofiilin editointi, kerrostetut/vapaat 3D-miljööt, korkeampi vaatetus-/kädentarkkuus ja lopullinen taiteellinen hyväksyntä, GPU/z-buffer, puhelimen muokattava näyttöteksti, koko ammattimainen äänellinen demovideo ja oikea UI-tallenne sekä fyysinen Mac/Safari/laitevarmistus ovat vielä avoimia. Nykyisten pidempien audioarkistojen ja kymmenentuhannen keyframen rajat on otettava huomioon, ennen kuin luvataan 20 minuutin täyslaatuinen vienti kaikissa tapauksissa.
