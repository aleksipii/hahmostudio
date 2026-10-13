# Koeta: englanninkieliset ohjeet ja tarkistetut ehdotukset

Käsikirjoitus on lähdeteksti. `NAME: dialogue` on repliikki; hakasulkeissa
oleva tuettu ohje ohjaa animaatiota. Englanninkielisen repliikin sanat eivät
käynnistä liikettä: `KALLE: I love to walk.` säilyy puheena. Käytä esimerkiksi
`[walk left 2s]` liikkeeseen. Suomenkieliset tagit ja aiempi FI-tunnistus säilyvät.

## Tuettu ohjekieli

Ohjeet eivät ole yleinen englannin kielen ymmärtäjä. Vain testatut muodot
ja valmiiksi toteutetut animaatiotoiminnot hyväksytään. Kirjainkoko ja
välilyöntien määrä eivät muuta ohjetta. Tuntematon toiminta, suunta,
moniosainen komento tai tuntematon muunnin antaa virheen.

| Toiminta | Esimerkkejä |
| --- | --- |
| Kävely | `[walk left 2s]`, `[walking to the left for 2 seconds]`, `[walk straight ahead 2s]` |
| Kävely taakse | `[walk backward 2s]`, `[walking backwards 2s]` (säilyttää suunnan) |
| Kääntyminen | `[turn left 2s]`, `[turn right 2s]` (suhteellinen 90°) |
| Osoittaminen | `[point forward 2s]` (oikea käsi, hahmon eteen) |
| Olankohautus | `[shrug shoulders 2s]` |
| Pään pudistus | `[shake head 2s]` |
| Taputus | `[clap hands 2s]` |
| Juoksu | `[run right 3s]`, `[running to the right for 3 seconds]` |
| Vilkutus | `[wave hello 2s]`, `[waving goodbye 2s]` |
| Hyppy | `[jump 1.2s]`, `[jumping for 1.2 seconds]` |
| Tuolille istuminen | `[sit on chair 2s]`, `[sitting on the chair 2s]` |
| Tuolilta nouseminen | `[stand up 2s]`, `[standing up 2s]` |
| Kyykky | `[crouch 2s]`, `[crouching for 2 seconds]` |
| Nyökkäys | `[nod 2s]`, `[nodding for 2 seconds]` |
| Tauko | `[wait for 2 seconds]`, `[pausing 2s]` |
| Puhelin | `[texting on phone 3s]`, `[tap the phone 3s]`, `[type on the phone 3s]` |
| Ilme | `[expression happy]`, `[emotion cheerful]`, `[emotion afraid]` |
| Kamera | `[shot close-up]`, `[camera close up]`, `[camera wide shot]`, `[camera two shot]` |
| Katse | `[look at Maija]`, `[look toward camera]`, `[look towards Kalle]` |
| Tausta | `[background living room]`, `[background kitchen]` ja valmiit taustanimet |
| Esine | `[prop coffee cup]`, `[prop book]`, `[prop none]` ja valmiit esinenimet |

Kävelylle ja juoksulle annetaan suunta: left/right/front/forward/straight ahead
(tai tuettu `to the ...` -muoto). `[walk]`, `[run backward 2s]`,
`[walk to the moon]` ja `[wave angrily]` eivät valitse arvaamalla toimintaa.
Liikkeen kesto on 0,5–20 sekuntia; koko jakson raja on 60 sekuntia.
Tuolille istuminen ja nouseminen tarvitsevat vähintään 1 sekunnin.
Istuma-asento jatkuu nousemiseen asti; puhe, tauko ja nyökkäys toimivat istuen.
Muut liikkeet tarvitsevat ensin nousemisen. Katso tuolin sijoittelu ja kontaktirajat
[tuolikontaktin ohjeesta](PRODUCTION-RULES.md#ensimmäinen-tuolikontakti).
Puhetta ei nopeuteta mahtumaan lyhyeen liikeohjeeseen.

## Editorin ehdotukset

1. Valitse editorissa rivi kohdistimella tai **Rivikohtainen tarkistus** -listasta.
2. Keskeneräinen/virheellinen hakasuljeohje näyttää siihen sopivia vaihtoehtoja.
   **Etsi ohjetta** hakee testatusta komentoluettelosta.
3. Valitse vaihtoehto ja tarkista **Nykyinen rivi / Ehdotettu rivi**.
4. **Hyväksy muutos** vaihtaa vain tämän rivin; **Peruuta** säilyttää tekstin.

Tuettu hakasulkeeton erillinen ohje, esimerkiksi `walk to the left for 2 seconds`,
voi saada tulkintaehdotuksen `[walk to the left for 2 seconds]`.
Ilman hyväksymistä alkuperäinen teksti pysyy puheena. `KALLE: walk left 2s`
on puhujan repliikki, eikä sitä ehdoteta korvattavaksi toiminnalla.
Pitkistä kuvauksista kuten `Kalle walks into the kitchen and opens a door`
ei muodosteta keksittyä animaatiota. Ne vaativat käyttäjän kirjoittamat tuetut
kamera-, tausta- ja liikeohjeet.

Rivitarkistus näyttää virheen, tulkintatarpeen, repliikin ja mahdollisen puhetilan.
Ohjetarkistus ei tarkoita, että ääni tai vienti olisi valmis. Vienti tekee oman
puheresurssien tarkistuksen.

Ehdotukset ovat erillisiä esikatseluja. Jos käsikirjoitus muuttuu esikatselun
jälkeen, vanhaa ehdotusta ei hyväksytä. CRLF, Unicode, muut repliikit ja
äänitysten tekstisidokset säilyvät. Projektin/jakson vaihto nollaa esikatselun.
Koko lähdetekstin 12 000 merkin raja koskee myös hyväksyttävää muutosta.

Toteutus: `hs-script::english` (komentosäännöt/luettelo),
`hs-script::assist` (tarkistus ja hyväksyttävä lähdemuutos) sekä natiivin
`script_assist_ui`. Ei pilvipalvelua, kielimallia tai käsikirjoituksen suorittamista.

Esimerkki: [english-reviewed.txt](examples/english-reviewed.txt).

## Liikekirjaston ensimmäinen laajennus

Kääntyminen on suhteellinen 90 asteen liike, ei maailman suuntaan tehty hyppy.
Uusi suunta säilyy liikkeen päätyttyä. Takaperin kävely kulkee hahmon nykyistä
suuntaa vasten ja käyttää omaa käänteistä askelsykliä. `point forward` tarkoittaa
hahmon paikallista etusuuntaa, ei arvatun henkilön/esineen kohdistamista.
Kääntymiseen ja takaperin kävelyyn ei lisätä samanaikaista `view`-ohjetta.

Osoittaminen, olankohautus ja taputus tarvitsevat nykyisessä toteutuksessa
vapaat kädet: poista kädessä oleva esine (`prop none`) ja piilota puhelin
(`phone hidden`). Nouse tuolilta ennen uusia liikkeitä. Pään pudistus on
animoitu kieltoele; se ei muuta repliikkiä tai sen merkitystä.

Esimerkki: [english-movements.txt](examples/english-movements.txt).
Tämä on seitsemän toteutetun liikkeen erä. Sivuaskeleet, portaat, oven avaaminen,
esineiden nouto/luovutus, kättely ja halaus eivät vielä kuulu tuettuun kieleen.
Niitä ei korvata samankaltaisella liikkeellä.
