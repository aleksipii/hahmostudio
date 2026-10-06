# S-01 · Script / Focus hero · 1440×900 capture

**Issue:** [`FIGMA-PARITY-ISSUES-0.45.md`](FIGMA-PARITY-ISSUES-0.45.md) · S-01  
**Spec:** [`FIGMA-SCRIPT-FOCUS.md`](FIGMA-SCRIPT-FOCUS.md)

Koodi on linjassa speksin kanssa (680 px content, 56 px sticky CTA, focus piilottaa step-navin). **Pixel-vertailu Figmaan vaatii tämän capturen.**

## Valmistelu (2 min)

1. `npm run desktop:dev` tai `npm run dev` → kirjaudu tarvittaessa.
2. Avaa projekti tai jätä tyhjä käsikirjoitus.
3. Yläpalkki **Käsikirjoitus** → focus-näkymä (`script-page-open`).
4. Sulje tai hylkää **palautusbanneri**, jos se peittää hero-alueen (S-04 korjattu z-indexissä; varmista silti).

## Ikkuna 1440×900

- **Desktop:** aseta ikkuna 1440×900 (tai Chrome DevTools device mode 1440×900).
- **Electron:** `CURSOR`-ympäristössä oletus voi olla 1440×900 — tarkista ennen kuvaa.

## Mitä kuvaan

- Koko focus-overlay (ei vasemman kirjaston häiriötä).
- Näkyvissä: textarea / ScriptGuide, Esc- tai Tab-vihje, sticky **Jaa kohtauksiin** (56 px korkea primary).
- Ei step-navigointia (1–5) focus-markupissa.

## Figma

1. Avaa [KILSAT Script UI · 0.38](https://www.figma.com/design/FFy68Fynv4Ds2VgRANZoXc).
2. Frame **Script / Focus · 03 Editor hero** → 1440×900.
3. Import screenshot (ei repoon — vain Figma/FigJam).
4. FigJam [Script user flow](https://www.figma.com/board/RQ3kH9AAduLT7E3iJabv3e): linkitä sticky *Focus ↔ Panel*.

## Kun valmis

- Merkitse S-01 checklist [`FIGMA-PARITY-ISSUES-0.45.md`](FIGMA-PARITY-ISSUES-0.45.md) kohdassa 3–4.
- Lisää uudet erot issue-taulukkoon vain jos `Korjaa: kyllä`.

## Agentin esitarkistus (2026-10-06)

Raportti: [`FIGMA-VISUAL-SESSION-0.48.md`](FIGMA-VISUAL-SESSION-0.48.md) · sticky 56 px · focus compose · step-nav piilossa.  
Focus-overlay täysleveys korjattu (`.screenplay-page` ei enää `max-width: 1200px`).  
**Figma-import** ja checklist-ruksi pysyvät käyttäjän tehtävinä (kuva ei repoon).

### Figma-import (manuaalinen)

1. Ota kuva 1440×900 (focus-overlay, ks. yllä).
2. Figma → frame **Script / Focus · 03 Editor hero** → **Place image** / paste.
3. Aseta referenssikuva taustalle (opacity ~40 %) tai FigJam-linkkiin.
4. Poista referenssikuva ennen julkaisua — **älä commitoi PNG:tä repoon**.

Agentti 2026-10-06: capture + `upload_assets` → design solmu `5:2` · istunto [`FIGMA-S-01-SESSION-2026-10-06.md`](FIGMA-S-01-SESSION-2026-10-06.md).
