# Jaksonrakennuksen mittaus (vaihe A)

Skripti: `node --experimental-strip-types scripts/benchmark-episode.ts` — 2 hahmoa (Pipsa, Ville), keittiö, puhelin, 50 repliikkiä ja liikettä, 10 toistoa. Mittaa `buildEpisode`-kutsun (tunnistus → roolitus → animaation käännös), ei pakettien latausta eikä esikatselun piirtoa.

| Päivä | Kone | Jakson kesto | Mediaani | Hitain |
|---|---|---|---|---|
| 2026-10-07 | Pilvikone: Intel Xeon 2,1 GHz, 4 ydintä, Node 22.22 | 83,7 s | 91 ms | 137 ms |

**Tavoite:** alle 2 s / 60 s jakso M1-Macilla. **Tila:** pilvikoneella 60 s jakson rakennus on noin 0,1 s. M1-mittausta ei ole tehty tässä ympäristössä; aja sama skripti Macilla ja lisää rivi. Testi `lib/episode-builder.test.ts` varmistaa rajan (< 2000 ms) jokaisella ajolla.
| 2026-10-07 (vaiheet A–F valmiit) | sama pilvikone | 83,7 s | 57 ms | 129 ms |

Rakennus sisältää nyt IK-liikkeet, sommittelun, kaksi käännöstä (pöydän/kävelyn sijoitus) ja ääniraidan suunnittelun.

## Toisto (vaihe G)

`npm run playback:benchmark` (Node, mallikonteksti, ei oikeaa canvasia): esityksen piirtokutsun p95 ≈ 0,6 ms kolmella
näkymäkoolla 1080×1920-näyttämöllä kahdella hahmolla; 60 fps -tavoite (16,7 ms ruutu) jää laskennan osalta reilusti
alle. **Todentamatta:** todellinen piirto Chromiumin/Electronin canvasilla M1-Macissa, VideoToolbox-vienti ja sen
reaaliaikakerroin — pilviympäristössä ei ole Macia eikä laitteistokoodausta.

Raskas laskenta: jakson rakennus (~60 ms) ajetaan pääsäikeessä yhdellä kerralla painalluksen jälkeen; sitä ei siirretty
workeriin, koska hahmopakettien kuvaobjekteja ei voi siirtää workeriin ilman uutta kuvadatan sarjallistusta. Esikatselun
ruutukohtainen laskenta ei sisällä rakennusta.
