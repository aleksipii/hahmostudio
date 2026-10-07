# KOETA · premium-viimeistelykerros

`styles/koeta-premium.css` ladataan viimeisenä (`main.tsx`). Vain tyylit ja kaksi
välilehtien nimeä; ei logiikka- tai tallennusmuutoksia.

## Päivitys
Yhden värin kokeilu (kaikki sinistä) hylättiin; tumma tila ja Ulkoasu-valinta (järjestelmä/tumma/vaalea) on palautettu.

## Periaatteet
- Neutraali tumma pinta, hiusviivareunat, yksi aksentti (logon sininen `#5ac7ff`).
- Oletuspainike on hiljainen (läpinäkyvä, reunus). Aksentti vain pääasialle (Vie…,
  ensimmäinen CTA), valinnalle (alleviivaus) ja fokukselle.
- Poistettu uncommitoitu sääntö (`studio2.css`), joka maalasi kaikki painikkeet siniseksi.

## Korjatut päällekkäisyydet ja leikkautumiset
| Ongelma | Korjaus |
|---|---|
| Vasemman paneelin välilehdet leikkautuivat (”Jaksot / sarja” piilossa) | Lyhyemmät nimet (Kirjasto, Jaksot), tasainen jako, `!important`-säännöt korjattu lähteessä |
| Oikean paneelin välilehtirivi romahti 1 px:ään ja katosi sisällön alle | `flex: none; min-height` |
| Inspektorin lohkot työntyivät oikealle (`align-items: end`) | `align-items: stretch`, täysi leveys |
| Aikajana vei yli puolet matalasta ikkunasta | Korkeus `min(var(--timeline-size), 26dvh)` |
| Tilarivin viestit leikkautuivat satunnaisesti | Lyhyet tilat kiinteinä, pitkä viesti typistyy |
| Kelluva työkalulista peitti piirtoalueen | Näyttämö varaa 148 px kaistan |
| Esitys/Rakenna-kytkin + sama otsikko kahdesti | Toistuva otsikko piilotettu |
| Aloituskortti vieri sisäisesti, kaksi sinistä CTA:ta | Tiivistetty, vain yksi aksenttipainike |

## Todennus
- Selaimessa 1200×700 (ikkunan vähimmäiskoko) ja 1440×900; viisi työvaihetta; DOM-pohjainen
  päällekkäisyys-/leikkautumisskannaus: ei todellisia osumia (jäljellä vain suljettujen
  valikoiden ja vierityskontainerin reunan väärät positiiviset).
- `npm run typecheck` ok. `npm test`: 1006/1007; ainoa epäonnistuminen on
  `playback-load`-suorituskykybudjetti, joka läpäisee erikseen ajettuna (kuormaherkkä).
- Ei ajettu: pakattu Electron-sovellus, oikea Mac-ikkuna, Retina-näyttö.

## Tunnetut rajat
- Vaalea teema: tilarivit ja kentät ok, mutta osa vanhoista paneeleista (esim. ääniosion
  tumma laatikko, aikajana) on edelleen kovakoodattu tummaksi.
- Kapeampi kuin 1200 px ikkuna ei ole tuettu (Electronin `minWidth`).
