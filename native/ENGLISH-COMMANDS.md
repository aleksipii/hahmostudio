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
