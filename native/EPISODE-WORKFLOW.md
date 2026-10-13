# Koeta: yksi jakso alusta loppuun

Yläpalkki näyttää käsikirjoituksen, hahmojen, puheen, animaation ja viennin
teknisen tilanteen sekä seuraavan tehtävän. **OK tarkoittaa teknistä tarkistusta**;
liikkeiden ja kuvauksen taiteellinen hyväksyntä tehdään itse esikatselusta.

1. Avaa `examples/pilot-episode.en.txt`: englanninkielinen 24 sekunnin
   kahden hahmon pilotti *The Missing Mug*. Ohjeissa on yksi liike per rivi.
2. Valitse Kallelle ja Maijalle eri Kokoro-äänet. Ääni-välilehdellä ota jo
   asennettu Kokoro käyttöön tai hyväksy mallin lataus. Mallia ei avata
   käynnistyksessä automaattisesti. Oma äänitys ja tuotu ääni ovat ensisijaisia.
3. Toista repliikit ja tarkista suun sekä äänen ajoitus. Äänentoistolaite avataan
   vasta toistoa tarvittaessa. Puheen todellinen kesto voi pidentää riviä.
4. Napsauta aikajanaa tai Leikkaus-työtilan kohtausriviä: oikealle avautuvat
   repliikki, liike, esine, tausta ja kuvakulma. Virhepainike valitsee lähderivin.
   Muokkaa rivin luonnosta ja paina **Hyväksy rivimuutos**.
5. Raahaa Leikkaus-työtilassa rivi toisen päälle järjestääksesi jaksoa. Myös
   välittömästi edeltävät kameraohjerivit siirtyvät mukana. Muut lähderivit
   säilyvät. Lisää tauko ennen riviä, kun haluat siirtää sitä myöhemmäksi.
   Aikajanan puhe- tai liikekortin vaakaraahaus näyttää uuden alkuajan luonnoksen,
   tarkistaa ristiriidat ja pyytää hyväksynnän. Oikean reunan raahaus muuttaa
   rivin kestoa; liian pitkä tallennettu puhe estää lyhennyksen. Myös inspectorin aloitusaika tai
   `[at 1s]` ajoittaa eri hahmojen rivit päällekkäin.
   Saman hahmon ristiriitaiset toiminnot estetään; katso [ajoitus- ja kontaktiohje](PARALLEL-CONTACTS.md).
6. Muokkaa sarjan hahmo-/maailmakirjastoa Leikkaus-työtilassa. Hahmon tallennus
   säilyttää myös äänen, mitat, asun ja tyylin. Pohjan käyttö muuttaa nykyistä
   jaksoa. Kirjasto tallentuu sarjan jaksoihin yhteisenä `library`-resurssina,
   jonka sisältö tarkistetaan avatessa. Vanhemmat sovellusversiot eivät tue tätä
   uutta resurssilajia; nykyinen versio lukee myös aiemmat projektit.
7. Yhteinen **Muokkaa → Kumoa / Tee uudelleen** palauttaa käsikirjoituksen,
   hahmot, kuvan, sarjakirjaston, musiikkiraidat sekä tekstitys- ja vientiasetukset
   samassa istunnossa. ⌘Z/⌘⇧Z (Linux Ctrl) toimii tekstikenttien ulkopuolella;
   tekstikenttien luonnoksilla säilyy oma tekstikumous. Piirto ja raahaus
   ryhmitellään painalluksen päättymiseen, käsikirjoitus kirjoitustaukoon.
   Historia rajataan 16 tilaan / 128 MiB; vanhimman tilan poistosta ilmoitetaan.
   Historianvaihto ei ole puheäänityksen korvaamisen transaktio eikä historia
   säily projektin sulkemisen yli. Vanhojen työtilakohtaisten kumouspainikkeiden
   käyttö näkyy myös yhteisessä historiassa.
8. Inspectorin Kevyt/Normaali/Tarkka valitsee esikatseluresoluution. Vientikoko
   säilyy erillisenä. Katse ja puheen pienet eleet häivytetään; käsissä oleva
   esine tai kirjoitettu liike estää automaattisen puhe-eleen. Esineelle lisätään
   oikean käden sormien ote. Uudet `[pick up ...]` ja `[give ...]` käyttävät
   erillistä tarkistettua käsi-IK:ta ja maailmassa sijoitettua esinettä.
9. Tallenna `.koeta`, sulje ja avaa uudelleen. Tarkista tallennettujen äänien
   säilyminen ilman uudelleensynteesiä. Tarkista tekstitykset ja vie MP4.

## Todennuksen rajat

Linuxissa pilotin tallennus ja uudelleenavaus testataan **TestEngine-äänen**
kanssa. Oikea FFmpeg-vienti on 24 sekuntia, 720 ruutua, H.264 + AAC + mov_text;
koeviennin resoluutio 160×90. Tämä testiääni ei ole kuunneltu Kokoro-synteesi.
Mac/Metal, fyysiset laitteet, oikea Kokoro-kuuntelu ja allekirjoitetun paketin
käyttö puhtaalla Macilla odottavat oikeaa testiympäristöä.

Täydellinen kontaktieditori, ovet, portaat sekä yleinen
ulkoisten luurankojen retargetointi tarvitsevat vielä uusia domain-toimintoja
ja kontaktimittauksia. Nykyiset istumis- ja jalkakontaktitestit säilytetään.
Mac-julkaisu: [packaging/README.md](packaging/README.md).
