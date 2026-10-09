# Ääni, dialogi ja huulisynkka — 9.10.2026

Lähtörevisio: `d356ad6e7d1ae043d68cb74a3c1bf0143f91d667`; työ tehdään tiimin muuttuvassa työkopiossa. Oma muutos: `lib/tiimi-kokoro-workflow.test.ts`. Moottorin toteutusta ei muutettu ilman todennettua bugia.

## KOODISTA TODETTU

- `lib/kokoro.ts:128`, `synthesizeOne`: oma ääni tarkastetaan ennen kieli-, ääni- ja välimuistitarkastusta. `force` ei ohita omaa ääntä. `createTestEngine` tuottaa deterministisen siniaallon; se ei tuota puhuttuja sanoja.
- `lib/voice-sources.ts:17`, `replaceBlockedBy`: synteettinen ääni ei korvaa käyttäjän ääntä; lukittu synteettinen klippi estää vaihdon. `components/presentation-panel.tsx:138`, `importVoice`: myös muuttuneet rajat tai resurssi estetään lukitussa klipissä. Samasta aineistosta lukittu suuajoitus säilytetään.
- `lib/presentation-timing.ts:20`, `timePresentation`: repliikin kesto tulee klipistä; lukittujen tapahtumien ristiriidat ilmoitetaan riveillä 38–39. Ääntä ei nopeuteta tähän kestoon.
- `lib/presentation-compile.ts:70`, `compilePresentation`: suhteelliset suuajat siirtyvät repliikin globaalin alun mukaan ja suu palautuu levossa olevaan asentoon klipin lopussa.
- Uusi testi lukee oikean englanninkielisen esimerkin sekä Pipsa/Ville-hahmopaketit. Se tarkastaa kaksi testimoottorin WAV-tuotosta, WAV-keston, oman äänen suojan myös force-tilassa, lukitun synteettisen klipin suojan, repliikkikestot sekä suun auki/kiinni-avaimet 30 fps -käännöksessä. Tuodun äänen sidonta ja suuajat ovat testifixtureä; käyttäjän äänitiedostoa ei avata. Suuaikoja ei analysoida siniaallosta eikä tästä väitetä Rhubarb-hyväksyntää.
- Olemassa oleva `/Users/Aleksi/Library/Application Support/hahmostudio/kokoro/manifest.json` ilmoittaa malliversion `Kokoro-82M-v1.0-ONNX` ja latauspäivän 7.10.2026. ONNX-tiedosto on olemassa ja sen koko on manifestin mukainen 92 361 116 tavua. Kaikkien tiedostojen hasheja, voice-resursseja tai mallin toimintaa ei tässä varmennettu. Työkopion `.private-runtime/kokoro` puuttuu. Tämä ei todista paketoidun sovelluksen runtimea puuttuvaksi.

## EHDOTUS

Kuuntelu- ja vientihyväksynnän seuraava työpaketti: sovelluksessa englanninkielinen esimerkki, olemassa olevan mallin eksplisiittinen käyttö, kaksi kuunneltua repliikkiä, yhden repliikin oma tuonti ja uusintayritys sekä alkuperäisen äänen palautus täsmäävällä hashilla. Sovi QA:n kanssa ennen ajoa toleranssi, ehdotus enintään kaksi vientiruutua 30 fps:ssa. Tarkasta dialogin alku/loppu sekä musiikin peitto ja leikkaus todellisesta vientivideosta. Arvio 0,5–1 henkilötyöpäivää, jos paikallinen runtime toimii; runtimekorjaus arvioidaan erikseen.

## AVOIMET KYSYMYKSET

Todellinen Kokoro-inferenssi, puhuttu sisältö, äänen laatu, vientisynkka, miksaus ja GUI:n yhden undo-transaktion hyväksyntä ovat avoimia. Mallia ei ladattu tai käynnistetty, verkkoa tai pilvi-TTS:ää ei käytetty eikä käyttäjän ääniä käsitelty.

## Toistettava tarkistus

`node --experimental-strip-types --test lib/tiimi-kokoro-workflow.test.ts lib/kokoro.test.ts lib/voice-sources.test.ts`

Itse ajettu kohdennettu tarkistus: **13/13 läpäisi**, fail/skip/todo 0, exit 0 (9.10.2026). Ensimmäisessä ajossa uuden testin väärä 24 kHz -oletus epäonnistui; testin odotus korjattiin vastaamaan `encodeSpeechWav`-funktion 16 kHz -uudelleennäytteistystä ja kestoa yhden ulostulonäytteen tarkkuudella. Tämä oli testin oletusvirhe, ei toteutusbugi. Testit ovat paikallisia testimoottorin ja kääntäjän tarkistuksia, eivät paketoitu sovellus tai todellinen Kokoro-kuuntelukoe.
