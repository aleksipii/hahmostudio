# 0.39 — Puhujan @sidonta ja hyväksyntä erillään navigoinnista

## Kehitysvaihe
Ensimmäinen @sidonta-erä + dokumentaatio. Kuvan hyväksyntä/lukitus pysyy `studio-shot-board` / `StudioMetadata.shots` -polussa — **ei sidottu työvaihe-pinniin**.

## Valmis (tämä erä)
- **`lib/speaker-handle-aliases.ts`:** rivit `@mira → MIRA`, `Tunnus @mira: MIRA`; repliikki `@mira: "…"` ja `@mira vilkuttaa`.
- **`StudioMetadata.speakerHandles`** (valinnainen, max 4) tallentuu parse-jälkeen projektin tuotantometadataan.
- Syntaksiohje käsikirjoitus-paneelissa.
- FigJam: `docs/FIGJAM-STUDIO-FLOW.md` (checklist + pika-copy).
- **`SpeakerBindingTable`:** puhuja · @tunnus · .hahmo — Hahmot-työvaiheessa (vasen paneeli) ja käsikirjoituksen `#script-cast`. `@`-rivit käsikirjoitustekstistä heti; commitattu `speakerHandles` voittaa. Pelkkä `@tunnus → Puhuja` näkyy ennen `Hahmo:`-riviä (`pendingCharacter`).
- **`lib/studio/shot-guard-summary.ts`:** varoitus käsikirjoituksen muokkauksessa + teksti kuvataululla; testit pin vs. shot-metadata.

## Ei vielä
- Erillinen referenssiarkki-UI tai pakollinen @ kaikille puhujille.
- Automaattinen hahmopaketin sidonta pelkästä @-rivistä (edelleen `ProductionResourcesPanel` / bindings).

## Seuraava työ
- FigJam-board: liitä pika-copy-stickyt + Link to design (käsin ~15 min).
- Valinnainen FigJam-diagrammi Figma-widgetin kautta (tiimin valinta).
