# Natiivin `.koeta`-palautus

`hs_project::recovery::RecoveryStore` tallentaa palautusarkistot erilliseen
sovellusdatakansioon. Sarjan vakaa ID muodostaa alikansion. Käyttäjän varsinainen
projektitiedosto ei ole palautuskohde eikä sitä muuteta.

- Uusi numeroitu autosave säilytetään uusimman validoidun aiemman autosaven rinnalla.
  Enintään kaksi valmistunutta autosave-arkistoa säilytetään sarjaa kohti.
- Nimetty revisio on muuttumaton. Samaa nimeä ei voi kirjoittaa uudelleen.
- Nimetyillä revisioilla ei ole automaattista kiintiöpoistoa.
- Kiintiö koskee koko palautusjuurta, myös muita sarjoja ja keskeneräisiä tiedostoja.
  Uuden arkiston on mahduttava aiempien rinnalle ennen aiempien autosavien karsintaa.
  Kiintiölaskenta tarvitsee normaalisti tilan kolmelle autosavelle sekä nimetyille
  revisioille. Karsinta tehdään vasta onnistuneen kiintiö- ja syötevalidoinnin jälkeen,
  ennen uuden tiedoston julkaisua. Uusin validoitu autosave säilyy kirjoitusvirheessä;
  vanhempi toinen autosave voi tällöin olla jo poistettu.
- Kiintiö- tai validointivirhe säilyttää aiemmat tiedostot. Levyn kirjoitusvirheessä
  olemassa oleva arkisto ei korvaudu osittaisella tiedostolla.
- Palautus tarkistaa `.koeta`-manifestin, resurssien tarkistussummat ja sarjan ID:n.
  Vioittunut uusin arkisto ohitetaan ja edellinen kelvollinen tarjotaan.
- Tilapäisiä tiedostoja ei avata palautuksena. Niitä ei poisteta automaattisesti.
- Polun parent traversal ja symlinkit estetään. Kiintiöskannaus on rajattu
  16 384 tiedostoon/kansioon ja vain juureen sekä sarjakansioihin.

Käyttöliittymä suorittaa yhden palautuskirjoituksen kerrallaan erillisessä
tehtävässä ja näyttää onnistumisen vasta kirjoituksen valmistuttua.
`RecoveryStore` olettaa yhden kirjoittajan palautusjuurta kohti; erilliset
sovellusprosessit eivät saa kirjoittaa samaan palautusjuureen yhtä aikaa.
Skannaaminen ei ole automaattinen projektin avaaminen: käyttäjä hyväksyy palautuksen.

`save_atomic` validoi väliaikaisen arkiston ennen julkaisua. Tämä ei ole lupaus
fyysisen sähkökatkon kestosta eikä komentoja toistava WAL. Tulevat tallennetut
renderöintityöt on palautettava keskeytyneiksi, ei onnistuneiksi.
