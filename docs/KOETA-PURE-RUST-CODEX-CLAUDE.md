TOIMEKSIANTO: KOETA — PURE RUST -ANIMAATIOSTUDIO

Rakenna nykyisen aleksipii/hahmostudio-repositorion pohjalta Koeta-niminen
natiivi työpöytäsovellus. Sovelluksen päätyönkulku on:

englanninkielinen käsikirjoitus → hahmokohtaiset Kokoro-äänet →
äänen mukaan ajoitetut repliikit ja huulisynkka → muokattava 3D-animaatio →
leikkaus ja englanninkieliset tekstitykset → tallentuva sarjaprojekti ja MP4.

Koeta yhdistää samaan sovellukseen:
1. Adobe Character Animatorin kaltaisen hahmoesityksen työnkulun.
2. Photoshopin kaltaiset animaatiohahmojen tarvitsemat kuvaeditointityökalut.
3. Videoeditorin aikajanan, äänen, leikkaukset ja viennin.
4. Käsikirjoituksesta rakennettavan, muokattavan 3D-animaation.
5. Sarjojen, jaksojen, hahmojen ja omien äänitysten pysyvän tallennuksen.

Tee oma alkuperäinen käyttöliittymä ja toteutus. Adobe-tuotteet ovat
toiminnallisia vertailukohteita; älä kopioi niiden grafiikkaa, tunnuksia,
lähdekoodia tai täsmällistä käyttöliittymää.

Älä lupaa koko Adobe-tuoteperheen ominaisuuspariteettia yhdellä toimituksella.
Tee mitattava ominaisuuslista ja toteuta se vaiheittain. Jokaisen vaiheen pitää
tuottaa toimiva, testattava kokonaisuus.


ENSISIJAINEN KIELI JA PUHETYÖNKULKU

Koetalla tehdään ensisijaisesti englanninkielisiä animaatiosarjoja ja jaksoja.
Käyttöliittymä voi säilyä suomenkielisenä. Suomenkielisen käyttöliittymän ja
nykyisen FI-tuen säilyttäminen ei saa heikentää englanninkielistä tuotantoa.
Suomenkielinen puhesynteesi ei ole tämän toimeksiannon päätavoite.

Kokoro on ensisijainen paikallinen puhesynteesimoottori.
- Jokaiselle hahmolle valitaan pysyvä ääni sarjan asetuksissa.
- Äänivalinnat ja tuotetut repliikit säilyvät projektissa.
- Muuttumattomia repliikkejä ei syntetisoida uudelleen tarpeettomasti.
- Repliikin muutos mitätöi vain siihen liittyvän puhevälimuistin.
- Välimuistiavain huomioi tekstin, äänen, malliversion ja synteesiasetukset.
  Äänen tai mallin muutos mitätöi vain siitä riippuvat tulokset.
- Kohtauksen ajoitus mukautuu todellisen puheen kestoon.
- Huulisynkka sidotaan tuotettuun ääneen.
- Käyttäjän oma äänitys tai tuotu ääni on aina synteettisen äänen edellä.
- Synteettinen puhe merkitään projektin metatietoihin.
- Malli ladataan käyttäjän luvalla; latauksen jälkeen puhe toimii offline.
- Mallipainot säilyvät mallivarastossa; projektin mukana tallennetaan tuotetut
  ääniresurssit ja niiden alkuperätiedot, ei mallipainoja.

ENSIMMÄINEN HYVÄKSYTTÄVÄ JAKSO

Tee lyhyt englanninkielinen jakso, jossa:
1. Vähintään kaksi hahmoa puhuu eri Kokoro-äänillä.
2. Repliikit ohjaavat huulisynkkaa ja kohtauksen ajoitusta.
3. Hahmot liikkuvat ja kamera vaihtaa kuvakokoa.
4. Jakso tallentuu sarjaprojektiin kaikkine ääniresursseineen.
5. Projekti avautuu uudelleen ilman puheen uudelleengenerointia.
6. Englanninkieliset tekstitykset seuraavat repliikkien ajoitusta.
7. MP4 sisältää toimivan kuvan, puheen ja tekstitykset.

Todellinen Kokoro-synteesi, kuuntelu ja äänen sekä suun yhteistoiminta pitää
testata. Pelkkä simuloitu puhe ei täytä hyväksyntää.

1. NYKYINEN KOODIPOHJA JA TYÖN ALOITUS

Lähtökohta on aleksipii/hahmostudio. Tunnettu lähtötilanne 12.10.2026 on
commit bb225e2, mutta tarkista todellinen paikallinen ja etärepositorion tila.
Älä oleta, että tämä commit on edelleen uusin.

YHTEINEN PÄÄHAARA

Käyttäjän vahvistama haaratilanne: main on ainoa jäljellä oleva yhteinen
päähaara. Älä luo uudelleen hahmostudio1.0-haaraa tai toteuta kahteen
päähaaraan tehtäviä päivityksiä. Vanhojen ohjeiden tällaiset kohdat ovat
vanhentuneet; tämä käyttäjän ohje korvaa ne. Säilytä historialliset handoffit
historiallisina, mutta päivitä aktiiviset työohjeet vastaamaan main-käytäntöä.
Tarkista todellinen etätila ennen Git-toimia. Mahdolliset tehtävähaarat ovat
väliaikaisia työn eristämistä varten, eivät uusia pysyviä päähaaroja.
Tämä ohje ei itsessään valtuuta pushia, yhdistämistä tai haarojen poistoa.

Lue ennen muutoksia:
- AGENTS.md
- TIIMI.md
- native/README.md
- native/PARITEETTI.md
- native/Cargo.toml ja Cargo.lock
- nykyisen tehtävän kannalta olennaiset cratejen lähdekoodit
- TypeScript/Electron-toteutuksen vastaavat moduulit ja testit.

