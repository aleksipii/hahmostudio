# KILSAT Studio 0.13 — tuotantoperustan ensimmäinen vaihe

Tämä versio toteuttaa pyydettyjen viiden kehitystoimenpiteen ensimmäisen kokonaisuuden nykyisen editorin päälle. Presentation/Production, animaatio-, PSD-, ääni- ja renderöintimoottorit säilyvät. Aiemmat hahmot, taustat, projektit ja .hahmo-versiot 1–5 säilyvät.

## 1. Tuotantodomain ja pysyvät tunnisteet

`lib/studio/domain.ts` muodostaa nykyisestä esityksestä Episode → Scene → Shot -näkymän. React ei omista näiden sääntöjä. Episode tunnistetaan esityksen alkuperäisellä ID:llä; kuva sidotaan pysyvään kameratapahtuman ID:hen. Kohtausten tunnisteet säilytetään metadataan ja sovitetaan säilyneiden tapahtumien avulla myös kohtauksen nimen/avaimen muuttuessa. Kamerakäskyt samalla hetkellä ratkaistaan viimeisen käskyn mukaan, joten adapteri ei luo niiden väliin nollakestoisia kuvia.

Yhteinen aika on kokonaislukutickeissä: 35 280 000 tickiä sekunnissa. Tämä esittää mm. 24/25/30 fps, 30000/1001 fps ja 48 kHz näyteajan ilman ruutujen ja näytteiden ristiriitaista pyöristystä. Adapterin ajat ovat jaksokohtaisia. Nykyisen moottorin sekunnit ja ruudut muunnetaan adapterin rajalla; niitä ei korvata tämän muutoksen yhteydessä.

`Production.studio` sisältää schemaVersion 1:n, jakso-ID:n, revisionumeron, kohtausten tunnisteet, käsikirjoitusluonnoksen, enintään 100 muutosmerkintää ja kuvan hyväksyntämetadatan. Vanha projekti saa adapterissa alkuarvot. Revisionumero on paikallinen muokkausnumero; renderin sisältöversio on SHA-256. Tulevaa tuntematonta studioskeemaa ei avata hiljaisesti.

## 2. Äänenvaihto yhtenä transaktiona

`replaceDialogueVoice` on ensimmäinen domainkomento. Se tarkistaa lähtörevision, repliikin ja lukitukset, koostaa uuden ajoituksen ja suuraidat ja vasta sitten palauttaa uuden esityksen sekä äänivaraston. Vaihto päivittää seuraavien tapahtumien ajat, kuvan keston ja hyväksynnän vanhenemisen. Lukitusristiriita estää koko muutoksen. Äänen analyysin aikana muuttunut esitys estää vanhentuneen tuloksen käytön.

Käsikirjoituspaneelin Kumoa/Tee uudelleen palauttaa sekä esityksen että ääniviittaukset. Yksi äänenvaihto vie yhden historia-askeleen. Ääniblobit ovat muuttumattomia; niiden avain johdetaan SHA-256:sta. Myös rajojen ja suuajoituksen uusiminen käyttää samaa komentoa. Nykyisen työnkulun mukaan muutokset koskevat ensin valmistelua: paina Rakenna jakso ennen päivitetyn version vientiä. Aiempi rakennettu jakso säilyy siihen asti. Tämä ei vielä siirrä kaikkia editorin muokkauksia yhteiseen komentopalveluun: muu editori käyttää edelleen nykyisiä omia historioitaan. Kumoamishistoriaa ei palauteta sovelluksen uudelleenkäynnistyksen jälkeen.

Hyväksyntämetadatan vanheneminen on toteutettu, mutta täydellistä review/assignment-työtilaa ei ole lisätty. Metadataan lukittu kuva estää tässä vaiheessa konservatiivisesti koko esityksen sisältömuutoksen. Kuvakohtainen vaikutusgraafi ja hyväksyntäkäyttöliittymä ovat seuraava vaihe.

## 3. Resurssimanifesti ja palautus

