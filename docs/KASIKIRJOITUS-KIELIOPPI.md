# Käsikirjoituksen tarkka kielioppi (Rakenna jakso)

Tunnistin on **sääntöpohjainen**, ei vapaan kielen ymmärrys. Siksi “mitä tahansa siihen laittaa, se luo animaation
virheettömästi” toteutetaan näin, ja nämä takuut on testattu:

1. **Jokaisella rivillä on täsmälleen yksi lopputulos** (tapahtuma, rakenne, kommentti tai näkyvä tarkistusmerkintä).
   Rakentaja ei kaadu millään syötteellä (fuzz-testi), eikä mitään ohiteta hiljaa: tunnistamaton lause näkyy
   tarkistuksessa rivinumeron kanssa eikä sille arvata animaatiota.
2. **Kanoninen muoto tunnistetaan aina 100 %:sti.** Alla oleva lauseluettelo on sama, jonka palikkaeditori kirjoittaa
   (`lib/blocks.ts` `blockSentence`). Testi: palikka → teksti → palikka tuottaa identtiset palikat.
3. **Sama syöte tuottaa saman jakson tavu tavulta** (ei satunnaisuutta, kelloa tai verkkoa).
4. **Puuttuvat resurssit eivät estä rakennusta**: puuttuva ääni, tuntematon tausta tai hahmo näkyy virheenä, jakso
   rakentuu silti katsottavaksi (neutraali tausta, oletushahmo).

Vapaa proosa (“Mira miettii elämäänsä”) ei ole virhe vaan näkyvä huomautus: animaatiota ei keksitä. Jos haluat varman
tuloksen, kirjoita rivi kanonisessa muodossa tai muokkaa palikkaa — palikkaeditori kirjoittaa kanonisen muodon puolestasi.

## Rakenne

| Rivi | Esimerkki | Tulos |
|---|---|---|
| Jakso | `Jakso 1: Pysäköintisakko` tai `---` | Uusi jakso (sarja, enintään 5 per .sarja) |
| Kohtaus | `INT. KEITTIÖ - AAMU`, `SISÄ. OLOHUONE`, `Kohtaus: Katu` | Osio + tausta synonyymeistä |
| Tausta | `Tausta: keittiö` | Kirjaston tausta (keittiö, olohuone, toimisto, kahvila, katu, puisto, auto, studio…) |
| Hahmo | `Resurssi hahmo MIRA: Pipsa`, `@mira → MIRA` | Roolitus; muuten nimi tai oletuspaketti |
| Esine pöydälle | `Resurssi esine: pöytä` | Pöytä sijoitetaan laskevan käden ulottuville |
| Musiikki | `Musiikki: iloinen / jännittävä / rauhallinen / surullinen / oma.wav / pois` | Ohjelmallinen tai tuotu musiikki, ducking |
| Tehoste | `Ääni: ovi`, `SFX: door`, `Puhelin soi.`, `Ovi paukahtaa.` | Tehoste kohdalleen |
| Repliikki | `MIRA:` + `“Teksti”` tai `MIRA: “Teksti”` | Repliikki (ääni tuodaan tai äänitetään) |
| Kuva | `LAAJA KUVA`, `PUOLIKUVA MIRA`, `LÄHIKUVA MIRA` | Kuvakoko, rajaus silmälinjaan |
| Siirtymä | `HÄIVYTYS MUSTAAN`, `HÄIVYTYS SISÄÄN`, `RISTIKUVA`, `LEIKKAUS` | Siirtymä |

## Kanoniset lauseet (palikat)

Kesto on valinnainen (`2 s`, `1,5 s`, `kaksi sekuntia`); ilman kestoa käytetään liikkeen luontevaa oletusta.

| Palikka | Kanoninen lause |
|---|---|
| Kävely / juoksu | `Mira kävelee oikealle 2 s.` · `Mira juoksee vasemmalle 1,5 s.` · `Mira kävelee suoraan 2 s.` · `Niko kävelee sisään vasemmalta 2 s.` |
| Eleet | `Mira vilkuttaa 2 s.` · `Mira osoittaa.` · `Mira puristaa nyrkkiä.` · `Mira nyökkää.` · `Mira hämmästyy.` |
| Vartalo | `Mira istuu.` · `Mira hyppää.` · `Mira kyykistyy.` · `Mira pysähtyy.` |
| Ilmeet | `Mira hymyilee.` · `Mira näyttää surulliselta / vihaiselta / huolestuneelta / hämmentyneeltä / loukkaantuneelta.` · `Mira näyttää peloissaan.` · `Mira tuijottaa ilmeettömänä.` · `Mira nostaa kulmiaan.` |
| Katse | `Mira katsoo kameraan.` · `Mira katsoo puhelinta.` · `Mira katsoo Nikoa.` |
| Puhelin | `Mira pitää puhelinta.` · `Mira näyttää puhelinta.` · `Mira näyttää puhelinta kameralle.` · `Mira napauttaa puhelinta.` · `Mira nostaa puhelimen korvalle.` · `Mira siirtää puhelimen toiseen käteen.` · `Mira laskee puhelimen pöydälle.` |
| Muut esineet | `Mira pitää kahvikuppia / kirjaa / laukkua / sateenvarjoa (vasemmassa kädessä).` · `Mira laskee kirjan pöydälle.` |
| Tauko | `Odota 1 s.` · `Mira odottaa 0,5 s.` · `Pieni tauko.` |
| Rajoitus | `Mira ei liiku.` · `Ei isoja eleitä.` · `Älä liikuta kameraa.` |
| Samanaikaisuus | `Samalla Mira vilkuttaa.` (alkaa edellisen repliikin kanssa) |

Englanti vastaavasti: `Mira walks right 2 seconds.`, `Mira waves.`, `Mira looks at the camera.`, `Mira holds a coffee cup.`

## Tarkka tila

`#!kilsat` lohkon alussa ottaa käyttöön tiukan kieliopin (`lib/script-grammar.ts`): jokainen tapahtuma vaatii nimetyn
hahmon ja keston, ja tuntematon rivi on virhe (ei huomautus). Metatietorivit (`Jakson nimi:`, `Pituus:`, `Musiikki:`,
`Resurssi …`) hyväksytään.

## Rajat
- Tunnistin ei ymmärrä mielivaltaista luonnollista kieltä eikä tuota puhetta. Uudet verbit vaativat sanaston laajennuksen.
- Hahmoja enintään neljä näyttämöllä kerrallaan.
- Ajoitus on käsikirjoituksen järjestys (+ `Samalla`); vapaa sekuntitarkka sijoitus tehdään tauoilla.
