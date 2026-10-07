# Käyttötesti oikealla käyttöliittymällä (2026-10-07)

Ajettu Playwrightin Chromiumilla Vite-kehityspalvelinta vasten (`npm run dev`), 1440×900, ei Electronia
(Electron-binääri ei ole pilviympäristössä) eikä Macia. Polku: ohita opastus → Käsikirjoitus → Kokeile esimerkkiä →
Rakenna jakso → palikan valinta → Vaihto+→ (kesto +0,5 s) → hiiren veto venytyskahvasta → inspector.

Löydetyt ja korjatut: marginaali merkitsi "Hän pysähtyy ja katsoo Miraa." tunnistamattomaksi (eri hahmolöytö kuin rakentajalla);
palikkaeditori oli 280 px sivupalkissa, jossa aikajana ei näkynyt (siirretty keskialueelle); hetkelliset palikat olivat 18 px ja
päällekkäiset peittivät toisensa (rivitys raidan sisällä, luettava minimileveys).

Mitattu: palikkamuutoksen kokonaisviive käyttöliittymässä 661 ms (kehityspalvelin; sisältää tallennuksen, rakennuksen ja
renderöinnin). Pelkkä rakennus < 100 ms (testi). Todentamatta: tuotantokoonti, Electron, hiiren veto Macin trackpadilla.
