# Käsikirjoituksella ohjattava Rust-animaatiostudio

Tutkimus ja toteutussuositus, 14.10.2026. Kohde: englanninkielinen alkuperäinen
3D-animaatiosarja, jakso 30–60 s, TikTok/Instagram/YouTube. Ensisijainen ohjaus
on käsikirjoitus. Kameraesityksen tallennus on myöhempi valinnainen lisä.

## 1. Suositus käyttäjälle

Rakenna yksi laadukas, toistettavasti tuotettava pilotti: kaksi hahmoa, yksi
paikka, 30 s, kolme kuvakokoa, oikea puhe ja toimiva huulisynkka. Sen jälkeen
laajenna 60 sekuntiin ja useampiin tapahtumapaikkoihin. Älä aloita laajasta
Photoshop-/video-/rigieditorista tai valtavasta liikekatalogista.

Uudessa repositoriossa suositukseni on Bevy + bevy_egui, englannin Kokoro
Candle-pohjaisella Rust-sovituksella, GLB-hahmot, omat Rust-domain-/ajoitus-
moduulit ja erillinen videovienti. Valitse yhteensopivat vakaat versiot
Bevy/bevy_egui-taulukosta ja lukitse ne; tutkimuksessa luetut main-haarojen
esimerkit eivät ole lupaus vakaan version API:sta. Ei kahta rinnakkaista
renderöintimoottoria eikä Bevy-moottorin rinnalle eframe-ikkunajärjestelmää.

Nykyiseen Koetaan ei kannata siirtää Bevyä väkisin: sillä on jo oma
wgpu/CPU-putki. Hyödynnä tarkistettu käsikirjoitus-, projekti-, ääni- ja
ajoituslogiikka tarpeen mukaan, mutta selvitä riippuvuudet ennen siirtämistä.
Uutta repositorya tai Bevy-sovellusta ei luotu tämän tutkimuksen aikana.

Pixar on kuvan ja näyttelyn laatutavoite, ei kirjaston nimi tai automaattinen
hyväksyntä. Teknisesti toimiva PBR-renderöinti ei yksin tuota elokuvan laatua.
Hahmosuunnittelu, riggaus, animaation ohjaus, kamera, valaistus ja viimeistely
ovat erillistä tuotantotyötä. Lyhyt jakso pienentää työmäärää, ei laatukriteeriä.

## 2. Mitä ensisijainen käsikirjoitusohjaus tarkoittaa

Käsikirjoitus on projektin muokattava lähde. Jokainen repliikki ja toiminto
saa pysyvän ID:n; animaation arviointi käyttää absoluuttista kohtausaikaa.

1. Jäsennin erottaa repliikit, toimintaohjeet, hahmot, paikat ja kamerat.
2. Validointi tarkistaa olemassa olevat resurssit ja toteutetut toimintotyypit.
3. Repliikeille valitaan oma/tuotu äänitys tai hahmon pysyvä Kokoro-ääni.
4. Tuotetaan lopullinen ääni, äänteiden ajoitus ja visemit.
5. Kohtauksen ajoitus ratkaistaan todellisen äänen keston perusteella.
6. Näyttelykerros tuottaa liikkeet, katseet, ilmeet ja reaktiot.
7. Kamera ja valo suunnitellaan tarkistettaviksi ehdotuksiksi.
8. Sama ratkaistu kohtaus toistetaan esikatselussa ja renderöidään vientiin.

Vapaa tarinankerronta ja tarkat toimintaohjeet erotetaan. Sääntöpohjainen
jäsennin toteuttaa dokumentoidut komennot, ei ymmärrä kaikkia englannin lauseita.
Valinnainen kielimalli saa ehdottaa rakenteista kohtausluonnosta. Sen tulos
validoidaan samalla tavalla ja käyttäjä hyväksyy sen ennen tuotantoa.
Kielimalli ei saa keksiä uusia resursseja tai kiertää toteuttamatonta kontaktia.

