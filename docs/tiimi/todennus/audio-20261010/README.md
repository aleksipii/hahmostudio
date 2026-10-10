# Äänen hyväksymistestit 10.10.2026

Repliikkitallennuksen testisyöte on generoitu 220 Hz virta oikean AudioWorkletin läpi. Testi liittää PCM:n repliikkiin, tarkistaa ajoituksen ja suuasennot, kumoaa ja tekee uudelleen sekä palauttaa editorin reloadin jälkeen. Tarkistussumma ja clip-metadata verrataan. Fyysistä mikrofonia ei avata.

Kokoron oikea moottori käyttää vain olemassa olevaa luvallista mallia, jonka tarkistussummat varmennetaan. Malli ei kuulu repoon tai sovelluspakettiin. Kokoro-IPC-testi kopioi vain hyväksytyn Kokoro-mallin eristettyyn testidatakansioon. Testipuhe on julkinen englanninkielinen testilause. WAV ei kuulu Gitiin.

```sh
npm run desktop:test:voice
HAHMOSTUDIO_KOKORO_MODEL_DATA="$HOME/Library/Application Support/hahmostudio" npm run kokoro:test:real
HAHMOSTUDIO_AUDIO_ACCEPTANCE=1 HAHMOSTUDIO_KOKORO_MODEL_DATA="$HOME/Library/Application Support/hahmostudio" HAHMOSTUDIO_WORKFLOW_OUTPUT=docs/tiimi/todennus/audio-20261010/packaged npm run desktop:test:workflow -- --packaged
```

Oikea mikrofonikoe: avaa asennettu KOETA, rakenna esimerkkijakso, avaa Tarkistus ja ohjaus / Ääninäyttelijän työpiste, valitse repliikki ja äänitä se itse. Vaihda Kuvaus/Leikkaus/Tarina-vaiheita, pysäytä tallennus ja käytä repliikki. Kuuntele, kumoa ja tee uudelleen, tallenna .hahmo ja avaa se uudelleen. Omat äänet pysyvät Macilla; niitä ei tarvitse lähettää minulle. Kirjaa kuuluuko sama ääni ja täsmääkö suu.

VoiceOver: käynnistä VoiceOver Macin omasta käyttöavusta. Kokeile ilman hiirtä vaiheriviä, toimintohakua, äänityksen valintaa/pysäytystä ja palautusdialogia. Kirjaa epäselvät nimet tai kohdat joissa näppäimistökohdistus katoaa. VoiceOver-kuuntelu, fyysiset laitteet ja vientisynkka eivät saa hyväksyntää tämän automaation perusteella.