Tarkista Git-haara, HEAD, paikalliset muutokset ja olemassa olevat käyttäjän
tiedostot. Noudata repositorion handoff-ohjeita. Älä resetoi, ylikirjoita tai
poista muiden työtä.

Käytä pilvitehtävän olemassa olevaa eristettyä checkoutia. Älä luo Git-worktreea
ilman käyttäjän nimenomaista pyyntöä.

Nykyinen native/-työtila sisältää:
- hs-core: aikapohja, aikajana ja diagnostiikka
- hs-script: käsikirjoitusjäsennin
- hs-motion: luuranko, IK, liikkeet ja toisioliike
- hs-character: parametriset 3D-hahmot
- hs-render: GPU/CPU-renderöinti ja vienti
- hs-lipsync: visemit ja huulisynkka
- hs-voice: paikallinen Kokoro-puhe
- hs-audio: toisto ja mikrofonikaappaus
- hs-camera: kamerakaappaus ja nykyinen pään seuranta
- hs-hahmo: olemassa olevien .hahmo-projektien luku
- hs-agents: sovelluksen agenttiputki
- hs-cli: komentorivityökalut
- hs-app: egui/eframe-työpöytäsovellus.

Hyödynnä tätä rakennetta. Älä aloita rinnakkaista sovellusta tyhjästä tai
kirjoita toimivia moduuleita uudelleen ilman perusteltua tarvetta.

Tunnetut nykyiset rajoitukset:
- Natiivi sovellus ei vielä tarjoa täydellistä siirrettävää projektitallennusta.
- .sarja-tallennus puuttuu natiivista.
- Kokoro tuottaa englantia; suomenkielistä puhetta ei saa väittää toimivaksi.
- Macin Metal-, kamera-, mikrofoni- ja aito Kokoro-hyväksyntä ovat avoimia.
- Kameran nykyinen seuranta ei vastaa MediaPipen kasvopisteitä.
- PSD-tuonti, palikkaeditori ja Mac-paketointi ovat keskeneräisiä tai puuttuvat.
- Electron säilytetään, kunnes native/PARITEETTI.md:n poistoehdot täyttyvät.

Tarkista jokainen havainto koodista ennen kuin rakennat sen varaan.


2. PURE RUST -RAJAUS

Sovelluksen tuotantologiikka ja käyttöliittymä kirjoitetaan Rustilla.
Älä rakenna uutta Electron-, Tauri-, React-, Node- tai selainkäyttöliittymää.

Nykyinen egui/eframe + wgpu on oletusratkaisu, ellei todellinen tekninen este
edellytä muuta. Perustele mahdollinen muutos ja sen siirtymäkustannus.

“Pure Rust” tarkoittaa tässä Rustilla toteutettua sovellusta. Se ei tarkoita,
että käyttöjärjestelmän kamera-, ääni-, Metal- ja ikkunointirajapinnat olisivat
Rustia. Kirjaa natiivikirjastot, FFI-riippuvuudet ja ulkoiset ohjelmat näkyvästi.

Nykyistä FFmpeg-vientiä saa käyttää adapterin kautta. Älä väitä sitä puhtaaksi
Rust-videokoodekiksi. Älä korvaa toimivaa vientiä epäkypsällä koodekilla vain
Pure Rust -nimityksen vuoksi.

Tavoitealusta on ensin macOS Apple Silicon. Linux toimii kehitys- ja
automaatiotestialustana. Intel-Mac ja Windows valmistellaan arkkitehtuurissa,
mutta niiden toimivuutta saa väittää vasta todellisen testauksen jälkeen.

Sovellus toimii paikallisesti ja offline-tilassa, kun valinnaiset mallit on
ladattu. Verkko ei ole käsikirjoituksen, projektin tai viennin perusvaatimus.


3. STORYTOLD ARKKITEHTUURIN VERTAILUKOHTANA

Tutki https://github.com/storytold ja tehtävän kannalta olennaiset julkiset
repositoriot. Selvitä niiden todelliset rakenteet, dokumentaatio ja lisenssit.

Älä päättele arkkitehtuuria pelkästä organisaation nimestä. Älä väitä lukeneesi
repositoriota, johon et saanut pääsyä. Jos verkkopääsy puuttuu, kirjaa se ja
jatka nykyisestä Rust-työtilasta.

Hyödynnä vain todistetusti soveltuvia periaatteita, esimerkiksi:
- pienet, selkeästi rajatut cratet
- domain-mallin erottaminen käyttöliittymästä
- eksplisiittiset riippuvuussuunnat
- headless-käyttö ja CLI
- renderöijän erottaminen editorista
- sovelluksen työnkulkujen erottaminen tiedosto- ja laiteadaptereista
- testattavat tietorakenteet ja deterministiset muunnokset.

Älä kopioi lähdekoodia ilman lisenssin tarkistamista. Kirjaa vertailusta
konkreettisesti, mitä sovellettiin ja miksi. Jos Storytoldin rakenne ei vastaa
nykyisen sovelluksen tarpeita, säilytä toimiva nykyinen ratkaisu.


4. ARKKITEHTUURIN PÄÄPERIAATTEET

Erota seuraavat kerrokset:

A. Domain
Sarja, jakso, käsikirjoitus, hahmot, kohtaukset, otokset, resurssit, animaatio,
äänet, aikajana ja projektihistoria.

B. Sovelluspalvelut
Projektin avaaminen/tallentaminen, käsikirjoituksen kääntäminen,
äänityksen liittäminen, editointikomennot, vienti ja palautus.

