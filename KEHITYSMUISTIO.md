# Hahmostudion kehitysmuistio

## 3.10.2026 — Ensimmäinen pikaanimointipaketti

### Auditointi ja rajaus
Ajantasaiset work/hahmostudio ja outputs/Hahmostudio tarkistettiin. Kumpikaan ei ole Git-työpuu; ei committeja, mergejä, ulkoista julkaisua tai poistokomentoja. Lähteen palautuspiste on work/hahmostudio-ennen-pikaanimointia-2026-10-03.zip. Omistajan kirjautumistietoja ei luettu eikä muutettu. Nykyiset moduulit säilytettiin: PSD-worker, tasomalli, parentKey-rigi, IK, animaatioradat, projektipakkaus, kamera, ääni, Rhubarb, MP4 ja sarja. Uusi työtila käyttää samaa näyttämöä ja renderer-/animaatiomoottoria.

Ensimmäinen kokonaisuus: yksi alkuperäinen robotti ja tausta → mikrofonin voimakkuussuu → A/D/W → muokattava otto. Ei rinnakkaista demoa eikä toimimattomia kortteja. Muut hahmot ja omien kuvien sovitus seuraavat myöhemmin.

### Resurssit ja alkuperä
Adoben https://pages.adobe.com/character/en/resources tarkistettiin. Blank Templates jäsentää oman kuvan tasot; Mouth Pack erottaa suumuodot; Background Pack pitää taustat erillisinä; Intro to Rigging Pack näyttää erilaisia niveltämistapoja; Audio Pack tarjoaa ääniaineistoja. Sivun latauslinkit johtavat okaysamurai.com/puppets/resources/TemplateBlank.zip, CHMouthPack.zip, BackgroundPack.zip, IntroToRigging.zip ja CHAudioPack.zip. Web-lukija ei pystynyt avaamaan ZIP-sisältöä. Emme ottaneet näitä käyttöön, ladanneet niitä sovellukseen tai päätelleet sivun ilmaisesta latauksesta jakelulupaa. Kaikki uudet grafiikat ovat omaa ohjelmallisesti piirrettyä Hahmostudio-grafiikkaa (CC0-1.0), eivät Adoben hahmoista kopioituja.

public/library: Otto.psd (oikea 8BPS/RGB/8-bit, 25 rasteritasoa ja 3 ryhmää), Otto.hahmo (valmis sidottu hahmo), Otto.png (todellinen esikatselu), Studio.png (1080×1920 tausta), KAYTTOOHJE.txt. Lähde scripts/create-otto.py + create-otto.mjs. .hahmo sisältää lähde-PSD:n, kuvat, alkuperäisen komposiitin, pysyvät PSD-ID:t 4101–4125, rigin, suun/silmien sidokset, ohjausasetukset, provenance.json ja ohjeen.

### Formaatti, roolit ja kanavat
.hahmo version 2 on yhteensopiva laajennus; v1-tuonti säilyi ja tavallisen vanhan projektin vienti on edelleen v1. document.quick.version=1, asset=hahmostudio-otto-robot-v1. document.sourcePsd viittaa source/character.psd-resurssiin ja säilyy uudelleenavauksessa. Suu-/silmäsidokset eivät riipu taulukkoindeksistä: quick.roles yhdistää semanttiset roolit pysyviin tasotunnisteisiin; rigi säilyttää PSD-ID:n, polun, parentin, pivotin ja nivelpisteet. Valmis paketti käyttää omia tunnettuja tunnisteitaan; mielivaltaisen uuden PSD:n automaattista sovitusta ei väitetä toimivaksi.

