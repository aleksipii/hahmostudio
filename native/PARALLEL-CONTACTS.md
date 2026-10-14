# Päällekkäinen ajoitus ja esinekontaktit

## Puheen ja liikkeen erillinen ajoitus

`[at 2s]` ajoittaa repliikin/rivin oletusikkunan absoluuttiseen aikaan.
Ilman sitä rivi alkaa aiempien rivien viimeisen päättymisen jälkeen.
Tallennettu puhe ja 0.3 s hengähdys voivat pidentää ikkunaa; ääntä ei leikata
ja synteesin nopeutta ei muuteta editorin aikarajan vuoksi.

Liikkeellä voi olla oma absoluuttinen alku ja kesto:

```text
KALLE: Hello there. [at 0s] [wave 3s] [motion at 1s] [motion duration 1s]
```

Repliikin ikkuna alkaa 0s ja sen oletuskesto on 3s. Vilkutus tapahtuu 1–2s.
Ilman uusia ohjeita vanha liike alkaa repliikin kanssa ja käyttää alkuperäistä
kestoa. Liike voi alkaa ennen puhetta tai sen jälkeen. Jakso ja seuraavan
implisiittisen rivin alku lasketaan molempien raitojen viimeisestä lopusta.

- **Puheradan kortti:** vaakaraahaus muuttaa vain repliikin alkua, oikean
  reunamerkin raahaus sen oletuskestoa. Nykyinen liike ankkuroidaan omilla
  ohjeilla, joten se säilyy myös vanhan projektin ensimmäisessä editissä.
- **Liikeradan kortti:** raahaus muuttaa vain `[motion at]`-alkua; oikea reuna
  muuttaa `[motion duration]`-kestoa. Puheen alku, näytteet, huulisynkka ja
  tekstitykset säilyvät. Liike voi olla puhetta lyhyempi.
- Keltainen kehys näyttää muokattavan raidan luonnoksen. Pudotus avaa
  tarkistuksen; **Hyväksy ajoitus** kirjoittaa lähdetekstin, **Peruuta** säilyttää
  sen. Escape peruu aktiivisen raahauksen. ⌘Z/⌘⇧Z (Linux Ctrl) palauttaa hyväksynnän.

Tarkistus käyttää nykyisiä tallennettuja ääniä, hahmoja, kameraa ja kontakteja,
eikä käynnistä synteesiä. Hyväksynnässä tilanne tarkistetaan uudelleen.
**Näytä virherivi** valitsee ilmoitetun lähderivin ja sen nykyisen aikajanakohdan.
Inspector näyttää liikkeen alku- ja loppuajan erikseen rivin ikkunasta.
Ajoituksen muutos ei järjestä hahmoja uudelleen näyttämöllä: tallennettujen
profiilien järjestys säilytetään, ja uudessa projektissa käytetään lähderivien järjestystä.

Kestot ovat 0.5–20s; esinekontaktit ja istuminen/nouseminen vähintään 1s.
Saman hahmon eri rivien päällekkäisyys hyväksytään vain erillisillä tuetuilla
liikekanavilla; koko kehon kontaktit varaavat vartalon ja tarvittavat kädet.
Tämä on konservatiivinen ristiriitasääntö, ei mielivaltaisten liikkeiden
yhdistäjä. Enimmäispituus on 60s. Puuttuvan puheen
todellinen ajoitus tarkistetaan vasta sen tuotannon jälkeen.

Rivin yhteiset hahmo-, esine- ja kamera-asetukset ovat voimassa aikaisemmasta
liike-/puhetapahtumasta molempien loppuun. Ensimmäisen rivin alkutausta on
käytössä hetkestä0; myöhemmät taustavaihdot seuraavat rivin ensimmäistä tapahtumaa.
Kamera on yhteinen: ristiriitaiset yhtäaikaiset kirjoitetut ohjeet estetään,
ja kirjoitettu kuvakulma voittaa automaattisen ehdotuksen.

MP4/SRT yhdistää päällekkäiset repliikit puhujanimineen yhteen ajoitettuun
tekstipakettiin. Projektin alkuperäisiä repliikkejä ei muuteta.
Aikajanan lopussa on enintään kaksi sekuntia tyhjää muokkaustilaa pidennykseen;
jakson kesto säilyy erillisenä. Kamera-/taustakortteja voi raahata ajoitusluonnokseksi.
Valitse hahmo -painike valitsee tarkistetun käsikirjoituksen hahmon toimintorivit;
valintamäärä ja palikoiden korostus näyttävät ryhmän. Lähdetekstin muuttuminen
tyhjentää ryhmävalinnan, jotta vanhat rivinumerot eivät osu uusiin toimintoihin.
Kun vähintään kaksi riviä on valittuna, valitun palikan raahaus siirtää koko
ryhmää yhteisellä ruutuihin kohdistetulla aikaerolla. Kehykset näyttävät luonnoksen;
pudotus avaa tarkistuksen ja hyväksynnän. Escape peruu, nollasiirto ei luo muutosta.
Palikan viimeiset 10 pikseliä säilyvät yksittäisen keston muokkaukseen.
Ilmeet ja katseet näkyvät inspectorissa ja esikatselussa; ne eivät peitä
varsinaisia liikeradan kortteja.

