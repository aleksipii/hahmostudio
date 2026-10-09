# Ideoitsija / tuotannon pullonkaulat — 9.10.2026

Vaihe: rajattu selvitys valmis, ehdotukset odottavat toteutuspäätöstä ja lopputarkastusta. Tarkastettu HEAD `d356ad6e7d1ae043d68cb74a3c1bf0143f91d667` sekä sen päällä oleva jaetun työkopion diff. Lähteinä AGENTS.md, TIIMI.md, rooliprompti ja raportit 01–07 sekä alla nimetyt toteutukset. Raporttien testitulokset ovat muiden asiantuntijoiden ilmoittamaa näyttöä; en ajanut testejä tai sovellusta tässä selvityksessä. Muutin vain tämän raportin.

Englanninkielinen Kokoro-esimerkki, desktop-pilvisilta ja flat/cel-valinta ovat jo toteutettuja. Niitä ei ehdoteta uudelleen. Kaupallisen pilotin ensimmäinen riippuvuus on todellinen toimitusnäyttö, ei tiimin kasvattaminen tai uusien ominaisuuksien määrä.

## 1. Yksi oikeasti kuunneltu ja viety englanninkielinen pilotti

**KOODISTA TODETTU:** `lib/kokoro.ts:49` (`isEnglishLine`) rajaa kielen heuristisesti; `:65` (`createTestEngine`) on testimoottori, ei puhuttujen sanojen näyttö. `desktop/encoder.mjs:3–4` (`probeEncoder`, `encodeFrames`) sisältää oikean VideoToolbox-proben ja ohjelmistofallbackin. `lib/studio/production-overview.ts:11–17` erottaa puuttuvan äänen ja työjonon valmiuden, mutta tämä projektio ei ole toimitusvideon kuunteluhyväksyntä. Ääni- ja full-stack-raportit jättävät oikean synteesin/kuuntelun ja koko sovelluksen viennin avoimiksi.

**Käyttäjän ongelma:** tuotantoketjun paikalliset regressiot eivät vielä osoita, että asiakas saa ymmärrettävän ja synkronoidun videon.

**EHDOTUS:** pienin työ on ajaa olemassa oleva kahden repliikin English-pohja erillisessä projektissa paketoidulla desktopilla, kuunnella molemmat oikeat Kokoro-repliikit ja tarkastaa lopullinen MP4. Tallennetaan version, mallin, vientiasetusten ja tiedoston hashin sisältävä hyväksyntäpöytäkirja. Ei uutta TTS- tai vientimoottoria.

**Riippuvuus:** olemassa olevan mallin ja runtime-resurssien tarkistus, sovelluksessa tehdyt ääni-/lupavalinnat; ääni + full-stack + QA. Käyttäjän omat äänet säilyvät.

**Hyväksyntä:** puhuttu teksti vastaa kahta lähderepliikkiä; molemmat kuunneltu; tallennus/avaus säilyttää sidonnat; vientitiedosto dekoodautuu ja kuva/ääni katsotaan. Dialogin alku/loppu ja suu arvioidaan ennalta sovitulla toleranssilla (ehdotus ≤2 ruutua / 30 fps). Hardware-enkoodaus raportoidaan erikseen.

**Arvio:** 1–2 htp yhteensä, kun runtime ja paketoitu sovellus toimivat. Sisältää ajon, kuuntelun ja yhden uusinnan; runtimekorjaus tai uusi malliasennus ei sisälly.

**AVOIN KYSYMYS:** toimiiko paikallinen synteesi käytännössä ja vastaako vienti esikatselua? Selvitetään ajolla, ei manifestin olemassaololla.

## 2. Kahden pilottihahmon katsottu liike- ja ulkoasureferenssi

**KOODISTA TODETTU:** `lib/toon3d.ts:3–5` (`ToonProfile`, `toonProfiles`) merkitsee mesh-hahmot `review`-tilaan. `:11–13` (`buildToonAsset`) sisältää tämän kierroksen flat-helmakorjauksen. `lib/character-sources.ts:14` pitää `REFERENCE_READY_PACKS`-listan tyhjänä. 2D- ja 3D-raporttien numeerinen asset/skinning-näyttö erotetaan taiteellisesta hyväksynnästä.

