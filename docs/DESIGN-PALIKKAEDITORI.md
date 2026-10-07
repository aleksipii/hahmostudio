# Palikkaeditori ja 10 minuutin työnkulku (KILSAT Studio)

Tämä dokumentti kuvaa uuden komponentin design-järjestelmän laajennuksena ja UI/UX-linjaukset tavoitteelle
*30–60 sekunnin animaatio 10 minuutissa*. Vertailukohtana on Rive (Design/Animate-tilat, aikajana alhaalla,
tilakone, inspector-avainnappulat) — ks. lähteet lopussa. Toteutus: `components/block-timeline.tsx`, `lib/blocks.ts`,
`lib/character-states.ts`, tyylit `styles/studio2.css` (osio *Palikkaeditori*).

## Uusi komponentti: Palikka-aikajana (BlockTimeline)

### Ongelma
Käsikirjoitus tuottaa jakson yhdellä painalluksella, mutta hienosäätö vaati tekstin muokkausta ja uudelleenjakoa tai
avainruututason editoria. Käyttäjä tarvitsee välitason: tapahtumat näkyvinä, siirrettävinä ja venytettävinä yksiköinä,
jotka pysyvät synkronissa tekstin kanssa.

### Olemassa olevat mallit
| Komponentti | Yhteistä | Miksi ei riitä |
|---|---|---|
| `presentation-timeline` (tuotannon kuva-aikajana) | Kuvat aikajärjestyksessä | Kuvataso, ei hahmon tapahtumia |
| Avainruutuaikajana (`editor.tsx`) | Raidat ja toistopiste | Liian matala taso: nivelavaimet, ei semantiikkaa |
| `state-editor.tsx` | Tilat ja siirtymät | Erillinen data, ei johdettu käsikirjoituksesta |

### Ehdotettu rakenne
| Osa | Kuvaus |
|---|---|
| Palikkakirjasto (toolbar) | Pillereitä (Vilkuta, Kävele →, Istu, Hymyile, Katso kameraan, Tauko 1 s, Lähikuva, Ääni: ovi…). Vedä raidalle tai Enter = lisää toistopisteeseen valitulle hahmolle. |
| Aikajana (`role="application"`) | Viivain + toistopiste, raidat: yksi per hahmo, *Kamera*, *Näyttämö* (tausta, siirtymät), *Ääni* (musiikki, tehosteet). |
| Palikka | Väri tyypin mukaan, nimi, kesto leveytenä, oikean reunan venytyskahva liikkeille ja tauoille. |
| Inspector | Tyyppikohtaiset kentät (liike, suunta, ilme, katseen kohde, kuvakoko, kesto) + lähderivi. |
| Hahmojen tilat | Johdettu tilakone: Lepo, Puhe, Kävely, Juoksu, Ele, Reaktio, Istuu + siirtymäehdot. |

#### API / Props
| Property | Type | Default | Description |
|---|---|---|---|
| `presentation` | `Presentation` | — | Käännetty esitys (palikat johdetaan tästä). |
| `selected` | `string?` | — | Valitun palikan tunniste. |
| `onSelect` | `(id?) => void` | — | Valinta. |
| `onCommand` | `(BlockCommand) => void` | — | `move`, `stretch`, `delete`, `duplicate`, `update`, `insert`. |
| `disabled` | `boolean` | — | Lukittu teksti tai käynnissä oleva työ. |
| `playhead` | `number` | `0` | Toistopiste sekunteina (kirjaston Enter-lisäys). |
| `pixelsPerSecond` | `number` | `48` | Zoom. |

#### Variants
| Variant | Käyttö | Visuaali |
|---|---|---|
| `block--liike` | Liikkeet | `--s2-accent-soft` |
| `block--ilme`, `block--katse` | Kasvot | `--s2-ok-soft` |
| `block--repliikki` | Repliikit (vain ajoitus) | `--s2-info-soft` |
| `block--ääni`, `block--tauko` | Ääni ja tauot | `--s2-warn-soft` |
| `is-derived` | Automaattikuvat ja -tehosteet | 60 % peittävyys, katkoviiva, ei muokattava |