Vitsi, tunne tai henkilön motivaatio ei määritä yhtä yksiselitteistä liikettä.
Näyttelytyyli ja ohjaajan valinnat tarvitsevat muokattavan esikatselun.
Käsikirjoitus voi ilmaista tarkoituksen, mutta tuotantotason esitys ei synny
pelkästään sanakirjaa laajentamalla.

## 3. Teknologiavalinnat ja Pure Rust -raja

| Osa | Valinta | Mitä lähde todistaa / käytännön raja |
|---|---|---|
| 3D-runtime | Bevy | Rust-moottori; viralliset esimerkit näyttävät GLB-animaation ja morph target -animaation. Editorin aikajana ja vienti rakennetaan itse. [1–3] |
| Grafiikka | Bevyn wgpu | Natiivi Rust-API käyttää Macilla Metalia ja järjestelmäajuria. WGSL on shader-kieli, ei C/C++-kirjasto. [4] |
| Editorin UI | bevy_egui / egui | Rust-käyttöliittymä ja Bevy-integraatio, versioyhteensopivuus tarkistetaan. [5–6] |
| Matematiikka / domain | glam, serde, rayon | Hyvä lähtökohta; valittujen versioiden ja ominaisuuksien riippuvuudet auditoidaan. |
| Hahmot | GLB/glTF 2.0 | Formaatti määrittelee skinningin, animaation ja morph-painot; ei valmista yhteistä kasvorigiä. [7] |
| Puhe | Candle + Kokoro-sovitus | Rust-päättely; Kokoron 82M-mallikortti ilmoittaa Apache-2.0-painot. Sovitus, G2P, sanastot ja äänet auditoidaan erikseen. [8–10] |
| Äänentoisto | cpal | Rust-API, mutta käyttöjärjestelmän äänirajapinnat/natiivikirjastot; Linuxissa mm. ALSA. [11] |
| Videovienti | Erillinen FFmpeg-prosessi | Kypsä käytännön vaihtoehto, ei Pure Rust. Rakennusvalinnat vaikuttavat LGPL/GPL-lisenssiin. [12] |
| Kamera-analyysi | Myöhempi paikallinen moduuli | MediaPipe ei ole suoraan Rust-kirjasto; sen virallinen jakelu sisältää muita kieliä ja natiivikomponentteja. [13] |
| ONNX-vaihtoehto | Mallikohtainen arvio | ort yleensä käärii C++ ONNX Runtimea; Rust-API ei takaa Rust-toteutusta. Muita backend-vaihtoehtoja ei pidetä automaattisesti malliyhteensopivina. [14] |

Suositeltu sopimus: oma sovellus/domain/renderöintilogiikka Rustia, ei
Electronia/Nodea/Python-palvelinta ajonaikaisessa perustyönkulussa. OS:n
Metal/CoreAudio/ikkunarajapinnat hyväksytään järjestelmäpalveluina.
FFmpeg on erillinen dokumentoitu poikkeus, jos käyttäjä hyväksyy sen.
Jos vaatimus on ehdottomasti ei yhtään C/C++-komponenttia, FFmpeg, tavallinen
ONNX Runtime ja MediaPipe eivät kuulu toimitukseen; MP4-koodekki ja tarkka
äänikohdistus tutkitaan toteutettavuusvaiheessa ennen muuta laajennusta.

Pure Rust ei tarkoita pelkkää CPU-renderöintiä. Elokuvatasoisen 1080p-videon
jatkuva ohjelmistorenderöinti olisi kallis päätyönkulku. CPU-renderöijä sopii
referenssiksi, testeihin ja yksittäisiin passivienteihin; GPU tekee esikatselun
ja laadukkaamman offline-viennin. Bevy on esikatselun järkevä lähtökohta,
ei valmiiksi todennettu elokuvan path tracer.

