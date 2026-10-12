# Mac-laitteiden ja VoiceOverin hyväksyntä

Tila 12.10.2026: fyysisiä laitteita ja VoiceOver-kuuntelua ei ole hyväksytty. Automaattinen testi ei korvaa näitä kokeita. Käytä erillistä testiprojektia; omia tallenteita ei liitetä GitHubiin. Kirjaa jokaisen kokeen yhteyteen sovelluksen lähdecommit, paketin app.asar-tarkistussumma, macOS-versio ja laitteen nimi. Pakkausagentti toimittaa uuden paketin tunnisteet.

## Koodista todettu

- `desktop/main.mjs` sallii mediaoikeuden vain oman editori-ikkunan audio/video-pyynnölle ja tarkistaa macOS:n mikrofonin/kameran luvan. Näytön tallennus ei kuulu tähän lupaan.
- `DialogueRecorder` tarjoaa luvan odotuksessa peruutuksen, tallennuksessa pysäytyksen ja hylkäyksen sekä `role=status`-tilatekstin. Näkyvä pysäytyspainike sisältää päivittyvän ajan; VoiceOverin käytännön toiminta on kuunneltava.
- Mikrofonin yksikkötestit käyttävät testilaitteita; generoitu Electron-äänivirta ei ole fyysinen mikrofonikoe.

## Fyysinen mikrofoni ja kamera

1. Avaa testiprojekti uudessa paketissa. Äänitä lyhyt oma testirepliikki. Tarkista macOS:n lupa, tuloääni ja että pysäytys liittää kuunneltavan repliikin. Peruuta toinen tallennus ja varmista ensimmäisen säilyminen.
2. Vaihda tallennuksen aikana kaikkiin työvaiheisiin. Pysäytyksen ja hylkäyksen pitää säilyä tavoitettavina; äänen pitää jatkua vaiheenvaihdossa.
3. Kytke kamera, mikrofoni ja näppäinohjaus yhtä aikaa. Tarkista hahmon liike ja ettei yhden ohjaimen lopettaminen pysäytä muita. Sulje kaikki laitteet ja varmista macOS:n käyttöilmaisimien sammuminen.
4. Kokeile ulkoisen laitteen irrotusta kesken tallennuksen, jos sellainen on käytettävissä. Sovellus ei saa jäädä pysyvästi varattuun tilaan eikä vanha repliikki saa kadota.
5. Tarkista luvan epääminen erillisessä testikäytössä vain, jos voit tehdä sen muuttamatta omia tarpeellisia käyttöasetuksiasi. Kirjaa tämä kokeilemattomaksi, jos lupa on jo myönnetty. Älä nollaa järjestelmälupia automaattisesti.

## VoiceOver ja näppäimistö

1. Käynnistä VoiceOver macOS:n tavallisella toiminnolla. Siirry työvaiheisiin, toimintohakuun ja projektivalikkoon. Kuuntele nimet, painikkeen tila ja valittu vaihe.
2. Käytä Tab/Shift+Tab sekä VoiceOverin siirtymis- ja aktivointikomentoja. Tarkista näkyvä kohdistus, looginen järjestys ja pääsy tallennuksen pysäytykseen ilman hiirtä.
3. Avaa toimintohaku ja valintaikkunat. Tarkista alkuperäinen kohdistus, sulkeminen Escillä ja paluu avaavaan ohjaimeen. Suljetun näkymän ohjaimia ei saa joutua käyttämään.
4. Äänitä testirepliikki. Kuuntele luvan odotus, tallennustila ja onnistuminen. Tarkista, ettei jatkuvasti muuttuva sekuntiluku tee pysäytyksestä vaikeaa tai hukuta muita ilmoituksia.
5. Aja Tallennus, Kumoa, Tee uudelleen ja vienti näppäimistöllä. Virheet ja valmistuminen pitää havaita ilman pelkkää väriä tai animaatiota.

## Tuloksen kirjaus ja Claude-jatko

Kirjaa jokainen koe erikseen: läpi / epäonnistui / tarkistamatta, odotus, todellinen havainto, paketin tunniste ja laitteen tiedot. Kuva tai ruuduntallenne on vapaaehtoinen; älä julkaise omaa ääntä tai henkilötietoja. Testaaja antaa itse kuunteluhyväksynnän.