#### States
| State | Behavior | Notes |
|---|---|---|
| Default | Napsautus valitsee, Enter avaa inspectorin | — |
| Focus | 2 px `--focus-ring` | Näppäimistö ensisijainen |
| Selected | Accent-reunus | `aria-pressed="true"` |
| Dragging | Esikatselusiirtymä pikseleinä, komento vasta irrotettaessa | Alle 3 px = napsautus |
| Disabled | `disabled`-prop: ei komentoja | Lukittu teksti / työ käynnissä |
| Derived | Ei vetoa, ei poistoa | Selitys `title`-vihjeessä |
| Conflict | `BlockConflict` → virheviesti, ei muutosta | Esim. rivi muuttunut lukemisen jälkeen |

#### Tokens Used
- Värit: `--s2-accent`, `--s2-accent-soft`, `--s2-ok-soft`, `--s2-info-soft`, `--s2-warn-soft`, `--s2-line`, `--s2-line2`, `--s2-bg1/2/3`, `--s2-text`, `--s2-muted`, `--s2-faint`, `--focus-ring` (vanhat tokenit varalla).
- Välit: 3/6/8/12 px; raidan korkeus 30 px; nimisarake 84 px (sticky).
- Typografia: 11–12 px UI, `--s2-mono` viivaimessa.
- Liike: `prefers-reduced-motion` poistaa siirtymät.

### Accessibility
- **Role**: aikajana `role="application"` + `aria-roledescription="aikajana"`; raita `role="group"` nimellä; palikka `role="button"` + `aria-pressed`.
- **Keyboard**: ←/→ siirtää edellisen/seuraavan palikan kohdalle, Vaihto+←/→ kesto ±0,5 s, Delete/Backspace poistaa, Ctrl/⌘+D kopioi, Enter/välilyönti avaa ominaisuudet; `aria-keyshortcuts` kertoo nämä.
- **Screen reader**: “NIKO · Liike: Kävely → · alkaa 1,87 s · kesto 2 s”. Kirjaston painike: “Lisää Vilkuta hahmolle Mira kohtaan 1 s”.

### Open Questions
- Vapaa ajoitus sekunnin murto-osiin (nyt napsautus tapahtumarajoille; tarkka väli = tauko-palikka).
- Monivalinta ja ryhmäsiirto.
- Tilakoneen muokkaus suoraan (nyt johdettu näkymä).

## UI/UX-linjaukset: 10 minuutissa 30–60 s animaatio

| Minuutti | Vaihe | Ratkaisu |
|---|---|---|
| 0–1 | Aloitus | Tyhjässä tilassa ensisijainen *Kokeile esimerkkiä* lataa esimerkkikäsikirjoituksen tekstiin (ei vielä rakenna). |
| 1–4 | Kirjoitus | Vapaa suomi/englanti; marginaali näyttää jokaisen rivin tulkinnan heti (Rive: “inspector näyttää animoitavat ominaisuudet”). Tarkka muoto: `docs/KASIKIRJOITUS-KIELIOPPI.md`. |
| 4 | Rakenna | Yksi ensisijainen toiminto **Rakenna jakso** (⌘↵) + viisivaiheinen edistyminen. Tulos on katsottava heti: tausta, roolitus, liikkeet, esineet, kuvat, ääniraita. |
| 4–8 | Hienosäätö | Palikka-aikajana (vrt. Riven Animate-tila: aikajana alhaalla, inspector oikealla). Muutos näkyy < 100 ms; teksti päivittyy samalla. Tarkistus listaa vain todelliset puutteet (puuttuva ääni, tuntematon tausta). |
| 8–9 | Äänet | Äänitä tai tuo repliikit; musiikki ja tehosteet ovat jo paikallaan ja duckaavat automaattisesti. |
| 9–10 | Vie | *Vie* yläpalkista (MP4/Mac-vientijono). |

Periaatteet: yksi ensisijainen toiminto kerrallaan; sama totuuslähde (teksti) kaikille näkymille; ei piilotettua
automaattikorjausta (ristiriidat näkyvät); näppäimistö ensin; kaikki muutokset kumottavia yhteisessä historiassa.

## Lähteet
- [Rive: Design vs Animate Mode](https://rive.app/docs/editor/fundamentals/design-vs-animate-mode)
- [Rive: How state machines work](https://rive.app/blog/how-state-machines-work-in-rive)
- [Rive: Introduction to listeners](https://rive.app/blog/introduction-to-listeners)