Blender voidaan käyttää erillisenä hahmojen valmistustyökaluna. Se ei ole
Pure Rust eikä sisälly studion runtimeen vain siksi, että sillä tehdään GLB.
Tarkista valmistetun aineiston lisenssit; formaatin avoimuus ei anna oikeuksia
jonkun toisen hahmoihin. Blenderin varsinaista glTF-vientiohjetta ei saatu
luettua tässä ympäristössä, joten exporter-kohtaiset rajoitukset on tarkistettava.

## 4. Arkkitehtuuri, joka pysyy hallittavana

Ehdotetut Rust-moduulit/cratet:

- `studio-domain`: sarja, jakso, kohtaus, repliikki, resurssi-ID, revision.
- `studio-script`: rajattu ohjekieli, lähderivit, validointi; ei renderer-riippuvuutta.
- `studio-speech`: äänilähde, Kokoro, tallennettu PCM, välimuisti, kohdistusadapteri.
- `studio-animation`: absoluuttinen ajoitus, visemit, näyttely ja kontaktiratkaisu.
- `studio-scene`: Bevy-adapteri, GLB-lataus, rigisopimus, valot ja kamerat.
- `studio-project`: formaatti, migraatiot, atominen tallennus, resurssien hashit.
- `studio-export`: kuvasuhteet, offscreen-renderöinti, ääni ja tekstitykset.
- `studio-app`: yksinkertainen UI ja taustatyöjonot.

Bevyn Entity-tunnisteita ei tallenneta projektin domain-ID:iksi. GLB:n
luu-/morph-indeksit sidotaan nimillä tarkistettuun hahmoprofiiliin; nimi puuttuu
→ tuonnin selkeä virhe. Ei hiljaista indeksien arvaamista toisesta rigistä.

Domain-ajat säilytetään kokonaislukutickeissä/rationaalisesti. Äänen kohdistus
säilytetään näyteindekseinä ja näytetaajuutena; renderöintiruutu johdetaan
samasta aikapohjasta. Ei seinäkelloon perustuvaa animaatiota tai koko jakson
ajoituksen ratkaisemista uudelleen jokaisessa ruudussa.

Alussa yksi pääagentti ja tarpeen mukaan yksi hahmo-/renderöintiagentti sekä
yksi puhe-/ajoitusagentti. Omistus tiedostoittain. Ei koko ominaisuuslistan
rinnakkaista rakentamista. Tallennus-/puhe-/rigisopimukset sovitaan ensin.

## 5. Huulisynkka: suositeltu oikea toteutus

### Kokoro-puhe

Kokoron virallinen Python-putki käsittelee `pred_dur`-kestoja ja muodostaa
sanatason aikaleimoja. Lähteessä on 24 kHz -ääneen liittyvä 600 näytteen
skaalaus, BOS-/välilyöntikorjauksia ja jopa offsettiin liittyvä TODO. [9–10]
Näitä arvoja ei saa kopioida sokkona eri Rust-sovitukseen.

Nykyisen Koetan `omp-voice-kokoro 0.1.0` laskee tokenkohtaiset kestot ja
kohdistuksen sisäisesti, mutta julkinen `forward_with_mode` palauttaa ääni-
tensorin. Lisäksi tämä sovitus normalisoi BOS/EOS-kestoja omalla tavalla.
Tarvittava jatkotyö on versionlukittu upstream-muutos tai ylläpidetty sovitus,
joka palauttaa yhdessä äänen, tokenit, tokenkohtaiset kestot ja mallirevision.
Älä muokkaa Cargo-cachen riippuvuutta: muutos ei olisi toistettavissa.

Käytä vain niitä tokeneita, jotka oikeasti menivät mallille. Säilytä G2P:n
alkuperäisen tekstin, IPA-tokenien ja mallin token-ID:iden vastaavuus.
Tuntematon token ei saa jäädä vain äänen syötteestä pois ja silti visemilistaan.
Käsittele BOS/EOS, välilyönnit, välimerkit, nopeus, chunk-raja ja mahdollinen
lisätty hiljaisuus eksplisiittisesti. Aikaleimat kootaan lopullisen yhdistetyn
PCM:n näytekelloon; niitä ei lasketa uudelleen tekstin merkkimäärästä.

