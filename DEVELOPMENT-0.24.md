# KILSAT Studio 0.24 — työjonon lajittelu

Vaihe 0.24 jatkaa paikallista tuotantoperustaa. Animointi → Kuvakortit → Lajittele työjono. Valinnat: Jakson järjestys, Määräaika (lähin ensin), Vastuuhenkilö (A–Ö) ja Tila (luonnos, hyväksytty, lukittu). Puuttuva vastuu/määräaika tulee viimeiseksi. Tasatilanteessa säilyy jakson alkuperäinen järjestys. Vaihto palauttaa ensimmäiselle sivulle mutta säilyttää valinnan ja toistokohdan.

Lajittelu on read-only-näkymä, ei kuvien uudelleenajoitus tai .hahmo-muutos. Suodatus tapahtuu ennen lajittelua, sivutus sen jälkeen. Yhteismuokkaus koskee edelleen kaikkia suodatettuja kuvia; CSV:n suodatettu vienti seuraa näytön järjestystä. Koko valmistelun CSV säilyttää jakson järjestyksen.

Lajittelu tallentuu nimettyyn hakunäkymään valinnaisena sort-kenttänä skeemassa 1. Vanhat näkymät ilman kenttää palautuvat jakson järjestykseen. Tuntematon lajittelu hylätään ilman automaattista asetusten nollausta. Tämä on paikallinen asetus, ei projektin sisältöä. Tuotantotilanteen tai validoinnin Avaa-kuva-toiminto palauttaa jakson järjestyksen, poistaa haun/suodatuksen ja näyttää oikean sivun, jotta kohde ei piiloudu lajittelun takia.

Testit kattavat määräajan/vastuun puuttuvien arvojen sijainnin, tasatilanteen, statusjärjestyksen, lähdemallin/listan muuttumattomuuden sekä vanhojen ja uusien hakunäkymien yhteensopivuuden. Ei graafista editori-/selain-, fyysisiä laitteita tai Safari-testiä tällä kierroksella. Moottorit, resurssit ja .hahmo v1–v5 säilyvät.

Rajat: yksi lajitteluavain nousevasti, ei monisarakelajittelua, taulukkolaskennan takaisin tuontia tai jakson kuvien järjestyksen muuttamista. Ei laajaa kuormitustestiä. Koko ammattistudio ei ole valmis. Asennus: sulje vanha app, pura uusi Mac-ZIP ja korvaa Ohjelmat-kansion KILSAT Studio.app. Tarkistukset: Kooditestit-0.24.0.md.