**Käyttäjän ongelma:** värien ja nivelten tekninen kelvollisuus ei takaa saumattomia eleitä, tunnistettavaa hahmoa tai siistiä toimituskuvaa.

**EHDOTUS:** pienin ratkaisu on Pipsan ja Villen yhteinen 2D/toon3d-liikenäyte: kävely, pysähdys, puhe, katse, käsiele, kyykky ja näkymän vaihto. Katsotaan front/quarter/profile/rear sekä rajatut ääriasennot samalla aikakannalla. Ei kirjaston regenerointia ilman kuvasta todettua vikaa.

**Riippuvuus:** 2D- ja 3D-vastuut + erillinen taiteellinen hyväksyjä; nykyinen preview-fixture ja ensimmäisen kohdan vientipolku. AI-vertailukuva vasta hyväksynnän jälkeen.

**Hyväksyntä:** jokainen näyte katsottu; saumat, helma, käsiesineet, lattiasuhde ja safe area kirjattu; esikatselu/vienti vastaavat valituissa ruuduissa. Hyväksyntä sidotaan täsmälliseen asset-/profiiliversioon. Hylätty kohta saa kuvaviitteen ja rajatun korjaustehtävän.

**Arvio:** 1,5–3 htp yhteensä kahdelle hahmolle, yksi katselmointi ja pieni korjauskierros. Uusi hahmotaide tai kaikkien neljän hahmon täydellinen hyväksyntä ei sisälly.

**AVOIN KYSYMYS:** ovatko helma, hiukset ja nivelet hyväksyttäviä liikkeessä? Tekninen geometriaehto ei ratkaise tätä.

## 3. Vertailukuvahyväksynnän grafiikkatunnisteen kattavuus

**KOODISTA TODETTU:** `lib/character-sources.ts:21–29` (`characterSources`) laskee kirjastopaketin tavuhashin tai käyttää tuodun hahmon asset-tunnistetta. `lib/toon3d.ts:3` määrittelee erillisen profiilin värit, hiustyylin ja renderStyle-kentän. Hash-funktio ei vastaanota tätä profiilia. `lib/cloud-render/pipeline.ts:206` käyttää kanonista `sourceSha256`-arvoa referenssien resolvoinnissa. Tämä ei yksin todista kaikkien muokkauspolkujen virhettä.

**Käyttäjän ongelma:** hyväksytyn kuvan vanhenemista ei voi luotettavasti arvioida, jos lopulliseen ulkoasuun vaikuttavat muutokset jäävät hyväksynnän sidonnan ulkopuolelle.

**EHDOTUS:** ensin arkkitehdin rajattu tietovirtakoe: hyväksy erillinen fixture, muuta toon3d-väriä/tyyliä ja tuodun hahmon rigiä, tarkista hyväksynnän tila. Vasta todennetun aukon jälkeen suunnitellaan versioitu grafiikkatunniste; ei koko kanonisen mallin refaktorointia.

**Riippuvuus:** arkkitehti + AI + 3D, yhteisen formaatin ja vanhojen hyväksyntöjen siirtymäpäätös; kohdan 2 referenssipolku.

**Hyväksyntä:** jokainen renderiin vaikuttava testattu muutos joko vanhentaa vertailukuvan tai saa dokumentoidun perustelun vaikutuksettomuudesta; muuttumaton ulkoasu säilyttää hyväksynnän. Vanhat projektit avautuvat eikä hyväksyntää arvata automaattisesti.

**Arvio:** 0,5–1 htp selvitykselle; mahdollinen rajattu korjaus 1–2 htp lisää. Haarukka erottaa todentamisen vielä vahvistamattomasta toteutustarpeesta.

**AVOIN KYSYMYS:** mitkä profiili-/rig-muutokset nykyinen integraatio jo vanhentaa toisessa kerroksessa? Tarkistettava koko komentopolussa.

## 4. AI-paneelin näppäimistöpolun katkos

**KOODISTA TODETTU:** `components/ai-panel.tsx:46` fokusoi dialogin ja käsittelee Escapen; `:63` ilmoittaa `aria-modal=true`. Tässä toteutuksessa ei ole Tab/Shift+Tab-rajausta tai avaajan fokuksen palautusta. UX-raportti erottaa SSR-semanttiikan oikeasta VoiceOver-kokeesta.