Synteesi voi käyttää satunnaisuutta. Tallenna lopullinen ääni ja kohdistus
samana resurssikokonaisuutena; projektiin uudelleenavaus ei syntetisoi uusiksi.
Välimuistiavaimeen kuuluvat teksti, hahmoääni, nopeus, G2P-/mallirevision ja
relevantit asetukset/siemen. Kohdistus sitoutuu lisäksi todellisen äänen hashiin.

### Oma tai tuotu ääni

Tunnettu käsikirjoitusrivi + todellinen äänitiedosto tarvitsee forced alignment
-kohdistuksen. Sana-ajastus ei yksin riitä tarkkoihin suun sulkeutumisiin;
tavoite on äännetason ajoitus. Mallin kieli, sanasto ja poikkeamat käsikirjoituksesta
pitää käsitellä. Epävarma kohdistus näytetään muokattavana, ei varmana tuloksena.

Montreal Forced Aligner on hyödyllinen vertailutyökalu: sen virallinen README
kertoo Python/Kaldi/Pynini-riippuvuuksista. Se ei ole Pure Rust -runtime. [15]
Rhubarb tuottaa käytännöllisiä suumuotojen ajoituksia ja voi käyttää dialogia
apuna, mutta ei sekään ole Rust-perusratkaisu. [16] Käytä näitä hyväksyntä-
vertailuun tai valinnaiseen ulkoiseen adapteriin, jos riippuvuus hyväksytään.

Tiukka Rust-polku: valitse englannille toimiva kohdistusmalli, varmista sen
operaattorit ja aja se Candle-/muulla auditoidulla Rust-backendillä. Tämä on
oma toteutettavuustehtävä, ei valmiiksi todettu ominaisuus. Pelkkä äänenvoimakkuus
ja nollanylitysten määrä tunnistavat puheaktiivisuutta, eivät luotettavasti
kaikkia englannin äänteitä. Näitä käytetään korkeintaan merkittyyn luonnokseen.

### Visemit ja kasvojen ohjaus

Aloita 10–12 käyttökelpoisesta muodosta: lepo, M/B/P, F/V, A, E/schwa, EE,
O, OO/W, L/TH ja yleiskonsonantti. Yksi visemi kattaa useita äänteitä;
kirjoituksen kirjain ei vastaa aina englannin äännettä. Lisää muodot vain,
kun hahmon rigissä on niille oikeasti laadukas geometria.

Ohjaa kasvoja kanavilla: leuan avautuminen, huulten sulku, leveys, pyöristys,
F/V-kontakti, kieli ja suupielet. Täydentävä tunnekerros hallitsee hymyä,
silmänympäryksiä ja kulmakarvoja. Puheen M/B/P-sulku ei saa avautua hymykerroksen
vuoksi. Kameraesitys ei saa samanaikaisesti kirjoittaa puhekanavia ilman
käyttäjän valitsemaa yhdistämissopimusta.

Tee koartikulaatio: seuraavan muodon ennakointi ja edellisen vaikutuksen
vaimeneminen. A/B-testaamalla päätettävä visuaalinen pehmennys ei saa poistaa
lyhyttä M/B/P-sulkua tai F/V-kontaktia. Ei yhtä 50 ms vähimmäiskestoa kaikkiin
äänteisiin. Aikaleimojen säilyminen ja hyvännäköinen liike ovat kaksi eri testiä.

## 6. Tässä tutkimuksessa tehty Rust-lisäys

`hs-lipsync/src/alignment.rs` lisää näytekelloon sidotun `AlignedViseme`-
rajapinnan ja `from_aligned`-rakentajan. Se ottaa lopullisen monoäänen ja
ulkopuolelta vahvistetut/käyttäjän korjaamat visemivälit. Se hylkää tyhjät,
päällekkäiset, väärin järjestetyt, äänen ulkopuoliset ja aikaprecision ylittävät
välit sekä virheelliset ääniarvot. Hiljaiset välit saavat lepoasennon.
Lyhyitä tapahtumia ei yhdistetä heuristiseen vähimmäiskestoon.

