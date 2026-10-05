# Vaihe 0.29 — projektihistoria, käsikirjoitus ja resurssipalautus

5.10.2026. KILSAT Studio 0.29.0. Säilyttää nykyiset moottorit ja .hahmo-tallennusmuodon.

## 1. Raakakäsikirjoitus ja suorat asetukset

Raakakäsikirjoitus julkaistaan projektidataan `script-source`-komentona samalla validate → journal → ack → publish -rajalla kuin muut muutokset. Tekstikentän kirjoittaminen on ensin paikallinen luonnos; yhden sekunnin kirjoitustauko tai **Tallenna käsikirjoitusteksti** lähettää komennon. Epäonnistuminen säilyttää tekstin kentässä. Keskeneräinen teksti näkyy Macin dirty-tilassa. Projektin tallentaminen ja projektin kumoaminen odottavat tekstin tallentamista; käyttäjä voi vahvistaa projektin vaihtamisen hylkäämällä työn tavallisessa vaihtodialogissa.

QuickPanelin näyttämöasetukset käyttävät `commitAnimation`-komentoa. Vanhentuneen async-valmistelun lähtötila tarkistetaan: ehdotus ei saa ylikirjoittaa myöhemmin muokattua dokumenttia tai näyttämöä. Työtilan vaihto ja laitteiden reaaliaikainen esikatselu ovat edelleen tilapäistä UI-tilaa.

## 2. Yksi projektiundo ja palautus

Hahmo/piirto, nivelet, animaatio, näyttämö, ääni, käsikirjoitus ja tuotantokomennot käyttävät samaa kronologista projektihistoriaa. Tuotantopaneelin Kumoa-painikkeet ja pääeditorin Kumoa/Tee uudelleen kohdistuvat tähän historiaan. Undo palauttaa koko projektitilan, myös tuotantoaineistot, ja synkronoi paneelin mallin ja tekstin.

Historia tallentaa journalissa SHA-256-todennettuja snapshot-viitteitä. Undo lukee kohteen levyltä, validoi .hahmo-projektin ja dekoodaa kuvat, kirjoittaa kuittauksen ja julkaisee vasta sen jälkeen. Kadonnut/vioittunut kohde estää kumoamisen. Automaattitallennus ja baseline säilyttävät historian viitteet; siivous ei saa poistaa aktiivisen historian kohteita.

Käynnistyksen **Palauta työ** palauttaa projektin lisäksi viimeiseen journal-tilaan kuuluvan historian. Tavallisen .hahmo-tiedoston avaaminen aloittaa uuden historian; undo-journal ei sisälly siirrettävään .hahmo-tiedostoon. Vanhoille 0.28-vedoksille ei keksitä historiaa. Vioittuneen uusimman tilan fallback voi palauttaa lyhyemmän historian ja näyttää siitä ilmoituksen.

Rajat: enintään 16 historia-viitettä, viitteet yhteensä 384 MiB; journalin kokonaisraja 20 tilaa / 512 MiB ja projektin yksittäinen raja 128 MiB. Vanhimmat kohteet poistuvat rajojen täyttyessä. Nimetyt revisiot ovat erillinen arkisto.

## 3. Pienemmät Mac-journalin kirjoitukset

Yli 128 KiB projektivedokset pilkotaan sisältöön ankkuroiduiksi 16–64 KiB SHA-256-paloiksi. Sama kuvatavu tallennetaan vain kerran; seuraava komento kirjoittaa uuden palaluettelon ja muuttuneet palat. Pieni lisäys ZIPin alkuun ei siirrä kaikkia kuvapaloja uusiksi. Jokainen pala ja rekonstruoidun projektin koko SHA-256 tarkistetaan palautuksessa.

Palaluettelo on sisäinen journal-muoto. Ulospäin palautuu täsmälleen alkuperäinen .hahmo-tavujono. Vanha raakavedos ja pienet vedokset toimivat edelleen. Aktiivisten vedosten yhteisiä paloja ei poisteta siivouksessa.

Tämä ei ole semanttinen komentodelta: editori edelleen serialisoi ja hajauttaa kokonaisprojektin. CPU, muistinkäyttö ja olemassa olevien palojen tarkistus eivät katoa. Yhteisen palan vioittuminen voi vaikuttaa useaan historiatilaan; se havaitaan, mutta alkuperäinen resurssi/varmuuskopio voi olla tarpeen. Selain käyttää IndexedDB-tallennusta ja historiaa, ei tätä Macin levypalajärjestelmää.

## 4. PSD-/luustoresurssien uudelleenkytkentä

Tuotannon resurssipaneeli hyväksyy uuden .hahmo-, PSD- tai PNG-tiedoston. PSD käyttää nykyistä importer-worker-logiikkaa. Olemassa oleva hahmo avaa tasovastaavuuspaneelin: automaattinen ehdotus perustuu vain yksiselitteiseen PSD-ID:hen tai avain+polkuun. Käyttäjä voi valita jokaisen vanhan osan uuden tason käsin.

Vaihto edellyttää täydellistä yksiselitteistä vastaavuutta, samaa piirtoalueen kokoa ja valideja liitoksia. Vanhan hahmon roolit, nivelpisteet, parent-linkit ja animaatioraidat remapataan. Vanha resurssi säilyy, hyväksyntä vanhenee ja lukitus estää vaikuttavan vaihdon nykyisellä komentovalidoinnilla. Koko vaihto on yksi projektin kumottava muutos.

PNG ei erottele raajoja: moniosainen hahmo ei sovi automaattisesti yhteen PNG-tasoon. Jos alkuperäinen rig/profiili puuttuu, korvaajalta vaaditaan valmis .hahmo-profiili. Eri kokoinen piirtoalue, eri anatomian automaattinen retarget ja siirrettyjen olkapäiden/lonkkien automaattinen pivot-korjaus eivät ole valmiita. Säilytetyt nivelpisteet pitää tarkistaa Hahmo-työtilassa.

## Tarkistukset ja seuraava työ

Kooditestit kattavat yhteisen historian järjestyksen, branch/redo-tyhjennyksen, viite-/kokorajat, prosessin uudelleenkäynnistyksen, aktiivisten viitteiden säilymisen siivouksessa, sisältöpalojen uudelleenkäytön ja korruption, vanhan raakavedoksen fallbackin sekä käsin valitun PSD-tasomappingin ja sen atomisen hylkäyksen. Paketoitu Electron-runtime tarkistaa myös historian ja palavedoksen palautuksen.

GUI-, Safari-, IndexedDB:n fyysisen levyn, laitteen tai virtakatkoksen koetta ei tehty. Uusi UI tarkistettiin koodissa, ei interaktiivisessa selaimessa. Mac-paketointi erotetaan oikeasta graafisesta käynnistyksestä toimitusraportissa.

Seuraava arkkitehtuurityö: semanttiset pienet komentopayloadit/inkrementaalinen serialisointi, siirrettävä historia projektipaketissa, pidempien projektien muisti-/suorituskykytestit ja eri geometrioiden hallittu retarget.