C. Laskenta ja renderöinti
Käsikirjoituksen analyysi, liike, IK, huulisynkka, kamera, kuvaeditointi,
äänimiksaus ja GPU/CPU-renderöinti.

D. Infrastruktuuri
Tiedostot, käyttöjärjestelmä, kamera, mikrofoni, äänen toisto, mallivarasto,
FFmpeg ja muut ulkoiset adapterit.

E. Käyttöliittymä
Näkymät, paneelit, valinnat, työkalut ja käyttäjän keskeneräiset syötteet.

Domain ei saa riippua egui-, wgpu- tai käyttöjärjestelmätyypeistä.
Käyttöliittymä ei saa toimia projektin toisena totuutena.

Käytä vakaita tunnisteita sarjoille, jaksoille, kohtauksille, otoksille,
hahmoille, repliikeille ja resursseille. Älä käytä listan indeksiä pysyvänä ID:nä.

Säilytä nykyinen yhteinen kokonaislukuinen aikapohja. Älä lisää erillisiä,
keskenään ajautuvia aika-arvoja ääneen, animaatioon ja videoon.

Projektimuutokset kulkevat yhteisen komentorajapinnan kautta:
- validoi komento
- muodosta muutos
- varmista tarvittava pysyvyys
- julkaise uusi tila
- kirjaa kumottava muutos.

Keskeneräinen tekstikenttä ei ole automaattisesti tallennettu domain-muutos.

Raskaat tehtävät ajetaan käyttöliittymäsäikeen ulkopuolella. Jokaisella
pitkällä tehtävällä on tila, eteneminen, peruutus ja ymmärrettävä virheilmoitus.

Älä luo yhtä valtavaa app.rs-tiedostoa. Siirrä vastuut olemassa oleviin
moduuleihin tai tarpeen mukaan uusiin crateihin. Uusi crate tarvitsee
selkeän vastuun; pelkkä tulevaisuuden mahdollisuus ei riitä.


5. LUO TOTEUTUSTIIMIN AGENTIT

Luo pääagentin ohjaama toteutustiimi, jos työympäristö tukee aliagentteja.
Jos se ei tue niitä, käytä samoja vastuualueita peräkkäisinä työvaiheina
ja kerro, ettei erillisiä agentteja käynnistetty.

Erota toteutustiimin agentit sovelluksen hs-agents-agenttiputkesta.
Ne ovat eri asioita.

Pääagentti — arkkitehtuuri ja integraatio
- vastaa lopputuloksesta ja työn järjestyksestä
- tarkistaa nykyisen koodin ja käyttäjän tavoitteet
- määrittää yhteiset rajapinnat
- jakaa tiedostojen omistuksen
- integroi työn ja tarkistaa koko työnkulun
- pitää TIIMI.md:n ja pariteettitiedot ajan tasalla
- ei hyväksy ominaisuutta valmiiksi pelkän aliagentin ilmoituksen perusteella.

Agentti 1 — Mac, työkaluketju ja paketointi
- Rust-käännös, Metal, käynnistys ja laiteoikeudet
- sovellustunniste, datakansio ja Info.plist
- kamera- ja mikrofonikäyttöoikeudet
- macOS .app ja myöhemmin DMG
- todelliset käynnistys- ja laitekokeet.

Agentti 2 — sarja, projektitallennus ja palautus
- sarja/jakso-domain
- projektiformaatti, migraatiot ja resurssit
- omat äänitykset projektin mukana
- atominen tallennus, autosave ja palautus
- yhteensopivuus nykyisiin formaatteihin.

Agentti 3 — käsikirjoitus ja tuotantomalli
- englanti ensisijaisena, nykyisen FI-tuen säilytys ja eksplisiittiset tagit
- lähderivien ja tapahtumien yhteys
- kohtaukset, repliikit, toiminta ja diagnostiikka
- käsikirjoituksesta muokattava animaatiosuunnitelma
- käsin tehtyjen muutosten säilyminen.

Agentti 4 — hahmot, 3D-liike ja lavastus
- nykyisten hahmojen ja rigien kehittäminen
- ilmeet, katseet, asut ja kampaukset
- liike, IK, toisioliike ja esineet
- sarjan toistuvat tilat ja kamerat
- GPU/CPU-tulosten vertailu.

Agentti 5 — puhe, huulisynkka ja live-esitys
- hahmokohtaiset englanninkieliset Kokoro-äänet ja oma puhe
- rivikohtaiset äänitykset
- mikrofonin ja kameran yhtäaikainen käyttö
- visemit, ilmeet, kalibrointi ja viive
- äänen ja animaation yhteinen ajoitus.

Agentti 6 — kuvaeditointi ja PSD
- tasot, maskit ja kuvankäsittely
- hahmon kuvaresurssit
- PSD-tuonti ja rajat
- ei-tuhoava editointi
- kuvan ja hahmorigin yhteys.

Agentti 7 — aikajana, videoeditointi ja vienti
- otokset, leikkeet, trimmaus ja siirtymät
- äänen miksaus ja aaltomuodot
- tekstitykset ja julkaisuprofiilit
- PNG/MP4-vienti ja laadunvarmistus
- peruutus ja palautus.

Agentti 8 — käyttöliittymä ja saavutettavuus
- alkuperäinen Koeta-käyttöliittymä
- telakoitavat paneelit ja työtilat
- näppäimistö, fokus ja saavutettavuus
- selkeät puuttuvan ominaisuuden tilat
- käyttäjän työnkulun hyväksyntä.

Agentti 9 — testaus ja formaattien turvallisuus
- projektien round-trip-testit
- vioittuneet arkistot ja resurssirajat
- aikapohja ja synkronointi
- regressiot ja end-to-end-testit
- testitulosten riippumaton tarkistus.

