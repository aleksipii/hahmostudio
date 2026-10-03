# Todellinen tila ja seuraavat vaiheet · 3.10.2026

## Toteutettu

- PSD-tasotuonti, osien tarkastelu ja näkyvyys; yksitasoinen PNG-tuonti.
- Nivelmääritys, pivotit, parentKey-sidokset, kahden osan IK, avainruudut, tweening, toisto ja ääni.
- Paikallinen kameraseuranta ja liikkeen tallennus, mikrofonin voimakkuusohjaus ja fi/en-Rhubarb äänen suumuodoille.
- Otto, Aino, Leo, muokattava Hahmopohja-PSD, kaksi yhdeksän suun PSD-pakettia ja kuusi omaa kuvausympäristöä (studio, puhelin/2 kulmaa, auto/3 kulmaa).
- Paikallinen fi/en-käsikirjoitusjäsennin: kävely, vilkutus, hyppy, kyykistys, nyökkäys ja tauko, kuvakulmien vaihdot sekä muokattavat avainruudut. Lisää aiemman työn perään; teksti ja kuvakulmat säilyvät .hahmo:ssa. Ei puheäänen synteesiä.
- Kameran liitetty pää pysyy kaulassa: ei siirtymää tai skaalausta, kallistus ±25°. Omalle PSD:lle selkeä Liitä osaan ja pään kiinnityspainike.
- Hyppy, A/D-käsien nostot, 1–3-ilmeet ja räpäytys. R tallentaa pikasuorituksen. Ohjauslähteet yhdistyvät parametrikohtaisesti.
- 1080×1920, 1920×1080 ja neliönäyttämö, MP4 ja PNG-kuvasarja; viiden jakson sarja ja YouTube-kooste.
- Kolme työtilaa, järjestelmä-/vaalea-/tumma teema, avattava aikajana, ohjeet.
- Electron-integraatio, natiivit tiedostoikkunat, Tallenna/Tallenna nimellä, recent-lista, Mac-valikot, tallentamattoman työn suojaus ja offline-resurssien paketointi.

## Rajat ja keskeneräinen varmennus

PSD:n vektori-/ryhmä-/leikkausmaskit, efektit ja säädöt eivät ole täydellisesti tuettuja. Live-mikrofoni ei tunnista äänteitä. Rhubarb ei litteroi puhetta, ja suomen phonetic-tunnistimen tarkkuus riippuu aineistosta. MP4 tarvitsee käytettävän kooderin; saatavuus tarkistetaan käytön yhteydessä. Fyysiset laitteet, natiivit dialogit ja oikea Safari tarvitsevat erillisen käytännön varmennuksen. Tallentamattomasta sarjasta ei tehdä automaattista projektitallennusta.

## Seuraava vaihe riippuvuusjärjestyksessä

1. Paketoidun sovelluksen fyysinen kamera/mikrofoni- ja lupavarmennus sekä visuaalinen tarkistus erikseen käyttäjän luvalla. Älä kutsu simuloituja testejä laitetesteiksi.
2. Kirjaston jatkolaajennus: sivu- ja takakuvahahmot, tilanteisiin sopivat käsieleet ja usean hahmon kohtaukset. Nykyinen kirjasto sisältää neljä hahmopohjaa ja kuusi ympäristöä. Säilytä lisenssit; älä kopioi Adoben esimerkkihahmoa.
3. Live-pikanäppäimet vilkutukselle (Shift+A/D), kyykylle (S) ja Q/E-kävelylle. Liikkeet ovat nyt käytettävissä käsikirjoitusgeneraattorissa, eivät näillä näppäimillä. Nykyinen kävelygeneraattori on erillinen työkalu; nämä pikanäppäimet eivät vielä ole toimintoja eikä niille näytetä valepainikkeita.
4. Liike- ja ilmeklippien malli, peruutus, sekoittaminen ja sisäkkäiset aikajanat, yhteensopiva projektimigraatio ja editointityökalut. Klipit eivät vielä ole toteutettuja.
5. Osien nimeäminen, maalauksen ja maskien korjaustyökalut. Nykyinen sovellus ei sisällä piirtoeditoria.
6. Avustettu PNG-osien tunnistus vasta maskien korjauksen jälkeen. Näytä epävarmat osat, älä arvaa piilossa olevia raajoja valmiiksi rigatuiksi. Mahdollisen ulkoisen palvelun käyttö vaatii erillisen päätöksen; nykyinen sovellus ei lähetä aineistoa pilveen.

Jatka samasta lähdekoodista. Älä korvaa nykyistä sovellusta demolla, muuta tallennusmuotoa yhteensopimattomaksi tai katkaise kameraa/mikrofonia näppäinohjauksen vuoksi.


0.4.0 lisäys: Aino ja Otto kolmella piirretyllä kuvakulmalla, sivukävelyn tukivaiheen jalkakontakti ja polvi-IK, juoksu, kohti katsojaa -perspektiiviliike, yläreunan liikepainikkeet, Näkymä-valikko sekä käteen kiinnitettävä puhelin kolmessa kulmassa. Poispäin/takakulma, yleinen 3D-luuranko, usean esineen sommittelu ja fysiikkapohjainen lattiatörmäys ovat tulevia vaiheita.


0.5.0 completed: compact Finnish application menus, native Mac view/help menu actions, local persisted panel sizing, focused stage view and two original paper-cutout casts with 3 independent drawings each. Floating/redockable tab windows and arbitrary panel grouping are not implemented; side panes resize and hide in the existing shared layout.

## 0.6.0

Toteutettu deterministinen Markdown-dialogipolku: lähdeteksti, puhujasidokset, mitattu paikallinen ääni, muokattavat suuasennot, katseet/ilmeet/rekvisiitta, jatkuva studio, kameraleikkaukset, suojatut tauot, valmistelun tallennus ja v3 projektipaketit. Seuraava käytännön varmennus tarvitsee oikeat repliikkiäänet ja käyttäjän luvan GUI-/laitevarmennukseen. Täydellinen monen hahmon live-ohjaus, yleiset taustamaailmat, täydet äännekohtaiset suuvariaatiot ja valittu puhesynteesi ovat jatkotyötä.

## 0.7.0

Toteutettu yleinen lähdeviitteellinen ohjaussuunnitelma, per-hahmo luonne/suhteet ja hillityt presetit, kirjaston ympäristöjen vaihdot, nykyisen moottorin vartaloliikkeet, rajoitusten ristiriidat, tarkat/joustavat aikavaatimukset, käyttäjän arvioiden vahvistus ja puuttuvien ohjeiden esto. Toinen riippumaton käsikirjoitus toimii ilman lähdekoodin muokkaamista. Jatkokehitys: vapaan luonnollisen kielen laajempi tulkinta, mielivaltainen rekvisiitta/omat taustaresurssit, valittu puhesynteesi ja oikeiden äänten/videoiden käyttövarmennus.