Roolit: root, head; left/right Arm, Forearm, Hand, Thigh, Shin, Foot; left/right Eye, Pupil, Brow, Blink; mouthNeutral/Open/Round. Pää liittyy vartaloon ja kasvot päähän. Raajojen alaosat liittyvät yläosiin ja kädet/jalkaterät alaosiin. Olkapää/kyynärpää/ranne ja lonkka/polvi/nilkka käyttävät dokumentin koordinaatteja, nivelalueilla on piirretty limitys. Kaksiosainen IK toimii nykyisen editorin työkalulla; pikaliikkeet kiertävät raajoja, eivät deformoi kuvaverkkoa. Pikaliikkeiden rajat: käsien kierto 0…135 astetta, hyppy enintään 12 % dokumentin korkeudesta, pupillin liike ±3 px. Nämä ovat presetin v1-parametreja, eivät yleinen luu-/liikerajaeditori.

A/D: hahmon anatominen vasen/oikea käsi, pidettävä, eksponentiaalinen paluu. W: ajallinen sinihyppy, edge-triggered eikä repeat käynnistä uutta. 1/2/3: neutraali/hymy/yllätys; B: räpäytys; R: otto; Space: nykyisen aikajanan toisto. FYYSISET KeyboardEvent.code-määritykset, ⌘/⌥/Control/Shift estävät perusliikkeet, Caps Lock ei muuta codea. Painikkeet käyttävät samaa actionia. Näppäimet voi vaihtaa, kaksoismääritykset estetään. Blur/visibility/focus-kenttä vapauttavat held-tilat; työtilan vaihto sulkee mikrofonin ja lopettaa esityksen. Shift-vilkutusta ja Q/E/S-kävely-/kyykkytoimintoja ei näytetä tässä paketissa.

Kanavat yhdistyvät riippumatta toisistaan: root-hyppy, kädet, head-lepoliike, pupillit, kulmakarvat ja suun/silmän varianttien peittävyys. Suuvariantit vaihtuvat hold-arvoina, jolloin kaksi suuta ei sekoitu päällekkäin. Elävä esitys ohittaa näiden osien aikajanan vain esikatselussa; vanhoja avainruutuja ei muuteta. Edistyneiden muokkaus-/kameratyökalujen käyttö tapahtuu toisessa työtilassa, joten ne eivät taistele samasta live-asennosta.

Scene.design=studio-v1 on erillinen ohjelmallinen taustaresurssi: version mukaan sama kuva piirretään näyttämön koossa. Taustan vaihto ei muuta rigiä tai animaatiota. Ladattava PNG on erillinen; valmis hahmo ei sisällä taustaa rasteroituna hahmotasoihin. Läpinäkyvää videota tai omia taustakuvia ei vielä lisätty.

### Tallennus ja mikrofoni
Uusi otto lisätään aikajanan nykyisen keston jälkeen; enintään 24 s, aikajana 1800 ja yhteensä 10000 avainruutua. Kaikki tarvittavat lepo-/kasvo-/raajanäytteet bakedataan tavallisiksi muokattaviksi radoiksi. Otolla on näkyvä alku-/loppuruutuilmoitus; erillistä klippi-/ottometadataeditoria ei vielä ole. Pikaliikkeen aikajanan undo toimii nykyisen animaatiohistorian kautta; äänen undo ei ole yhteinen.

LocalMicrophone: käyttäjän napsautuksesta AudioContext + getUserMedia(audio only), paikallinen RMS-analyysi, kohinaraja/herkkyys/pehmennys, kolme suuasentoa. AudioWorklet kopioi PCM-näytteitä vain tallennuksen ajaksi; ulostulo vaimennetaan nollaan, ei kaiutinkierron reittiä. Mono-WAV sijoittuu oton alkuruutuun, vanha ääni yhdistyy monoksi eikä sen pidempää loppua leikata. Yhdistämisvirhe jättää liikkeen ja vanhan äänen talteen. Sulkeminen pysäyttää streamin raidat ja AudioContextin. Peruuttaminen ennen lupapäätöstä mitätöi käynnistyksen; mahdollisesti myöhemmin saatu stream suljetaan.