Älä käynnistä kaikkia agentteja heti. Aloita vaiheeseen tarvittavista.
Jos rinnakkaisuus on rajattu, käytä agentteja vuoroissa.

Anna jokaiselle agentille:
- täsmällinen tavoite
- luettavat lähteet
- omistetut tiedostot
- sovitut rajapinnat
- hyväksymiskriteerit
- testikomennot
- tehtävän ulkopuolelle rajatut muutokset.

Yhteisiä ydintiedostoja muuttaa yksi omistaja kerrallaan. Integroi pieninä
kokonaisuuksina. Agentti ei saa muuttaa muiden rajapintoja ilmoittamatta.


5A. CODEXIN JA CLAUDEN YHTEISTYÖ

Käyttäjä kehittää Koetaa sekä Codexilla että Claudella. Git, AGENTS.md ja
TIIMI.md ovat yhteinen tiedon lähde. Älä oleta näkeväsi toisen työkalun
keskusteluhistoriaa. main on yhteinen päähaara.

Yhteinen päätavoite:
englanninkielinen käsikirjoitus → hahmokohtaiset Kokoro-äänet →
muokattava 3D-animaatio → tallentuva sarjaprojekti →
englanninkieliset tekstitykset → MP4.

TYÖN ALOITUS

Ennen muutoksia:
1. Lue AGENTS.md ja TIIMI.md:n viimeisin handoff.
2. Tarkista Git-haara, HEAD ja paikalliset muutokset.
3. Tarkista etämuutokset repositorion ohjeiden mukaisesti.
4. Selvitä, mitä toinen työkalu on jo toteuttanut.
5. Ilmoita tämän tehtävän tavoite ja omistetut tiedostot.

Älä ylikirjoita, resetoi tai poista toisen työkalun työtä.
Älä aloita jo käynnissä olevaa tehtävää uudelleen.

TYÖNJAKO

Jaa tehtävät kokonaisuuksiksi, joilla on yksi omistaja kerrallaan.
Esimerkiksi:
- Codex: projektitallennus, resurssit, migraatiot ja niiden testit.
- Claude: Kokoro-työnkulku, hahmoäänet, huulisynkka ja niiden testit.

Tämä on esimerkkijako. Todellinen jako kirjataan TIIMI.md:hen tehtävän
alkaessa. Kumpikin työkalu voi toteuttaa kaikkia vastuualueita.

Yhteisiä domain-tyyppejä ja rajapintoja muuttaa yksi omistaja kerrallaan.
Sovi rajapinta ennen rinnakkaista toteutusta. Kirjaa:
- tietotyypit ja vastuut
- virhetilanteet
- resurssien ja revision tunnisteet
- tallennuksen ja ajoituksen sopimus.

Jos molemmat työkalut työskentelevät samanaikaisesti, käytä niiden olemassa
olevia erillisiä checkouteja tai käyttäjän hyväksymiä worktreeja. Älä luo
uutta worktreea ilman käyttäjän nimenomaista pyyntöä. Pelkät eri Git-haarat
samassa työhakemistossa eivät eristä rinnakkaista työtä. Jos eristystä ei ole,
tee työkalujen työ peräkkäin ja luovuta tila handoffilla.

ALIAGENTIT

Codex ja Claude voivat luoda tehtäväkohtaisia aliagentteja käytettävissä
olevien työkalujensa rajoissa. Älä oleta voivasi käynnistää toista
palvelua aliagenttina.

Anna jokaiselle aliagentille rajattu tehtävä, tiedostojen omistus,
rajapinnat ja hyväksymiskriteerit. Pääagentti vastaa integraatiosta
ja lopputuloksen tarkistamisesta.

HANDOFF TYÖKALUSTA TOISEEN

Päivitä TIIMI.md ennen työn luovuttamista:
- Työkalu: Codex / Claude
- Tavoite ja nykyinen vaihe
- Haara ja tarkka commit
- Toteutetut muutokset
- Muutetut ja omistetut tiedostot
- Ajetut testit ja tulokset
- Testiympäristö: Linux / Mac, simuloitu / oikea laite
- Avoimet virheet ja hyväksynnät
- Seuraava konkreettinen tehtävä.

Säilytä keskeneräinen työ ja merkitse sen tila rehellisesti.
Commitointi ja push tehdään käyttäjän valtuutuksen ja AGENTS.md:n mukaan,
main-käytäntöä noudattaen. Älä julkaise tai yhdistä muutoksia pelkän
handoffin perusteella. Älä käytä vanhaa kahden päähaaran push-ohjetta.

INTEGRAATIO

Integroiva työkalu:
1. Tarkistaa molempien muutokset ja yhteiset rajapinnat.
2. Säilyttää molempien tekemän työn.
3. Ratkaisee ristiriidat toiminnallisen tavoitteen perusteella.
4. Ajaa yhdistetylle versiolle tarvittavat testit.
5. Tarkistaa tallennus → uudelleenavaus → puhe → animaatio → vienti -työnkulun.
6. Kirjaa lopullisen tilan TIIMI.md:hen.

Toisen työkalun ilmoittama onnistuminen on lähtötieto.
Valmius perustuu tarkistettuun koodiin ja testituloksiin.


6. SOVELLUKSEN AGENTTIPUTKI

Kehitä nykyistä hs-agents-putkea. Säilytä olemassa olevat:
- ScriptParserAgent
- VoiceAgent
- TimingAgent
- LipSyncAgent
- CharacterMeshAgent
- ProceduralMotionAgent
- CinematographyAgent
- RustRenderAgent.

