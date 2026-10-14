# Koetan alkuperäiset näyttelytyylit

Näyttelytyyli-valikossa on Pehmeä 3D sekä Stop motion 12/15 asentoa sekunnissa.
Asetus tallentuu jakson `.koeta`-resurssiksi, palautuu avauksessa ja kuuluu yhteiseen
kumoamiseen. Vanha projekti ilman asetusta avautuu Pehmeä 3D -tilassa.

Stop motion porrastaa vapaiden käsivarsien ja pään paikalliset asennot.
Hahmon paikka, jalat, kamera, kohtauksen aika ja äänen mukaan ajoitetut visemit
säilyvät jatkuvina. Tämä on turvallinen ylävartalon pose cadence, ei koko kuvan
pysäyttäminen tai valokuvattu muovailuvaha-animaatio. Avainruuduilla ohjatut
hahmot säilyttävät asennot; esine-/lavastekontaktien tai pideltävien esineiden
jaksoissa käsivarsien porrasnäytteistys poistetaan konservatiivisesti käytöstä.
Kontaktit ratkaistaan todellisella ajalla ja törmäykset tarkistetaan sen jälkeen.

Ilmeiden suun kulmat ja puheettoman hahmon leuka vaihtuvat pehmeästi 180 ms:ssa.
Puhe pitää oman leuka-/huulimuotonsa. Silmät ja kulmakarvat ovat edelleen jäykkää
geometriaa; uusi toiminto ei lupaa kaikkien kasvonpiirteiden animaatiota.

Koominen ajoitus tehdään näkyvillä ennakointi- ja reaktiotauoilla, katseohjeilla
sekä eleillä. Sovellus ei päättele vitsiä vapaasta tekstistä. Alkuperäiset kohtaukset:

- [Koominen sisääntulo](examples/acting-comedy.en.txt)
- [Yksi pieni asia](examples/acting-emotion.en.txt)

Niiden englanninkieliset repliikit tarvitsevat oikean Kokoron tai omat äänitykset.
`--no-speech` tekee vain hiljaisen luonnoksen, ei puhuttua jaksoa.

CLI käyttää samaa FrameBuilder-putkea kuin esikatselu ja vienti:

```sh
cargo run --locked -p hs-cli -- render examples/acting-comedy.en.txt \
  --acting-style stepped12 --no-speech --gpu --size 1280x720 -o comedy.mp4
```

Sallitut arvot ovat `smooth`, `stepped12`, `stepped15`. Tuntematon arvo on virhe.
Tyyliresurssi on enintään 128 tavun JSON-enum; tuntematon tyyli ja kaksoisresurssi
estetään avauksessa. Tyylimuutos mitätöi liikkeen lukijoiden kamera-/kontaktivaiheen
ja esikatseluvälimuistin; muuttumatonta puhetta ei tarvitse generoida uudestaan.

Toteutus ottaa vaikutteita stop motionin ajoituksesta ja pehmeästä 3D-näyttelystä.
Koetan hahmot, kohtaukset ja tyylinimet ovat omia; studiokohtaista laatuhyväksyntää
tai valmiin Aardman-/Pixar-tuotannon vastaavuutta ei väitetä.