Esimerkit: [independent-motion.en.txt](examples/independent-motion.en.txt)
ja [parallel-dialogue.en.txt](examples/parallel-dialogue.en.txt).

## Esineen nosto ja luovutus

```text
[background living room]
[camera two shot]
[object cup mug on stand at -0.25 1.22 0.20]
KALLE: [pick up cup 2s]
MAIJA: [at 0s] [wait 6s]
KALLE: [at 2s] [give cup to Maija 2s]
```

`cup` on yksilöllinen tunniste, `mug` tuettu esinemalli ja koordinaatit ovat
esinespesifisen tartuntapisteen metrejä maailman koordinaatistossa.
Valinnainen `on stand` lisää esineen alle geometrisesti mitoitetun tuen.
Ilman sitä tukea ei arvata. Enintään 16 esinettä; tunnisteessa ASCII-kirjaimet,
numerot tai alaviiva, pituus 1–32. Koordinaatit ovat äärellisiä, enintään
±5 metriä ja korkeus vähintään 0.1 metriä.

Nosto ja luovutus kestävät 1–20 sekuntia. Nosto valitsee lähimmän vapaan
käden ja tarttuu 45 prosentin kohdalla. Alustalta nostettaessa esine nousee
12 cm. Lattialla olevaan esineeseen hahmo kyykistyy nilkat ja varpaat
ankkuroituina, tarttuu ja nousee takaisin seisten esine kädessä. Lattialle
laskeminen käyttää vastaavaa ankkuroitua kyykistymistä.
Esimerkki: [floor-pickup.en.txt](examples/floor-pickup.en.txt).
Luovutus siirtää omistajuuden puolivälissä ja vapauttaa antajan käden.
Vastaanottajan pitää olla käsikirjoituksen nimetty hahmo. Esineen on oltava
olemassa ja antajan omistuksessa; toiminnan osapuolet pysyvät paikallaan
kontaktin aikana. Odotus ja pienet pään liikkeet ovat sallittuja.

Puuttuva esine, tavoittamaton ote, varattu käsi, väärä omistaja tai ristiriitainen
liike estää tuotannon. Tarkistus käyttää nykyisten hahmojen luurankoja ja
käsi-IK:ta, mittaa täyden otteen virheen (enintään 2 mm) sekä tarkistaa otteen
jokaisessa renderöidyssä ruudussa. Esinemallit ja tukigeometria välimuistitetaan.
Inspectorissa voi valita tunnetun esineen, vastaanottajan ja kontaktin keston.

Käsikirjoitus tallentuu `.koeta`-projektiin; kontaktit rakennetaan uudelleen
projektin omista hahmoista avaamisen jälkeen. Tämä ei ole jäykkien kappaleiden
fysiikkasimulaatio eikä yleinen sormien tai vartaloiden törmäysratkaisin.
Ovilla, pudottamisella ja portailla on rajatut toteutetut kontaktit; yleinen
dynaaminen törmäysratkaisu ja mielivaltaisten ulkoisten luurankojen retargetointi
ovat edelleen avoinna. Tarkista kuva, kädet ja ajoitus esikatselusta.

Hahmojen vartaloita, päitä ja jalkoja tarkistetaan FK:sta johdetuilla kapseleilla.
Samanaikaiset risteävät reitit hylätään lähderivin, osapuolten ja ajan virheellä.
Tarkistus käyttää ratkaistuja kontaktiasentoja ja sallii 3 mm toleranssin;
käsivarsia ja sormia ei käsitellä vartalotörmäyksinä, joten tuettu luovutus säilyy.
Näytteiden välissä tarkistetaan samanaikaisesti etenevät lineaariset kapseliradat.
Työ on rajattu; epäselvä läheinen kontakti hylätään konservatiivisesti.
Tämä ei ole mielivaltaisen epälineaarisen liikkeen tai tarkkojen pintojen fysiikkatakuu.

Linux-testit kattavat kontaktigeometrian, omistajuuden, ristiriidat,
tallennuksen ja uudelleenavauksen. TestEngine on simuloitu puhe; se ei todista
Kokoron laatua, kuuntelua tai Mac-laitteiden toimintaa.
