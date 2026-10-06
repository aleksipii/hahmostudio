# FigJam — Script user flow + Resolve-linkit (0.38)

Board: [KILSAT Script user flow](https://www.figma.com/board/RQ3kH9AAduLT7E3iJabv3e)  
Design: [KILSAT Script UI · 0.38](https://www.figma.com/design/FFy68Fynv4Ds2VgRANZoXc) · [KILSAT Studio · UI Resolve](https://www.figma.com/design/vfBqIrcXhys0XoTODSbsI5)

## Checklist (~15 min, käsin FigJamissa)

1. Avaa board · zoomaa user flow -alueelle.
2. **S** (sticky) × 6: kopioi alla olevat otsikot + tekstit (tai koko sticky-lohkot).
3. Jokaiselle stickylle: valitse · **Link to design** → Resolve-frame (taulukko alla).
4. **Prototype:** valitse sticky 1 → **Prototype** → drag **Interaction** → sticky 2 … → 5 → (valinnainen) linkki Resolve `05 · Aikajana`.
5. Script-haara: `02 Draft` → `03 Parsing` → onnistuminen → lisää nuoli stickylle 3 / design `Storyboard / Grid`.
6. Yhteenveto-sticky yläreunaan (valinnainen).

Sovellusvastine: työvaihe-pin (**Asetukset → Tuotantovaihe**), tuotantokierros (**Ohje**).

---

## Sticky 1 — Käsikirjoitus

**Otsikko:** 1 · Käsikirjoitus  
**Teksti:**  
Käyttäjä kirjoittaa tai tuo .md/.txt-käsikirjoituksen. **Jaa kohtauksiin** tunnistaa repliikit ja kuvat paikallisesti (ei pilveä).  
Sovellus: Animointi → Käsikirjoitus, vasen **Työvaihe → Käsikirjoitus** (teksti ei lukittu).

**Link:** Resolve `01 · Käsikirjoitus` · Script UI capture `node-id=2-2` · Focus hero: `docs/FIGMA-SCRIPT-FOCUS.md`

---

## Sticky 2 — Hahmot

**Otsikko:** 2 · Hahmot  
**Teksti:**  
Valitse .hahmo-paketit kirjastosta ja sidota puhujiin. Ei @-viittauksia eikä erillistä referenssiarkkia — sidokset tuotantopaneelissa.  
Sovellus: **Työvaihe → Hahmot** lukitsee vasemman paneelin kirjastoon; käsikirjoitusteksti lukittu.

**Link:** Resolve `02 · Hahmot` · Opastus / Spotlight · 2

---

## Sticky 3 — Storyboard

**Otsikko:** 3 · Storyboard  
**Teksti:**  
Kuvakortit, järjestys (drag), shot-kisko. Uudelleengenerointi = päivitä käsikirjoitus **Käsikirjoitus**-vaiheessa.  
Sovellus: **Työvaihe → Storyboard** avaa kuvakortit; käsikirjoituslähde lukittu.

**Link:** Resolve `03 · Storyboard` · FigJam `Storyboard / Grid · default`

---

## Sticky 4 — Kuva (shot)

**Otsikko:** 4 · Kuva  
**Teksti:**  
Yksi kuva kerrallaan: tapahtumaeditori, kameran ohjaus, hyväksyntä/lukitus kuvatasolla.  
Sovellus: **Työvaihe → Kuva** + oikea inspector.

**Link:** Resolve `04 · Kuva` · Opastus / Spotlight · 4

---

## Sticky 5 — Aikajana ja vienti

**Otsikko:** 5 · Aikajana  
**Teksti:**  
Esikatselu, ääniraidat, shot-strip, **Vie…** / MP4. Hahmo- ja Esitys-työtilat säilyvät rinnalla.  
Sovellus: **Työvaihe → Aikajana** avaa aikajanan.

**Link:** Resolve `05 · Aikajana` · Opastus / Spotlight · 5

---

## Script-polku (FigJam prototype)

| From | To | Huom |
|------|-----|------|
| `Script / Panel · 01 Empty` | `02 Draft` | |
| `02 Draft` | `03 Parsing` | |
| `03 Parsing` | `04 Parse error` (virhehaara) | |
| `03 Parsing` | toast onnistui | |
| onnistui | `Storyboard / Grid · default` | Link design → `03 · Storyboard` |
| `Script / Focus · 03 Editor hero` | panel | Yläpalkki **Käsikirjoitus** |

---

## Sticky — Yhteenveto (valinnainen, boardin yläreuna)

**Teksti:**  
Viisi **työvaihetta** = sama data, eri fokus. **Tuotantokierros** sovelluksessa (Ensimmäinen käynti + Ohje → Näytä uudelleen). Hover-kortit: Resolve-komponentit.

---

## Pika-copy (liitä suoraan FigJam-stickyyn)

**Sticky 0 — Yhteenveto**  
Viisi työvaihetta · sama projekti · eri fokus. Sovellus: Asetukset → Tuotantovaihe. Design: Resolve vfBqIrcXhys0XoTODSbsI5

**Sticky 1**  
1 · Käsikirjoitus — Tuo .md/.txt · Jaa kohtauksiin (paikallinen). Link: Resolve 01 · Käsikirjoitus

**Sticky 2**  
2 · Hahmot — .hahmo kirjastosta · sidonta puhujiin · @mira → MIRA (valinnainen). Link: Resolve 02

**Sticky 3**  
3 · Storyboard — kuvakortit · drag-järjestys. Link: Resolve 03 · Storyboard / Grid

**Sticky 4**  
4 · Kuva — yhden kuvan ohjaus · hyväksyntä erillään työvaihe-pinistä. Link: Resolve 04

**Sticky 5**  
5 · Aikajana — esikatselu · Vie MP4. Link: Resolve 05

> **Figma-diagrammi:** Cursor voi luoda FigJam-kaavion, kun valitset tiimin Figma-widgetissä (Starter: Aleksi Piirainen's team).
