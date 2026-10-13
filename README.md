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
- Paikallinen Kokoro-puhe ja pysyvät hahmoäänet; oma äänitys tai tuotu ääni on ensisijainen.
- Äänen kestoon sidotut repliikit ja huulisynkka, hahmokohtainen päällekkäinen ajoitus,
  tarkistettu esineen nosto ja luovutus.
- `.koeta`-sarjaprojektit ääniresursseineen, autosave/palautus, sarjan hahmo- ja maailmakirjasto.
- Mikrofoni-/kameraesitystyökalut, kuva- ja tasoeditori, rajattu PSD-tuonti,
  leikkausasetukset, taustaäänet, englanninkieliset tekstitykset ja MP4-vienti.

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

Sovellus on kehitysversio. Oikean Macin, Kokoro-kuuntelun, kamera-/mikrofonilaitteiden,
Finder-avausten ja allekirjoitetun/notarisoidun itsenäisen DMG:n hyväksyntä on kesken.
Linux-testit eivät todista näitä toimiviksi. Release-version kokoa, muistia ja energiaa
pitää vielä mitata Macilla. `main` on yhteinen päähaara.

Vanhojen DEVELOPMENT-dokumenttien ja `docs/tiimi`-muistioiden Electron-/npm-ohjeet
ovat historiallisia, eivät nykyisiä käynnistys- tai kehitysohjeita.
