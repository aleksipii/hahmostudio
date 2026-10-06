# Runbook · 5× kartonki-jakso + YouTube-kooste

Lyhyt polku Mr.Kille / Mr.Handu -kartonkikäsikirjoituksella, cutout-IR:llä ja yhdellä 1920×1080 -MP4-viennillä. Kaikki paikallisesti.

**Tekninen tausta:** [`DEVELOPMENT-0.46-phase-e.md`](../DEVELOPMENT-0.46-phase-e.md) · yleinen sarja [`Pystyvideo-ja-sarja.md`](../Pystyvideo-ja-sarja.md)

---

## Esivalmistel

| Kohde | Arvo |
|-------|------|
| Näyttämö | Pystyvideo **1080 × 1920** (Näyttämö-paneeli) |
| Hahmot | Kille + Handu (cutout-paketit käsikirjoituksessa) |
| Jakson max | 60 s / jakso · kooste **1–5** jaksoa |
| Sarjaraja | 128 MiB yhteensä · `.sarja` max 5 jaksoa |

Esimerkkitekstit: [`public/library/YouTube-kartonki-runko.md`](../public/library/YouTube-kartonki-runko.md) (yksi jakso) ja [`public/library/YouTube-kartonki-jaksot-1-5.md`](../public/library/YouTube-kartonki-jaksot-1-5.md) (viisi vaihtelevaa jaksoa).

---

## Vaihe A — Yksi kartonki-jakso (toista 5×)

1. **Animointi** → vasen **Käsikirjoitus** (tai yläpalkki **Käsikirjoitus** focus-tilassa).
2. **Tuo UTF-8-teksti** → valitse jakson `.md` (esim. `YouTube-kartonki-jaksot-1-5.md` → kopioi **vain yhden** `#!kilsat`-lohkon omaan tiedostoon tai leikkaa editorissa).
3. Tarkista manifesti: `Resurssi tausta: cutout-*`, `Resurssi hahmo KILLE/HANDU`, valinnainen `Resurssi esine:`.
4. **Jaa kohtauksiin** → sidonta Kille/Handu → äänet (tai hiljainen jakso ilman ääntä).
5. **Rakenna jakso** → toista esikatselu.
6. **Tallenna projekti** → `Jakso-01.hahmo` (uniikki nimi per jakso).
7. Vasen **Jaksot / sarja** → **Lisää nykyinen jakso** (tai **Tuo jaksot** aiemmasta `.hahmo`).

Toista A:lla jaksoille 02–05 (eri käsikirjoituslohko tai muokattu replikki).

---

## Vaihe B — Järjestys ja sarjatiedosto

1. **Jaksot / sarja** -listassa järjestä nuolilla (1 → 5).
2. **Tallenna sarja** → `Kartonki-YouTube.sarja` (varmuuskopio listalle).
3. Varmista yhteiskesto ja 128 MiB raja ennen vientiä.

---

## Vaihe C — YouTube-kooste (vaihe E)

1. Kun **1–5** jaksoa listassa, paina **Vie … YouTube-koosteena · MP4**.
2. Tulos: **1920 × 1080**, 30 fps, pysty sisältö **contain** + jakson taustaväri sivuilla.
3. Cutout-IR: jokaisen jakson `presentation`/manifesti ladataan vientiin (sama polku kuin yksittäis-MP4).
4. Peruuta vienti vapauttaa koodaajat/canvakset.

Julkaise MP4 itse YouTubeen; sovellus ei lähetä pilveen.

---

## Vianetsintä

| Ongelma | Tarkista |
|---------|----------|
| Kooste-nappi harmaa | Lista tyhjä tai vienti käynnissä |
| Cutout ei näy | Käsikirjoituksessa `# !kilsat` + oikeat hahmopaketit; rakenna jakso uudelleen |
| Taustakuva puuttuu | `Resurssi taustakuva:` + tuonti projektiin ennen tallennusta |
| Sarja ei avaudu | `.sarja` v1, max 5 jaksoa, alle 128 MiB |
| Desktop vs selain | Molemmissa `runVideoExport(..., wide=true)`; ExportQueue käyttää cutout-preloadia |

---

## Checklist (5× + kooste)

- [ ] 5 erillistä `.hahmo`-jaksoa tallennettu
- [ ] Kaikki pysty 1080×1920 · cutout-kohtaukset toistuvat
- [ ] `.sarja` tallennettu (valinnainen)
- [ ] Yksi 1920×1080 MP4 viety ja tarkistettu järjestys/ääni
- [ ] Figma/capture erillinen: [`FIGMA-CAPTURE-SESSION-0.45.md`](FIGMA-CAPTURE-SESSION-0.45.md)
