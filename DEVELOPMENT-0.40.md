# 0.40 — @sidonta jatko (taulukosta paketti)

## Kehitysvaihe
Jatkaa 0.39:tä: sidonta pysyy manuaalisena (ei auto-.hahmo pelkästä @-rivistä).

## Valmis (tämä erä)
- **`SpeakerBindingTable`:** valitse .hahmo -pudotus + Tuo (.hahmo) rivikohtaisesti (`#script-cast`).
- **`lib/speaker-pack-options.ts`:** kirjastovaihtoehdot + heuristinen **ehdotus** (KILLE → Kille-Oma jne.).
- **`lib/presentation-speaker-binding.ts`:** `patchSpeakerBinding` (sama kenttälogiikka kuin aiemmin fieldsetissä).
- **Hahmot-vaihe (editor):** kompakti taulukko näyttää ehdotuksen; täysi valinta Käsikirjoitus-paneelissa.

## Ei vielä
- Pakettivalinta suoraan editorin Hahmot-vaiheesta ilman Käsikirjoitus-välilehteä (vaatii jaetun `loadAsset`-polun editoriin).
- Pakollinen @ kaikille puhujille.

## Seuraava työ
- Script UI (0.38): focus-capture + script-compose.
- Tuotanto: shot-guard + `revise()`-UX.