Uusi `.hahmo` sisältää valinnaisen `resource-manifest.json`-tiedoston: jokaisen arkistojäsenen polku, tavukoko ja SHA-256. Myös hahmopakettien ja alkuperäisten repliikkiäänien tavut tarkistetaan ennen projektin tulkintaa. Manifestista puuttuva, ylimääräinen tai muuttunut resurssi aiheuttaa virheen. Vanhojen manifestittomien projektien aiemmat tarkistukset säilyvät. Manifesti ei ole digitaalinen allekirjoitus.

Projektin muutos käynnistää automaattisen palautuspisteen noin 2,5 sekunnin joutoajan jälkeen. Käsikirjoituspaneeli synkronoi luonnoksensa ja vielä jäsentämättömän lähdetekstin noin sekunnin jälkeen. Tallennus odottaa keskeneräistä toimintoa eikä kirjoita käyttäjän omaa projektitiedostoa tai poista tallentamattoman työn merkintää. Tiedosto → Tallenna on edelleen varsinainen projektitallennus.

Macissa `desktop/recovery.mjs` kirjoittaa yksilölliseen, olemassa olevaa vedosta muuttamattomaan tiedostoon, synkronoi tiedoston levylle ja vaihtaa journalin atomisella nimenvaihdolla. Vain kaksi viimeistä vedosta säilytetään. Kirjoitukset sarjoitetaan; uudelleenkäynnistys ja tarkistussumman perusteella tehtävä paluu edelliseen ehjään vedokseen on testattu. Orvoiksi jääneet oman palautushakemiston snapshot-tiedostot siivotaan. Käyttäjän muut tiedostot säilyvät.

Käynnistyksessä palautuspalkki tarjoaa Palauta työ / Jatka nykyisellä projektilla / Poista palautuspiste. Epäonnistunut avaaminen säilyttää palautuspalkin. Vioittunut hakemisto pysäyttää automaattitallennuksen ja tarjoaa erillisen poistotoiminnon. Tyhjä projekti ei vielä tuota vedosta: valitse tai avaa ensin hahmo/projekti tai käytä käsikirjoituksen valmistelutallennusta. Keskeneräisten luonnosten puuttuvat resurssit ja pidempi kesto sallitaan; aikajanalle rakennettujen kohtausten tarkistukset pysyvät tiukkoina.

Selainversio käyttää saman originin IndexedDB:tä. Sen portti/origin määrittää erillisen palautusvaraston; Macin varasto sijaitsee sovelluksen käyttäjätietohakemistossa. Selainvaraston toiminta on toteutettu, mutta sitä ei ole tällä kierroksella testattu selaimessa.

Rajaus: palautus on kahden täyden projektivedoksen journal, ei rajaton revisioarkisto, komentoihin perustuva replay-journal eikä inkrementaalinen resurssitallennus. Arkiston 128 MiB raja säilyy. Isojen PSD-projektien jatkuvan automaattitallennuksen suorituskykyä ei ole kuormatestattu.

## 4. Jäädytetty renderöintisopimus

`freezeRender` tekee muuttumattoman projektivedoksen. `inspectRenderSnapshot` tarkistaa viennin aikavälin, koostetun esityksen virheet, resurssit, kuvan keston ja tarvittavan miksatun äänen. Sopimuksessa ovat sovellus- ja sopimusversio, vedoksen SHA-256, semanttinen sisältöversio, resurssien tarkistussummat, jakso-ID:t, vientiasetukset ja odotettu ruutumäärä. ZIPin aikaleimat eivät vaikuta semanttiseen renderi-identiteettiin.

Mac-vientityöntekijä tarkistaa saman vedoksen uudelleen ennen renderöintiä. Jono ottaa kopion projektitavuista; myöhempi editointi ei muuta jonossa olevaa työtä. Aiempi kuittauksellinen ruutujen kirjoitus, peruutus ja FFmpeg-pakkaus säilyvät.