Lisää uusia vaiheita vain todellisen vastuun perusteella.

Jokaisella vaiheella on:
- tyypitetty syöte ja tulos
- reads/writes-riippuvuudet
- syöterevisio tai sisältöön perustuva välimuistiavain
- peruutus
- diagnostiikka
- toistettava tulos, kun syöte ei muutu.

Älä suorita koko putkea jokaisesta käyttöliittymän muutoksesta.
Älä käytä vanhentunutta ääntä tai liikedataa uuden käsikirjoituksen kanssa.

Sovelluksen agentit ovat ensisijaisesti deterministisiä Rust-palveluita.
Niiden olemassaolo ei tarkoita, että sovellus vaatii LLM-palvelun.

Jos myöhemmin lisätään kielimalliapuri, sen ehdotukset ovat erillisiä,
käyttäjän hyväksymiä muutoksia. Malli ei saa kirjoittaa suoraan projektin
kanoniseen tilaan, muuttaa lukittuja otoksia tai lähettää yksityistä
käsikirjoitusta verkkoon ilman käyttäjän suostumusta.


7. ENSIMMÄINEN VAIHE: MACILLA TOIMIVA NYKYINEN STUDIO

Tämä on ensimmäinen hyväksyntäportti.

Macilla:
- tarkista työtila ja päivitä turvallisesti
- cd native
- cargo run --release -p hs-app
- varmista ikkunan avautuminen
- varmista Metal-näyttämön toiminta
- avaa Ääni- ja Esitys-välilehdet
- lataa Kokoro käyttäjän nimenomaisella luvalla
- syntetisoi englanninkielinen repliikki
- kuuntele ääni
- vertaa suuta ja ääntä
- äänitä englanninkielinen repliikki myös oman äänen työnkulun testaamiseksi
- käynnistä kamera ja mikrofoni yhtä aikaa
- kokeile kalibrointia
- vaihda välilehteä laitteiden pysyessä toiminnassa
- tallenna esityksen ääni ja liike yhteisellä aikapohjalla
- vie lyhyt video ja tarkista sen ääni.

Tarkista puuttuva oikeus, puuttuva laite, laitteen irrotus ja peruutus.
Virhe ei saa kaataa sovellusta tai jättää laitetta lukituksi.

Jos käytettävissä on vain Linux:
- tee soveltuvat käännös- ja automaatiotarkistukset
- älä merkitse Mac-hyväksyntää läpäistyksi
- jatka Macista riippumatonta kehitystä
- anna tarkka Mac-koeohje
- kirjaa oikeaa laitetta tarvitsevat tarkistukset avoimiksi.

Älä pysäytä kaikkea kehitystä siksi, että fyysinen Mac-koe odottaa käyttäjää.
Älä kuitenkaan ohita sitä julkaisun hyväksyntäporttina.


8. TOINEN VAIHE: SARJA JA SIIRRETTÄVÄ PROJEKTI

Toteuta projektitallennus ennen laajaa uusien ominaisuuksien rakentamista.

Sarja sisältää:
- sarjan ID:n ja nimen
- jaetun hahmokirjaston ja pysyvät hahmokohtaiset Kokoro-äänivalinnat
- jaetut lavasteet ja resurssit
- jaksojen tunnisteet, nimet ja järjestyksen
- sarjan oletusasetukset.

Jakso sisältää:
- oman ID:n
- jaksonumeron ja nimen
- käsikirjoituksen ja sen revision
- hahmojen sidokset ja parametrit
- kohtaukset, otokset ja kamerat
- animaatioraidat
- tuotetut Kokoro-repliikit, synteesimetatiedot, omat äänitykset ja tuodut äänet
- äänen ajoituksen ja visemit
- videoeditoinnin aikajanan
- tekstitykset
- vientiasetukset
- resurssiviittaukset.

Tutki nykyisiä .hahmo- ja .sarja-formaatteja ennen formaatin suunnittelua.
Älä anna uudelle yhteensopimattomalle formaatille vanhaa tiedostopäätettä.

Valitse ja dokumentoi:
- laajennetaanko olemassa olevaa formaattia
- käytetäänkö versionoitua natiivilaajennusta
- tarvitaanko erillinen natiivin projektiformaatti.

Projektin pitää olla siirrettävissä toiseen koneeseen ilman alkuperäisiä
absoluuttisia tiedostopolkuja.

Käytä versionoitua manifestia, vakaita resurssitunnisteita ja SHA-256-
tarkistussummia. Rajaa arkiston kokonaiskoko, purettu koko, tiedostomäärä,
kuvakoot ja äänen pituudet. Estä path traversal ja muut arkistohyökkäykset.

Tallennus:
- kirjoita uusi tiedosto väliaikaiseen sijaintiin
- varmista sisältö
- korvaa kohde atomisesti alustan tukemalla tavalla
- säilytä edellinen kelvollinen projekti virhetilanteessa
- älä lupaa sähkökatkodurabiliteettia ilman sitä tukevaa toteutusta ja koetta.

Autosave:
- käyttäjän työtä ei ylikirjoiteta
- palautettava revisio erotetaan lopullisesta projektista
- quota-/levytilavirhe näkyy käyttäjälle
- palautus tarkistaa resurssien eheyden
- keskeytynyt vienti ei näy onnistuneena.

Hyväksymiskoe:
1. Luo sarja ja jakso.
2. Kirjoita lyhyt käsikirjoitus.
3. Muuta hahmon ulkoasua.
4. Syntetisoi kahden hahmon englanninkieliset repliikit eri Kokoro-äänillä
   ja korvaa yksi repliikki omalla englanninkielisellä äänityksellä.
