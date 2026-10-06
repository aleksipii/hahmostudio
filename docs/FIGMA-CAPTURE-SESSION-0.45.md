# Figma capture · Script / Focus · 0.45

**Istunto:** 2026-10-06 · `http://127.0.0.1:5179` (Vite / desktop-dev -polku)  
**Huom:** Kuvaa ei tallenneta repoon; tuo capture Figmaan/FigJamiin paikallisesti.

## Toistettava polku

1. `npm run desktop:dev` (tai Vite `5179` + Electron).
2. Avaa projekti tai **Kokeile esimerkkianimaatiota**.
3. Yläpalkki **Käsikirjoitus** → focus-overlay (`script-page-open`).
4. Tuo [`public/library/YouTube-kartonki-runko.md`](../public/library/YouTube-kartonki-runko.md) tai jätä tyhjä + ScriptGuide.
5. Varmista: 680 px sarake, Esc/Tab-vihje, sticky **Jaa kohtauksiin**, ei step-navia (`.script-panel--focus`).
6. Figma: frame **Script / Focus · 03 Editor hero** 1440×900 · FigJam [Script user flow](https://www.figma.com/board/RQ3kH9AAduLT7E3iJabv3e).

## Mitattu (agentti · selain ~701 px leveys)

| Mitta | Figma / spec | Sovellus |
|-------|----------------|----------|
| `.presentation-panel` max-width | 680 px | 680 px |
| Sticky CTA min-height | 56 px | 56 px (mitattu korkeus 56 px) |
| Step-nav focusissa | piilotettu | `display: none` |
| Compose min-height (focus) | 360–530 px | responsive `min()`; compose-korkeus ~793 px (korkea viewport) |

Leveys alle 680 px on odotettua (viewport kapeampi kuin hero-frame).

## Issue-päivitykset

| ID | Havainto | Korjaa | Toimenpide |
|----|----------|--------|------------|
| S-01 | Hero-frame pixel-vertailu vaatii 1440×900 capture käyttäjältä | ei | Avoin · checklist-kohta 3–4 |
| S-04 | Palautuspiste-banneri (`z-index: 30`) peitti focus-overlayn (`z-index: 25`) | kyllä | `.script-page-open .screenplay-page { z-index: 40 }` |

Shot hover + valinta: ei testattu tässä istunnossa (Resolve / storyboard).

## Seuraava (käyttäjä)

- [ ] 1440×900 capture ilman palautusbanneria (tai banner ratkaistu ensin).
- [ ] FigJam sticky + design-linkki.
- [ ] Uudet ID:t chatissa → `docs/FIGMA-PARITY-ISSUES-0.45.md`.