MP4/GIF dekoodataan ennen onnistuneen viennin korvaamista. FFmpeg tarkistaa ruutumäärän ja pyydetyn ääniraidan olemassaolon; FFprobe tarkistaa kuvan mitat ja MP4:n kuvataajuuden. Manifestiin kirjataan todellinen enkooderi, tarkistustulos ja tiedoston SHA-256. Sivutiedosto on `<video>.manifest.json`. Kahden tiedoston julkaisun tavallinen virhe palauttaa vanhan videon ja manifestin. Tämä ei vielä ole sähkökatkon yli atominen kahden tiedoston transaktio.

PNG-sarjan kansiossa ovat render-manifesti ja jokaisen PNG:n SHA-256 sekä aiempi kuvasarja.json. PNG-sarjoja ei korvata olemassa olevan kansion päälle. Vanha WebCodecs-MP4-polku saa samat projektin esitarkistukset, mutta siihen ei lisätty Macin jälkidekoodausta tai sivumanifestia. Vanha erillinen PNG-lataus säilyy aiempana työkaluna.

Rajaus: ei EXR/ProRes-, LUT-, loudness-masterointi-, persistent batch- tai render farm -uudistusta. Ääniraidan olemassaolo ei todista puhetekstin vastaavuutta tai miksauksen laatua. Samasta jäädytetystä vedoksesta laskettavan sopimuksen toistettavuus on testattu; editorin kaikkien Canvas/3D-kuvien pikselivastaavuutta eri GPU:illa ei ole sertifioitu.

## 5. Kuvataulu ja yhteinen valinta

Animointi → käsikirjoituksen ohjauspöytä → Kuvakortit näyttää adapterin todelliset kuvat. Kuvakortit/Kuvaluettelo, haku ja 24 kuvan sivutus käyttävät samaa domainia. Kortti näyttää kohtauksen, alkukohdan, keston, hahmot, revision, tilan, äänten tilan ja virheiden määrän. Esikatselukuva piirretään olemassa olevalla rendererillä.

Kortin valinta ratkaistaan `selectShot`-funktiolla: sama tapahtuma välitetään käsikirjoituksen valintaan ja ominaisuuksiin ja sama kohtausruutu nykyiseen toistopäähän. Virheen Avaa ongelman kohta tekee vastaavan navigoinnin repliikkiin/tapahtumaan. Alkuperäinen kuvien järjestäminen ja siirtäminen säilyy erillisessä avattavassa osiossa. Työtilojen vaihto ei nollaa projektia eikä laiteohjausta.

Tämä on ensimmäinen kuvataulu nykyiselle tuotantomallille. Se ei vielä tuo omistajia, määräpäiviä, kommentointia, usean kuvan siirtoa tai satojen kuvien virtuaalista hierarkkista aikajanaa. Nykyiset tuotantomallin kokorajat pysyvät voimassa.

## Tarkistus ja Mac-version avaaminen

Tämän toimituksen testimäärä, paketointi ja runtime-tulokset kirjataan `Kooditestit-0.13.0.md`-raporttiin. Domain-, transaktio-, palautus-, resurssikorruptio-, navigointi- ja vientivirhetestit ovat mukana `npm test` -komennossa. Tyyppitarkistus: `npm run typecheck`. Rakennus: `npm run build:private` ja `npm run desktop:package:mac`.

Pura `Hahmostudio-Mac-0.13.0-arm64.zip`. Sulje vanha KILSAT Studio kokonaan. Siirrä uusi `KILSAT Studio.app` Ohjelmat-kansioon vanhan sovelluspaketin tilalle ja avaa se. Projektit ja asetukset eivät sijaitse sovelluspaketissa. Lataukset-kansiossa oleva aiempi app ei päivity lähdekoodimuutoksesta itsestään.

Paketoinnin ja paketoidun Electron/Node-runtimen onnistuminen raportoidaan erikseen graafisesta käynnistyksestä, selaintestistä sekä fyysisistä kamera-/mikrofonitesteistä.
