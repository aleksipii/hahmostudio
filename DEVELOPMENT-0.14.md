# KILSAT Studio 0.14 — revisiot, paikallinen hyväksyntä ja palautuva vientijono

Nykyiset moottorit, resurssit ja .hahmo-versioiden 1–5 lukeminen säilyvät. Tämä vaihe jatkaa 0.13:n tuotantoperustaa. Se ei ole valmis tiimistudio eikä muuta nykyistä valmistelu → Rakenna jakso → vienti -työnkulkua.

## Nimetyt projektiversiot

Mac-sovelluksessa Tiedosto → Projektin versiot → anna nimi → Tallenna versio tallentaa avoimen projektin täyden .hahmo-vedoksen, mukaan lukien projektissa mukana olevat repliikkiäänet. Se ei korvaa käyttäjän projektitiedostoa. Avaa versio tarkistaa SHA-256:n ja käyttää nykyistä projektin avaamista sekä tallentamattoman työn varmistusta. Poisto vaatii oman vahvistuksensa; muiden versioiden jakamaa resurssia ei poisteta.

Valinnainen `Scene.studioProjectId` tunnistaa projektin myös avaamisen ja tallennuksen jälkeen. Vanha projekti saa tunnisteen avattaessa; pysyvyys edellyttää sen tallentamista uuteen tiedostoon. Projektin kopio säilyttää tunnisteen ja saman historian — erillistä Haarauta projektiksi -toimintoa ei vielä ole.

`desktop/revisions.mjs` ja `archive-store.mjs` tallentavat sisällön SHA-256-nimisiksi muuttumattomiksi tiedostoiksi käyttäjätietohakemiston `project-revisions`-kansioon. Tiedostot synkronoidaan levylle ennen atomista indeksin vaihtoa. Enintään 1000 nimettyä versiota ja 2 GiB arkistotilaa. Jokainen vedos enintään 128 MiB. Rajan täyttyminen ilmoitetaan, vanhoja nimettyjä versioita ei poisteta automaattisesti. Versioarkisto on paikallinen; projektin mukaan paketoitu resurssimanifesti säilyy.

Kahden automaattipalautusvedoksen toiminta säilyy erillisenä. Nimetyt versiot eivät ole inkrementaalinen journal tai sovelluksen uudelleenkäynnistyksen yli jatkuva undo. Selainversion versiohistoriapainike ilmoittaa Mac-edellytyksen eikä esitä toimintoa valmiina.

## Muokkauskomennot ja kuvan hyväksyntä

`editProduction` koostaa tavallisen ohjauspöydän muokkauksen ja tarkistaa lukitusristiriidat ennen mallin julkaisemista. Odotetun revision tarkistus estää vanhentuneen muutoksen. Aiempi äänenvaihtotransaktio säilyy. Käsikirjoituksen Kumoa/Tee uudelleen palauttaa valmistelun mallin ja ääniviittaukset.

Kuvakortti/kuvaluettelo tarjoaa Hyväksy kuva → Lukitse kuva → Avaa lukitus. Hyväksyntä sallitaan luonnokselle, jonka adapterissa ei ole virheitä eikä puuttuvia repliikkiääniä. Hyväksyntä on käyttäjän tarkistuspäätös, ei automaattinen taiteellisen laadun sertifiointi. Lukitus edellyttää voimassa olevaa hyväksyntää. Avaaminen vahvistetaan ja palauttaa tilan luonnokseksi.

`reviewShot` tallentaa tilan, hyväksytyn sisältörevision ja muutosmerkinnän muuttamatta sisältörevision numeroa. Sisältömuutos kasvattaa revision ja vanhentaa hyväksynnät. Tila tallentuu .hahmo-projektiin ja kumoutuu yhtenä historia-askeleena. Lukittu kuva estää tässä vaiheessa konservatiivisesti koko esityksen sisältömuutoksen; kuvakohtaista vaikutusgraafia ei toteutettu. Käyttöliittymä kertoo tämän rajan.

Review on paikallinen ensimmäinen vaihe: ei käyttäjäidentiteettejä, kommentteja, assignmentia, määräaikoja tai tiimien samanaikaista muokkausta. Valmistelun hyväksyntä ei ole renderöinnin pakollinen portti. Renderöintisopimus tarkistaa edelleen juuri rakennettavan projektivedoksen; hyväksynnän ja kaikkien ulkoisten resurssiversioiden täydellinen riippuvuussidonta on jatkotyö. Kaikkien editoriosien historioita ei yhdistetty.

## Kaatumisen jälkeen palautuva Mac-vientijono

`DurableExportQueue` säilyttää vientityön, asetukset, kohteen, render-manifestin ja jäädytetyn projektivedoksen `render-queue`-hakemistossa. Vedos ja jonon checkpoint kirjoitetaan ennen renderöinnin käynnistämistä. Jonon kirjoitukset sarjoitetaan. Vain sovelluksen omat viitteettömät tilannekuvat siivotaan; vientitiedostoja ei siivota.

Kesken sovelluksen päättymisen olleet työt palautuvat tilaan Keskeytynyt. Ne eivät käynnisty automaattisesti. Avaa vientipaneeli ja paina Yritä uudelleen. Uudelleenyritys renderöi alkuperäisen vedoksen alusta, ei jatka puolivälin ruudusta. Nykyisen projektin muokkaaminen ei muuta jonossa olevaa vedosta. Vedoksen SHA-256 tarkistetaan ennen workerin käynnistymistä; worker tarkistaa semanttisen render-manifestin uudelleen.

Olemassa olevan videon korvaamisesta kysytään ja vanha video säilyy tarkistettuun uuteen tulokseen asti. Olemassa olevaan PNG-kansioon ei jatketa: luo uusi työ uuteen kansioon. Sovellus-/moottoriversion muutos voi estää vanhan vedoksen renderöinnin: avaa projekti ja luo uusi työ nykyisellä versiolla. Valmiin työn vedos vapautetaan ja tuloksen tiedostopolku säilyy historiassa.

Enintään 20 historian työtä, neljä jonossa/aktiivisena, 256 MiB keskeneräisten tai epäonnistuneiden vedosten laskennallinen kokonaisraja ja 512 MiB levyllä. Yksi renderöinti kerrallaan. Virhe-/keskeytyneet työt säilyvät, kunnes käyttäjä poistaa ne. Vioittunutta indeksiä ei korvata hiljaisesti. Levyn kirjoitusvirhe estää uuden työn käynnistyksen ja näytetään vientipaneelissa. Automaattista vioittuneen indeksin korjausta ei vielä ole.

## Todennettu ja rajat

204 kooditestiä läpäisee, mukaan lukien nimettyjen revisioiden palautus ja eristys, jaettujen vedosten poisto, tarkistussummavirhe, kiintiö, renderjonon palautus ilman automaattikäynnistystä, alkuperäisen vedoksen uusinta, kirjoitusvirheen estämä dispatch, virheellisen indeksin hylkäys ja hyväksyntä/lukitus/transaktiohistoria. TypeScript-tarkistus läpäisee.

Mac-paketointi ja paketoidun runtimen tarkistus raportoidaan toimituksen Kooditestit-0.14.0.md-tiedostossa. Graafista käyttöä, fyysistä kameraa/mikrofonia tai Safaria ei tällä kooditestikierroksella kokeiltu. Keskeytys simuloitiin uudelleen avatulla levyvarastolla, ei sähkökatkolla. Monen prosessin samanaikaista arkistokirjoitusta ei tueta; Mac-sovellus käyttää olemassa olevaa yhden instanssin lukkoa.