Tämä on testattu ajoitusadapteri, ei uusi puheentunnistusmalli tai valmis
Kokoro-kestojen poiminta. Nykyinen tuotantopolku käyttää edelleen heuristista
huulisynkkaa, kun tarkkaa kohdistusta ei ole. Adapteri ei ole vielä kytketty
projektin kohdistusresurssiin tai sovelluksen UI:hin. Nykyisen `shape_at`-
ristihäivytys säilyy: erittäin lyhyiden sulkujen täysi visuaalinen toteutus
vaatii seuraavaksi erikseen viritetyn koartikulaation ja oikean kasvorigin.

## 7. Ammattimaisen hahmon vähimmäisvaatimukset

Osta/valmista kaksi alkuperäistä tuotantohahmoa, joilla on huolellinen topologia,
UV:t ja materiaalit. Pure Rust ei edellytä kaiken hahmogeometrian rakentamista
koodissa primitiveistä. Parametrinen demo on hyvä tekninen testi, mutta sen
muotolaatu ei automaattisesti riitä tavoiteltuun lopputulokseen.

GLB-tuontisopimus määrittää mittakaavan, suunnan, restposen, luunimet,
inverse bind -matriisit, materiaalikanavat ja morph target -nimet. glTF
siirtää morph-animaatioita, mutta ei kaikille hahmoille yhteistä kasvojen
merkitystä. Nimet ja merkitykset sidotaan hahmoprofiilissa. [7]

Tarvittavat kasvokanavat: vasen/oikea räpäytys, katse, kulmakarvat, posket,
leuka, huulet, suupielet sekä visemit. Hampaiden, kielen ja silmäluomien
läpileikkaukset tarkistetaan äärimuodoissa. Skinning ja morphit testataan
myös yhdessä ilmeen/puheen/pään käännöksen kanssa.

Liikkeiden retargetointi tarvitsee profiilin: luiden nimeäminen, akselit,
rajoitteet, hahmon mitat ja jalka-/käsikontaktit. Sama animaatio ei sovi
mihin tahansa hahmoon vain vaihtamalla luunimet. Testaa kaksi eri mittaista
hahmoa ennen suuren liikeaineiston rakentamista.

## 8. Näyttely, liike, kuva ja valo

Käsikirjoitus määrittää toiminnan; laadukas näyttelykerros lisää hallittavia
ennakointeja, katseen siirtymistä ennen vastaamista, hengitystä ja eleiden
ajoitusta. Näyttelyprofiili on hahmokohtainen ja versioitu. Satunnaisvaihtelu
käyttää tallennettua siementä ja etukäteen tuotettuja ratoja.

Kerrosjärjestys: perusasento/liikkuminen → authored-eleet → keskustelun eleet
→ katse/ilme → puhekanavat → kontaktit/rajoitteet. Konfliktit ratkaistaan
kanavakohtaisella sopimuksella, ei sillä kumpi järjestelmä sattuu päivittymään
viimeksi. Kantava käsi ei vilkuta; tukeva jalka ei luista maassa.

Valaistuksen ensimmäinen hyväksyttävä taso: harkittu key/fill/rim, varjot,
PBR-materiaalit, sävyjen hallinta ja yhtenäinen värimuunnos. Lopullisessa
viennissä laadukkaampi antialiasing/resoluutio; esikatselussa pienempi kuorma.
Hiukset, ihon sironta, GI ja vaatefysiikka ovat erillisiä laadun laajennuksia.
Älä rakenna koko path traceria ennen kuin valaistu pilotti näyttää hyvältä.

Kameraehdotukset: laaja, kaksikko, lähikuva ja reaktiokuva. Säilytä katsesuunnat
ja keskustelun jatkuvuus. Automaattinen leikkaus on muokattava ehdotus.
Pystysuora ja vaakasuora versio tarvitsevat omat rajaukset, eivät vain croppia.