**Käyttäjän ongelma:** näppäimistökäyttäjä voi siirtyä modalin taustalle tai menettää työvaiheen sijainnin sulkiessaan paneelin.

**EHDOTUS:** rajattu fokusrajaus ja fokuksen palautus olemassa olevaan dialogiin, yksi oikea Electron-näppäimistökoe. Latausstatus on jo korjattu, sitä ei toteuteta uudelleen.

**Riippuvuus:** UX + QA; testattava myös paneelista avattavan natiivin pilvidialogin kanssa.

**Hyväksyntä:** Tab/Shift+Tab pysyy avoimessa paneelissa, Escape sulkee ja palauttaa avaajaan; natiivista dialogista palaaminen toimii; VoiceOver ilmoittaa nimen ja latauksen oikeassa ajossa.

**Arvio:** 0,5–1 htp toteutukseen ja laitekokeeseen, kun nykyinen GUI-harness on käyttövalmis.

**AVOIN KYSYMYS:** miten natiivin dialogin fokus käyttäytyy oikealla Macilla? SSR ei vastaa tähän.

## 5. Pilvi-/GPU-palvelun kaupallisen käytön näyttö puuttuu

**KOODISTA TODETTU:** `lib/cloud-render/pipeline.ts:158–160` erottaa live-verification-ledgerin valmiista auditointiin päätyneestä renderistä. `lib/ai-status.ts:48–49` erottaa mallilukituksen ja muut renderiportit. AI-raportin palvelunäyttö on paikallinen ja simuloitu, ei oikea GPU-/Drive-ajo. Pilvisilta on jo olemassa.

**Käyttäjän ongelma:** AI-lisäosan todellista toimituskykyä, siirtoa ja odotusaikaa ei vielä voi luvata tuotantoaikatauluun.

**EHDOTUS:** kun pilvi on pilotin tavoite, yksi ennalta rajattu testi hyväksytyllä referenssillä ja erillisellä testiaineistolla olemassa olevassa nollakustannuspolussa. Mitataan lähetys, render, validointi ja tuloksen palautus sekä keskeytys/uusinta. Paikallinen 2D/3D-pilotti voi edetä tästä riippumatta.

**Riippuvuus:** kohdat 2–3, voimassa oleva mallilukitus/lisenssi, käyttäjän sovelluksessa antamat luvat ja todellisesti saatavilla oleva ilmainen tausta; AI + QA.

**Hyväksyntä:** onnistuneen työn auditointi ja live-ledger osoittavat oikean taustan; tiedosto palautuu, validointi ja katselmointi läpäisevät; peruutus ei vaihda maksulliseen palveluun eikä tulos muuta kanonia automaattisesti. €0-väite todennetaan politiikasta ja taustan tiedoista, ei pelkästä UI-tekstistä.

**Arvio:** 1–2 htp testin valmisteluun ja yhteen ajo-/uusintakierrokseen. Ulkoisen palvelun jonotus tai saatavuus ei ole henkilötyötä eikä taattu kalenteriaika; integraatioviat arvioidaan havaintojen jälkeen.

**AVOIN KYSYMYS:** onko valittu ilmainen ympäristö juuri nyt saatavilla ja kaupalliseen käyttötapaan soveltuva? Tähän tarvitaan palvelu-/mallikohtainen tarkistus ennen ajoa. En tehnyt verkko- tai GPU-kutsua tässä raportissa.

## Päätös ja seuraava työ

Raportti toimitetaan lopputarkastukseen. Ehdotukset eivät käynnistä toteutusta automaattisesti. Ensisijainen valinta on kohdat 1–2 paikallisen toimitusnäytön saamiseksi; kohta 3 ennen laajempaa AI-referenssikäyttöä, kohta 4 rajattuna käytettävyyskorjauksena ja kohta 5 vain pilvipilotin osana. Arviot ovat henkilötyötä, eivät toteutuneita kuluja tai kalenterilupauksia; niitä ei pidä summata ennen vastuiden ja päällekkäisyyksien sopimista.
