# Haarakartoitus — 9.10.2026

Tarkastettu 9GitHub-haaraa ja alkuperäisen paikallisen repon 7haaraa. Main ja hahmostudio1.0 olivat sama revisio d356ad6e7d1ae043d68cb74a3c1bf0143f91d667. Päätökset perustuvat koko historiaan ja nykyiseen sisältöön; vanhan PR:n yhdistäminen ei yksin riitä poistoperusteeksi.

| GitHub-haara | Ainutlaatuiset commitit mainiin | Päätös ja peruste |
|---|---:|---|
| `claude/tiimi-hahmografiikka-4r5gbm` | 3 | Säilytä: yhdistämätöntä sovellustyötä. 23e2edf Toon3d-hahmot viivattomiksi ja kuvaukset ajan tasalle; 63fc529 Yhdistä hahmostudio1.0 (PR #14–#17) hahmografiikan haaraan; 57fdf71 3D-lavasteet toon3d-kohtauksiin: 30 lavastetta suljettuina kappaleina |
| `claude/tiimi-kasikirjoitussaannot` | 4 | Säilytä: yhdistämätöntä sovellustyötä. a2087dc fix(käsikirjoitus): ryhmäpuhuja ja virheellinen kesto jäävät näkyvästi tunnistamatta; 2681a8c test(käsikirjoitus): säännöt dokumentoitu ja testattu, ominaisuustestit, syy tunnistamattomalle riville; 9495aa1 fix(käsikirjoitus): tunnistin ei enää tulkitse väärin korpuksen rivejä; c148a45 test(käsikirjoitus): tunnistimen korpus (34 tapausta) ja lähtötaso |
| `claude/tiimi-tekoaly-q1331b` | 3 | Säilytä: yhdistämätöntä sovellustyötä. 746d21d docs(AGENTS): pilvirenderöinti työpöydällä valinnaisena, oletuksena pois; 0a89df1 fix(tekoäly): Tekoäly-komennolle koti ominaisuuskartassa; a19ea7c fix(tekoäly): Tekoäly… sovelluksen omaan Näytä-valikkoon ja toimintohakuun |
| `claude/tiimi-testaaja-88wrwc` | 0 | Poista: sama commit kuin main, ei ainutlaatuista sisältöä tai avointa PR:ää. |
| `claude/tiimi-ui-ux-nr3q0j` | 5 | Säilytä: yhdistämätöntä sovellustyötä. 9ece0d5 feat(ui): Leikkauksen aikajana isommaksi (V6), Roolituksen ohjeteksti taitettu (V5); d36684e feat(ui): siisti yläpalkki (V4): Näkymä ja Tallenna Projekti-valikkoon, seuraava vaihe -painike; 645ca1c feat(ui): minimalistisempi työtila (V1-V3); 1e2ccd5 feat(ui): hallintolaskuri (V0), lähtötaso mitattu; bfd45c5 docs(ui): suunnitelma minimalistisesta käyttöliittymästä |
| `codex/asiantuntijapromptit-2026-10-08` | 2 | Poista arkistoinnin jälkeen: kaikki 10promptia ja English-esimerkki tavuilleen toteutushaarassa; vanha README arkistoitu docs/tiimi/arkisto/promptti-indeksi-2026-10-08.md. |
| `codex/asiantuntijat-2026-10-09` | 4 | Säilytä: yhdistämätöntä sovellustyötä. b81310a docs: record completed GitHub publication; 69ebf8b docs: normalize verification log whitespace; 5929e69 docs: include complete final verification logs; 0aa5218 feat: integrate animation studio specialist work and English Kokoro example |
| `hahmostudio1.0` | 0 | Säilytä: käyttäjän nimeämä pää-/tallennushaara. |
| `main` | 0 | Säilytä: käyttäjän nimeämä pää-/tallennushaara. |

## Paikallinen alkuperäinen repo

| Haara | Ainutlaatuiset commitit mainiin | Päätös |
|---|---:|---|
| `englanninkielinen-esimerkki` | 0 | Poista -d: kaikki commitit mainissa, ei käytössä työpuussa |
| `hahmostudio1.0` | 0 | Säilytä |
| `mac-tarkistus` | 0 | Poista -d: kaikki commitit mainissa, ei käytössä työpuussa |
| `main` | 0 | Säilytä |
| `toon-tyyli-luonnos` | 1 | Säilytä: yksi yhdistämätön grafiikkaluonnos, historiallista käyttäjätyötä ei hävitetä |
| `uudet-hahmot` | 0 | Poista -d: kaikki commitit mainissa, ei käytössä työpuussa |
| `vienti-e2e` | 0 | Poista -d: kaikki commitit mainissa, ei käytössä työpuussa |

## Poiston toteutusehdot

Varmista juuri ennen poistoa remote-haaran SHA sekä paikallisen haaran SHA ja worktree-käyttö. Etäpoisto käyttää tarkkaa expected-SHA-leasea eikä ylikirjoita muuttunutta haaraa. Paikallinen poisto vain git branch -d, ei -D. Säilytä main, hahmostudio1.0, kaikki yhdistämätön työ ja aktiivinen asiantuntijahaara. Tarkastetun neljän Claude-työhaaran nykyiset päät eroavat aiemmin yhdistettyjen PR:ien päistä. Niillä on uutta työtä.

Tämä kartoitus ei yhdistä näiden säilytettyjen haarojen koodia päähaaroihin. Päivitä toteutunut poistotulos ja jäljelle jääneet haarat toimenpiteiden jälkeen.


## Toteutunut siivous

Poistettu GitHubista atomisesti ja alkuperäiset SHAt tarkistavilla leaseilla:
- claude/tiimi-testaaja-88wrwc: d356ad6e7d1ae043d68cb74a3c1bf0143f91d667, sama main-revisio.
- codex/asiantuntijapromptit-2026-10-08: 4f83c44a9bbbb602480a9b47934e726a1bba030a; 10 promptia ja English-esimerkki identtisinä aktiivisessa toteutushaarassa, vanhan indeksin blob ab851fa88cc9bc51fef4f857c8aa10edf1514892 arkistoitu tavuilleen mainiin.

Poistettu alkuperäisen repon paikalliset täysin yhdistetyt haarat git branch -d: englanninkielinen-esimerkki, mac-tarkistus, uudet-hahmot ja vienti-e2e. Worktree-tarkistus osoitti, ettei niissä ollut aktiivista työpuuta. Ei force-deletea eikä käyttäjän tiedostojen poistoa.

Jäljelle GitHubiin 7haaraa: main,hahmostudio1.0,claude/tiimi-hahmografiikka-4r5gbm,claude/tiimi-kasikirjoitussaannot,claude/tiimi-tekoaly-q1331b,claude/tiimi-ui-ux-nr3q0j ja codex/asiantuntijat-2026-10-09. Alkuperäiseen paikalliseen repoon jäivät main,hahmostudio1.0 ja toon-tyyli-luonnos.

Kiintiöohje ja lukija julkaistiin samaan 7f82b90-commitiin mainissa ja hahmostudio1.0-haarassa; alkuperäinen main-työpuu päivitettiin fast-forwardilla ja sen hahmostudio1.0-viite samalla säilyttävällä päivityksellä. Sääntö yhdistettiin myös aktiiviseen asiantuntijahaaraan. Lopputulosraportin myöhempi dokumentaatiocommit päivitetään molempiin päähaaroihin atomisesti.

Kiintiölukijan 4/4 testiä läpäisi. Oikean app-server-lukijan tulos oli 66 % jäljellä 5 tunnin ikkunassa ja 95 % viikossa; käyttäjä vahvisti 5 tunnin valinnan. Raja ei ollut lauennut eikä yhdistämättömiä sovellusmuutoksia siirretty päähaaroihin.