## 9. Projektit ja välimuisti

Sarja sisältää pysyvät hahmo-/ääni-/maailmaprofiilit; jakso viittaa versioituun
snapshotiin. Jakso sisältää lähteen, ratkaistun aikajanan, ääniresurssit,
kohdistuksen, animaatioradat, kamera-/valoasetukset ja vientiasetukset.

Tallenna schema_version, resurssien SHA-256, sample_rate, model/G2P/aligner-
revision ja synteettisen äänen alkuperä. Ei absoluuttisia henkilökohtaisia
hakemistopolkuja projektin resursseihin. Mallipainot sovellusdatassa,
ääni-/animaatioresurssit projektissa. Offline-avaus ei vaadi mallin lataamista.

Muuttunut repliikki mitätöi sen äänen/kohdistuksen ja siitä riippuvan
kohtaustimingin; muuttunut valo ei mitätöi puhetta. Hahmon uusi ääni mitätöi
vain synteettiset otot, ei käyttäjän hyväksymää omaa äänitystä.
Tallennus/vienti tehdään väliaikaiseen kohteeseen ja julkaistaan onnistuneena;
epäonnistuminen ei korvaa aiempaa toimivaa projektia tai videota.

## 10. Sarjatuotanto ja somevienti

Alkuasetukset suunnitelmana: 1080×1920 9:16, 30 fps ja 30–60 s pystyjakso;
1920×1080 16:9 vaihtoehtoisella kameralla YouTubeen. 30 s = 900 ruutua,
60 s = 1800 ruutua. Yksi ruutu 1080×1920 RGBA8 on noin 7.9 MiB;
1800 pakkaamatonta ruutua on noin 13.9 GiB. Vienti streamaa ruudut, ei
pidä koko jaksoa RAMissa eikä monista kaikkia AOV-passiruutuja sinne.

MP4-suositus käytännön vientiin: H.264, yhteensopiva 8-bit 4:2:0-kuva,
AAC-ääni, tasainen ruutunopeus ja verkkoavausta tukeva MP4-rakenne.
Nämä ovat toimitusasetusehdotuksia, eivät kaikkien somepalvelujen tämänpäiväisten
vaatimusten tarkistettu yhteenveto. Tarkista alustojen viralliset rajat
julkaisuvaiheessa; tutkimusympäristö ei päässyt niiden ohjesivuille.

Englanninkieliset tekstitykset johdetaan samasta vahvistetusta repliikkiajoituksesta.
Poltetut tekstit + erillinen SRT; sivumarginaalit ja UI:n peittoalueet
muokattavina presetissä. Testaa puhelimessa, että kasvot ja tekstit eivät peity.
Pidä dialogi ymmärrettävänä musiikin päällä, tarkista clipping, true peak ja
koettu voimakkuus oikealla kuuntelulla. Ei universaalia LUFS-lupausta kaikille
alustoille. Miksaus säilyy muokattavana eikä Kokoron ääntä venytetä, jotta
jakso väkisin mahtuisi kestotavoitteeseen.

## 11. Yksinkertainen käyttöliittymä

Yksi pääikkuna: käsikirjoitus vasemmalla, esikatselu keskellä, valitun rivin
asetukset oikealla ja pieni kohtausaikajana alhaalla. Päätoiminnot:
Tuota puhe → Toista → Tallenna → Vie video. Ei yhtä aikaa kaikkia editoreita.

Klikattava rivivirhe vie lähteeseen. Puhe-/kohdistus-/rigivirhe selitetään
käyttäjän toiminnalla: puuttuva ääni, puuttuva suumuoto, epävarma kohdistus.
Tarkka huulisynkan muokkaus avataan repliikin kautta, ei pakollisena näkymänä.
Kamera/mikrofoni ovat oletuksena suljettuja. Kokoro latautuu tarvittaessa.

Taustatyöjono erottaa latauksen, synteesin, kohdistuksen ja viennin. Työt ovat
peruutettavia, eivät estä editoria; valmis tulos hyväksytään vain jos sen
repliikki-/projektirevision on edelleen ajantasainen.

