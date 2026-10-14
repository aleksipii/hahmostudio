# Koetan ammattitason kehitysvaiheet

Kohde on luotettava paikallinen englanninkielisten animaatiojaksojen studio.
Käyttäjän järjestys: ominaisuudet ensin, oikean Macin hyväksyntä ja
keveysmittaukset viimeiseksi. Henkilökohtainen käyttö ei edellytä tässä
vaiheessa julkisen jakelun allekirjoitusta tai notarisaatiota.

## Agenttien toteutuskierros 14.10.2026

Pääagentti omistaa integraation, yhteiset rajapinnat, dokumentaation,
käyttöliittymätarkistuksen ja lopulliset testit. Erikoisagentit eivät commitoi
tai pushaa itsenäisesti. Kaikki työ tehdään nykyisessä pilvicheckoutissa;
samalla tiedostolla on yksi omistaja.

| Vaihe / agentti | Omistetut tiedostot | Tämän kierroksen toteutus | Jatkohyväksyntä |
| --- | --- | --- | --- |
| 1. Pilotti ja puhe / `pilot_voice` | `hs-app/voice_ui.rs`, `hs-voice/store.rs` | Peruutettava Kokoro-kansiotuonti taustalla, siirron eteneminen, katkenneen työn diagnostiikka, vanhan mallin palautus tallennusvirheessä | Aito englanninkielinen Kokoro, kuuntelu ja äänen/suun yhteistoiminta; julkisen mallin aiempi CDN403 on edelleen ulkoinen este |
| 2. Animaation laatu / `animation_quality` | `hs-agents/contacts.rs`, `tests/object_contacts.rs`, floor-pickup-esimerkki | Lattialta nostaminen kyykistyen, nilkka-/varvasankkurit, ote, omistajuus ja seisomaan palautuminen | Taiteellinen arvio; laajemmat actor–actor-kontaktit, siirtymät ja dynaamiset törmäykset |
| 3. Editorin työnkulku / `editor_workflow` | `hs-app/timeline_ui.rs` | Hahmon rivien ryhmävalinta, tyhjennys ja määrän näyttö; lähdemuutos mitätöi vanhan valinnan | Pilottijakson käytettävyyskoe, suuret aikajanat, laajemmat ryhmäoperaatiot |
| 4. Projektien luotettavuus / `project_resilience` | `hs-project/recovery.rs` ja crate-ohje | Uusi palautustallennus julkaistaan ennen vanhojen poistamista; epäonnistuminen säilyttää molemmat palautuskopiot | Pitkät muokkausistunnot, suuret käyttäjäprojektit ja todellinen levyn täyttyminen |
| 5. Kuva ja ääni / `picture_audio` | `hs-audio/lib.rs` | 5 ms master-voimakkuusrampi, äärellisten laitenäytteiden tarkistus ja mikrofonin väliaikaisen puskurivarauksen poisto | Toiston hakujen/pysäytyksen häivytys, vientimiksauksen kuuntelu/loudness sekä valaistuksen ja materiaalien seuraava toteutus |
| 6. Mac ja mittaukset / `release_readiness` | `native/packaging/measure_macos.py`, testit ja paketointiohje | Toistettava PID-kohtainen CPU/RSS- ja pakettikokomittaus, tulokset JSON:iin | Vasta aiempien vaiheiden jälkeen oikea Mac/Metal/Finder/laitteet/VoiceOver/DMG; energia Instrumentsilla |

Pääagentti lisää ryhmävalinnan korostuksen aikajanan piirtoon. Valitut rivit
luetaan kerran piirtoa kohti, ei uudelleen jokaiselle palikalle.

## Toinen agenttikierros 14.10.2026

| Agentti | Toteutus | Rajat |
| --- | --- | --- |
| `animation_quality` | Hahmojen vartalo-, pää- ja jalkakapselien kontaktit sekä samanaikaisesti liikkuvien reittien tarkistus; rivillä näkyvät osapuolet ja aika | Konservatiivinen proxy, 3 mm toleranssi; ei sormien/vaatteiden fysiikkaa tai automaattista väistöä |
| `release_readiness` (tässä kierroksessa liikkeet) | Vilkutus, osoitus, olankohautus ja taputus palautuvat pehmeästi alkuperäiseen nivel- ja sormiasentoon | Tuetut eleet, ei yleinen kaikkien liikkeiden yhdistelijä; juuren rata ja jalat säilyvät |
| `editor_workflow` | Valittujen rivien yhteinen raahaus, ruutuihin kohdistettu siirto, esikatselukehykset, tarkistettu hyväksyntä ja Escape-peruutus | Puhe/liike siirtyvät yhdessä; oikea reuna muokkaa edelleen yksittäisen palikan kestoa |
| `picture_audio` | Toiston käynnistys/pysäytys/haku ja äänilähteen vaihto saavat 5 ms siirtymän; callback ei voi ylikirjoittaa uudempaa hakua | Lyhyt edellisen näytteen häntä, ei kahden jatkuvan puheraiteen miksaus; laitekuuntelu avoinna |
| `pilot_voice` (tässä kierroksessa kuva) | Sama hillitty avainvalon kiilto CPU:ssa ja GPU:ssa, Flat/Cel-tyylit; valosuunnan pituus ei muuta kirkkautta | Tyylitelty kiilto, ei PBR-materiaaleja/HDR:ää tai uusia GPU-riippuvuuksia |
| `project_resilience` | Projektin ZIP-hakemiston koko tarkistetaan ennen indeksointia; rikkinäinen ulompi arkisto ei palaudu aineiston sisäiseen arkistoon | Lukutavujen sisältö ei muutu; tuetaan rajattu absoluuttinen ZIP64, ei monilevyistä tai suhteellisesti upotettua ZIP64:ää |

