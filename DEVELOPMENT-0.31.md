# KILSAT Studio 0.31 — delta-WAL, siirrettävä historia ja nivelketjujen sovitus

5.10.2026. Nykyisen React/TypeScript/Electron-sovelluksen jatkokehitys. Vanhojen `.hahmo` v1–v5 -projektien, 0.30-historian, aiempien palautusvedosten, alkuperäisten resurssien ja renderöintimoottorien luku säilyy.

## 1. Macin deltajournal

`desktop/delta-journal.mjs` ylläpitää uuden projektin aloitustilaa ja sen jälkeen vain semanttisia komentoja. Tavallinen muokkaus ei kirjoita `.hahmo`-snapshotia. Commit sisältää komento-ID:n, lähtötilan viitteen, JSON-polkumuutokset, resurssiviitteiden lisäykset/poistot ja kumoamishistorian. Taulukon lisäys/poisto käyttää tarkistettua splice-deltaa. Päällekkäinen komento-ID on idempotentti vain samalla sisällöllä. Vanhentunut lähtötila hylätään.

Resurssit ovat SHA-256:lla tunnistettuja jaettuja 16–64 KiB sisältöpaloja. Myös muuttunut sisäinen hahmoarkisto siirtyy vain muuttuneina paloina, eikä kuvia lähetetä uudelleen animaatiometadatan muutoksen vuoksi. Tallennus tarkistaa uudet tavut ja palaviitteet. Palautus tarkistaa kaikkien palojen ja koko resurssin hashin.

Järjestys: editorin validointi → uusien resurssien fsync → komentotiedoston fsync → atominen rename → hakemiston fsync → komento-ID/requestHash-kuittaus → editorin julkaisu ja historian päivitys. Puolikas komentotiedosto ei ole palautuskohde. Aloitustila tarvitaan uudelle/importoidulle projektille tai rendererin välimuistin puuttuessa; tavallisen muokkauksen mukana ei kulje kokonaista projektivedosta.

Tilaviitteen `hash` on nyt metadatan Merkle-hashin ja resurssiviitteiden tilahash, ei `.hahmo`-ZIPin hash. Materiaalistettu palautus antaa erikseen `stateHash` ja `archiveHash`; renderer tarkistaa molemmat oikeassa merkityksessä. Vanhojen vedosten byte-hash-sopimus säilyy. Väärää kuittausta ei julkaista.

Journalin oma levykiintiö on 512 MiB. Kiintiö tarkistetaan ennen uusien resurssien kirjoitusta; mitään käyttäjän projektia tai vahvistettua journal-haaraa ei poisteta automaattisesti. Komentoketjut säilyvät, joten pitkäaikainen käyttö voi edellyttää projektin tallentamista historia mukaan lukien ja palautusvaraston erillistä tyhjentämistä. Automaattinen ketjujen kompaktio ei ole tämän version toiminto.

## 2. Inkrementaalinen serialisointi

`prepareProject` tuottaa metadatan ja muuttumattomat resurssit ilman koko projektin ZIP-serialisointia. `saveProjectRecovery` vertaa rakenteita ja lähettää vain deltan, muuttuneet viitteet ja puuttuvat palat. Muuttumattomien Blobien tavut, hashit, palaluettelot, hahmoarkistot ja tasometadatan haarat käytetään uudelleen.

Native-journal käyttää rakenteita jakavaa deltan sovitusta sekä JSON-ropeja ja Merkle-hasheja. Muuttumattomat metadatapuut säilyttävät aiemmat serialisointiosat ja validoinnin. Muuttuneiden taulukoiden indeksi-/hashlistan käsittely voi edelleen olla lineaarinen taulukon pituuteen nähden; tähän ei väitetä O(log n) -B-puuta.

Rig/animaatiovalidointi hyväksyy nyt sisäisen objektin suoraan; tiedostolukijoiden JSON-rajapinta säilyy. Validoitu editorin rig/animaatio jäädytetään ja sen validointia voidaan käyttää uudelleen. Muokkaa kopioita, älä validoitua tilaa paikan päällä. DOM-mediaa ei jäädytetä eikä structuredClone-kloonata.

Kokonainen ZIP/tavujono tarvitaan edelleen käyttäjän tiedostotallennuksessa, palautuksen materiaalistuksessa ja render-checkpointissa. Tämä ei ole jokaisen muokkauksen IPC-polku. Browser/IndexedDB käyttää yhteensopivaa snapshot-fallbackia; uusi inkrementaalinen IPC/WAL-polku koskee Mac-sovellusta.

## 3. Deduplikoitu siirrettävä historia

`.hahmo` sisältää valinnaisen `history.json` version 2 ja yhden SHA-256-sisältöpalavaraston. Useat historia-vedokset voivat viitata samoihin paloihin. Alkuperäinen ZIP-tavujono rekonstruoidaan täsmälleen, ja resurssimanifesti kattaa myös historia-aineiston. Version 1 historia luetaan edelleen.

Rajat: enintään 16 historia-tilaa, rekonstruoitu historia enintään 384 MiB, koko paketti enintään 128 MiB. Raja koskee ainutkertaisia pakattavia tavuja, joten samat kuvat eivät kuluta sitä joka tilassa uudelleen. Raja voi silti tulla vastaan aidosti erilaisten resurssien vuoksi. Tallennus ei katkaise historiaa huomaamatta.

## 4. Atominen historiatuonti

