# Käsikirjoituksesta muokattavaksi jaksoksi · 0.7.0

## Työnkulku

Avaa Käsikirjoitus → Dialogi ja leikkaukset. Liitä UTF-8-teksti tai tuo .md/.txt. Tunnista ohjaussuunnitelma. Valitse kullekin puhujan nimelle kirjaston hahmo tai valmis oma .hahmo. Tuo puheäänet ja rajaa tarvittaessa samasta pitkästä tallenteesta repliikkikohtaiset osuudet. Tarkista kaikki kategoriat ja hyväksy näkyvät arviot. Korjaa puuttuvat vaatimukset ja ajoitusristiriidat. Rakenna muokattava jakso projektiin, toista, tallenna .hahmo ja vie MP4.

Tyhjässä studiossa ensimmäinen valittu hahmopaketti toimii uuden projektin pohjana ja jakso alkaa ruudusta 0. Olemassa olevassa projektissa jakso lisätään aiemman työn perään. Uusi kohtaus aloittaa erillisen suunnitelman; aiemmat kohtaukset säilyvät. Säilytä valmistelu projektissa ja ⌘S tallentaa myös keskeneräiset valinnat, lähdetekstin ja tuodut äänet. Koko projektin nykyinen raja on 60 s / 1800 ruutua.

## Syöte

```text
Jakson nimi: Aamu autossa
Pituus: 10–14 s
Tarkoitus: Näytä ystävien rauhallinen lähtö matkalle.
Hahmo MIRA: ystävällinen, maltilliset eleet.
Hahmo NIKO: rauhallinen ja kuiva.
Suhde MIRA: Niko on Miran ystävä.
Ääni MIRA: lämmin ja selkeä.
Miljöö: auto kuljettaja. Mira vasemmalla, Niko oikealla.
0:00–0:05 — Lähtö
LAAJA
MIRA: “Ready?”
Mira vilkuttaa 1 s.
NIKO: “Yes.”
0:05–0:10 — Perillä
Tausta: car-passenger-v1
Mira kävelee oikealle 2 s.
MIRA: “Here we are.”
Niko nyökkää 1 s.
NIKO: “Good.”
Pidä 0,8 sekuntia.
Otsikkokortti: Matka alkaa 1 s
```

Sama jakso löytyy painikkeesta Lataa toinen esimerkki · auto ja tiedostosta public/library/Aamu-autossa.md. Siinä ei ole puheäänityksiä; kooditesti käyttää erillisiä simuloituja äänen ajoituksia, ei keksittyä äänitiedostoa valmiina käyttäjälle.

## Mitä ohjeista tehdään