## 12. Toteutusjärjestys ja oikea hyväksyntä

| Vaihe | Tehtävä | Näyttö valmistumisesta |
|---|---|---|
| A | Bevy/egui + yksi laadukas GLB-hahmo | Oikean Macin front/viisto/profiili, materiaalit, silmät ja ääriasennot. |
| B | Yksi Kokoro-repliikki + duration-adapteri | Oikea 24 kHz ääni, tokenit ja kestot samasta ajosta; kuuntelu ja ajoituksen overlay. |
| C | Visemit + kasvorigi + koartikulaatio | M/B/P-sulut, F/V, pyöristetyt vokaalit ja tauot näkyvät äänen oikeilla kohdilla. |
| D | Rajattu käsikirjoitus + näyttely | 10 s dialogi, katse, nyökkäys ja ele; sama seek/esikatselu/vienti. |
| E | Toinen hahmo + tallennus | Sarjaprojektin avaus offline ilman äänen generointia. |
| F | 30 s pilotti ja MP4 | Puhelimessa katsottu video kuvan/puheen/tekstien kanssa. |
| G | 60 s ja toistuva sarjatyö | Toinen jakso samoilla hahmoilla; hyväksyttävä työn määrä ja kuvan laatu. |
| H | Valinnainen kameraesitys | Ei muuta käsikirjoituksen ensisijaisuutta tai puhekanavien omistusta. |

Tämä on uuden repositorion suositus: jokaisen vaiheen kokeilu Macilla pitää
uuden hankkeen pienenä. Nykyisen Koetan omistajan ohje on yhä ominaisuudet
ensin ja lopullinen Mac-hyväksyntä myöhemmin; tutkimusdokumentti ei kumoa sitä.

Huulisynkan hyväksyntäaineisto: lyhyet ja nopeat M/B/P-sulut, F/V, diftongit,
"Peter bought a blue mug", "Five very fine friends", "We owe you two", nimet,
numerot, hiljainen tauko, pitkä repliikki/chunk-raja sekä oma äänitys. Kohdistus
arvioidaan käsin merkitystä vertailuaineistosta: tapahtuman ajoitusvirhe ja
puuttuva sulku mitataan erikseen. Sovitaan hyväksyttävä raja pilotin avulla;
rajaa tai laatua ei väitetä mitatuksi etukäteen.

Tarkista myös toiston pysäytys/hyppy, nopean muokkauksen peruutus, mallin
puuttuminen, vanha projekti, väärä rig, keskeytynyt vienti ja levy täynnä.
Macilla testataan Metal, ääni, muistihuiput, pakettikoko ja energiankulutus.
Linux-testit eivät korvaa näitä. Kuva hyväksytään myös käyttäjän palautteella.

## 13. Nykyisen Koetan auditointi

- `hs-script`: olemassa oleva rajattu ohjekieli; pidä lähderivit ja virheet.
- `hs-voice/kokoro.rs`: Candle + loqui-g2p, paikalliset mallit, 24 kHz ääni.
  Mallin kestot eivät nykyisestä julkisesta adapterista tule ulos.
- `hs-lipsync`: 10 suumuotoa, energiasegmentointi ja painotetut foneemikestot.
  Tämä on heuristinen ajoitus, ei todellinen forced alignment. Audio-only-polku
  ei ole kattava englannin foneemitunnistin. TestEngine ei ole kuunneltavaa puhetta.
- `hs-motion/face.rs`: nykyiset suun luut/kanavat ovat hyödynnettävä lähtökohta;
  silmien/luomien/kulmakarvojen erillinen rigi puuttuu.
- `hs-character`: tämänpäiväinen perheuudistus paransi primitivi-geometriaa,
  mutta se ei ole elokuvan tuotantohahmojen korvike.
- `hs-project`, `hs-agents`: olemassa oleva sarjaprojekti, äänen säilytys ja
  yhteinen FrameBuilder-ajoitus ovat hyödyllisiä; siirrä vain tarvitsemasi osat.
