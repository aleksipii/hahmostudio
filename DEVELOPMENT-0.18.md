# KILSAT Studio 0.18 — kuvien työjono

Kehitysvaihe: tuotantotyökalujen paikallinen perusta. 0.13–0.15 rakensivat identiteetin, tallennusturvan ja kuvakohtaiset lukitukset; 0.16 lisäsi review-kommentit; 0.17 tuotantotilanteen koonnin. Tässä vaiheessa lisätään kuvien vastuut ja määräajat. Koko ammattistudio ei vielä ole valmis.

## Käyttö

Avaa Animointi → Kuvakortit. Valitse kuva ja avaa kuvaluettelon alla Kuva … · vastuuhenkilö ja määräaika. Kirjoita nimi, valitse määräpäivä ja paina Tallenna työjonotiedot. Molemmat kentät ovat valinnaisia. Poista vastuu ja määräaika tyhjentää vain tämän kuvan työjonotiedot.

Kuvakortti näyttää vastuuhenkilön ja määräpäivän. Tuotantotilanne tarjoaa Myöhässä sekä Keskeneräinen ilman vastuuhenkilöä -suodatukset. Haku tunnistaa myös vastuuhenkilön nimen ja yhdistyy muuhun tilasuodatukseen. Työjonopäivä näkyy koonnissa.

Keskeneräinen tarkoittaa luonnosta tai hyväksyttyä/lukittua kuvaa, jolla on virheitä, puuttuva ääniviite, avoin kommentti tai nollakesto. Hyväksytty/lukittu ongelmaton kuva on työjonon kannalta valmis. Määräpäivänä työ ei ole vielä myöhässä: myöhästyminen alkaa seuraavana paikallisena kalenteripäivänä. Ilman määräaikaa työ ei ole myöhässä.

Työjonotiedot eivät muuta kuvan hyväksyntää, lukitusta, animaatiota tai sisältörevisionumeroa. Niitä voi muokata lukitussisältöä avaamatta. Muutos ja tyhjennys kumoutuvat valmistelun Kumoa/Tee uudelleen -historiassa. Tallenna projekti säilyttää tiedot; nykyiset palautusvedokset ja nimetyt revisiot sisältävät ne myös.

## Toteutus

`lib/studio/shot-tasks.ts` määrittää ShotTaskin ja TaskCommandin. Valinnainen StudioMetadata.shotTasks on pysyvällä shotId:llä avattu sanakirja: owner, dueDate ja updatedAt. Vanha skeema 1 ja .hahmo-versioiden 1–5 lukupolku säilyvät. Määräpäivä on YYYY-MM-DD ilman kellonaikaa. Päivä validoidaan oikeaksi kalenteripäiväksi; esimerkiksi 29.2.2026 hylätään ja 29.2.2028 hyväksytään.

`assignShotTask` tarkistaa lähtörevision ja kohteen, muodostaa uuden validoidun mallin ja audit-merkinnän ennen julkaisua. Molempien kenttien tyhjennys poistaa vain kyseisen merkinnän. Kommentit, hyväksynnät, animaatiot ja muut kuvien työjonotiedot säilyvät. Poistetun kuvan työjonotietoja ei poisteta automaattisesti eikä niitä lasketa nykyisiin työjonomääriin.

`productionOverview(p,today)` ottaa eksplisiittisen vertailupäivän, joten määräaikatestit eivät riipu koneen kellosta. Käyttöliittymä muodostaa Macin paikallisen päivän, virkistää sen kerran minuutissa ja ikkunaan palattaessa. Päivä on editoritilaa, ei renderöintimoottorin aikakoordinaatti.

## Tarkistus ja rajat

220 kooditestiä läpäisee. Uudet testit kattavat .hahmo-tallennuksen/avaamisen, lukituksen ja hyväksynnän säilymisen, kumoamisen ja tyhjennyksen, määräpäivän rajan, ongelmattoman hyväksytyn kuvan poistumisen myöhästymislistasta, palautteen palauttaman keskeneräisyyden, vastuuhenkilöhaun, virheelliset päivät ja ylipitkän nimen, vanhentuneen revision sekä pysyvän kuvaidentiteetin/orpotietojen säilymisen.

Paikallinen yhden valmistelun työjono. Vastuuhenkilö on vapaa nimi, ei käyttäjätili, todennettu tekijäidentiteetti tai viestin vastaanottaja. Ei palvelinta, sähköposti-ilmoituksia, tiimin rinnakkaisia muokkauksia, roolipohjaisia oikeuksia tai sarjan/kauden yhteistä kalenteria. Enintään 2500 työjonotietuetta, nimi enintään 120 merkkiä. Poistettujen kuvien merkintöjen erillistä relink-/siivouskäyttöliittymää ei lisätty.

Tyyppitarkistus, tuotantorakennukset, Mac-paketointi ja runtime-tulokset kirjataan Kooditestit-0.18.0.md-tiedostoon. Graafista käyttöä, Safari-yhteensopivuutta tai fyysistä kameraa/mikrofonia ei testattu tällä koodikierroksella. Aiemman version jäädytetty renderjono voi vaatia uuden työn versiosopimuksen vuoksi.
