# KILSAT Studio 0.19 — kuvien työjonon CSV-vienti

Kehitysvaihe: paikallisten tuotantotyökalujen perusta. 0.16 toi kommentit, 0.17 koonnin ja 0.18 vastuut/määräajat. 0.19 lisää työjonon siirrettävän taulukkoraportin. Koko studiotason tuotantojärjestelmä ei vielä ole valmis.

## Käyttö

Avaa Animointi → Kuvakortit → Tuotantotilanne → Vie kuvien työjono CSV-tiedostoksi. Valitse Koko valmistelu tai Nykyinen haku ja suodatus ja paina Vie CSV. Suodatettu vienti sisältää kaikki tulokset, myös muilla kuvakorttisivuilla olevat kuvat.

Macissa käytetään nykyistä Tallenna tiedosto -ikkunaa ja atomista tiedostokirjoitusta. Peruutus säilyttää projektin ennallaan. CSV ei vaihdu aktiiviseksi projektitiedostoksi eikä merkitse projektia tallennetuksi. Selainversio käynnistää CSV-latauksen nykyisellä saveFile-polulla.

## Sisältö ja muoto

Sarakkeet: jakso-ID/nimi, sisältörevisio, työjonon vertailupäivä, kohtaus, kuva-ID/nimi, tila, alku ja kesto sekunteina sekä tarkkoina tickeinä, hahmot, vastuuhenkilö, määräaika, myöhästymistila, ääniviitteiden tila, avoimien kommenttien määrä, virhemäärä ja tekninen tarkistettavuus.

CSV on UTF-8 BOMilla, puolipiste-erottimella ja CRLF-riveillä. Sekuntisarakkeet käyttävät pilkkua ja kuutta desimaalia; tick-sarakkeet säilyttävät tarkan 35 280 000 tickin aikakoordinaatin. Tekstisolut lainataan ja lainausmerkit kahdennetaan; rivinvaihto solun sisällä säilyy. Taulukkolaskennassa käytä tarvittaessa tuontiasetuksia UTF-8 / puolipiste.

Mahdollinen kaavaksi tulkittava =/+/-/@-alkuinen teksti suojataan etuliitteellä myös alkuvälilyöntien jälkeen. Null-merkki poistetaan raporttisolusta. Projektin alkuperäinen teksti ei muutu. Tiedostonimen erottimet ja kontrollimerkit korvataan; Unicode-koodipistettä ei katkaista ja nimen rungon koko rajataan 180 UTF-8-tavuun.

Mukana eivät ole ääni- tai kuvatiedostot, kommenttien tekstit, poistettujen kuvien orpotiedot tai koko projektin muokkaushistoria. Hyväksyntä tarkoittaa käyttäjän nykyistä päätöstä ja ääniviite leikkeen viitettä, ei sertifioitua videota tai äänen todellista saatavuutta.

## Arkkitehtuuri

`lib/studio/production-csv.ts` muodostaa deterministisen raportin nykyisestä productionOverviewsta. Valitut kuvat ratkaistaan ID:llä koonnin todellisista riveistä, joten ulkopuolinen tai duplikaattikuva hylätään eikä vanhentunutta kopioriviä käytetä. Vertailupäivä tulee samasta koonnista kuin käyttöliittymän myöhästymislaskenta.

`ProductionCsvExport` valitsee koko/suodatetun aineiston ja käyttää nykyistä `saveFile(blob,name,{kind:'export',saveAs:true})`-siltaa. CSV muodostetaan ennen tallennuksen odottamista. Domain ei muutu; mitään uutta projektiskeemaa ei tarvita. Tallennuksen virhe/peruutus esitetään omassa tilaviestissä.

## Tarkistus ja rajat

224 kooditestiä läpäisee. Uudet testit kattavat raportin toistettavuuden, ID:t/tickit/revision/päivän, lähdemallin muuttumattomuuden, suodatuksen ja duplikaatti/väärä-ID-hylkäyksen, erikoismerkkien ja kaavaprefiksien käsittelyn sekä CSV-tavujen tallentamisen oikealla NativeFiles-kirjoittajalla ilman aktiivisen projektin vaihtumista. Tallennuksen peruutus testattiin.

CSV ei ole .hahmo-varmuuskopio eikä sitä tuoda takaisin projektiin. Ei automaattista Excel-/Numbers-/pilviyhteyttä, kaksisuuntaista synkronointia tai kaikkien projektien sarjaraporttia. Taulukkolaskentasovelluksen tuontia ei kokeiltu graafisesti. Selainlatauspolku on toteutettu mutta sitä ei testattu selaimessa. Nykyiset moottorit, resurssit ja .hahmo-versioiden 1–5 lukupolku säilyvät.

Tyyppitarkistus, tuotantorakennukset, Mac-paketointi ja paketoidun runtimen tulokset kirjataan Kooditestit-0.19.0.md-tiedostoon. Graafista editoria, fyysistä kameraa/mikrofonia tai Safaria ei testattu tällä koodikierroksella.