Mikrofoni ei ole foneemitunnistus. Englanti/suomi eivät vaadi uutta puhemallia tässä peruspolussa. Nykyinen Rhubarb-äännetyökalu ja MediaPipe-kamera säilyvät erillisinä edistyneinä työkaluina; uudessa pakettipolussa ei ole pilvipalvelua eikä ulkoista mallilatausta.

Valmiin hahmon avaaminen säilyttää aiemman työn palautettavana .hahmo-blobina istunnossa (Palauta edellinen työ / Lataa edellinen työ turvaan). Istunto ei ole pysyvä tallennus: ennen sivun sulkemista on ladattava projektit. Valmis resurssi on muuttumaton; käyttäjän muutokset latautuvat omaksi .hahmo-tiedostoksi.

### Tarkistukset ja jatko
37 automaattista testiä: vanhat 30 säilyvät, 7 uutta kattavat oikean paketin/PSD-tavut ja projektin kierroksen, sidokset, näppäinmodifioijat, repeatin, molemmat kädet ja ajallisen hypyn, hiljaisuuden/leposuun, yhden suuvariantin ja pupillien rajat, uuden oton lisäyksen vanhoja avainruutuja ja koko aiempaa toistoa säilyttäen, WAV-tavut sekä robotin kaksiosaisen IK:n. Tyyppitarkistus ja yksityinen tuotantokoonti läpäisevät; entiset 500 kt/fflate-koontivaroitukset ovat edelleen informatiivisia.

Selaimessa Codexin in-app Chromium Macilla: valmis hahmo latautui yhdellä valinnalla; oikea PSD avautui PSD-workerilla (25 tasoa, suun varianttien näkyvyys oikein); W ja hymy nauhoitettiin 455 ruudun/25 radan/1089 avainruudun esitykseksi; .hahmo tallennettiin ja avattiin uudelleen; hypyn alin y -107,70 px; uusi KeyJ-hyppymääritys tallentui samaan projektiin. MP4-vienti tuotti 1080×1920 H.264-pystyvideon, kesto 18,967 s (mediabunny-parserilla tarkistettu). Tässä koeotossa ei ollut mikrofonilta saatua ääntä. Mikrofonin käynnistys jäi testiselaimessa odottamaan lupaa; peruutus testattiin, fyysisen mikrofonin ääni/tallennus/laitevapautus on vielä käyttäjän laitteella varmistamatta. Safari-yrittäminen palautti Computer Use permissions are not granted; Safaria tai erillistä Chromea ei testattu. Photoshopissa avaamista ei testattu.

Seuraava rajattu työ: varmistetaan fyysinen mikrofoni käyttäjän selaimessa; sitten vilkutus ja kyykky sekä toinen hahmo samalla paketointitavalla. Sen jälkeen PSD-sidosten korjaus ja oman PNG:n oikea ositus. Täyttä Adobe Character Animator -toiminnallisuutta ei ole.


## 3.10.2026 — nykyisen editorin selkeyttäminen

### Auditointi ja säilytys
Käytössä on outputs/Hahmostudio-kansion yksityinen palvelin ja koottu React/TypeScript-editori. work/hahmostudio sisältää saman lähdekoodin ja paikalliset riippuvuudet. Lähdetiedostot verrattiin ennen muutoksia: ei eroja. Kumpikaan kansio ei ole Git-työpuu, joten keskeneräisiä muutoksia ei stashattu eikä Git-kommitteja tehty. Lähdekoodin palautuspiste: work/hahmostudio-ennen-ui-2026-10-03.zip. Omistajan tiedostoa ei luettu eikä muutettu.

Koodista tarkistetut säilytettävät toiminnot: PSD:n worker-tuonti, ryhmät/näkyvyydet/tasohaku, alkuperäinen esikatselu, taso- ja pakettivienti; manuaaliset roolit/pivotit/nivelet/liitoshierarkia ja rig-JSON; aikajana/FPS/kesto/avainruudut/kolme siirtymää/40 animaatiomuutoksen kumoaminen; siirrettävä .hahmo grafiikka/rig/animaatio/ääni/näyttämö; MediaPipe-kamera ja muokattavat liikenäytteet; kaksiosainen IK, kävelyn avainruudut, voimakkuussynkka ja paikallinen Rhubarb; MP4 H.264/AAC/PNG-kuvasarja sekä viiden jakson .sarja/YouTube-kooste. Näiden ydinketjuja ei korvattu.