- Nykyisessä ympäristössä oikea Kokoro hyväksyntätesti on ohitettu mallin vuoksi.
  Tässä tutkimuksessa ei ladattu mallia eikä testattu oikeaa puhesynteesiä.

Ensimmäinen tekninen seuraava tehtävä: saada Kokoron mallin duration-tulos
julkiseen versionlukittuun Rust-API:in, yhdistää se tarkasti lopulliseen PCM:ään
ja tehdä yhdestä oikeasta repliikistä kuunneltava/renderöity kohdistusnäyte.
Tähän ei tarvita ensin kymmentätuhatta liikettä tai koko videoleikkauseditoria.

## 14. Lähteet ja tutkimuksen rajat

Ensisijaiset lähteet luettu 14.10.2026 verkosta. Alla olevat linkit ovat
virallisia repositorioita, mallikortteja tai spesifikaatioita. Main-haarojen
sisältö voi muuttua; tuotantopäätös lukitaan valitun version ja commitin mukaan.

1. [Bevy README](https://github.com/bevyengine/bevy/blob/main/README.md).
2. [Bevy: animated mesh](https://github.com/bevyengine/bevy/blob/main/examples/animation/animated_mesh.rs).
3. [Bevy: morph targets](https://github.com/bevyengine/bevy/blob/main/examples/animation/morph_targets.rs).
4. [wgpu README](https://github.com/gfx-rs/wgpu/blob/trunk/README.md).
5. [egui README](https://github.com/emilk/egui/blob/main/README.md).
6. [bevy_egui README ja yhteensopivuus](https://github.com/vladbat00/bevy_egui/blob/main/README.md).
7. [glTF 2.0 -spesifikaatio](https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/Specification.adoc).
8. [Candle README](https://github.com/huggingface/candle/blob/main/README.md).
9. [Kokoro-82M mallikortti](https://huggingface.co/hexgrad/Kokoro-82M).
10. [Kokoro pipeline.py](https://github.com/hexgrad/kokoro/blob/main/kokoro/pipeline.py) ja [model.py](https://github.com/hexgrad/kokoro/blob/main/kokoro/model.py).
11. [cpal README](https://github.com/RustAudio/cpal/blob/master/README.md).
12. [FFmpeg LICENSE.md](https://github.com/FFmpeg/FFmpeg/blob/master/LICENSE.md).
13. [MediaPipe README](https://github.com/google-ai-edge/mediapipe/blob/master/README.md).
14. [ort README](https://github.com/pykeio/ort/blob/main/README.md).
15. [Montreal Forced Aligner README](https://github.com/MontrealCorpusTools/Montreal-Forced-Aligner/blob/main/README.md).
16. [Rhubarb README](https://github.com/DanielSWolf/rhubarb-lip-sync/blob/master/README.adoc).

Lisäksi luettiin nykyisen Koetan lähteet ja paikallisen lukitun
omp-voice-kokoro 0.1.0:n model.rs. Verkkosivujen sisältö on lähdetietoa,
ei agentin työohjeita.

Adobe Character Animatorin huulisynkkaohje, Google MediaPipe Face Landmarker
-ohjesivu, Blenderin glTF-vientimanuaali, FFmpeg-verkkosivun lisenssiohje,
YouTuben vienti-/Shorts-ohjeet ja MFA:n verkkomanuaali palauttivat tässä
ympäristössä verkkoproxyn 403-eston. Niitä ei merkitä luetuiksi. Osalle löytyi
virallinen GitHub-lähde, jota käytettiin yllä. Blender-manuaalin arvatun
GitHub-polun 404 ei todista ohjeen puuttumista. Instagram-/TikTok-palvelujen
nykyisiä julkaisurajoja ei varmennettu. Mallien suoritusnopeutta, uuden
Bevy-hankkeen kokoa tai elokuvatasoista laatua ei mitattu tässä tutkimuksessa.