5. Muuta kameraa ja ajoitusta.
6. Tallenna projekti.
7. Sulje sovellus.
8. Siirrä projekti toiseen hakemistoon.
9. Avaa uudelleen.
10. Varmista, että teksti, hahmot, äänivalinnat, ääniresurssit, ajoitus ja
    kamera säilyivät ilman puheen uudelleengenerointia.
11. Vie sama jakso.
12. Testaa myös katkennut tallennus ja vioittunut resurssi.


9. KÄSIKIRJOITUKSESTA 3D-ANIMAATIOKSI

Käsikirjoitus on muokattava lähde, mutta siitä muodostettu animaatio on myös
käyttäjän editoitavissa.

Toteuta ensin selkeästi määritelty englanninkielinen rakenne. Säilytä nykyinen
suomenkielinen tuki, mutta priorisoi englanninkielinen tuotantotyönkulku:
- kohtausotsikot
- hahmojen nimet
- repliikit
- toiminta
- taustat
- esineet
- ilmeet
- katseet
- kuvakoot
- kameraliikkeet
- kestot ja tauot.

Esimerkki:

[background living room]
[shot wide]
KALLE: Hello everyone, welcome to our new episode! [wave 2s]
MAIJA: Are you talking to the camera again? [expression surprised]
[shot two-shot]
KALLE: This is our show. [look at Maija]
[prop coffee cup]
EETU: I want to join too! [jump]
[background kitchen]
RONJA: Let's get started. [expression happy]

Esimerkki on tavoiteltu syntaksi. Älä väitä kaikkia sen tageja tuetuiksi ennen
toteutusta. Tuntematon tagi tuottaa rivikohtaisen diagnostiikan.

Säilytä lähderivi, lähdealue ja tapahtumatunniste. Älä arvaa tuntematonta
toimintaa hiljaisesti. Näytä käyttäjälle tulkinta ja korjattavat kohdat.

Uudelleenkäännös ei saa hävittää:
- käyttäjän omia äänityksiä
- käsin muokattua liikettä
- hahmosidoksia
- hyväksyttyjä tai lukittuja otoksia
- myöhempien kohtausten tarkoituksellista ajoitusta.

Erota automaattinen suunnitelma ja käyttäjän override-muutokset.

Älä nopeuta repliikkiääntä vain siksi, että arvioitu kohtausaika on lyhyempi.
Pidennä kohtaus tai pyydä käyttäjän päätös.


10. HAHMOESITYS ADOBE CHARACTER ANIMATORIN TAPAAN

Toteuta vertailukelpoiset työnkulut vaiheittain:

- hahmon valinta ja roolitus
- kameran ja mikrofonin yhtäaikainen käyttö
- pään yaw/pitch/roll
- kalibrointi ja peilaus
- herkkyys ja liikkeen rajat
- ääneen sidottu suu
- visemit
- näppäimistöllä laukaistavat ilmeet ja eleet
- trigger-ryhmät ja vaihtoehtoiset hahmo-osat
- ottojen tallennus
- ottojen trimmaus, uusinta ja valinta
- tallennetun esityksen ja käsin tehtyjen avainruutujen yhdistäminen.

Kasvojenseurannassa:
- erottele nykyinen pään seuranta ja tulevat kasvopisteet
- älä väitä silmien tai kulmien seurantaa nykyisen ihonväriseurannan perusteella
- tutki paikallinen, lisenssiltään sopiva ratkaisu
- pidä mallilataus käyttäjän hyväksymänä
- älä lähetä kamerakuvaa verkkoon.

Säilytä samanaikaiset lähteet:
- kamera ohjaa päätä
- mikrofoni ohjaa puhetta
- näppäimistö ohjaa triggereitä
- käyttäjän määrittämä prioriteetti ratkaisee päällekkäiset kanavat.

Käyttöliittymän paneelin vaihtaminen ei saa pysäyttää laitteita.


11. 3D-HAHMOT JA SARJAN MAAILMA

Jatka nykyisistä Kalle-, Maija-, Eetu- ja Ronja-hahmoista.

Toteuta:
- hahmokohtaiset mittasuhteet
- kampaukset ja hiusvärit
- asut ja asujen värit
- lasit, päähineet ja lisävarusteet
- ilmeet: neutraali, iloinen, vihainen, surullinen, yllättynyt, peloissaan
- katseen kohteet
- suun ja ilmeen yhteistoiminta
- hahmon kädessä olevat esineet
- pysyvät hahmoprofiilit sarjan sisällä.

Hahmot ovat alkuperäisiä. Älä kopioi tunnettujen animaatiosarjojen hahmoja.

Sarjan paikat:
- olohuone
- keittiö
- lastenhuone
- eteinen
- piha
- koulu
- katu
- puisto.

Tee paikoista uudelleenkäytettäviä lavasteita:
- vakaa ID
- mitat ja koordinaatisto
- kulkureitit ja kontaktipinnat
- esinepaikat
- kamerapaikat
- valaistusasetukset.

Kävely, IK ja kontaktit tarvitsevat mitattavat testit.
Älä hyväksy jalkojen näkyvää liukumista tai hahmon läpäisemää lattiaa
pelkän silmämääräisen oletuksen perusteella.


12. PHOTOSHOP-TYYPPINEN KUVAEDITOINTI

Rakenna animaatiotyöhön tarvittava kuvaeditori, älä yleistä Photoshop-kloonia.

Ensimmäinen kokonaisuus:
- rasteri- ja vektoritasot
- tasojen nimet, järjestys, ryhmät ja näkyvyys
- valinta, siirto, skaalaus ja kierto
- sivellin ja pyyhekumi
- täyttö ja yksinkertaiset muodot
- tasomaskit
- rajaus
- opacity
- värisäädöt
- kumoa/tee uudelleen.