Ennen muutoksia 30 testiä läpäistiin. Selaimessa kokeiltiin tasotestin tuonti ja Nivelet-näkymä. Oikeassa paneelissa kamera, ääni, näyttämö, automaattiset liikkeet ja tason tiedot olivat yhtä aikaa, ja tärkeät muunnoskentät olivat kiinni. Kameran latauksen aikana sulkeminen oli estetty.

### Valmis toteutus
- Ylhäällä pysyvät Tasot / Nivelet / Animoi sekä alkuperäinen PSD-esikatselu. Näkyvä muokkaustila erottaa lepoasennon ja animaatioasennon. Aktiivista työvaihetta painamalla ei vaihdeta vahingossa pois.
- Oikealla Valinta / Näyttämö / Liikkeet / Esitys. Nykyiset komponentit pysyvät asennettuina; hidden hallitsee vain näkyvyyttä. Näin osavalinnat, sarjan jaksot, hahmo, rigi ja aikajana säilyvät. Muunnos avautuu Animoi-vaiheessa.
- Animaation Kumoa / Tee uudelleen myös yläpalkissa. Tämä ei laajenna historiaa grafiikkaan tai rig-muutoksiin.
- Tallennusmuistutus ja ladatun projektitiedoston tila. Ei autosave-lupausta. Työkalujen/paneelien/zoomin vaihto ei tee projektia muuttuneeksi; persistoidun sisällön muutos tekee.
- Kameran sulkeminen myös ylhäältä ja latauksen peruuttaminen. Sulkeminen päättää mahdollisen tallennuksen ja pysäyttää kameraraidat, workerin ja ajastimen. Vanhentunut käynnistys ei avaa seurantaa uudelleen. Paneelin piilotus ei sammuta kameraa.
- Näppäimistöfokus ja mukautuva paneeliasettelu. Käyttöohje/README päivitetty.

