# Vaihe 0.28 — pysyvä kirjoitus ennen muutoksen julkaisua

4.10.2026. KILSAT Studio 0.28.0. Nykyinen React/Electron-rakenne, animaatio- ja käsikirjoitusmoottorit sekä .hahmo-yhteensopivuus säilyvät.

## Toteutettu järjestys

1. `DurableCommandGate` estää rinnakkaisen muokkaustransaktion ja validoi ehdotuksen.
2. Editorissa `prepareEditorEdit` validoi nivelhierarkian ja animaation; `readScene` validoi näyttämön. Tuotantokomento käyttää lisäksi olemassa olevaa `executeProductionCommand`-validointia, revisioita, vaikutustarkistuksia ja lukituksia.
3. Ehdotettu kokonaisprojekti pakataan nykyisellä `saveProject`-serialisoijalla. Nykyinen näkyvä sisältö ja kumoamishistoria säilyvät ennallaan.
4. Macin RecoveryStore kirjoittaa muuttumattoman .hahmo-vedoksen, fsync-varmistetun checksum-commitin ja atomisesti vaihdettavan indeksin. Hakemisto fsyncataan ennen kuittausta. Komentovedoksella on UUID ja laji; samat projektitavut eivät yhdistä kahta eri komentoa.
5. Electron-kuittauksen komento-ID, SHA-256, tavumäärä ja päivämäärä tarkistetaan. Väärä tai puuttuva kuittaus estää julkaisun.
6. Vasta kuittauksen jälkeen päivitetään React-projektitila ja historia. Kumoa/Tee uudelleen eivät poista historiasta kohdetta ennen onnistunutta kirjoitusta.

Tämä on **projektivedoksiin perustuva ennen julkaisua kirjoitettava komentojournal**, ei semanttisten komentopayloadien replay-moottori. Palautus avaa viimeisen vahvistetun tilan eikä suorita parseria, puheanalyysia tai muita moottoreita uudelleen. Sovelluksen kaatuminen kuittauksen jälkeen mutta ennen React-julkaisua voi jättää muutoksen vain palautuspisteeseen; tämä ikkuna on testattu palvelutasolla. Kirjoitusvirhe estää näkyvän muutoksen, mutta jos virhe tapahtuu commit-tiedoston syntymisen jälkeen, palautuksessa voi löytyä jo kirjoitettu ehdotus. Virhe ei lupaa levyllä olevan ehdotuksen peruuttamista.

## Katetut reitit

- `commitEdit`: tasot/piirron tallennus, näkyvyys, nivelmuokkaus, nivel-/animaatiotuonti ja QuickProfile.
- `commitAnimation`: avainruudut, IK/kävely/huulisynkronoinnin tulokset, näyttämö, kuvakulma, tallennetut kamera-/mikrofoniesitykset, ääniraidan lisäys/vaihto/poisto.
- Molempien editorihistorioiden undo/redo.
- PresentationPanelin `update`: tapahtumat, tuotannon äänen vaihto/rajat/suu, tehtävät/yhteismuokkaus, kommentit, review/hyväksyntä/lukitus sekä resurssien palautus/vaihto.
- Käsikirjoituksen tulkinnan valmis ehdotus, tuotannon undo/redo ja hahmon sidonta. Resurssin lataus valmistellaan ennen näkyvää sidontaa.
- Valmistellun tuotannon ja valmiin kohtauksen siirto pääeditoriin tallentaa myös resurssikartan samassa ehdotuksessa.

Tuotannon ensimmäinen käsikirjoitus voidaan tallentaa tyhjään, nykyisellä formaatilla luettavaan projektipohjaan. Puuttuvia hahmoja/ääniä ei merkitä valmiiksi. Palautusbannerin palautus/hylkääminen pitää ratkaista ennen uuden komentojournalin kirjoittamista.

Vanha tausta-autosave säilyy vielä katteensa ulkopuolisille muutoksille; se ei saa aloittaa vanhan vedoksen kirjoitusta komentotransaktion aikana. Muutoksen aikana vaihtunut lähtötila estää ehdotuksen julkaisun.

## Mitä edelleen puuttuu

- Kaikkien muutosten yksi ProjectStore/CommandService: editorissa on edelleen erilliset edit-, animaatio- ja tuotantohistoriat.
- Raakakäsikirjoituksen kirjoitus, osa QuickPanelin suorista näyttämöasetuksista, projektin/PSD:n avaaminen ja kirjaston projektivaihdot eivät ole samalla komentotransaktiopolulla. Laitteen reaaliaikainen esikatselu on tarkoituksellisesti tilapäistä; tallennettu tulos käyttää komentoreittiä.
- Tyhjän uuden kohtauksen UI-valinta ja keskeneräiset tekstikentät eivät ole kuitattuja tuotantokomentoja.
- Undo/redo-pinot eivät palaudu sovelluksen käynnistyessä: palautuu projektitila, ei koko editorihistoria.
- Komentopayload, lähtörevision hash ja pienet delta-tallennukset; nyt jokainen hyväksytty komento kirjoittaa täyden projektivedoksen. Suuri PSD ja jatkuva numerokentän muokkaus voivat tehdä kuittauksesta hitaan. Rinnakkainen muokkaus torjutaan, ei jonoteta vanhentuneita ehdotuksia.
- Journalin historia on rajattu 20 tilaan / 512 MiB; yksittäinen vedos enintään 128 MiB. Nimetyt revisiot ovat erillinen arkisto.
- Yleinen raw-PSD/rig-uudelleenkytkentä, käsin ratkaistava puuttuva taso ja eri luuston retarget ovat kesken.
- Selain käyttää IndexedDB:n transaction-oncomplete-rajaa; Macin fsync-lupausta ei uloteta selaimeen. Fyysistä virtakatkoskoetta, levyn vikatilaa, GUI- tai Safari-koetta ei tehty.

## Kooditestit

254 testiä läpäisi, ei epäonnistuneita tai ohitettuja. Uudet testit todentavat odottavan kuittauksen, validointi-/levyvirheen, rinnakkaisen komennon torjunnan, historian säilymisen virheessä, väärän hash/ID-kuittauksen, saman sisällön eri command-recordit, kuittauksen jälkeisen renderer-katkosikkunan ja aidon .hahmo-tuotantoehdotuksen palautuksen ennen julkaisua. Aiemmat lukitus-, audio-, render-, palautus-, revisio- ja tallennustestit säilyvät.

Tyyppitarkistus ja paketointi raportoidaan toimituksen Kooditestit-0.28.0.md-tiedostossa. Graafista käynnistystä ei päätellä onnistuneesta paketoinnista.