Seuraava kokonaisuus:
- tuetut sekoitustilat
- clipping ja ryhmäeristys
- valintamaskit
- ei-tuhoavat säädöt
- hahmo-osien ja materiaalien editointi
- kuvaresurssin päivittäminen rikkomatta rigiä.

PSD-tuonti:
- käytä lisenssiltään sopivaa Rust-kirjastoa tai erillistä adapteria
- säilytä tasojen vakaat tunnisteet ja hierarkia
- säilytä dokumenttikoordinaatit ja piirtojärjestys
- ilmoita tukemattomat ominaisuudet
- noudata nykyisiä dokumentoituja kokorajoja
- älä väitä täyttä PSD-yhteensopivuutta ilman testiaineistoa.

Pidä 2D-tasoeditointi, 3D-hahmon geometria ja 3D-materiaalit erillisinä
malleina. Kuvan muokkaus ei saa vahingossa muuttaa hahmon luurankoa.


13. VIDEOEDITOINTI

Toteuta yhteinen aikajana, jossa on:
- kohtaukset ja otokset
- kamerat
- hahmojen animaatiot
- puhe
- omat äänitykset
- musiikki
- äänitehosteet
- tekstitykset
- tuodut video- ja kuvamateriaalit, kun dekoodaus on toteutettu.

Ensimmäiset työkalut:
- valinta
- leikkeen siirto
- trimmaus
- jako
- poisto
- snapping
- zoomaus
- playhead
- toisto ja tauko
- kumoa/tee uudelleen.

Määrittele ripple-editoinnin vaikutukset ennen sen toteuttamista.
Äänen ja kuvan sidokset eivät saa katketa huomaamatta.

Äänelle:
- aaltomuoto
- äänenvoimakkuus
- fade-in/fade-out
- mykistys
- musiikin ducking puheen aikana
- clipping-ilmaisin
- deterministinen vientimiksaus.

Älä tee repliikkiääneen automaattista nopeutusta tai äänen muuttamista ilman
käyttäjän päätöstä.

Tekstityksille:
- käsikirjoitukseen sidotut repliikit
- ajoituksen muokkaus
- puhujan valinta
- tyyli ja turva-alue
- poltettu tekstitys videoon
- tarvittaessa SRT/VTT-vienti.


14. KOETAN KÄYTTÖLIITTYMÄ

Näkyvä nimi on Koeta. Älä muuta sovellustunnistetta tai käyttäjän datakansiota
ilman migraatiota, joka säilyttää vanhan työn.

Suunnittele alkuperäinen studio, jossa:
- keskellä näyttämö
- vasemmalla projektin, hahmojen ja resurssien rakenne
- oikealla valinnan ominaisuudet
- alhaalla aikajana
- ylhäällä projektin nimi, työtila ja yhteiset toiminnot.

Työtilat:
1. Tarina — käsikirjoitus ja tulkinta
2. Hahmot — roolitus ja hahmotyöpaja
3. Kuva — tasot ja kuvaeditointi
4. Esitys — kamera, mikrofoni ja triggerit
5. Leikkaus — aikajana, ääni ja tekstitykset
6. Vienti — esikatselu, tarkistukset ja julkaisutiedostot.

Paneelit:
- telakoitavat ja koon muutoksen muistavat
- selkeä aktiivinen valinta
- ei laitteiden katkaisua paneelin vaihtuessa
- ei käyttäjän työn häviämistä työtilan vaihdossa.

Yhteiset toiminnot:
- uusi/avaa/tallenna/tallenna nimellä
- viimeisimmät projektit
- kumoa/tee uudelleen
- komentohaku
- näppäinoikotiet
- kontekstivalikot
- ymmärrettävä tehtävien eteneminen
- virheestä palautuminen.

Älä rakenna toimimattomia “valmiita” painikkeita. Keskeneräinen ominaisuus
näkyy selkeästi keskeneräisenä tai jätetään pois käyttäjän työnkulusta.

Testaa näppäimistökäyttö, fokusjärjestys ja macOS VoiceOver todellisessa
ympäristössä. egui tai AccessKit ei yksin todista saavutettavuutta.


15. VIENTI JA JULKAISUPROFIILIT

Toteuta versionoidut vientiprofiilit:
- TikTok/Reels/Shorts: 1080×1920, 9:16
- YouTube: 1920×1080, 16:9
- neliö: 1080×1080
- käyttäjän mukautettu profiili sovelluksen rajoissa.

Nimet ovat käyttäjän apuja, eivät lupaus alustojen muuttumattomista
teknisistä vaatimuksista.

Säilytä nykyiset vientirajat, kunnes niiden muuttaminen on erikseen
perusteltu, toteutettu ja testattu.

Vienti sisältää:
- todellisen kuvan ja äänen
- tekstitykset valinnan mukaan
- oikean kuvasuhteen
- kansikuvan tai valitun ruudun
- etenemisen ja peruutuksen
- resurssien esitarkistuksen
- valmiin tiedoston dekoodaus-/metadata-tarkistuksen.

Varmista esimerkiksi ffprobella:
- videokoodekki
- ääniraita
- resoluutio
- kesto
- fps
- äänen ja kuvan ajoitus.

Älä ilmoita vientiä onnistuneeksi ennen kuin tiedosto on valmis ja tarkistus
on läpäisty. Keskeytynyt tai epäonnistunut vienti ei saa korvata aiempaa
onnistunutta tiedostoa.


16. TESTAUS JA HYVÄKSYMISKRITEERIT

Valitse testit muutoksen riskin mukaan. Älä kirjoita näennäisiä testejä,
jotka vain toistavat toteutuksen.