Pääagentti integroi ryhmäraahauksen, lisäsi tuotantovirheen rivipainikkeen ja
korjasi ⌘⇧Z:n käsittelyjärjestyksen: uudelleenteko tarkistetaan ennen kumoamista.
Esimerkkireitit muutettiin törmäämättömiksi; käyttäjän projekteja ei muuteta automaattisesti.
Mac-hyväksyntä ja mittaukset jäävät edelleen viimeiseksi.

Liikkeiden esimerkki: [gesture-transitions.en.txt](../../native/examples/gesture-transitions.en.txt).

## Mitä valmistuminen tarkoittaa

Tekninen testi ei korvaa valmista jaksoa tai taiteellista hyväksyntää.
Ensimmäinen tuotantohyväksyntä tarvitsee 20–30 sekunnin kahden hahmon jakson:
oikeat eri Kokoro-äänet tai omat äänitykset, toteutuneet kontaktit ja liikkeet,
kuvakoon vaihto, tallennus ja uudelleenavaus samoine äänineen, englanninkieliset
tekstitykset ja kuunneltu MP4. TestEngine-äänet merkitään testiaineistoksi.

Tallennusvirhe ei saa kadottaa aiempaa projektia. Peruutettu työ ei saa
korvata muokattua kuvaa tai vanhaa mallia ennen sen lopullista julkaisukohtaa.
Tuntematon ohje, mahdoton ote tai toteutumaton kontakti estää viennin
lähderivivirheellä. Käyttäjä arvioi liikkeen esikatselusta.

Nykyinen 8-bittinen ohjelmistorenderöinti ei vielä toteuta täyttä PBR-valaistusta,
HDR:ää, refraktiota tai path tracingia. Tämä kierros ei nimeä sovellusta valmiiksi
ammattistudioksi. Tarkat ajetut testit, havainnot ja jatkotyö kirjataan TIIMI.md:hen.

## Ensimmäisen kierroksen tekninen tarkistus

Linuxissa: `cargo test --locked --workspace -j2` läpäisi 374 testiä;
yksi oikeaa Kokoro-mallia tarvitseva testi jätettiin ajamatta. App/CLI-build
ja workspace-clippy läpäisivät, tyylivaroituksia jäi. Paketoinnin 16 Python-testiä
läpäisivät. Xvfb/lavapipe-esikatselu todensi noston ja seisomaan palautumisen,
puhepaneelin puuttuvan mallin tilanteen sekä hahmon ryhmävalinnan korostuksen
ja tyhjentymisen lähdemuutoksessa. Floor-pickup-esimerkistä vietiin oikea
4 sekunnin H.264-MP4 CPU:lla ilman puhetta; se ei ole Kokoro-pilotti.

## Toisen kierroksen tekninen tarkistus

Linuxissa 400 Rust-testiä läpäisi, yksi oikeaa Kokoro-mallia tarvitseva testi
oli edelleen ohitettu. App/CLI-build ja workspace-clippy läpäisivät;
tyylivaroituksia jäi. GPU-testit ajettiin oikeasti Vulkan/lavapipella:
CPU/GPU-kuvien keskiero oli Flat 0.23 ja Cel 0.32, ja kiillon 12 vertailutilannetta
läpäisivät. Kyse on Linuxin ohjelmistorenderöijästä, ei Macin Metal-testistä.

Xvfb-käyttöliittymässä kaksi toimintoriviä siirtyi raahauksella +0.5 s,
hyväksyntä muutti jakson 4.0→4.5 s, Ctrl+Z palautti 4.0 s ja Ctrl+Shift+Z
palautti 4.5 s. Escape perui uuden luonnoksen muuttamatta käsikirjoitusta.
Törmäävä reitti esti näyttämön ja ilmoitti rivin, molemmat hahmot ja ajan.
Ele-esimerkistä vietiin 10 sekunnin H.264-MP4 CPU:lla ilman puhetta.
Oikea puhe, taiteellinen arvio ja Mac-hyväksyntä ovat edelleen erillisiä tehtäviä.
