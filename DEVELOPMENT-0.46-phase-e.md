# Vaihe E — YouTube-sarjaketjutus (kooste)

## Kehitysvaihe
Lyhyiden jaksojen ketjutus laajakuvaan (1920×1080) ilman pilveä; sama render-polku kuin yksittäis-MP4, mukaan cutout-IR.

## Valmis (koodi)
- **`lib/mp4-export.ts`:** 1–5 `.hahmo`-jaksoa, `wide=true` → 1920×1080, `contain` + taustaväri, cutout-preload kaikille jaksoille.
- **`components/episode-panel.tsx`:** sarja 1–5 jaksoa; YouTube-kooste ei vaadi enää täyttä viittä jaksoa.
- **Sarjatiedosto `.sarja`:** version 1, enintään 5 jaksoa / 128 MiB (aiempi polku säilyy).

## Rajat
- Kooste ei korvaa `.hahmo`-projektia eikä tee automaattista projektitallennusta.
- Jakson enimmäiskesto vientiin 60 s / jakso (aiempi raja).
- 20 minuutin production-malli ≠ `.sarja`-kooste.

## Dokumentaatio
- Runbook: [`docs/YOUTUBE-KARTONKI-SARJA-RUNBOOK.md`](docs/YOUTUBE-KARTONKI-SARJA-RUNBOOK.md)
- Viisi esimerkkikäsikirjoituslohkoa: [`public/library/YouTube-kartonki-jaksot-1-5.md`](public/library/YouTube-kartonki-jaksot-1-5.md)

## Seuraava
- Valinnainen: sarjan metatiedot (otsikko, jakson järjestys) manifestiin.
- Käyttäjän end-to-end vienti (ei automaattitestissä).