Tarvittavat testiryhmät:
- domain- ja komentotestit
- käsikirjoituksen testikorpus
- projektin round-trip ja migraatiot
- vioittuneet arkistot ja resurssirajat
- äänen, visemien ja animaation synkronointi
- liikkeen ja IK:n mittaukset
- GPU/CPU-renderöinnin vertailu toleransseilla
- viennin ääni ja metadata
- autosave ja keskeytyksestä palautuminen
- käyttöliittymän todelliset työnkulut
- Macin käynnistys ja laiteoikeudet.

Käytä soveltuvin osin:
- cargo test --locked --workspace
- cargo check --locked --workspace
- cargo clippy --locked --workspace --all-targets
- cargo fmt --check
- tarvittava release-build
- todellinen sovelluksen käynnistys
- todellinen vientikoe.

Tutki epäonnistuminen. Älä poista assertioneita, ohita testejä tai muuta
tarkistussummia vain saadaksesi vihreän tuloksen.

Raportoi erikseen:
- läpäisty
- epäonnistunut
- ohitettu
- odotettu epäonnistuminen
- ei ajettu
- simuloitu laite
- oikea laite.

Linuxin virtuaalinäyttö ei todista Macin toimivuutta.
Kameran synteettinen testikuva ei todista oikean kameran hyväksyntää.
Käännöstarkistus ei todista sovelluksen käynnistystä.


17. TYÖJÄRJESTYS

Vaihe A:
Nykyinen natiivi studio kääntyy ja käynnistyy. Macin avoimet hyväksynnät
tunnistetaan ja tehdään käytettävissä olevalla laitteella.

Vaihe B:
Sarja ja siirrettävä jaksoprojekti. Käsikirjoitus, hahmot, Kokoro-äänivalinnat, tuotetut repliikit ja omat äänitykset
säilyvät sulkemisen ja uudelleenavaamisen yli.

Vaihe C:
Ensimmäinen englanninkielinen jakso päästä päähän:
kaksi hahmokohtaista Kokoro-ääntä → huulisynkka → hahmoliike → kamera →
tallennus ja uudelleenavaus → englanninkieliset tekstitykset → MP4.

Vaihe D:
Hahmojen ilmeet, asut, kampaukset ja sarjan toistuvat paikat.

Vaihe E:
Videoeditointi, musiikki, tehosteet ja tekstitykset.

Vaihe F:
Kuvaeditori, PSD-tuonti ja hahmoresurssien editointi.

Vaihe G:
Palikkaeditori ja laajempi käsikirjoitustunnistin.

Vaihe H:
Mac-paketointi, palautus, saavutettavuus ja julkaisuhyväksyntä.

Vaihe I:
Electronin poisto vasta native/PARITEETTI.md:n todellisten poistoehtojen
täytyttyä ja käyttäjän erillisellä poistovaltuutuksella.

Älä hajauta ensimmäistä vaihetta kymmeniin keskeneräisiin ominaisuuksiin.
Tee ensin toimiva, tallentuva ja vietävä lyhyt jakso.


18. DOKUMENTOINTI JA RAPORTOINTI

Pidä ajan tasalla:
- native/README.md
- native/PARITEETTI.md
- TIIMI.md
- arkkitehtuuripäätökset
- projektiformaatin määrittely
- hyväksyntäkokeiden ohjeet.

Älä täytä dokumentaatiota tulevaisuuden ominaisuuksilla “valmiina”.
Dokumentoi toteutettu käyttäytyminen ja todelliset rajat.

Jokaisen työvaiheen jälkeen raportoi:
- mitä käyttäjä voi nyt tehdä
- mitä muuttui
- mitä testattiin ja missä ympäristössä
- mitä jäi avoimeksi
- seuraava konkreettinen työ.

Git- ja julkaisutoimissa noudata käyttäjän tämänhetkistä valtuutusta ja
repositorion ohjeita. Älä force-pushaa, poista haaroja, julkaise sovellusta
tai muuta repositorion näkyvyyttä tämän yleisen toteutuspromptin perusteella.


19. ALOITA NYT

Älä vastaa vain suunnitelmalla.

1. Tarkista nykyinen checkout ja ohjeet.
2. Tutki Storytoldin todellinen arkkitehtuuri ja lisenssit, jos verkkopääsy on
   käytettävissä.
3. Inventoi nykyisen Rust-studion toteutetut ja puuttuvat osat.
4. Luo vaiheeseen tarvittavat toteutusagentit.
5. Varmista nykyinen käännös ja soveltuvat testit.
6. Selvitä Mac-hyväksyntöjen tila.
7. Aloita sarja-/projektitallennuksen toteutus nykyiseen koodipohjaan.
8. Tee ensimmäinen tallennettava ja uudelleen avattava jakso.
9. Integroi, testaa ja dokumentoi tulos.
10. Jatka seuraavaan hyödylliseen vaiheeseen käyttäjän valtuutuksen puitteissa.

Kysy vain tietoa, jota ei voi päätellä koodista tai ohjeista ja joka estää
etenemisen. Jatka riippumatonta työtä odottaessasi vastausta.

Tärkein hyväksyntä:
Käyttäjä pystyy tekemään Koetalla lyhyen englanninkielisen animaatiojakson,
tallentamaan sen sarjaansa, avaamaan sen myöhemmin uudelleen ja viemään
videon, jossa kuva, hahmokohtainen Kokoro-puhe, huulisynkka ja englanninkieliset
tekstitykset toimivat yhdessä. Oma tai tuotu ääni säilyy aina synteettisen
puheen edellä, kun käyttäjä on valinnut sen repliikille.