Claude: lue TIIMI.md:n viimeinen kirjaus ja agenttien työhaarojen kirjaukset. Jatka tarkistamatta olevista kokeista; älä muuta automaattisia tuloksia laitehyväksynnäksi. Todettu käyttöongelma korjataan ensin erillisessä työhaarassa ja sen jälkeen uusitaan kyseinen koe. Ehdotus: erityisesti tallentimen päivittyvän painikenimen ja portaalin kohdistuksen tarkistus.

## Saavutettavuusagentin lähdeauditointi 12.10.2026

**Koodista todettu:** tallentimen pysäytyspainikkeen näkyvä teksti vaihtuu 100 ms välein. Aiemmin tämä oli myös sen saavutettavuusnimi. Nyt `aria-label` kuvaa vaiheessa käytettävää toimintoa ilman vaihtuvaa sekuntimäärää; näkyvä aika ja `role=status` säilyvät. Tämä poistaa nimeen tulevat ajastinpäivitykset. Se ei todista VoiceOverin kuuntelukäyttäytymistä. Yksikkötesti kattaa kaikkien neljän vaiheiden nimet, renderöintitesti ensimmäisen vaiheen kytkennän. Workflow-diagnostiikkaan lisättiin todellisen tallennuksen aika ennen/jälkeen -väite ja hylkäyksen jälkeinen nimi; näitä uusia GUI-väitteitä ei ajettu tällä haaralla.

**Koodista todettu, käytännön vaikutus tarkistamatta:**

| Kohde | Lähteen toteutus | Seuraava kokeiltava asia |
|---|---|---|
| Toimintohaku | `command-palette.tsx`: alkuperäinen fokus talletetaan, input fokusoidaan, cleanup palauttaa fokuksen. Nuolinäppäimet, Enter ja Esc on käsitelty. Ei paikallista Tab-rajausta tai taustan inert-kytkentää. | Tab/Shift+Tab ei saa viedä sulkemattoman modalin taustaan; tarkista myös fokuksen paluu komennon avaamaan uuteen modalin. |
| Pilvirenderöinnin modal | `cloud-render-dialog.tsx`: dialogielementti saa fokuksen, Esc kuunnellaan documentissa. Ei paikallista fokuksen palautusta tai Tab-rajausta. | Sulje ja tarkista kohdistuksen sijainti, taustan tavoitettavuus sekä toinen päällekkäinen dialogi. Älä kytke pilveä päälle tätä koetta varten. |
| Rig-ehdotus | `rig-suggest-dialog.tsx`: Sulje käyttää autoFocusia, Esc käsitellään sectionissa. | Tab/Shift+Tab-rajaus ja avaavaan ohjaimeen palautuminen. |
| Palautuspiste | `recovery-prompt-modal.tsx`: normaalihaaran Jatka käyttää autoFocusia; virhehaarassa sitä ei ole. Pakollista valintaa ei suljeta Escillä. | Palautusvirheen alkuperäinen kohdistus ja pakollisen dialogin taustan estäminen. Escillä sulkemista ei saa lisätä ohittamaan pakollista valintaa. |
| Pysyvä tallenninportaali | `panel-dock.tsx`: sama host siirretään appendChildilla, cleanup poistaa hostin. Reactin ohjaimia ei luoda uudelleen. | Fokusoitu pysäytyspainike ja näkyvä fokus vaiheenvaihdon jälkeen; hostin pysyvyys yksin ei takaa fokuksen säilymistä. |

**Ehdotus:** todenna edellä nimetyt Tab- ja portaalitapaukset eristetyllä lähde-Electronilla ja vasta sen jälkeen rajaa mahdollinen yhteinen modalin fokuksenhallinta. `aria-modal=true` ei yksin toteuta näppäimistön Tab-rajausta. Näitä rivejä ei lasketa läpäistyiksi GUI-testeiksi tai todennetuiksi VoiceOver-virheiksi.

**Avoimet:** fyysisen mikrofonin ja kameran kokeet, ihmisen VoiceOver-kuuntelu, modalien näppäimistötestit, tallentimen saavutettavuusnimen uudet workflow-väitteet lopullisella lähdebuildillä/paketilla. Käyttöoikeuksia ei muutettu eikä fyysisiä laitteita avattu.

