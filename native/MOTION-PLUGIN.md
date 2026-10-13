# Sovelluksen sisäinen liikeplugin

**Koeta Native Humanoid** (`koeta.motion.humanoid.v1`) on paikallinen Rust-plugin,
joka tarjoaa **32 400 hahmoriippumatonta liikevariaatiota**. Se on rekisteröity
sovelluksen sisäiseen `MotionPlugin`-rajapintaan; kirjaston käyttö ei tarvitse
verkkoa, mallilatausta tai erillisen DLL:n asentamista.

Kirjasto muodostuu 18 yksittäisestä liikkeestä ja 306 järjestetystä kahden
liikkeen yhdistelmästä: **324 pohjaa × 25 kestoa × 4 aloitussuuntaa**.
Parin liikkeet ovat eri liikkeitä ja niiden järjestys vaikuttaa lopputulokseen.
Kesto on 1,0–3,4 sekuntia per liike. Aloitussuunta esitetään erillisellä 0,5 s
asetusrivillä, joten kokonaiskesto on 1,5–7,3 s. Se on aloitussuunta, ei kaikkien
myöhempien liikkeiden lukittu suunta; suunnattu kävely/juoksu ohjaa vartaloa.

Tämä ei ole 32 400 uutta perustoimintoa tai valmiiksi levylle tallennettua
mocap-klippiä. Variaatiot lasketaan pyydettäessä, joten jokaista hahmoa ja
liikettä varten ei tarvita erillistä suurta aineistotiedostoa. Aiempi 2 000
vakiohahmojen glTF-klipin aineisto säilyy erillisenä vientivaihtoehtona.

## Sovittaminen hahmoon

Plugin käyttää **valitun hahmon omia mittasuhteita ja luurankoa**. Kallen
kierrot eivät siirry sellaisinaan lyhyemmälle hahmolle. Kävely, raajojen IK,
sormieleet ja kontaktit lasketaan tavoitehahmon omille luupituuksille.

Tuettuina ovat Koetan native Humanoid -luurankoa käyttävät vakiohahmot ja
projektin omat `CharacterParams`-hahmoprofiilit. Hahmon nimi tarvitsee nykyiseen
käsikirjoituskieleen kelpaavan tunnisteen. Profiilia ei nimetä uudelleen tai
korvata toisella hahmolla automaattisesti.

Luurankosopimus tarkistaa lantion, selän, rintakehän, pään, molemmat raajat ja
sormet, vanhempien hierarkian sekä IK-segmenttien kelpoisuuden. Esimerkiksi
puuttuva käsinivel tai nollapituinen kyynärvarsi antaa virheen. Sovitettu liike
kulkee oikean tuotantoputken ja kontaktitarkistuksen läpi ennen esikatselua.

**Mielivaltaiset ulkoiset luurangot, eläimet, paperinuket tai puutteellisesti
rigatut hahmot eivät ole automaattisesti tuettuja.** Ne tarvitsevat erillisen
tuonnin, luukartoituksen, lepoasentojen/koordinaatiston sovituksen ja testauksen.
Tätä pluginia ei esitetä niiden yleiseksi retargetointiratkaisuksi.

## Käyttö

Käsikirjoitus-välilehdellä avataan **Liikeplugin**. Valitse projektihahmo,
yksittäinen liike tai liikepari, kesto ja aloitussuunta. Hakua ja tuloslistaa
rajataan; koko 32 400 kohteen joukkoa ei rakenneta jokaisella ruudulla.

Esikatselu näyttää lisättävät ohjeet ja kokonaiskeston. **Hyväksy** lisää ne
käsikirjoituksen loppuun. Aiemmat repliikit ja rivinvaihdot säilyvät. Jos
käsikirjoitus tai tavoitehahmon profiili muuttuu esikatselun jälkeen, vanha
esikatselu hylätään. Projektin profiili menee samannimisen vakiohahmon edelle.

Liikkeet noudattavat nykyisiä sääntöjä: esimerkiksi käsissä oleva esine estää
taputuksen ja tuolilta pitää nousta ennen kävelyä. Lopullisen työnkulun tarkistus
huomioi koko kohtauksen ja äänen keston; pelkkä pohjan valinta ei hyväksy vientiä.
Käsikirjoituksen koko- ja 60 sekunnin rajat säilyvät.

CLI näyttää rekisteröidyn sisäisen pluginin tiedot:

```sh
cd native
cargo run --locked -p hs-cli -- motion-plugin-info
```

## Oma hahmo esimerkkiprojektissa

Seuraava esimerkki luo uuden sarjaprojektin, jossa 1,12 m Jane käyttää samaa
taputuspohjaa omilla mittasuhteillaan. Se ei korvaa olemassa olevaa tiedostoa.

```sh
cd native
cargo run --locked -p hs-agents --example motion_plugin -- /polku/jane.koeta
cargo run --locked -p hs-app -- /polku/jane.koeta
```

## Laajentaminen

Uusi sisäinen plugin toteuttaa `MotionPlugin`-rajapinnan ja rekisteröidään
`plugins()`-listaan. Uudet liikkeet tarvitsevat todellisen animointitoteutuksen,
resurssit ja hyväksymistestit. Tuntemattomia toimintoja ei toteuteta nimeämällä
saman näköistä liikettä uudelleen.

Ovet, portaat, esineiden luovutus ja kahden hahmon kontaktit eivät vielä kuulu
näihin pohjiin. Yleistä törmäys-/vaatefysiikkaa tai kaikkien kuvakulmien
ammattitasoista laatutakuuta ei ole. Lopullinen animaatio katselmoidaan kuvasta.