### Adoben ideoiden soveltaminen
[Character Animatorin työtilat](https://helpx.adobe.com/adobe-character-animator/desktop/introduction/workspace.html) rajaavat näkyvät paneelit tehtävän mukaan. Sama periaate auttaa nyt Hahmostudion kameran, nivelen ja avainruutujen löytämistä. [Animaten valinnan ominaisuuspaneeli](https://helpx.adobe.com/animate/desktop/workspace-and-workflow/authoring-panels.html) auttaa kohdistamaan muokkauksen valittuun tasoon. [Esityksen tallennus](https://helpx.adobe.com/adobe-character-animator/desktop/recording-and-playback/record-and-playback.html) erottaa live-syötteen ja tallennetun esityksen; nykyinen kamera tuottaa avainruutuja, ei erillistä ottojen editointijärjestelmää. Oma paneelijako soveltaa näitä ajatuksia nykyiseen tuotteeseen.

Mesh-muodonmuutos, symbolit, sisäkkäiset aikajanat ja erilliset otot ovat tässä vaiheessa liian laaja lisäys. FLA-/Character Animator -projektien tuontia tai täyttä PSD-yhteensopivuutta ei ole.

### Yhteensopivuus ja kesken
.hahmo/.sarja/rig/animaatio-JSON säilyvät muuttumattomina: migraatiota ei tarvita. UI:n välilehdet ja ladatun tiedoston tila ovat tilapäisiä. Pikselit/roolit/pivotit/avainruudut eivät muutu näkymää vaihtamalla. Alkuperäinen PSD kannattaa säilyttää, sillä .hahmo sisältää normalisoidut rasteritasot.

Piirtoeditori, tasojen lukitus/uudelleennimeäminen/maskit, PNG:n pilkkominen, segmentointimalli, autosave ja ottojen säilytys ovat vielä toteuttamatta. Rigin muutoksilla ei vielä ole yhtenäistä undo-historiaa. Suomen Rhubarb käyttää kielestä riippumatonta mallia; laajaa puhelaatutestiä ei tehty tässä UI-vaiheessa. Kävely ei lukitse jalkoja maahan eikä taivuta polvia automaattisesti.

### Seuraava rajattu kokonaisuus
Ensin yhteisen rasteritasomallin muokkaushistoria ja versioitu tallennus: uusi hahmodokumentti, kaksi piirrettävää tasoa, sivellin/pyyhekumi, lukitus ja yksi veto/yksi kumoaminen. Sen jälkeen PNG:n käsin tehtävä monikulmiomaski ja oikea läpinäkyvä taso alkuperäisillä offseteilla; alkuperäinen kuva säilyy. Malliavusteista segmentointia ei lisätä ennen toimivaa manuaalista polkua.

### Tarkistukset
30/30 testiä läpäistiin sekä ennen muutoksia että muutosten jälkeen. Lopullinen yksityinen tuotantokoonti sisältää tyyppitarkistuksen; se läpäistiin. Paikallisen riippuvuuskansion tiedostoluku oli hidas, joten koonti tehtiin /private/tmp-hakemistossa samalla package-lock.json-tiedostolla ja npm ci -asennuksella. Tuotantokoonti antaa entiset kokovaroitukset (pääpaketti yli 500 kt sekä fflate:n staattinen/dynaaminen tuonti); koontivirheitä ei ole.

Selaintesti: vanha kävelyprojekti avattiin, 531 avainruutua/18 tasoa säilyi; Tasot/Nivelet/Animoi ja Valinta/Näyttämö/Liikkeet/Esitys säilyttivät valitun tason sekä ruudun 2. Muunnoskentät näkyvät heti. Avainruudun kierto 12,5 → 20 → Kumoa palautti arvon 12,5 ja ladatun tiedoston tilan. Tallenna projekti tuotti .hahmo-tiedoston, jonka kaikki JSON-data, kuvat ja ääni vastaavat alkuperäistä (JSONin tyhjemerkkimuotoilu voi erota). Tiedosto avattiin uudessa istunnossa ja 531 avainruutua palautui.

MP4-vienti uudesta Ääni ja videovienti -osiosta: 1080 × 1920, H.264/AVC, stereo AAC 48 kHz, kokonaiskesto 5,077 s sisältäen äänen lopun täytteen. Fyysistä kameraa ei avattu: testipalvelin viivästytti workerin latausta, jotta käynnistys voitiin perua varmasti ennen laitekyselyä. Yläpalkin Sulje kamera näkyi myös Valinta-paneelissa, sulkeminen palautti Kameran suljettu -tilan ja 531 avainruutua säilyi. Kamerapaneelin päävalinta säilyi välilehtien välillä. Tässä vaiheessa ei testattu fyysisen kameran merkkivaloa tai esityksen tallennusta laitteelta.

Responsiivinen tarkistus 900 × 700 ja 700 × 850: sivun leveys vastasi näyttöä, ominaisuuspaneeli pysyi käytettävissä. Selaimen konsolissa ei ollut virheitä. Yksityinen palvelin ja omistajan kirjautuminen säilytettiin; lähdekoodia ei julkaistu ulkoisesti.

## 3.10.2026 · Työtilojen uudistus, ohjauslähteet ja kooditestit

Nykytilan kartoitus: PSD-tuonti, vakaa tasomalli, nivelsidokset, kahden osan IK, avainruudut, interpolointi, kamera, paikallinen Rhubarb, PNG/MP4 ja viiden jakson sarja olivat olemassa. Pikaanimointi oli erillinen paneeli, jonka aktiivisuus sammutti mikrofonin työvaihetta vaihdettaessa ja sulki kameran yhteiskäytön pois. Projektimuodot v1/v2 säilyvät muuttumattomina. Ennen muutoksia tehtiin lähdekoodin ZIP-varmuuskopio (hahmostudio-ennen-tyotiloja-2026-10-03.zip); käyttäjän tallennettuja tiedostoja tai omistajatunnusta ei käsitellä.

Toteutus: kolme työtilaa, pysyvästi kiinnitetyt laitepaneelit, näkymästä erillinen mikrofonin elinkaari, per-ohjauskanava yhdistäminen, yhteisen esityksen tallennus, erilliset sulkupainikkeet, suljettava aikajana sekä järjestelmä/vaalea/tumma-ulkoasu. Kamera käyttää valmiissa Otossa pään ja pupillien valmiita sidoksia. Ilman kasvoja kameran vanha asento vapautetaan. Suun ohjaus mikrofonista on äänenvoimakkuutta, ei reaaliaikaista äännetunnistusta; Rhubarb suomi/englanti äänitiedostosta säilyy.

Koodivarmennus: mikrofonin injektoitu laiteympäristö, luvan epääminen, alustuksen virheet, peruminen ennen/kesken luvan, myöhäisen luvan ääniraidan sulkeminen, irronnut laite, keskeytetty AudioContext, RMS, PCM16/WAV, vanhan äänen loppuosan säilyminen ja resurssien idempotentti vapautus. AudioWorklet suoritetaan Node VM:ssä. Ohjausmiksauksen testi tallentaa ja avaa kameran/käsien/suun yhdistelmän .hahmo-tiedostosta. React-palvelinrenderöinti tarkistaa navigoinnin, laiteohjaimet ja tallennuksen lukituksen. Alkuperäiset tuonnin, projektin, nivelten, animaation, puheen, kävelyn ja yksityisen kirjautumisen testit säilyvät.

Käyttäjän uuden ohjeen mukaisesti tässä päivityksessä ei tehdä selain- tai fyysisiä laitetestejä. Safari-yhteensopivuudesta varmennetaan koodipolut (AudioContext/webkit, puuttuvat rajapinnat, playsInline, käännöskohde), ei todellisen Safari-selaimen toimintaa. Visuaalinen asettelu ei ole selainvarmennettu. Sovellusta ei julkaista ulkoiseen palveluun eikä käyttöoikeuksia muuteta. Laajempi hahmo- ja liikekirjasto, PNG-osien erottelu, piirtäminen, tasojen uudelleennimeäminen ja sisäkkäiset klipit jäävät seuraaviksi vaiheiksi; nykyiset työkalut säilyvät.

Lopullinen tulos: 53/53 kooditestiä läpäisi; TypeScript ja build:private onnistuivat. Paikallinen käyttöversio ja käyttöpaketti päivitettiin.


## 0.3.0 · 3.10.2026
Selkeämpi kirjasto/käsikirjoitus, kontrasti- ja ohjainkorjaukset, teknisten tietojen piilotus lisätietojen alle ja aikajana pois Hahmo-tilasta. Kameran liitetty pää pysyy kaulassa; pään pikakiinnitys. Otto säilyy, Aino/Leo/Hahmopohja sekä kaksi suupakettia ja kuusi omaa kuvausympäristöä lisätty. Paikallinen fi/en-käsikirjoitus tuottaa muokattavat liikkeet ja kuvakulmat vanhan työn perään, ei puheääntä. 83 kooditestiä ja Mac-paketin resurssi/fi-en-Rhubarb-varmennus; ei fyysisiä tai selaimen visuaalisia testejä.


## 0.4.0
Aino/Otto monikulmapaketit (75 tasoa, 3 kulmaa), kävely/juoksu sivuille ja kohti katsojaa, sivuaskeleen tukivaiheen IK, yläpalkin Näkymä ja liikepainikkeet, erillinen puhelin esineenä kolmessa kuvakulmassa ja käsikirjoitusohjeet. Säilytä lähdekoodi ja valmiit paketit; vanhaa asennettua .app:ia ei vaihdeta sen ollessa käynnissä.


0.5.0: ylävalikot, pienemmät työkalurivit, koko tilaan joustava näyttämö, Näytä → näyttämöön keskittyminen ja sovitus, kirjaston/ominaisuuksien/aikajanan säädettävät koot (myös näppäimistöllä), paikalliset asetukset, Roni/Salla alkuperäiset 75-tasoiset kolmen kuvakulman paperileikkaushahmot. Vanha kirjasto ja startup-korjaus säilyvät.

## 0.6.0 · 3.10.2026

Lisätty paikallinen dialogikäsikirjoituksen tuonti, KILSAT-esimerkin alkuperäiset 18 repliikkiä, KILLE/Roni- ja HANDU/Salla-sidokset, repliikkiäänien rajaus, todellinen ajoitus, suu/katse/ilme/puhelin/leikkausraidat ja suojatut tauot. Valmistelu, hahmopaketit ja alkuperäiset äänet tallentuvat .hahmo v3:een. Vanhan projektin radat säilyvät; lisäys/päivitys ja äänen muutos ovat kumottavia. Roni/Salla sivukäsien piirtojärjestys korjattu alkuperäisiä PSD-ID:itä säilyttäen. Hahmon keskitys käyttää liikkuvien osien rajoja; turvarajat ovat editoriapu.

Äänitiedostoja ei ollut mukana, joten puhutun KILSAT-jakson lopullinen vienti on vielä todentamatta. Puhesynteesiä ei kytketty. Testit käyttävät koodia, simuloituja äänen näytteitä ja paketin runtimea; laitteita ja selainikkunaa ei testattu.

## 0.7.0 · yleinen jaksotyökalu

KILSATin nimisidokset poistettu toteutuslogiikasta; käyttäjä yhdistää nimet kirjaston hahmoihin. Yleinen ohjaussuunnitelma säilyttää tarkoituksen, hahmojen luonteen/suhteet, ympäristön, sijoittelun, toiminnan, äänet, kameran, tauot, kiellot ja lopetuksen sekä lähdeviitteet. Arviot vahvistetaan, puuttuvat olennaiset ohjeet estävät rakentamisen. Liikkeet yhdistetty nykyiseen screenplay-/IK-moottoriin. Taustan vaihdot, jatkuva maailmantila, aktiivisen kulman puhesuu, rajaus ja määräaikaiset otsikkokortit toimivat yhteisessä renderöinnissä.

Toinen hyväksymissyöte: Mira/Niko autossa, eri miljööt ja ajat, vilkutus/kävely/nyökkäys ja oma lopetus. Kooditestit tarkistavat myös projektin roundtripin, puuttuvien resurssien eston, täsmälliset aikaristiriidat, käyttäjän arvioiden hyväksynnän ja live-datan puuttumisen vientirenderöinnistä. Tulkinta on paikallisiin sääntöihin perustuva; puhesynteesiä tai oikeaa valmista puhuttua videota ei ole mukana.

## 6.10.2026 · 0.38 — KILSAT Studio UI-yhtenäistäminen (käsikirjoitus)

### Kehitysvaihe
Visuaalinen polish (Rive / Character Animator -henki), suomenkielinen UI ja kaikki olemassa olevat toiminnot säilyvät. Viisi tuotantovaihetta on **navigointi** (`studio-flow-nav`), ei erillistä datamallia työtiloille 2–5.

### Valmis (koodi)
- Tokenit ja `ui-minimal.css`: tummat pinnat, accent, shot-kisko, export/tuotanto.
- Resolve-hover tokenit (`--resolve-*`), työvaihe- ja kuvakorttien `:hover`; **tuotantokierros** (`localStorage` `hahmostudio-studio-flow-tour-v1`); **Ohje → Näytä tuotantokierros uudelleen**.
- Työvaihe-pin + **Asetukset → Tuotantovaihe** (rajaus päälle/pois, nollaus); FigJam-copy: `docs/FIGJAM-STUDIO-FLOW.md`.
- **Käsikirjoitus:** `script-compose` — toolbar (Tuo, Esimerkit), editori, status, sticky **Jaa kohtauksiin**; variantit `panel` | `focus` (`scriptPage`).
- Aikajana piilotetaan käsikirjoitusvaiheessa ja focus-näkymässä.
- Työvaihe-nav, tiiviimpi yläpalkki, import-kortin näkyvyys; `DEVELOPMENT-0.38.md` (px-spec).

### UX / Figma
- FigJam user flow: [KILSAT Script user flow](https://www.figma.com/board/RQ3kH9AAduLT7E3iJabv3e).
- Figma Design: [KILSAT Script UI · 0.38](https://www.figma.com/design/FFy68Fynv4Ds2VgRANZoXc) — wireframe **00 Script** + localhost-capture [Script / Panel · 02 Draft (capture)](https://www.figma.com/design/FFy68Fynv4Ds2VgRANZoXc?node-id=2-2). Seuraavaksi: focus-näkymän toinen capture, FigJam-prototype-linkit.
- Figma Resolve: [KILSAT Studio · UI Resolve](https://www.figma.com/design/vfBqIrcXhys0XoTODSbsI5) — 5 työvaihe-framea, **Comp / Työvaihe-kortti** ja **Comp / Shot-kortti** (default/hover/active|selected), **Opastus / Spotlight · 1–5** (prototype: Seuraava, Ohita, Avaa näkymä, nav-hitit → `01…05`, beacon → spotlight). Present-aluksi **Opastus / Spotlight · 1**.

### Tarkistukset
- `npm run typecheck`, `npm test` (952) koodissa.
- Visuaalinen: `npm run desktop:dev` → Käsikirjoitus → toolbar + sticky CTA; yläpalkin Käsikirjoitus → focus, aikajana pois.

### 0.39 (valmis · pushattu)
- `@mira → MIRA`, `speakerHandles`, **SpeakerBindingTable**, **shot-guard**, testit. GitHub `main`: `530b8d8` (2026-10-06).
- FigJam stickyt: käsin (`docs/FIGJAM-STUDIO-FLOW.md`), ei repossa.

### 0.40 (pushattu · `f35f9f2`)
- Puhujan pakettivalinta taulukosta Käsikirjoituksessa. `DEVELOPMENT-0.40.md`.

### 0.41 (pushattu · `e865e4f`)
- Script focus, Hahmot-sidonta, lukitus-esto. `DEVELOPMENT-0.41.md`.

### 0.42 (pushattu · `ef68f6c`)
- **Figma:** `docs/FIGMA-SCRIPT-FOCUS.md` (capture käsin FigJam/Figmaan).
- **Journal:** `bind-cast`-komento editor + käsikirjoitus.
- **Varoitus:** hyväksytty kuva + muuttunut teksti → varoitus (lukitus → esto).
- `DEVELOPMENT-0.42.md` · `npm test` 962.

### 0.43 (valmis koodissa · ei pushattu)
- Parse-vahvistusdialogi (`ScriptReparseConfirm`) hyväksytyille kuville.
- Script UI Figma-pariteetti: focus/panel CSS, `docs/FIGMA-UI-PARITY.md`.
- `DEVELOPMENT-0.43.md` · testit ajettava pushin yhteydessä.

### 0.44 (valmis koodissa · ei pushattu)
- Resolve-pariteetti: työvaihe 01–05, `resolve-shot-card`, `resolve-segmented`.
- `docs/FIGMA-RESOLVE-PARITY.md` · `DEVELOPMENT-0.44.md`.

### Seuraava
- Figma focus / Resolve -screenshot FigJamiin (käsin): `docs/FIGMA-SCRIPT-FOCUS.md` + `docs/FIGMA-RESOLVE-PARITY.md`.
