# Dialogikohtaukset · 0.6.0

1. Avaa vanha projekti tai valitse kirjaston hahmo. Avaa Käsikirjoitus → Dialogi ja leikkaukset.
2. Tuo UTF-8 `.md`/`.txt`, liitä teksti tai lataa KILSAT-esimerkki. Tunnista ja tarkista. Lähdeteksti ja lähderiviviitteet säilyvät.
3. KILLE → Roni, HANDU → Salla. Vaihda hahmo kirjastosta tai tuo valmis .hahmo. Omat PSD:t tarvitsevat ensin pikaanimoinnin sidokset. Tarkista toimintojen vastaavuudet; puuttuva toiminto estää luonnin.
4. Keskitä kumpikin hahmo omalle sommittelualueelleen. Säädä X, Y ja Koko tarvittaessa. Tarkista puhelimen haltija, käsi ja kuvakulma. Valkoinen studio ja sama puhelin pysyvät kameraleikkausten läpi.
5. Lisää jokaiselle repliikille oma ääni. Pitkästä yhteisestä tallenteesta voit rajata alku-/loppuajan ennen tuontia. Ääntä ei generoida, nopeuteta tai katkaista tavoitepituuteen.
6. Oletuksena suu aukeaa äänen voimakkuudesta. Valinnainen paikallinen englannin Rhubarb sovittaa äänteet kolmeen suuasentoon. Hiljaisuus sulkee suun. Tämä on rajallinen suumuotosovitus, ei täydellinen äännetranskriptio. Muokkaa suuajoitusta tarvittaessa tapahtumaeditorin JSON-kentässä (`time` sekunteina, `shape`: `rest`, `open`, `round`). Muokkaus lukitsee ajoituksen.
7. Säilytä suojatut tauot. Jos tauko sisältyy ääneen, merkitse valinta vain todellisen loppuhiljaisuuden yhteydessä; näytteistä mitattu hiljaisuus tarkistetaan. Muutoin tauko lisätään äänen perään.
8. Tavoitteen ylitys näyttää ristiriidan. Valitse luonnollinen pidempi kesto tai korjaa ääniä/tekstiä. Nykyinen koko projekti enintään 60 s / 1800 ruutua. Esimerkin 30–35 s ei ole lupaus, jos omat äänen kestot ylittävät sen.
9. Tarkista esikatselu. Aikajana näyttää kameran, dialogin, ilmeet, katseet, liikkeet, puhelimen, tauot, otsikon ja suuajoituksen. Painamalla tapahtumaa avaat muokkauksen. Lukituksia ei sivuuteta uudelleenrakennuksessa.
10. Säilytä valmistelu projektissa ja tallenna .hahmo myös keskeneräisenä. Lisää valmis kohtaus projektin loppuun. Päivitä korvaa saman kohtauksen, Kumoa palauttaa aikajanan ja äänen. Aiemman kohtauksen keston muuttaminen estetään, jos se siirtäisi myöhempää sisältöä. Viimeisen kohtauksen kestoa voi muuttaa.
11. Tallenna .hahmo ja vie MP4 nykyisellä vientityökalulla. Pystyvideo: 1080 × 1920. Jaksot / sarja kokoaa viisi tallennettua jaksoa laajakuvakoosteeksi.

## Tuettu muoto

```text
SARJA — S01E01: “Jakson nimi”
Pituus: 30–35 sekuntia
0:00–0:05 — Aloitus
WIDE — molemmat hahmot.
KILLE:
“Hello.”
Katsoo puhelinta.
Pidä noin 0,5 sekuntia.
CUT TO: CLOSEUP HANDU.
HANDU:
“No.”
```

Puhe tunnistetaan nimirivistä ja seuraavasta lainatusta tekstistä. Markdown-otsikot, lihavoidut nimet, CRLF ja viivavariantit hyväksytään. Tarkistus säilyttää tuntemattomat ohjeet näkyvinä. Parserin ohjelmointirajapinta hyväksyy erillisen nimialias-kartan; käyttöliittymässä käytä samaa puhujan nimeä koko käsikirjoituksessa.

Kamerakoot: WIDE (laaja), MEDIUM (puolikuva), CLOSEUP (lähikuva), CUT TO (suora leikkaus). Tuetut hillityt toiminnot: neutraali puhe, huoli, hämmennys, lievästi loukkaantunut ilme, katse puhelimeen/toiseen hahmoon, puhelimen näyttäminen, kulmakarvan nosto ja liikkumaton tuijotus. Yleiset tuotanto-ohjeet eivät muutu repliikeiksi. Käsikirjoitusta ei tulkita pilvimallilla.

## Ohjauslähteet ja rajat

Käsikirjoitus tuottaa deterministisen suunnitelman. Tallennettu kasvoliike luetaan hahmopaketista, jos siinä on liikkuvia kasvotason avainruutuja. Repliikkiääni ohjaa suuta myös tässä tilassa. Live-esikatselu voi ohjata ensimmäisen hahmon kasvoja Esitys-työtilan tiedoista; vienti käyttää tallennettua suunnitelmaa. Kehon ja käsien ohjaus säilyy erillisenä. Suojattu viimeinen tuijotus ei saa satunnaista lepoliikettä tai räpäytystä.

Dialoginäyttämö on tässä vaiheessa valkoinen studio, enintään neljä puhujamääritystä ja yksi käteen kiinnitetty puhelin. KILSAT on kaksihahmoinen esimerkki. Käsikirjoituksen yleisten liikeohjeiden kävely/juoksu jää nykyiseen Yhden hahmon liikkeet -työkaluun. Tämä ei korvaa kaikkia Adobe Character Animatorin toimintoja.

Liitteessä ei ollut oikeita repliikkiääniä. Valmista puhuttua KILSAT-videota ei ole tuotettu tai tarkistettu. Fyysisiä laitteita, Safari-ikkunaa, visuaalista esikatselua tai Finder-käynnistystä ei testattu käyttäjän testausrajauksen vuoksi.