- Jakson nimi/Title ja SARJA — S01E01 -otsikko tunnistetaan.
- Pituusväli erotetaan toteutuneesta kestosta. Yksittäinen numerollinen sekuntikesto on tavoite; noin/about jättää alarajan joustavaksi. Osioikkunat ovat joustavia; lukittu/locked osion nimessä tekee siitä tarkan vaatimuksen. Avainruudut lasketaan kerran sekunneista projektin kuvataajuuteen.
- Hahmo/Character, Suhde/Relationship ja Ääni/Voice säilyvät profiilissa lähdeviitteineen. Tunnistetut rauhallinen/kuiva/huolestunut kuvaukset vaikuttavat hillittyyn poseen ja eleiden voimakkuuteen. Tarkoitus säilyy koko jakson tavoitteena, mutta sen vapaamuotoinen tulkinta vaatii käyttäjän tarkistuksen. Äänityksen prosodiaa ei muuteta.
- Miljöö/Environment ja Tausta/Background vaihtavat kirjaston ympäristöä. Tuetut ID:t: studio-v1, phone-front-v1, phone-angle-v1, car-driver-v1, car-passenger-v1, car-back-v1 ja white. Sanalliset suomen/englannin nimivastineet hyväksytään. Kirjastosta puuttuva metsän, kaupungin tai muun ympäristön vaatimus estää rakentamisen; valitse tapahtumalle tuettu tausta tai täsmennä teksti.
- Sijainti/Position: NIKO oikea määrittää sijoittelun. Hahmon X/Y/Koko ja keskitys ovat käyttäjän korjauksia. Näyttämötila on jatkuva kameraleikkausten läpi.
- Repliikit voivat olla PUHUJA: ja seuraava lainattu rivi tai PUHUJA: “repliikki”. Tuotannolliset kommentit eivät ole puhetta. Hiljainen jakso voi sisältää nimetyt hahmot, tuetut liikkeet ja otsikkokortit ilman dialogia.
- Kävele/juokse vasemmalle, oikealle tai suoraan, vilkuta, hyppää, kyykisty, nyökkää ja pysähdy toimivat nimetyllä hahmolla. Merkitse kesto, esimerkiksi 2 s. Puuttuva kesto on näkyvä arvio. Puhuessaan/while speaking yhdistää liikkeen edeltävän repliikin aloitukseen. Muuten liike on oma vaihe yhteisellä aikajanalla. Puuttuvat raajat/nivelsidokset ja päällekkäiset vartaloliikkeet näytetään virheinä.
- Katse puhelimeen tai nimettyyn toiseen hahmoon, huoli, hämmennys, lievästi loukkaantunut ilme, kulmakarvan nosto ja liikkumaton tuijotus käyttävät nykyisiä tasoja. Kuuntelevan hahmon suu pysyy levossa. Liikkuvan hahmon aktiivisen kuvakulman suu ajoitetaan sen lopulliseen ääneen.
- Ei isoa elettä rajoittaa eleitä. Älä liikuta NIKO jäädyttää kasvojen liikkeen ja estää vartaloliikkeen, mutta ääni voi edelleen liikuttaa suuta. NIKO saa liikkua vapauttaa kiellon. Tuntemattomat kiellot näytetään puuttuvina. Yksi puhelin on tuettu rekvisiitta; muut esineet eivät muutu huomaamatta puhelimiksi.
- WIDE/laaja, MEDIUM/puolikuva, CLOSEUP/lähikuva ja CUT/leikkaus ovat suoria leikkauksia. Puhujan vaihtuessa ehdotettu puolikuva näkyy arviona. Kamerarajaus seuraa suunniteltua liikettä, eikä muuta actorien tai puhelimen maailmantilaa.
- Numerolliset tauot suojataan. Ääneen sisältyvä tauko hyväksytään vain mitatusta loppuhiljaisuudesta. Tauot, puhe, liikkeet ja otsikkokortit lasketaan yhteiseen kokonaiskestoon. Ääntä ei nopeuteta tai typistetä tavoitteen täyttämiseksi.
- Otsikkokortti/Title card: teksti 1 s näyttää annetun tekstin määritellyn ajan. Kortti ei jää pysyvästi peittämään myöhempiä kohtauksia.

## Tarkistus ja rajat

Vaatimus näyttää Toteutettu, Arvio tai Puuttuu sekä lähderivin ja siihen liittyvän tapahtuman. Napsauta Näytä ohjeen tapahtuma korjataksesi toteutuksen. Tapahtuman laji ja tuetut arvot ovat validoitua dataa; käsikirjoituksesta ei generoida eikä suoriteta ohjelmakoodia. Puuttuva vaatimus estää rakentamisen. Käyttäjän valitsema vaihtoehto näkyy arviona ja vaatii hyväksynnän.

Tämä on paikallinen sääntöpohjainen suunnittelija, ei kaikkien vapaamuotoisten käsikirjoitusten täydellinen semanttinen tulkitsija. Enintään neljä hahmomääritystä, kirjaston taustat ja yksi puhelin. Oman mielivaltaisen rekvisiitan, oman taustakuvan ja valitun puhesynteesin yhdistäminen tähän polkuun on jatkokehitystä. Repliikkiäänien tuonti toimii nyt.

Live-kamera, mikrofoni ja näppäimet säilyvät tavallisessa Esitys-työtilassa. Jaksossa live-esikatselu vaikuttaa ensimmäisen hahmon kasvoihin; suu käyttää repliikkiääntä. Vienti ei ota live-dataa ja käyttää tallennettua suunnitelmaa. Selain-, fyysisiä laite- tai Finder-testejä ei tehty käyttäjän aiemman testausrajauksen vuoksi. Oikeita repliikkiäänityksiä ei toimitettu, joten puhuttua lopullista videota ei ole todennettu.
