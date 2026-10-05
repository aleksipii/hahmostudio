# KILSAT Studio 0.21 — tuotannon tarkistusnavigointi

Vaihe 0.21 jatkaa paikallisen tuotantoperustan kehitystä. Animointi → Kuvakortit → Tuotannon tarkistus. Valitse kaikki, virheet tai huomiot. Ilmoitus näyttää vakavuuden tekstinä, koodin, todellisen viestin ja koodin perusteella annettavan korjausehdotuksen.

Avaa ongelman tapahtuma poistaa kuvataulun haun/suodatuksen, avaa oikean sivun ja kuvan sekä valitsee nykyisen tapahtuman ja siirtää olemassa olevan yhteisen toistokohdan sen alkuun. Tapahtumakohtainen inspector käyttää samaa valintaa kuin muut ohjauspöydän valinnat. Näyttämö, moottori ja projekti eivät muutu.

Koko valmistelun virhettä ei enää sidota mielivaltaisesti ensimmäiseen kuvaan. Poistettuun tapahtumaan osoittava ilmoitus säilyy näkyvissä ilman väärää navigointia. Repliikki, jolta puuttuu AudioClip-viite, näkyy eksplisiittisenä virheenä. Tämä tarkistaa viitteen eikä blobin tai äänen laatua: export preflight pysyy tiedostojen totuuslähteenä.

lib/studio/validation-navigation.ts muodostaa read-only-listan ja ratkaisee navigoinnin nykyisestä esityksestä. ProductionValidationPanel on erillinen uudelleenkäytettävä paneeli. Kohde ratkaistaan jälleen painettaessa; vanhentunut/tuntematon kohde ei navigoi. Ei automaattista korjaamista tai metadatan muutosta, joten undo- tai tallennusmuotoihin ei tarvita uutta skeemaa.

Testit kattavat tapahtuman/kuvan/ruudun valinnan, lähteen muuttumattomuuden, globaalit ja poistuneet kohteet sekä puuttuvan ääniviitteen. Säilytetään .hahmo v1–v5, resurssit ja nykyiset moottorit.

Rajat: ehdotus on koodiin perustuva ohje, ei todistus korjauksen onnistumisesta. Ei automaattista Hahmo-työtilan nivelvalintaa tai äänen tuonti-ikkunan avaamista. Ei uusia lip-sync/color/IK-validaattoreita. Graafista käyttöä, fyysisiä laitteita ja Safaria ei testattu. Koko ammattistudio ei ole valmis. Asennettu app korvataan uudella ZIPistä puretulla KILSAT Studio.app-paketilla vanhan sulkemisen jälkeen.
