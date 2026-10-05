# KILSAT Studio 0.25 — tuotantopolun vahvistus ja työjonon jatkokehitys

Vaihe 0.25 on laajempi kokonaisuus: integraatiotesti, tarkistusilmoitusten haku/seuraava kohde, käänteinen lajittelu sekä yhteensopivuus- ja työjonon datatestit. Nykyiset moottorit, resurssit, projekti ja .hahmo v1–v5 säilyvät.

## Tarkistusilmoitukset

Animointi → Kuvakortit → Tuotannon tarkistus. Hae virhekoodista, viestistä tai korjausehdotuksesta ja yhdistä vakavuussuodattimeen. Avaa seuraava ongelman tapahtuma käy nykyisen tuloksen navigoitavat kohteet läpi ja aloittaa lopusta uudelleen. Globaalit ja poistuneet kohteet pysyvät listassa mutta niitä ei arvata kuvakohteiksi. Valittu ilmoitus merkitään aria-current-attribuutilla. Haku/suodatinmuutos aloittaa selaamisen alusta. Tavallinen tapahtuman avaus käyttää samaa yhteistä kuva-/tapahtumavalintaa ja toistokohtaa.

## Käänteinen lajittelu

Lajittele työjono → Käänteinen järjestys. Määräaika, vastuu ja tila voidaan näyttää laskevasti, ja jakson järjestys voidaan kääntää. Puuttuvat työjonotiedot pysyvät lopussa myös laskevassa järjestyksessä. Tasatilanteessa säilyy jakson järjestys. Ei jakson ajoituksen tai sisällön muuttamista. Suodatettu CSV seuraa järjestystä ja yhteismuokkaus kattaa kaikki tulokset.

SavedShotView.descending on valinnainen boolean skeemassa 1. Vanhasta näkymästä puuttuva arvo tarkoittaa nousevaa järjestystä. Tuntemattomat/virheelliset arvot hylätään. Kohdenavigointi palauttaa jakson järjestyksen nousevaksi, tyhjentää haun/suodatuksen ja näyttää oikean sivun.

## Integraatiotarkistus

Yksi testiskenaario kulkee nykyisen parserin ja compilerin tuottamasta mallista vastuiden yhteismuokkaukseen, undo/redo-toimintoihin, palautteen lisäämiseen ja hyväksynnän estoon, kommentin ratkaisuun, hyväksyntään, lukitukseen, .hahmo-tallennukseen/avaamiseen, pysyvien ID:iden ja metadatan tarkistukseen, tallennetun hakunäkymän palautukseen, lajitteluun, CSV-vientiin, kuvakohtaiseen tarkistuslistaan ja render-esitarkistukseen. Sama snapshot tuottaa saman manifestin.

Tämä on koodissa ajettava integraatio, ei graafinen käyttö- tai video/audio-dekoodaustesti. Testi käyttää rajattua fixture-ääntä: preflightin rakenteelliset edellytykset tarkistetaan, ei miksauksen kuuntelua. Nykyiset FFmpeg/QC-testit ovat erillisiä.

500 synteettisen kuvarivin datatesti kattaa lajittelun täydellisyyden, tasatilanteet, puuttuvat tiedot, lähteen muuttumattomuuden ja kaikkien rivien CSV-viennin molemmissa suunnissa. Se ei varmista 500 kuvan reaaliaikaista näyttämörenderöintiä, muistinkäyttöä tai pitkän jakson vientiä. Node/React-markup-testi tarkistaa tarkistuspaneelin nimet, tilaviestit ja disabled-toiminnan ilman selainta.

## Rajat ja toimitus

Ei automaattikorjauksia, tiimikäyttäjiä, uusia moottoreita tai renderformaatteja. Ei graafista editori-/selain-, fyysisiä laitteita tai Safari-testiä tällä kierroksella. Koko ammattistudio ei ole valmis. Tarkistusraportti: Kooditestit-0.25.0.md. Sulje vanha KILSAT Studio, pura uusi Mac-ZIP ja korvaa Ohjelmat-kansion app.
