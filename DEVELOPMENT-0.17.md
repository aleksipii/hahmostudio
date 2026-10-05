# KILSAT Studio 0.17 — tuotantotilanteen koonti

Tämä vaihe lisää yhden valmistelun tuotantotilanteen nykyiseen kuvatauluun. Esitys-, animaatio-, ääni-, rig-, PSD- ja renderöintimoottorit sekä aiemmat tallennukset säilyvät. Uutta tallennettavaa skeemaa ei tarvita: koonti lasketaan nykyisestä mallista.

## Käyttö

Avaa Animointi → ohjauspöydän Kuvakortit → Tuotantotilanne. Näkymä näyttää kohtausten ja kuvien määrän, keston, virheet/huomiot, luonnokset, hyväksytyt ja lukitut kuvat, korjattavat kuvat, tarkistettavissa olevat kuvat, puuttuvat ääniviitteet sekä kommentoidut kuvat.

Tilamäärän painaminen suodattaa alapuolisen kuvaluettelon. Sama Suodata kuvat -valinta toimii myös tavallisissa Kuvakortit/Kuvaluettelo-näkymissä. Haku yhdistyy tilasuodatukseen ja tunnistaa kuvan nimen, kohtauksen nimen ja hahmot. Näytetään X / Y kertoo suodatuksen tuloksen, mittarien määrät koskevat koko valmistelua.

Avaa seuraava keskeneräinen kuva etsii nykyisen kuvan jälkeen seuraavan luonnoksen tai ongelmallisen hyväksytyn/lukitun kuvan ja kiertää lopussa alkuun. Se avaa oikean kuvakorttisivun, palauttaa haku-/tilasuodatuksen kaikkiin kuviin, valitsee kuvan ja siirtää nykyisen esikatselun toistokohdan. Toiminto ei muuta hyväksyntää, lukituksia, kommentteja tai animaatiota. Kun keskeneräisiä kuvia ei ole, toiminto on pois käytöstä.

## Tilojen merkitys

Hyväksytty/lukittu-mittari kertoo käyttäjän tarkistuspäätösten määrän. Hyväksytty kuva voi silti näyttää korjattavaa, jos sillä on nykyisiä teknisiä virheitä tai palautetta. Lukitusta ei avata automaattisesti.

Korjattavaa tarkoittaa kuvaa, jolla on nykyisiä virheitä, puuttuva repliikin ääniviite, avoin kommentti tai nollakesto. Kukin kuva lasketaan tähän kerran, vaikka ongelmia olisi useita.

Teknisesti tarkistettavissa tarkoittaa luonnosta, jolla näitä esteitä ei ole. Se ei ole taiteellinen hyväksyntä, todennettu MP4 tai vakuutus todellisen ääniblobin saatavuudesta. Ääniviite puuttuu kertoo repliikkiäänileikkeen puuttumisesta nykyisessä mallissa. Oikeat tiedostot, resurssihashit ja vientitulokset tarkistetaan edelleen nykyisessä preflight-/QC-putkessa.

Poistettuihin kuviin jääneet avoimet kommentit ilmoitetaan erikseen. Ne säilyvät kommenttilistassa, mutta niitä ei yhdistetä toiseen kuvaan tai lasketa olemassa olevien kuvien kommenttimääräksi. Tyhjä tapahtumamalli ei tuota koontiin näennäistä valmista kuvaa.

## Arkkitehtuuri

`lib/studio/production-overview.ts` muodostaa nykyisestä adapterista yhden read-only-koonnin. Samalla käynnillä kootaan avoimet kommentit per kuva, tilamäärät ja orpotiedot. `filterProductionShots` yhdistää tilan ja suomenkielisen haun. `nextUnfinishedShot` ratkaisee navigoinnin deterministisesti nykyisestä kuvajärjestyksestä.

`components/production-dashboard.tsx` esittää koonnin. `StudioShotBoard` käyttää samaa koontia suodatuksessa ja korttien kommenttimäärissä sekä nykyistä choose/seek-valintapolkua. Komponentin tila sisältää vain näkymän, suodattimen, haun ja sivun. Projektin tuotantotilaa ei kopioida uuteen React-totuuslähteeseen.

## Tarkistus ja rajat

216 kooditestiä läpäisee. Uudet testit kattavat erilliset kuvamäärät, teknisen valmiuden ja hyväksynnän eron, status/kommentti/ääniviite/kohtaus/hahmo-suodatuksen, keskeneräiseen navigoinnin ja kierron, lukitun kuvan palautteen, valmiin valmistelun sekä tyhjän mallin ja kommenttiorpojen käsittelyn. Koonti ei muuta lähtömallia.

Tämä on yhden valmistelun koonti, ei koko sarjan/kauden/monen projektin hallinta. Ei tehtävien vastuuhenkilöitä, määräaikoja, tiimien yhteistä palvelinta tai automaattista hyväksyntää. Suodattimet ovat editorin väliaikaista tilaa. Enintään 24 korttia renderöidään sivulla; satojen kuvien kuormaa ei tällä kierroksella mitattu.

TypeScript, web-/Mac-rakennus, Mac-paketointi ja runtime-tarkistukset kirjataan Kooditestit-0.17.0.md-tiedostoon. Graafista käyttöä, fyysistä kameraa/mikrofonia tai Safaria ei testattu. Aiemman sovellusversion jäädytetty renderjono voi versiosopimuksen vuoksi edellyttää uuden vientityön luomista.
