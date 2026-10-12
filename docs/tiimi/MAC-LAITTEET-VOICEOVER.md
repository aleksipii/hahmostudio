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
