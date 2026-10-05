# KILSAT Studio 0.27 — palautusjournal, editorin transaktiot ja hahmopaketin uudelleenkytkentä

Lähtö: käyttäjän prioriteettilistan must-have-kohdat komennot/transaktiot, journal/recovery ja relinking. Tässä ei oteta käyttöön uutta studioformaattia eikä muuteta .hahmo-muodon tarkoitusta. Nykyiset moottorit ja käyttäjän resurssit säilyvät.

## Macin palautusjournal

RecoveryStore kirjoittaa fsync-varmistetun muuttumattoman .hahmo-tilannekuvan, sen jälkeen itsenäisen commit-JSONin (sekvenssi, snapshotin SHA-256/koko/nimi/aika ja commitin oma SHA-256), ja lopuksi nykyisen kahden snapshotin hakemiston atomisesti. Uudelleenkäynnistys muodostaa palautusjärjestyksen valideista commit-merkinnöistä. Puuttuva/vioittunut/stale hakemisto ei estä ehjän commitin löytämistä. Snapshotin tavut tarkistetaan ennen palautusta; uusin vioittunut johtaa edelliseen ehjään. Keskeneräistä snapshotia ilman validia commitia ei palauteta. Polkuviitteet ovat rajattuja omiin tiedostonimiin, ei käyttäjän mielivaltaisiin polkuihin.

Journal säilyttää enintään 20 vahvistettua tilaa ja 512 MiB; yksittäinen vedos enintään 128 MiB. Kahden uusimman vanha palautusindeksi säilyy yhteensopivana. Vain palautushakemiston omat journal/snapshot-tiedostot siivotaan. Vioittunut indeksi ilman validia commitia on edelleen virhe. Banneri kertoo uudelleen rakennetusta journal-palautuksesta. Webin nykyinen IndexedDB-kahden vedoksen palautus säilyy.

Tämä on kokonaisen projektitilan replay vahvistetusta tallennuksesta, ei kaikkien semanttisten komentojen WAL ennen editorin muutoksen julkaisua. Nykyinen 2,5 sekunnin autosave sekä tuotantoluonnoksen 1 sekunnin siirtoviive säilyvät: ennen durable committia tapahtunut muutos voi yhä kadota. Takuuta jokaisesta näppäinpainalluksesta tai virtakatkosta ei anneta. Täydellinen per-command durability/replay ja hakemistofsync/virtakatkosvarmennus ovat jatkotyötä.

## Editorin komentokattavuus

prepareEditorEdit validoi dokumentin tasovastaavuuden, rig-hierarkian ja animaatioradat ennen commitEditin tilan/historian muuttamista. Nivelmuokkaus, nivel-JSON-tuonti, animaatio-JSON-tuonti ja QuickProfile-asetukset kytketään nykyiseen dokumenttitransaktioon. Näyttämöasetukset ja projektin äänituonti käyttävät nykyistä animaatiotransaktiota ja ovat kumottavia. Import ei enää nollaa aiempaa historiaa. Virheellinen nivelkehä/orpo rata hylätään ennen julkaisua.

Dokumentin avaaminen, kameran live-preview, kaikki live-liukusäätimet ja uuden käsikirjoituksen parseri eivät vielä ole yksi yhteinen typed command -järjestelmä. Kahden nykyisen editorihistorian ja tuotantohistorian yhdistäminen yhdeksi projektipalveluksi on jatkotyötä.

## Hahmo-/PSD-/rig-paketin vaihto

Käsikirjoituksesta jaksoksi → Tuotannon resurssit ja komentohistoria → Vaihda PSD/rig-hahmopaketti (.hahmo). Valitse PSD:stä tallennettu rigattu paketti. Uusi resurssi saa SHA-256-pohjaisen erillisen tunnisteen; vanhaa pakettia ei ylikirjoiteta. Alkuperäiset rig-pisteet, parent-suhteet ja avainruudut luetaan uuden dokumentin tasoihin nykyisellä readAnimation/readRig-mapperilla: PSD-ID ensin, ilman sitä avain ja polku. Semanttiset QuickProfile-roolit, kuvakulmat ja kytkintasot remapataan samoihin vastaavuuksiin.

Eri dokumenttikoko, puuttuva tai moniselitteinen taso estää vaihdon. Ei arvailua nimen perusteella. Vanhat avainruudut eivät korvaudu tuodun paketin esimerkkiliikkeillä. Hahmosidonnan vaihto kulkee compilerin ja shot-impactin kautta; hyväksyntä vanhenee ja lukittu kuva estää muutoksen. Undo/redo palauttaa mallin, äänet ja koko resurssikartan; mediaoliot säilyvät viitteinä ilman DOM-olioiden structuredClonea. Async-käsittely tarkistaa mallin vaihtumisen ennen hyväksyntää, UI vahvistaa muutoksen.

Tämä käsittelee .hahmo-paketoituja PSD/rig-resursseja. Raaka PSD pitää ensin tuoda editoriin ja tallentaa hahmopaketiksi. Erilaisten luustojen automaattinen semanttinen retarget, uusi pivot-geometria, poistuneiden tasojen manuaalinen mapping-paneeli ja samasta paketista eri rigivariantteja eivät sisälly. Jos alkuperäinen paketti puuttuu kokonaan, käyttäjän vahvistama korvaava paketti voi luoda uudet sidokset, mutta vanhan puuttuvan rig-geometrian säilymistä ei väitetä.

## Tarkistus ja toimitus

Kooditestit kattavat puuttuvan/vioittuneen palautusindeksin rekonstruoinnin, keskeneräisen snapshotin ohituksen, corrupt commitin ohituksen, checksum-fallbackin ja journalin 20 tilan rajan. Hahmopaketin testi kattaa vanhat radat, vanhan resurssin säilymisen, hyväksynnän vanhenemisen ja undo/redo-kartan; väärä geometria ja lukitus estävät vaihdon. Editoritesti kattaa nivelkehän/orporadan atomisen hylkäyksen.

Ei graafista editori-/selain-, fyysisiä laitteita tai Safari-testiä; ei tosiasiallista OS-virtakatkoskoetta. Koko ammattistudio ja yllä nimetyt täyden kattavuuden puutteet eivät ole valmiita. Sulje vanha KILSAT Studio, pura uusi Mac-ZIP ja korvaa Ohjelmat-kansion app. Tarkistusraportti: Kooditestit-0.27.0.md.
