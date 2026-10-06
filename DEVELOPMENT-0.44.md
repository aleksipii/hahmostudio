# 0.44 — Cutout-IR editorissa, resurssimanifesti, preset-eleet

## Kehitysvaihe
YouTube-tyylisen kartonkituotannon seuraava askel: yhteinen tapahtuma-IR, eksplisiittiset resurssiviitteet ja osoitus/vihainen ilme.

## Valmis
- **`lib/cutout/presentation-ir.ts`:** Presentation → 24 fps cutout-aikajana; preset-kartta (POINT, HAND_WAVE, …); cutout-tunnistus QuickProfile-assetin perusteella.
- **`lib/script-resource-manifest.ts`:** `Resurssi tausta/hahmo/prop` -rivit; validointi ennen parsea; `world.design` ja binding-assetit.
- **Preset-eleet:** `osoittaa` / `point` (#!kilsat + enrichDirection); `ilme: vihainen` → ANGRY cutout-IR:ssä; PSD-käännös `compileBodyMotion` point-eleelle.
- **Editori:** valinnainen kartonkiesikatselu (`loadCutoutPacks` + SVG→canvas); painike **YouTube-runko · kartonki**; malli `public/library/YouTube-kartonki-runko.md`.
- **Testit:** `lib/cutout-presentation-ir.test.ts`.

## 0.44b — MP4, PNG-tausta, FIST/istu (valmis koodissa)
- **`lib/cutout/export-context.ts` + `lib/scene-render.ts` + `lib/mp4-export.ts`:** kartonki-IR preload ennen frame-silmukkaa; cutout-kohtaus piirretään SVG→canvas (24 fps ajoitus, 30 fps vienti).
- **Oma PNG taustaksi:** `Resurssi taustakuva: <tunniste>` → `world.customBackgrounds`; `doc.presentationImages` tallennus `.hahmo`-projektiin; UI-tuonti käsikirjoitusnäkymässä.
- **Presetit:** `nyrkki`/`fist` → FIST, `istu`/`sit` → SIT (cutout-IR + PSD `compileBodyMotion`).
- **Testit:** laajennus `lib/cutout-presentation-ir.test.ts`.

## Rajat (rehellisesti)
- Cutout-MP4 vaatii Mr.Kille/Mr.Handu -QuickProfilet kaikille puhujille; muut hahmot käyttävät PSD-esityspolkua.
- Prop-manifesti tunnistaa vain `phone-v1` / `table-prop-v1`; muu estetään manifestivirheellä.
- Reaktioklipit hahmopaketeittain ja reframing (vaihe D/E) eivät vielä kuulu tähän pakettiin.

## 0.44c — desktop-vienti + reaktioklipit (valmis koodissa)
- **`buildCutoutRenderContextFromProject`** + **`lib/export-render.ts`**: ExportQueue-renderöijä käyttää cutout-SVG-polkuja.
- **`lib/cutout/pack-reactions.ts`**: REACT_NOD / REACT_SURPRISE / REACT_WAVE (Mr.Kille + Mr.Handu).

## 0.45–0.46 (valmis koodissa)
- **Manifesti:** kaikki `propLibrary`-rekvisiitat + alias (puhelin, pöytä, muki …) → `production.props`.
- **Vaihe E:** [`DEVELOPMENT-0.46-phase-e.md`](DEVELOPMENT-0.46-phase-e.md) — 1–5 jakson YouTube-kooste.
- **Figma 0.45:** S-02/S-03 CSS; issue-doc täytetty.

## Seuraava työ
- Figma-capture (S-01) ja uudet issue-rivit.
- Sarja-esimerkki / dokumentoitu 5× kartonki + kooste-vienti.