Editorin nykyisen projektin ja resurssien kuvadekoodaus valmistuu ennen tuonticommitia. Historia-tilojen rakenne, resurssiviitteet ja tarkistussummat validoidaan. Mac tuo koko past/future/current-joukon yhdessä commit-merkinnässä: joko kaikki tilat ovat vahvistettuja tai mikään niistä ei ole uusi palautuskohde.

Tavallinen kirjoitusvirhe siivoaa vain kyseisen transaktion luomat, vahvistamattomat resurssipalat. Vahvistettuja resursseja ei poisteta. Prosessin/virran katkeaminen voi jättää huomiotta jääviä väliaikaistiedostoja; ne eivät ole osittain hyväksyttyä historiaa. Vahvistamisen jälkeen kadonnut kuittaus palauttaa koko transaktion käynnistyksessä. Selain käyttää vastaavasti yhtä IndexedDB-transaktiota; oikeaa selain-IDB-levytestiä ei tehty.

## 5. Yleisempi 2D-luustosovitus

`chain-retarget.ts` tukee erimääräisiä, peräkkäin liitettyjä 1–32 luun ketjuja, enintään 32 ketjua. Semanttiset käsien/jalkojen alku- ja loppuroolit sekä kuvakulmat muodostavat ketjut. Epäselvät sidokset vaativat käyttäjän osavastaavuuden; kuvien sisällöstä ei arvata anatomiaa.

- FK jakaa lähteen maailman suuntia kohdeketjulle pituusosuuksien mukaan.
- IK siirtää päätepisteen tavoitteen kohdemittasuhteisiin. Kaksiluisella ketjulla käytetään analyyttistä ratkaisua; pidemmällä determinististä FABRIK-ratkaisua.
- FK/IK-osuus, ruutuaskel ja paikallaan pysyvien kontaktien lukitus näkyvät uudelleenkytkentäpaneelissa.
- API tukee käsin määritettyjä kontaktijaksoja, päätepisteen suuntaa, pole-pistettä ja nivelten kiertorajoja.
- Liikkuvan juuren aikana käden/jalan maailmankontakti voidaan pitää paikallaan. Ulottumaton tavoite, kontaktipoikkeama ja nivelraja tuottavat diagnoosin; virhettä ei piiloteta venyttämällä luuta.
- Tulos on tavallisia muokattavia avainruutuja. Kohteen anatomia, alkuperäinen animaatio ja vanha resurssi säilyvät.

Tämä on nykyisen 2D-rigin sovitus, ei mielivaltaisen 3D-meshin retarget. Puuttuville semanttisille ankkureille, haarautuville ketjuille, nollapituuksille tai ulottumattomille tavoitteille ei luvata automaattisesti oikeaa animaatiota. Puhelin-/kävely-/live-ohjainten olemassa olevat omat rig-vaatimukset säilyvät: ketjusovitus ei korvaa niitä kokonaan. Valmisteltu `.hahmo` käyttää omaa luustoaan; raaka-PSD ilman luustoa käyttää piirtoalueen skaalattuja vanhoja pivoteja. Varmista sovituksen lopputulos ennen hyväksyntää.

Vanha 10 000 avainruudun raja säilyy. Pitkän liikkeen voi sovittaa suuremmalla ruutuaskella tai osissa; kaikkien luiden koko pitkän jakson ruutukohtainen bake ei aina mahdu tähän rajaan.

## 6. Mittaukset ja oikeat testirajat

Toistettava komento: `npm run benchmark`. Tulos `docs/benchmarks/0.31.json`: oikea Mr.Kille-hahmopaketti, 500 kuvaa, 1000 s jakso, 10 000 avainruutua, 100 journal-muokkausta, kylmä palautus ja 16 historian tilan pakkaus. Raportti sisältää ajat, IPC-tavut, levytilan ja prosessin muistin. Nämä ovat yhden suoritusympäristön Node/domain/I/O-mittauksia, eivät Canvas/GPU:n ruudunpäivitys- tai UI-latenssin mittauksia.

Testit kattavat myös oikean journal-kirjoittajan SIGKILL-keskeytyksen ennen rename-committia ja fsync-commitin jälkeen. Tämä on aito prosessikaatuminen, ei koko tietokoneen virtakatkos. APFS:n/laitteen sähkökatkoksen kestävyys tarvitsee erillisen testikoneen ja käytännön kokeen.

Näkyvää Mac-käynnistystä yritettiin: Computer Use ei saanut Finderin käyttöoikeuksia ja Päätteen ohjaus estettiin turvallisuustarkistuksessa. Erillinen, vanhaan käyttäjädataan koskematon Electron `--self-test` päättyi exit 134 ennen testiraporttia tässä ympäristössä. Siksi tämän version graafista käynnistystä ei voi merkitä onnistuneeksi eikä käytännön UI-tarkastusta tehdyksi. Paketoitu Node-runtime, journal, historia, revisiot ja renderjono testataan erikseen.

`system_profiler` ei näyttänyt kamera- eikä äänilaitteita tässä suoritusympäristössä. Fyysistä kameraa, mikrofonia tai ääneen perustuvaa huulisynkronointia ei varmennettu. Laitteen puuttuminen ei ole onnistunut laitetesti.

## Tuotantovalmius

Tämä vaihe parantaa pyydettyä perustaa, mutta ei todista koko sovellusta valmiiksi ammattimaiseksi studioksi. Seuraava hyväksyntä vaatii toimivan näkyvän Mac-käynnistyksen, omat kamera-/mikrofonitestit, oikean animaation visuaalisen tarkistuksen sekä pitkien jaksojen varsinaisen renderin ja laadun tarkistuksen. Journalin tekninen palautustesti ei korvaa näitä.
