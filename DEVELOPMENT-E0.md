# Vaihe E0 — paikallinen Kokoro-puhesynteesi

## Kehitysvaihe
E0 (ennen äänitehosteita ja musiikkia, vaihe E). Linjaus: AGENTS.md, merkintä 2026-10-07. Vain paikallinen Kokoro, vain englanninkieliset rivit.

## Valmis (koodi)
- `lib/kokoro.ts`: sulkeohjeiden jäsennys (`(quickly)/(fast)/(slowly)/(nopeasti)/(hitaasti)` muuttavat nopeutta; muut, esim. `(whispers)`, poistetaan puhutusta tekstistä ja näytetään huomautuksena, ei arvata), kielirajaus, välimuistiavain (teksti+ääni+nopeus+mallin versio, SHA-256), `SpeechEngine`-rajapinta, deterministinen testimoottori ja `synthesizeLines`.
- Suojat: oma tai lukittu ääni ei koskaan ylikirjoitu (`kept-own-audio`); ajan tasalla oleva rivi ohitetaan (`current`); huomautusrivi tuotetaan vain käyttäjän hyväksynnän jälkeen; puuttuva ääni ja suomenkielinen rivi estetään.
- `AudioClip.synthetic` (valinnainen, validoitu) ja `Binding.kokoroVoice` (valinnainen, validoitu). Vanhat projektit toimivat ilman. Kentät kulkevat .hahmo-esitysmallin mukana.
- `desktop/kokoro.mjs`: mallin hallinta tietokansiossa (`<userData>/kokoro`), lataus vasta natiivin vahvistusikkunan jälkeen, kokoraja, atomisesti vaihdettava staging, manifesti ja tarkisteen varmistus, synteesipalvelu (yksi pyyntö kerrallaan, validoitu pyyntö, peruutus vapauttaa moottorin).
- `desktop/kokoro-engine.mjs` + `kokoro-worker.mjs`: moottori omassa utilityProcess-prosessissa; peruutus tappaa prosessin.
- Kapea IPC: `studio:kokoro-status/download/remove/synthesize/cancel` + edistymisviesti. Renderöijän eristys säilyy.
- `components/kokoro-panel.tsx`: lataus, ääni hahmolle, Tuota ääninauha, rivikohtainen ▶ ja Tuota uudelleen, huomautusten hyväksyntä, peruutus. Merkintä **Kokoro · synteettinen**. Jokainen rivi liitetään nykyisellä `voice`-komennolla (kumottava, Rhubarb/äänestä laskettu suu, kestot todellisista äänistä).
- `scripts/prepare-kokoro-runtime.mjs` (`npm run kokoro:prepare`): ajoympäristö `.private-runtime/kokoro`, pakataan resurssiksi, jos olemassa. Mallipainoja ei pakata.
- Testit: `lib/kokoro.test.ts`, `desktop/kokoro.test.mjs`. Testimoottori, ei verkkoa eikä mallia.

## Rajat ja todentamattomat
- **Ei ajettu oikealla Kokorolla.** Pilvi ei tavoita Hugging Facea. Mallitiedostojen polut (`config.json`, `tokenizer.json`, `tokenizer_config.json`, `onnx/model_quantized.onnx`), kokorajat ja kokoro-js 1.2.1:n lataus paikallisesta kansiosta (`env.localModelPath`) perustuvat pakettiin ja muistiin, eivät ajoon. Ensimmäinen oikea ajo Macilla voi vaatia säätöä.
- Mallitiedostojen sha256 on ensilatauksella kirjattu tarkiste (trust-on-first-use), ei verrattu julkaistuun arvoon. Kiinnitä arvot `MODEL_FILES`iin Macilla.
- Muistin ja nopeuden mittaus on tekemättä (Macilla): mallin latausaika, muistihuippu, nopeus suhteessa reaaliaikaan 30 s ja 3 min.
- `npm run kokoro:prepare` ja pakettiin liittäminen eivät ole ajettuja (Mac vaaditaan). onnxruntime-node voi kasvattaa pakettia.
- Vain englanti. Kokoron kielituki ei kata suomea; suomenkielistä riviä ei syntetisoida.
- `Beat.`/`Pieni tauko` ovat jo `hold`-tapahtumia tunnistimessa; E0 ei lisää omaa taukologiikkaa.
- Ääninauha liitetään rivi kerrallaan, joten jokainen rivi on oma kumoaskel (ei yhtä koko nauhan askelta).
- Ei GUI- eikä laitetestiä. Ei tehty selainnäkymän tarkistusta.

## Seuraava
Ajo ja mittaus omalla Macilla, tarkisteiden kiinnitys, sitten vaihe E (äänitehosteet ja musiikki).
