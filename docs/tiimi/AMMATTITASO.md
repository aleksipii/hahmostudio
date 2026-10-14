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

## Tämän kierroksen tekninen tarkistus

Linuxissa: `cargo test --locked --workspace -j2` läpäisi 374 testiä;
yksi oikeaa Kokoro-mallia tarvitseva testi jätettiin ajamatta. App/CLI-build
ja workspace-clippy läpäisivät, tyylivaroituksia jäi. Paketoinnin 16 Python-testiä
läpäisivät. Xvfb/lavapipe-esikatselu todensi noston ja seisomaan palautumisen,
puhepaneelin puuttuvan mallin tilanteen sekä hahmon ryhmävalinnan korostuksen
ja tyhjentymisen lähdemuutoksessa. Floor-pickup-esimerkistä vietiin oikea
4 sekunnin H.264-MP4 CPU:lla ilman puhetta; se ei ole Kokoro-pilotti.
