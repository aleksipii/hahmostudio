# KILSAT Studio 0.15 — kuvakohtainen muokkausturva

Tämä vaihe korvaa 0.14:n konservatiivisen koko esityksen sisältömuokkauseston kuvakohtaisella vaikutustarkistuksella. Nykyinen Presentation/Production pysyy auktoriteettina. Moottoreita, resursseja tai tallennusmuotoja ei korvattu.

## Käyttö

Kuvakorttien Hyväksy kuva → Lukitse kuva toimii kuten ennen. Voit muuttaa esimerkiksi myöhemmän kuvan kameran zoomausta, vaikka aiempi kuva on lukittu. Aiempi kuva pysyy lukittuna ja sen hyväksyntä säilyy uudella sisältörevisiolla. Muutoksen koskemat hyväksynnät palautuvat luonnoksiksi.

Jos repliikkiäänen pidentäminen siirtäisi myöhempää lukittua kuvaa tai maailmankuvan muutos vaikuttaisi siihen, muutos estetään kokonaan. Virheilmoitus nimeää estävän kuvan. Avaa sen lukitus tarkoituksella ennen muutosta. Hylkäys ei muuta esitystä, äänen viitteitä tai hyväksyntää. Kumoaminen palauttaa aiemman mallin ja tilat.

Käsikirjoituksen valmistelu ja aikajanalle rakennettu jakso ovat edelleen erilliset: paina Rakenna jakso ennen vientiä. Tämä muutos ei lisää tiimikommentteja, tehtäväjakoa tai pakollista hyväksyntäporttia renderöintiin.

## Toteutus

`lib/studio/shot-impact.ts` muodostaa deterministisen, kanonisen riippuvuusvertailun kuvan aloituksesta/kestosta, pysyvästä kohtausidentiteetistä, maailmasta, hahmomäärityksistä, tuotantoasetuksista, ääniviittauksista, tapahtumista ja animaatioraidoista.

Kuvan loppua edeltävät tapahtumat otetaan mukaan myös silloin, kun ne ovat ennen kuvan alkua: hahmon asento, ilme, katse, sijoittelu, kameran tila tai miljöö voi jatkua seuraavaan kuvaan. Tapahtumakohtaiset kamera-, lukitus- ja override-asetukset rajataan tähän riippuvuusjoukkoon. Myöhemmin alkava rekvisiitta ei ole aiemman kuvan riippuvuus. Animaatioraidasta huomioidaan myös ensimmäinen kuvan loppurajalla tai sen jälkeen oleva avain, koska interpolointi voi vaikuttaa kuvan sisällä.

`revise` sovittaa ensin kohtausidentiteetin kuten ennen, vertaa lähtöä ja tulosta, estää muuttuvan/poistuvan lukitun kuvan ja vanhentaa vain vaikutusjoukossa olevat hyväksynnät. Muuttumattoman voimassa olevan hyväksynnän approvedRevision siirtyy seuraavaan revisioon. Ohjausmuokkaus ja repliikkiäänen vaihto koostavat lähtömallin ja tuloksen samalla compilerilla ennen vertailua. Tallennettu StudioMetadata säilyy schemaVersion 1:nä eikä vanhoihin projekteihin tarvita uutta pakollista kenttää.

## Turvallinen mutta varovainen raja

Tämä on ensimmäinen vaikutusanalyysi, ei täydellinen minimaalinen riippuvuusgraafi. Aiemman tapahtuman muutos voi vanhentaa kaikki myöhemmät kuvat, vaikka yksittäisen myöhemmän kuvan näkyvä pikselitulos pysyisi samana. Maailma-, metadata-, hahmomääritys- ja ohjausprofiilimuutokset ovat yleisiä riippuvuuksia. Tuntematon tapahtuma-ajoitus otetaan varovaisesti mukaan; uudelleenjäsennettävän käsikirjoituksen muokkaus voi siksi edelleen vaatia lukituksen avaamisen.

PSD:n tai rigiresurssin ulkoista tiedostomuutosta ei tällä vertailulla sertifioida. Resurssimanifestin ja render-manifestin aiemmat tarkistukset säilyvät. Riippuvuuksien välimuisti, tarkka tila-analyysi ja shot-kohtaiset resurssihashit ovat jatkotyötä. Vertailu käsittelee koko valmistelun animaatioavaimia: satojen kuvien kuormaa ei ole mitattu.

## Testaus ja toimitus

208 kooditestiä läpäisee. Uudet testit varmistavat myöhemmän kameramuutoksen aiemman lukituksen rinnalla, hyväksynnän säilymisen ja vanhenemisen, äänenvaihdon aiheuttaman lukitun kuvan siirtymisen eston sekä globaalin rajausmuutoksen ja kuvan poiston eston. Myös loppurajan jälkeisen interpolointiavaimen muutos ja animaation lyhentäminen havaitaan. Aiemmat tallennus-, palautus-, revisio-, transaktio-, renderjono- ja vientitarkistukset säilyvät.

Tyyppitarkistus, web-/Mac-rakennus, Mac-paketointi ja paketoidun runtimen tulokset kirjataan Kooditestit-0.15.0.md-tiedostoon. Tämä toimitus ei ole graafinen käyttötesti tai fyysisen kameran/mikrofonin/Safarin varmennus.