## Claude 12.10.2026: selaimen näppäimistö- ja fokuskoe sekä korjaukset

Työhaara `claude/project-thread-02q2wy` (sisältää `codex/devices-voiceover-2026-10-12` @ `aca2f3a`). Ajettu Linux-kontissa Chromiumilla Vite-kehityspalvelinta vasten. Mikrofonina Chromiumin valelaite (`--use-fake-device-for-media-stream`). Tämä ei ole VoiceOver-koe eikä fyysisen laitteen koe.

**Todettu ennen korjausta (selain-ennen.txt, 22 läpi / 21 epäonnistui):**
- Toimintohaku: Tab ja Shift+Tab vievät kohdistuksen taustalle. Kun kohdistus on poistunut kentästä, Esc ei enää sulje hakua.
- Asetukset: Tab karkaa taustalle. Esc sulkee, mutta kohdistus putoaa sivun runkoon eikä palaa Projekti-valikkoon.
- Äänitys: kun äänitys alkaa, tallennintyökalut siirtyvät pysyvään isäntään (`PanelDock`) ja kohdistus katoaa runkoon. Näppäimistön tai VoiceOverin käyttäjä menettää paikkansa juuri, kun pysäytystä tarvitaan. Sama tapahtuu hylkäyksen ja liittämisen jälkeen.
- Käyttöohje toimi jo oikein (vertailukohta).

**Korjattu:**
- `lib/dialog-focus.ts` + testi ja `components/use-dialog-focus.ts`: yhteinen Tab-rajaus päällimmäiselle `aria-modal`-ikkunalle, alkukohdistus tarvittaessa ensimmäiseen ohjaimeen ja paluu avaajaan (tai suljetun valikon otsikkoon). Käytössä: toimintohaku, Asetukset, pilvirenderöinti, nivelehdotus ja palautuspiste (palautuspisteeseen ei lisätty Esc-sulkemista).
- Toimintohaku: Esc sulkee koko ikkunasta, ei vain hakukentästä.
- `PanelDock`: isännän siirron aiheuttama kohdistuksen menetys palautetaan samaan ohjaimeen.
- `DialogueRecorder`: hylkäyksen ja liittämisen jälkeen kohdistus palaa äänityspainikkeeseen, jos se oli tallentimessa.
- Esikatselun koristeellinen turva-alueen kehys on `aria-hidden` (axe: kielletty aria-label div-elementissä).

**Korjauksen jälkeen (selain-jalkeen.txt, 35 läpi / 0 epäonnistui):** 40 ensimmäistä Tab-pysäkkiä näkyvällä kohdistusrenkaalla ja nimellä; toimintohaku (painike ja Ctrl+K) ja Asetukset: alkukohdistus, Tab/Shift+Tab rajaus, Esc, paluu avaajaan; äänitys Enterillä, vakaa saavutettavuusnimi, kohdistus säilyy aloituksessa ja kuudessa ⌥-vaiheenvaihdossa, Hylkää näppäimistöllä, liittäminen ja status-ilmoitus. Verkkoversiossa vienti-ikkuna ei ole modaali (vain Mac-sovelluksessa), ja Tekoäly avaa paneelin; niitä ei testattu tässä.

**Ei korjattu, päätös käyttäjälle tai UI-agentille:** axe-core löytää jokaisesta vaiheesta 6–14 heikon kontrastin tekstiä (esim. `#5e5e6b` tummalla, 2,9:1; Seuraava-painikkeen valkoinen teksti vaaleansinisellä, 2,2:1). Ne ovat tietoisia minimalismin värejä, joten niitä ei muutettu tässä.

**Avoinna edelleen:** fyysinen mikrofoni ja kamera, ihmisen VoiceOver-kuuntelu, Electron-workflow-diagnostiikan kaksi uutta nimiväitettä integroidulla buildillä, vienti-ikkunan näppäimistökoe Mac-sovelluksessa. Käyttäjän lyhyt lista: `docs/tiimi/LAITEHYVAKSYNTA-TARKISTUSLISTA.md`.
