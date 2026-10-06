# 0.41 — Script focus, Hahmot-sidonta, revise-UX

## Kehitysvaihe
Yhdistetty erä: A (Script UI) → B (editorin Hahmot) → C (tuotanto revise).

## Valmis
- **Script focus:** `script-panel--focus` piilottaa otsikon, johdannon ja vaihenavigoinnin; focus-sivulla Tab-kierto + Esc → `closeScriptPage`; vihje `script-focus-hint`.
- **Hahmot-vaihe:** `loadPresentationCastPack` jaettu; `SpeakerBindingTable` valitsee/tuo paketin suoraan kirjastosta (`presentationDraft` + `presentationAssets`).
- **Revise-UX:** `scriptReparseLockedBlock` — varoitus + pois päältä **Jaa kohtauksiin**, jos teksti poikkeaa ja lukittuja kuvia on; `revise()`-heitto edelleen varmistuksena.

## Seuraava työ
- Figma focus-capture (kuva), FigJam-linkit.
- Pysyvä cast-sidonta komentojournalin kautta editorista (nyt luonnos + tallenna projekti).
- Hyväksyttyjen (ei lukittujen) kuvien tarkempi ennakko ennen parsea.
