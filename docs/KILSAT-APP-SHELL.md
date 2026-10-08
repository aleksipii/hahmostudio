# KILSAT Studio 2.0 -kehys

Hyväksytty luonnos: tumma ammattityökalu, viisi työvaihetta, ⌘K-haku (2026-10-07).

## Entry ja tyylikerrokset (`main.tsx`)

1. `style.css`, `studio-ui.css`, `styles/tokens.css`, `styles/app-shell.css`, `styles/ui-minimal.css`, `styles/studio-components.css` — paneelikomponenttien perustyylit (palautettu; 1.0-kuori jätti ne pois ja mm. modaalit ja tuotantokierros menivät rikki).
2. `styles/kilsat-app.css` — KILSAT 1.0 -kerros.
3. **`styles/studio2.css`** — Studio 2.0: tokenit (`--s2-*`, kartoittaa vanhat `--bg-*`, `--accent`, `--color-*`), kehys, paneelit, työvaiheasettelu (`.phase-*`), ⌘K. Ladataan viimeisenä.

Tumma teema on oletus uudelle käyttäjälle; Järjestelmä/Vaalea/Tumma valitaan Asetuksista tai ⌘K-haulla.

## Rakenne

| Tiedosto | Rooli |
|----------|--------|
| `components/studio-shell.tsx` | Yläpalkki: brand, projektivalikko, työvaiheet 1–5, haku, kumoa/tee uudelleen, Näytä, Tallenna, Vie |
| `components/command-palette.tsx` | ⌘K-haku; komennot ajavat samat funktiot kuin painikkeet |
| `components/app-menu.tsx` | Valikko (`summary`-, `className`-propit projektivalikolle) |
| `components/editor.tsx` | Moottori ja asettelu; `paletteCommands`, `angleChoice`, `movementShortcuts` |
| `lib/` | Ei muutoksia |

## Toimintojen paikat

- Projektivalikko: avaa, viimeksi avatut, tallenna, tallenna nimellä, versiot, tuo kuva/PSD, lisää ääni, erilliset JSON-tiedostot, edellinen työ, asetukset, käyttöohje, tuotantokierros, kirjaudu ulos.
- Näyttämön palkki: työvaiheen otsikko, Rakenna/Esitys (Hahmot), kuvakulma, Kuvakortit, Tarkista tuonti, Keskittymistila (Käsikirjoitus), esikatselun tausta.
- Hahmotyökalut (Piirtäminen, Tasot, Nivelmääritys, Alkuperäinen PSD) kelluvat näyttämöllä Rakenna-tilassa.
- Ohjauslähteet (kamera, mikrofoni, näppäimet, valmiit liikkeet) ovat oikeassa paneelissa Esitys-tilassa.
- Storyboard: kuvataulu täyttää keskialueen. Kuva: kuvanauha näyttämön yläpuolella. Aikajana: kuvataulu suljetaan.
- Asetukset-ikkuna: ulkoasu, saavutettavuus, työvaiheen rajaus, pikanäppäimet.
- Pikanäppäimet: ⌘K haku, ⌥1–⌥5 työvaihe, ⌥6 Työpaja (ei kirjoituskentissä rajoitettu; QuickPanelin perusliikkeet ohittavat muokkausnäppäimet).

Poistettu päällekkäisinä: valikkorivi (Tiedosto/Muokkaa/Näytä/Asetukset/Ohje), sivuraili, Lisätyökalut, Työtila-asetukset, toistuva Hahmo/Esitys-kytkin yläpalkissa. Niiden toiminnot ovat yllä luetelluissa paikoissa.

## Tuotanto ja Työpaja (2026-10-08)

Kaksi osastoa kuten studiossa. Mitään toimintoa ei poistettu.

- Työvaiheet nimetty elokuvan vaiheiksi: **Tarina, Roolitus, Storyboard, Kuvaus, Leikkaus** (tunnisteet `script`…`timeline` ennallaan, joten tallennettu työvaiherajaus ja kierros toimivat).
- **Työpaja** (yläpalkissa vaiheiden vieressä, ⌥6, ⌘K "Työpaja") = vanha Hahmo/Rakenna-työtila: tasot, piirto, nivelet, tuonnin tarkistus ja esikatselun tausta. PSD-tuonti ilman valmista ohjausta avautuu edelleen sinne.
- Roolitus avaa suoraan Esitys-työtilan (kirjasto, puhujasidokset, live-ohjaus). Rakenna/Esitys-kytkin poistui näyttämön palkista; Hahmon osat -välilehti näkyy vain Työpajassa.
- Esikatselun taustanapit näkyvät vain Työpajassa; kaikkialla ⌘K "Esikatselun tausta".
- `lib/studio-feature-map.ts`: jokaisen toiminnon koti (osasto, vaihe, paljastuskerros, ⌘K-tunniste). Testi varmistaa, että jokaisella ⌘K-komennolla on koti, kartta ei viittaa puuttuvaan komentoon ja kunkin vaiheen päänäkymässä on enintään 7 toimintoa.
