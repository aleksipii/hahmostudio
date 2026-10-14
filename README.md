# Koeta — Pure Rust -animaatiostudio

Koeta on paikallinen työpöytäsovellus englanninkielisten animaatiosarjojen tekemiseen.
Kirjoita tuetun ohjekielen käsikirjoitus, valitse hahmot ja niiden äänet,
tarkista 3D-esikatselu ja vie jakso MP4:ksi. Suomenkielinen käyttöliittymä ja FI-tuki säilyvät.

**Ainoa sovellus on `native/`-hakemiston Rust-studio.** Electron, React/TypeScript,
Vite ja Node-palvelin poistettiin käyttäjän päätöksellä 13.10.2026. Poisto ei tarkoita,
että kaikki vanhan sovelluksen ominaisuudet olisi siirretty. Git-historia säilyttää
vanhan lähdekoodin; toimitetut hahmo-, tausta- ja esimerkkiaineistot säilyvät repositoriossa.

## Mitä sovellus tekee

- Parametriset 3D-hahmot, sääntöpohjaiset liikkeet, lavasteet, esineet ja kuvakulmat.
- [Käsikirjoitusstudion tutkimus](docs/suunnitelmat/KASIKIRJOITUSSTUDIO-TUTKIMUS-20261014.md): uusi Rust-studio, Kokoron ajoitus, huulisynkka, kasvorigi ja 30–60 sekunnin sarjatuotanto; lähteet ja toteutusvaiheet.
- [Hahmoperheen muotoilu](native/CHARACTER-DESIGN.md): yhtenäiset vaatesiluetit, muotoillut hiukset ja selkeämmät kasvot; todellinen renderöity katselmuskuva kehittäjän työkaluna.
- [Näyttelytyylit](native/ACTING-STYLES.md): pehmeä 3D, vapaan ylävartalon stop motion 12/15 asentoa/s ja pehmeät suun ilmesiirtymät. Tyyli tallentuu jaksoon.
- Paikallinen Kokoro-puhe ja pysyvät hahmoäänet; oma äänitys tai tuotu ääni on ensisijainen.
- Äänen kestoon sidotut repliikit ja huulisynkka, hahmokohtainen päällekkäinen ajoitus, puheen ja liikkeen erilliset alut/kestot,
  esineen nosto/luovutus sekä rajatut lasku-, pudotus-, ovi- ja porraskontaktit.
- `.koeta`-sarjaprojektit ääniresursseineen, autosave/palautus, sarjan hahmo- ja maailmakirjasto.
  Vanhan `.sarja` v1 tuonti sekä `.hahmo`-kirjoitus ja historia säilyttävät alkuperäiset aineistot.
- 2D-rigin ja natiivin 3D-luurangon avainruudut, tarkistetut ryhmäsiirrot sekä
  kamera-/taustakorttien ajoitus; kommentit, tehtävät ja paikallinen hyväksyntä/lukitus.
  Aikajanalla hahmon rivit voi valita yhdessä ja valitut palikat korostuvat.
  Valittu ryhmä voidaan raahata yhteiseen, ennen hyväksyntää tarkistettavaan ajoitusluonnokseen.
- Mikrofoni-/kameraesitystyökalut, kuva- ja tasoeditori, rajattu PSD-tuonti,
  leikkausasetukset, taustaäänet, englanninkieliset tekstitykset ja MP4-vienti.
- [Ohjelmistopohjainen 3D-renderpassien PSD-vienti](native/RENDER-PASSES.md):
  base color, AO, specular, syvyys ja normaalit omiksi kohdistetuiksi tasoiksi.
  Vienti-välilehden asetukset ja Renderöi tasoiksi avaavat ne suoraan Kuva-editoriin;
  muokatut tasot/PSD ja asetukset säilyvät .koeta-projektissa.

Tuntematon ohje tai mahdoton kontakti annetaan virheenä. Sovellus ei tulkitse
mielivaltaista proosaa eikä korvaa kaikkia Photoshopin tai ammattivideoeditorin ominaisuuksia.

## Käynnistys ja testit

```sh
cd native
cargo run --locked --release -p hs-app
cargo test --locked --workspace -j4
cargo build --locked -p hs-app -p hs-cli -j4
python3 -m unittest discover -s packaging/tests
```

Rust ja käyttöjärjestelmän kehitysriippuvuudet tarvitaan lähteestä kääntämiseen.
MP4 tarvitsee FFmpegin ja FFproben; Mac-paketoija voi sisällyttää ne lisensseineen.
Kokoro-malli ladataan erikseen käyttäjän luvalla, ei Gitiin tai app-bundleen.
Ajon aikana ei tarvita Nodea, selainta, Electronia tai Pythonia. Python palvelee
paketointia ja kuvaketyökalua; erillinen Codex-kiintiötyökalu käyttää Nodea.

## Ohjeet ja kehitystilanne

- [Natiivin sovelluksen ohje](native/README.md), [kokonaisen jakson työnkulku](native/EPISODE-WORKFLOW.md).
- [Päällekkäinen ajoitus ja esinekontaktit](native/PARALLEL-CONTACTS.md).
- [Jäljellä olevat ominaisuuspuutteet](native/PARITEETTI.md).
- [Mac-paketointi](native/packaging/README.md), [DMG-julkaisun tarkistuslista](native/packaging/RELEASE-CHECKLIST.md).
- [Codex/Claude-työohjeet](AGENTS.md), [yhteinen handoff](TIIMI.md).
- [Ammattitason kehitysvaiheet ja agenttien työnjako](docs/tiimi/AMMATTITASO.md).

Sovellus on kehitysversio. Oikean Macin, Kokoro-kuuntelun, kamera-/mikrofonilaitteiden,
Finder-avausten ja allekirjoitetun/notarisoidun itsenäisen DMG:n hyväksyntä on kesken.
Linux-testit eivät todista näitä toimiviksi. Release-version kokoa, muistia ja energiaa
pitää vielä mitata Macilla. Käyttäjän nykyinen tavoite on henkilökohtainen käyttö:
ominaisuudet ensin, Mac-hyväksyntä ja keveysmittaukset vasta niiden jälkeen.
Allekirjoitus/notarisaatio ei ole henkilökohtaisen käytön tämän vaiheen valmistumisehto.
`main` on yhteinen päähaara.

Vanhojen DEVELOPMENT-dokumenttien ja `docs/tiimi`-muistioiden Electron-/npm-ohjeet
ovat historiallisia, eivät nykyisiä käynnistys- tai kehitysohjeita.
