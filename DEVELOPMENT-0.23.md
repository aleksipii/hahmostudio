# KILSAT Studio 0.23 — tallennettavat hakunäkymät

Vaihe 0.23 jatkaa paikallista tuotantoperustaa. Animointi → Kuvakortit → määritä haku ja suodatus → Tallennetut hakunäkymät → anna nimi → Tallenna nykyinen haku ja suodatus. Nimen painaminen palauttaa ehdot avoinna olevaan valmisteluun ja ensimmäiselle sivulle. Hahmovalinta ja toistokohta säilyvät. Haku toimii kuten ennen: kuvan nimi, kohtaus, hahmo tai vastuuhenkilö. Voit poistaa yksittäisen näkymän vahvistuksella.

Enintään 20 nimettyä näkymää; nimi 80 merkkiä, haku 500. Näkymä sisältää ID:n, nimen, suodattimen ja hakutekstin. Ei projekti-ID:tä, kuva-ID:itä, animaatiota, ääniä tai hyväksyntätilaa. Sama näkymä toimii eri valmisteluissa niiden senhetkisillä tiedoilla. Esimerkiksi myöhässä-suodatin arvioidaan nykyisen paikallisen päivän mukaan.

LocalStorage-avain kilsat-shot-views-v1 ja schemaVersion 1. Tämä on käyttäjän paikallinen asetus, ei .hahmo-dataa eikä projektin undo-komento. Nimet ja ID:t ovat yksilöllisiä; virheellinen tai uudempi skeema estää päällekirjoituksen. Lukeminen/tallennus voi epäonnistua ja siitä näytetään viesti. Tallennus päivittää UI-listan vasta onnistuneen asetuskirjoituksen jälkeen. Tuntemattomia lisäkenttiä ei kopioida normalisoituun asetukseen.

Kooditestit kattavat roundtripin, alkuperäisen muuttumattomuuden, poiston, tallennusvirheen, nimien/ID:iden duplikaatit, version ja kokorajat. Ei graafista editori-/selain-, fyysistä laite- tai Safari-testiä tällä kierroksella.

Rajat: näkymät eivät synkronoidu koneiden tai selainprofiilien välillä eivätkä sisälly projektivarmuuskopioon. Ei rinnakkaisten ikkunoiden kirjoituskonfliktien ratkaisua. Asetuksia ei automaattisesti nollata vioittumistilanteessa. Ei automaattista näkymän avaamista uudelle projektille. Nykyinen projekti, .hahmo v1–v5, moottorit, resurssit ja paneelit säilyvät. Koko ammattistudio ei ole valmis.

Asennus: sulje vanha sovellus, pura uusi Mac-ZIP ja korvaa Ohjelmat-kansion KILSAT Studio.app. Tarkistustulokset: Kooditestit-0.23.0.md.
