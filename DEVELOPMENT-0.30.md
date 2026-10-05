# KILSAT Studio 0.30 — tallennuksen jatkokehitys ja liikesovitus

5.10.2026. Nykyistä React/TypeScript/Electron-editoria ja .hahmo v1–v5 -lukua säilyttävä lisäys.

## Toteutus

- Inkrementaalinen resurssiserialisointi: muuttumattomien Blob-resurssien tavut, SHA-256 ja ZIP-tietueiden CRC/otsakkeet käytetään uudelleen WeakMap-välimuisteista. Muuttumattomien kohtausnäyttelijöiden pakettiserialisointi käyttää dokumentti/animaatio-identiteetin välimuistia. ZIP muodostuu Blob-osista eikä joka komennon yhtä suurta zipSync-työpuskuria tarvita. ZIP-aika on vakio ja tiedostojärjestys järjestetty. Projektin metadata serialisoidaan edelleen, ja IPC tarvitsee lopullisen tavujonon. Resurssien on oltava immuuttisia; muutokselle uusi Blob/dokumentti/animaatio.
- Semanttiset komentodeltat: journalin projektivedos sisältää command-delta.json-tiedoston: version, lähtö- ja tulosmetadatan SHA-256 sekä polkukohtaiset before/after-muutokset. Taulukkomuutokset tallennetaan atomisesti taulukkona. Deltan uudelleentoiston tulos tarkistetaan ennen pysyvää tallennusta. Väärä lähtötila, prototype-polut ja puuttuvat vanhemmat estävät replayn. Komennon koko varmennettu checkpoint ja aiempi sisältöpalajournal säilyvät palautuksen varmistuksena; tämä ei ole pelkkiin deltoihin perustuva journal eikä IPC-siirtomäärän täydellinen eliminointi.
- Siirrettävä historia: projektin tallennus pakkaa paikallisen journalin past/future-vedokset .hahmo-arkistoon ja resurssimanifesti kattaa ne. Avaus tarkistaa vedokset ja tuo ne paikalliseen journaliin ennen historiaan kytkemistä. Undo/redo käyttää nykyistä kuittausreittiä. Enintään 16 tilaa ja koko paketin 128 MiB raja; liian suuri historia estää tallennuksen selkeällä virheellä, eikä tiloja poisteta huomaamatta. Historiavedokset eivät sisällä lisää historiaa. Vanha .hahmo ilman historiaa avautuu kuten ennen. Historian mukana voi kulkea poistettua mediaa/käsikirjoitusta: kyse on käyttäjän projektitiedostosta, ei julkaisuvideosta.
- Luustojen liikesovitus: valmistellun .hahmo-korvaajan rig säilyttää omat pivotit/jointit/vanhemmat. Semantic QuickProfile -roolit ja kuvakulmaroolit ehdottavat yksiselitteisiä osavastaavuuksia. Käyttäjä tarkistaa/muuttaa mappingin. Paikalliset siirtymät sovitetaan vastaavien luustosegmenttien pituuksien suhteella; juuren siirtymä käyttää piirtoalueiden geometrisen keskimitan suhdetta. Rotation, easing, ajoitus, scale ja opacity säilyvät. Väärät roolit, duplikaatit, puuttuvat animoidut osat ja erilainen liitosketju estävät sovituksen.
- Raaka-PSD:n uudelleenkytkentä sallii eri piirtoalueen koon eksplisiittisellä tasovastaavuudella. X/Y-pivotit, joints ja siirtymät skaalataan akselikohtaisesti; lähteen tiedot päivitetään kohdekokoon. Piirros/vanhat resurssit eivät muutu. Tämä ei tunnista raajoja kuvan sisällöstä.

## Rajat

Erimääräisiä luita, erilaisia ketjuja, FK/IK-retargetia, kontaktipisteitä ja automaattista jalkalukituksen uudelleenratkaisua ei toteutettu. Muuttunut anatomia voi vaatia käsin tehdyn liike-/rig-korjauksen; tarkista tulos ennen hyväksyntää. Rig mappingin ehdotus ei ole lupa vaihtaa resursseja automaattisesti.

Historia siirtyy pääeditorin Tallenna/Tallenna nimellä -reitin mukana. Render-checkpointit, hahmokirjaston sisäiset paketit ja sarjan erillinen formaatti eivät automaattisesti sisällä editoriundoa. Avaus tuo historian paikalliseen journaliin; tuonnin I/O-virhe ei julkaise uutta näkyvää projektia, mutta osa tuonticheckpointeista voi olla journalissa. Tuonti ei ole usean tiedoston atominen filesystem-transaktio.

Deltojen ainoa tallennusformaatti ei vielä korvaa checkpointia. Metadata/taulukoiden serialisointi, koko loppupaketin IPC/hajautus ja portable-historian vedostiedostojen kopiointi jäävät kustannuksiksi. Historiapaketti ei deduplikoi eri vedosten resursseja; Mac-journalin sisältöpalat deduplikoivat. ZIP- ja resurssivälimuistit eivät pysy prosessin uudelleenkäynnistyksen yli.

Koodi-/pakettitestit raportoidaan erikseen. Graafista käynnistystä, selainta, fyysisiä laitteita, oikeaa virtakatkosta tai satojen kuvien rasitustestiä ei tehty.
