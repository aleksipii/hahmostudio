# Hahmostudion kooditestit · 3.10.2026

- 53/53 testiä läpäisi, ei ohitettuja testejä.
- TypeScript ja tuotantokäännös läpäisivät (npm run build:private).
- Mikrofonin simuloidut laite- ja elinkaaritestit: lupa, käynnistysvirheet, peruminen, myöhäinen lupa, irtoaminen, RMS, WAV/PCM, vanhan äänen säilyminen ja resurssien vapautus.
- AudioWorklet-prosessori suoritettiin Node VM:ssä.
- Kamera + kädet + mikrofoni yhdistettiin ja tallennettiin/avattiin .hahmo-projektista.
- React-komponenttien navigointi ja painikkeiden toimintoehdot tarkistettiin palvelinrenderöinnillä.
- Alkuperäiset PSD-mallin, projektin, nivelten, IK:n, animaation, puheen, kävelyn ja yksityisen kirjautumisen testit läpäisivät.
- Safari-koodipolut: tavallinen/prefiksoitu AudioContext, puuttuvat rajapinnat, playsInline ja ES2022/Safari 16.4 -käännöskohde. Kooderien saatavuus tarkistetaan käytettäessä.

Testit eivät avanneet selainta, kameraa tai fyysistä mikrofonia. Fyysisen laitteen toiminta, todellinen Safari ja visuaalinen asettelu eivät ole tämän päivityksen testituloksia. Käyttäjän pyynnön mukaisesti selainversiota ei testattu.

Käännöksen jäljellä olevat huomautukset koskevat yli 500 kt JavaScript-pakettia ja fflate-moduulin jakamista; käännös onnistui. Projektimuodot, omistajatunnus ja käyttöoikeudet säilytettiin. Ulkoista julkaisua ei tehty.
