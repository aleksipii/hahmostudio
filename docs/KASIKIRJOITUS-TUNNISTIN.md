# Käsikirjoituksen sääntöpohjainen tunnistin (fi/en)

`lib/script-recognizer.ts` luokittelee jokaisen käsikirjoitusrivin suljetulla sanastolla. Tunnistin ei arvaa: lause, jota sääntö ei kata, jää tilaan `unknown` ja näkyy marginaalissa varoituksena.

## Rivitilakone

```mermaid
stateDiagram-v2
  [*] --> header
  header --> header: metatieto / hahmo / johdanto
  header --> body: kohtaus, aikakoodi, siirtymä, kuva, ohje
  body --> cue: PUHUJA tai Puhuja:
  cue --> cue: (sulkeohje)
  cue --> dialogue: repliikki
  dialogue --> body: lainaus sulkeutui tai ohjerivi
  dialogue --> dialogue: lainaamaton jatko
  body --> notes: Character Animator -ohjaus / Leikkauskieli / Production notes
  notes --> body: seuraava kohtaus tai aikakoodi
  body --> comment_block: /* tai [[
  comment_block --> body: */ tai ]]
```

Rivityypit: `metadata`, `scene-heading` (INT./EXT., SISÄ./ULKO., Kohtaus:), `timecode` (0:00–0:04 — Nimi), `transition` (CUT TO, FADE IN/OUT, DISSOLVE, LEIKKAUS, HÄIVYTYS), `shot`, `character-decl`, `cue` (myös V.O., O.S., CONT'D, jatkuu, ruudun ulkopuolelta), `parenthetical`, `dialogue`, `direction`, `comment`, `strict-header`, `unknown`.

## Ohjerivien lauseet

Ohjerivi jaetaan lauseisiin (piste, puolipiste, *sitten/then*, *ja/and* kun molemmilla puolilla on verbi). Jokaisesta lauseesta tunnistetaan:

| Tyyppi | Esimerkkejä |
|--------|-------------|
| Liike | kävelee/käveli/kävelevät/astelee, juoksee/juoksi/ryntää, hyppää, kyykistyy, istuu/istuutuu/istahtaa, vilkuttaa/heiluttaa kättä, nyökkää, osoittaa, nyrkki, pysähtyy · walks/ran/sprints/hops/squats/sits/waves/nods/points/clenches/halts |
| Suunta | vasemmalle, oikealle, suoraan, kohti kameraa · left, right, forward, toward the camera · lähtöpaikka: *vasemmalta* / *from the left* = liike oikealle |
| Reaktio | hämmästyy, säikähtää, hätkähtää · startled, gasps |
| Ilme | vihainen, huolestunut, hämmentynyt, loukkaantunut, pokerinaama, kulmat ylös, iloinen/hymyilee/nauraa, surullinen/itkee/alakuloinen (myös adverbinä: "huolestuneena") |
| Katse | katsoo, vilkaisee, tuijottaa, katse · looks at, glances, stares — kohde: hahmo sijamuodossa, puhelin tai kamera/katsoja |
| Puhelin | pitää, näyttää, napauttaa, korvalle, pöydälle, toiseen käteen, esiin/pois |
| Tauko | pieni/pitkä tauko, hiljaisuus, pidä, odota · beat, pause, silence |
| Rajoitus | Ei isoja eleitä, Älä liikuta kameraa, Mira ei liiku · Do not move, no extra props |
| Muut | Tausta:, Otsikkokortti:, leikkausrytmi |

Kestot: `2 s`, `0,5 sekuntia`, `1–2 s` (yläraja), `puoli sekuntia`, `kolmen sekunnin ajan`, `two seconds`, `half a second`, `500 ms`, `beat` = 0,5 s.

Hahmot ratkaistaan sijamuodoista (Killelle, Handua, Miraan, Nikoon), pronomineista edelliseen hahmoon (hän, he/she) ja monikosta kaikkiin (molemmat, they both). Kielto poistaa sen alaiset sanat ("loukkaantuneelta, mutta ei vihaiselta" → loukkaantunut).

Englannin lyhyet kuvatermit (WIDE, MEDIUM, CU, MS, PAN…) tunnistetaan vain isoilla kirjaimilla tai `Camera:`-etuliitteen jälkeen, jotta repliikki "a very wide sidewalk" ei ole kuvakoko. Suomen yhdyssanat (lähikuva, puolikuva, yleiskuva) tunnistetaan kirjainkoosta riippumatta.

## Kytkennät

- `presentation-direction.ts` (vapaa käsikirjoitus): liike, katse ja ilme tunnistimesta; vanha osamerkkijonohaku vain jos tunnistin ei ymmärrä riviä.
- `script-grammar.ts` (`#!kilsat`): hyväksyy tunnistimen taivutusmuodot vain nimetylle, määritellylle hahmolle ja kun kesto on annettu. Hylätyn rivin ehdotus kertoo mitä puuttuu.
- `script-line-annotations.ts`: marginaali näyttää tulkinnan (esim. "kävely ← 2 s"), tunnistamaton rivi merkitään.

## Rajat

Ilo näyttää hymy-suun (Suu hymy -taso) ja nostaa kulmia; puhe ohittaa hymyn repliikin ajaksi ja hymy palaa sen jälkeen seuraavaan ilmeeseen asti. Hahmolle ilman hymy-suuta tulee varoitus. Suru nostaa kulmien sisäreunoja ja laskee katseen; erillistä surusuuta ei ole. Katse kameraan keskittää pupillit ja suoristaa pään; profiilikuvakulmassa tulee varoitus. Tunnistetut mutta toteuttamattomat asiat (pelko) näkyvät syyn kanssa, eikä niille arvata korvaavaa animaatiota. Vapaata proosaa ilman tuettua verbiä ei tulkita. Testiaineisto: `tests/fixtures/scripts/`, testit `lib/script-recognizer.test.ts`.
