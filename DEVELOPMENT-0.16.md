# KILSAT Studio 0.16 — kuvakohtaiset tarkistuskommentit

Tämä vaihe lisää paikallisen review-kierroksen aiemman kuvataulun, hyväksynnän ja lukituksen päälle. Nykyinen editori, moottorit, animaatiot, hahmot, äänet ja .hahmo-versioiden 1–5 lukupolku säilyvät.

## Käyttö

Avaa Animointi-työtilan ohjauspöydän Kuvakortit, valitse kuva ja siirrä toistopää tarkistettavaan kohtaan. Avaa kuvataulun Tarkistuskommentit-osio, kirjoita huomio ja paina Lisää kommentti. Lomake näyttää kuvan nimen ja toistokohdan kuvan alusta. Jos toistopää ei ole valitun kuvan sisällä, kohde rajataan sen sisälle ja näytetään lomakkeessa ennen tallennusta.

Avaa toistokohta valitsee kommentin kuvan ja siirtää saman esikatselun toistopään kohteeseen. Merkitse käsitellyksi sulkee huomion; Avaa uudelleen palauttaa sen avoimeksi. Näytä-valinnalla voi listata avoimet tai kaikki kommentit. Kortissa näkyy avoimien kommenttien määrä. Kommentointi ja käsittely käyttävät valmistelun Kumoa/Tee uudelleen -historiaa ja nykyistä projektitallennusta/palautusvedoksia.

Avoimet kommentit estävät uuden hyväksynnän ja lukituksen. Uusi kommentti tai uudelleenavaus hyväksyttyyn kuvaan palauttaa kuvan luonnokseksi. Kommentin ratkaiseminen ei hyväksy kuvaa automaattisesti. Lukittuun kuvaan voi jättää palautetta, mutta sen lukitusta ei koskaan avata automaattisesti: avaa lukitus itse, jos palaute edellyttää sisältömuutosta. Käsittelytila on paikallisen käyttäjän päätös, ei automaattisesti todennettu korjaus.

Kommentit koskevat valmistelua. Rakenna jakso ennen päivitetyn esityksen vientiä kuten ennenkin. Hyväksyntä/review ei ole pakollinen renderöinnin portti.

## Data ja komennot

`lib/studio/review.ts` määrittää ReviewCommentin ja CommentCommandin. Optional StudioMetadata.reviewComments tallentuu nykyisen Production-mallin sisään skeeman pysyessä versiona 1. Kommentissa ovat UUID, pysyvä shotId, kuvan sisäinen tick-offset, teksti, open/resolved-tila, alkuperäinen sisältörevisionumero sekä luonti-/käsittelyaika. Vanha kommentiton .hahmo ei tarvitse migraatiota.

`commentProduction` tarkistaa kohteen, odotetun sisältörevision, tekstin ja toistokohdan, muodostaa uuden validoidun mallin ja lisää audit-merkinnän. Kommentin käsittely ei muuta sisältörevisionumeroa eikä regeneroi animaatiota. Muutos palautetaan yhtenä valmistelun historiatransaktiona. React-komponentti ei omista tallennettua kommenttidataa.

Kuvan sisäinen offset säilyy ajoituksen muuttuessa. Lyhentyneen kuvan navigointi rajataan viimeiseen käytettävään ruutuun ja käyttöliittymä ilmoittaa rajauksesta; alkuperäistä kommenttikohtaa ei kirjoiteta yli. Poistetun kuvan kommentit säilyvät listassa Poistettu kuva -merkinnällä ja navigointi estetään. Orvon kommentin voi edelleen merkitä käsitellyksi tai avata uudelleen. Käsikirjoituksen uudelleenjäsennyksen säilyneet kuvaidentiteetit säilyttävät kommentin kohteen.

## Rajat

Paikallinen review, ei palvelinta, tekijäidentiteettejä, @mention-ilmoituksia, samanaikaista monen käyttäjän muokkausta, keskusteluketjuja tai kuvaan piirrettyjä annotaatioita. Kommentit esitetään tekstinä eikä HTML:nä.

Enintään 1000 kommenttia esityksessä, 4000 merkkiä per kommentti. Kommentteja ei poisteta automaattisesti. Tällä vaiheella ei lisätty kommenttien muokkaus/poistokäyttöliittymää tai per-kuva-suodatusta; avoin/kaikki-suodatus kattaa valmistelun kaikki kuvat. Toistokohdat ovat kuvansisäisiä, eivät yksittäiseen repliikkiin sidottuja. Erittäin lyhyt alle ruudun kuva ei välttämättä sisällä omaa kokonaista esikatseluruutua. Uudelleenjäsennys ja 0.15:n vaikutusvertailu pysyvät varovaisina.

## Tarkistus

212 kooditestiä läpäisee. Uudet testit kattavat .hahmo-tallennuksen ja avaamisen, kumoamisen, käsittelyn ja uudelleenavauksen, hyväksynnän estämisen/vanhenemisen, lukituksen säilymisen palautetta lisättäessä, kuvan retimingin, lyhennyksen rajauksen, poistuvan kuvan palautteen säilyttämisen sekä virheellisen, liian suuren, vanhentuneen ja kuvan ulkopuolisen datan hylkäämisen.

TypeScript, tuotantorakennukset, Mac-paketointi ja paketoidun runtimen tulokset raportoidaan Kooditestit-0.16.0.md-tiedostossa. Tämä kooditestikierros ei varmista graafista käyttöä, fyysistä kameraa/mikrofonia tai Safari-yhteensopivuutta.
