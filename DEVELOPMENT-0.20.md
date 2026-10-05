# KILSAT Studio 0.20 — työjonon yhteismuokkaus

Vaihe 0.20 jatkaa paikallista tuotantotyöjonoa. Animointi → Kuvakortit → Muokkaa työjonoa yhdessä. Haku ja suodatus määrittävät kohteet kaikilta sivuilta. Rajaa kohteet ensin; painike näyttää määrän ja vahvistus muutettavat tiedot.

Vastuuhenkilölle ja määräajalle erikseen: Säilytä nykyinen, Aseta kaikille tai Tyhjennä kaikilta. Säilyttäminen ei kopioi ensimmäisen kuvan arvoa muille. Muutos on yksi undo-transaktio; animaatio, lukitukset, hyväksyntä ja sisältörevisio säilyvät. Tallenna projekti säilyttää tiedot nykyiseen .hahmo-muotoon.

assignShotTasks validoi koko ID-joukon, revision ja arvot ennen kopiomallin julkaisemista. Tuntematon tai toistuva kohde estää koko muutoksen. Sama aikaleima kaikille muuttuville merkinnöille; nykyinen metadata-validointi ja 2500 merkinnän raja säilyvät. Tyhjä kenttä tyhjentää vain kyseisen tiedon. Molempien poistaminen poistaa oman merkinnän. Orpotiedot säilyvät.

Uudet kooditestit kattavat atomisen hylkäyksen, erillisten kenttien säilyttämisen, tyhjennyksen, koskemattomat kohteet, lukituksen ja hyväksynnän säilymisen, alkuperäisen muuttumattomuuden ja koko muutoksen kumoamisen. Tarkistusraportti sisältää build- ja runtime-tulokset.

Rajat: kohteet valitaan haulla/suodatuksella, ei erillisillä monivalintaruuduilla. Ei tiimirooleja, palvelinta tai ilmoituksia. Koko ammattistudio ei ole valmis. Graafista käyttöä, fyysisiä laitteita tai Safaria ei testata tällä kierroksella. Asennettu app ei päivity lähteestä: sulje vanha, pura uusi ZIP ja korvaa Ohjelmat-kansion KILSAT Studio.app.
