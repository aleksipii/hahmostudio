# Koeta — Rust-työpöytäsovellus

## Nykyinen omistajan ohje (13.10.2026)

- Repositoriossa kehitetään vain `native/`-hakemiston Rust-sovellusta. Käyttäjä pyysi Electronin sekä React/TypeScript-selainversion ja Node-palvelimen poistamista. Vanha pariteettilistan poistoehto on kumottu; puuttuvat ominaisuudet pysyvät avoimina `native/PARITEETTI.md`:ssä.
- `main` on ainoa yhteinen pysyvä päähaara. Älä palauta `hahmostudio1.0`-haaraa tai vanhaa sovellusta ilman uutta käyttäjän pyyntöä.
- Codex ja Claude jakavat Gitin, tämän tiedoston ja TIIMI.md:n. Lue viimeisin handoff, tarkista HEAD/haara/muutokset ja hae etätila ennen työtä. Säilytä toisen työkalun työ. Yhdellä tiedostolla on yksi omistaja kerrallaan.
- Käytä olemassa olevaa eristettyä pilvicheckoutia. Uusi worktree edellyttää käyttäjän nimenomaista pyyntöä.
- Koeta tuottaa ensisijaisesti englanninkielisiä jaksoja: käsikirjoitus → hahmokohtainen Kokoro tai oma ääni → ajoitus/huulisynkka → 3D-animaatio → `.koeta`-sarja → englanninkieliset tekstitykset → MP4. Säilytä suomenkielinen käyttöliittymä ja FI-tuki.

- Nykyinen prioriteetti (14.10.2026): toteuta ominaisuudet ensin; oikean Macin hyväksyntä ja keveysmittaukset sen jälkeen. Käyttäjä tekee sovellusta alustavasti itselleen; allekirjoitus/notarisaatio ei ole tämän vaiheen valmistumisehto. Älä merkitse laitetestejä tehdyiksi Linuxin perusteella.

## Komennot

Työhakemisto `native/`:

```sh
cargo run --locked --release -p hs-app
cargo test --locked --workspace -j4
cargo build --locked -p hs-app -p hs-cli -j4
cargo clippy --locked --workspace --all-targets -j4
python3 -m unittest discover -s packaging/tests
```

Mac-paketointi: `native/packaging/README.md`. Linux tarvitsee ALSA-kehityskirjastot ja pkg-configin; FFmpeg/FFprobe tarvitaan videovientitesteihin. Aito Mac-build tarvitsee Applen SDK:n. Älä aja npm-, Vite- tai Electron-komentoja: niiden lähteet on poistettu. `scripts/codex-quota-status.mjs` on erillinen Codex-työkalu, ei sovelluksen Node-riippuvuus.

## Arkkitehtuuri ja aineistot

- Pidä domain, käsikirjoitus, projekti, puhe, liike, renderöinti ja käyttöliittymä erillisissä crateissa. Agenttien riippuvuudet ovat `reads`/`writes`; yhteinen tick-aikapohja ja lähderivi säilytetään.
- Sääntöpohjainen jäsennin ei arvaa toimintoja eikä generoi puuttuvaa dialogia. Tuntematon ohje ja mahdoton kontakti estävät viennin. Tulkitut luonnokset tarvitsevat käyttäjän hyväksynnän.
- Älä nopeuta puhetta toimituksellisen aikaikkunan vuoksi. Muuttumaton ääni säilytetään; oma äänitys/tuonti voittaa synteesin. Kokoro on paikallinen, lataus luvalla, mallipainot ja käyttäjän ääni pysyvät Gitin ja app-bundlen ulkopuolella.
- Säilytä käyttäjän projektit ja aineistot sekä toimitetut `public/library`-aineistot ja juuren esimerkkiprojektit. Vanhan lähdekoodin poistolupa ei ole aineiston poistolupa. PSD:n vakaat ID:t, hierarkia ja offsetit säilyvät. Noudata cratejen formaatti-, koko-, tarkistussumma- ja resurssirajoja; älä ohita validointia.
- Projektit ja asetukset sijaitsevat app-bundlen ulkopuolella. Avaus suojaa nykyprojektin, virheellinen tuonti ei korvaa toimivaa resurssia ja epäonnistunut vienti säilyttää aiemman tiedoston.
- Kamera/ääni analysoidaan paikallisesti. Välilehden vaihto ei sulje käyttäjän käynnistämiä laitteita. Kokoro, kamera ja mikrofoni käynnistetään tarvittaessa. Vältä ruutukohtaista geometrian uudelleenrakennusta.
- UI:ssa ei ole valepainikkeita toteuttamattomille ominaisuuksille. Kumoaminen, lähteen muutos ja esikatselun invalidointi säilyvät johdonmukaisina.
- Älä muuta repo-oikeuksia, julkaise verkkosivustoa tai poista OS-suojausta. Git-push ei ole lupa sovelluksen käyttöönottoon tai allekirjoitusavainten käsittelyyn.

## Todennus ja handoff

- Testaa muutokseen liittyvät toiminnalliset polut, käännös ja tarpeellinen lint. UI-muutos tarvitsee oikean GUI-tarkistuksen (käyttäjän lupa annettu).
- Erota simuloitu TestEngine, Linux/Xvfb/lavapipe, Mac-paketti ja oikea laite. Kokoron kuuntelu, Metal, kamera/mikrofoni, Finder, Gatekeeper, notarisaatio ja VoiceOver ovat hyväksyttyjä vain todellisen ajon perusteella.
- Päivitä TIIMI.md: työkalu, tavoite, haara/commit, omistetut tiedostot, tehdyt muutokset, tarkat testit/ympäristö, avoimet virheet ja seuraava tehtävä. Valmius perustuu koodiin ja tuloksiin, ei toisen työkalun ilmoitukseen.
- Historialliset selain-/Electron-ohjeet: `docs/AGENTS-LEGACY-20261013.md` ja vanhat DEVELOPMENT-dokumentit. Ne eivät kumoa näitä nykyisiä ohjeita.

## Low-quota checkpoint policy (owner instruction, 2026-10-09)
- The threshold means **10% remaining or less**, not 10% used. Read `node scripts/codex-quota-status.mjs` when starting sustained work, before a large new phase and after a completed phase. The owner explicitly confirmed the five-hour primary window (300 minutes) on 2026-10-09; default trigger requires that exact window. Do not invent a separate 24-hour quota or confuse it with the weekly window. A user correction to the selected window takes precedence.
- The helper uses the official Codex app-server `account/rateLimits/read` method and makes no model calls or Git writes. Missing/failed quota data is unknown, never zero. Record an unavailable check and use only an explicit user/UI reading as a fallback; never promise an unseen threshold fired. This is an active-work instruction, not an installed background scheduler.
- On a confirmed threshold: finish the current small atomic edit, collect the specialists' completed work, document the phase/results/open checks/next steps in TIIMI.md and create a commit. Stage intended source, tests and documentation explicitly; never stage user voices/projects, credentials, model weights or unrelated private files.
- Run the checks appropriate to the change; source changes require typecheck, relevant tests and build. Reuse valid checks for the exact unchanged source when possible. If changes fail or remain unverified, commit and push them to the work branch for recovery, label the state and leave main at its last verified revision. Do not discard work or call it tested.
- Fetch the main destination head. Integrate only the current completed/tested work; do not merge other unique branches merely because quota is low. Preserve every main commit. If main is not an ancestor of the candidate, resolve the integration and retest; never force-push or reset away remote work.
- Push the verified candidate to main with a non-forced update, e.g. `git push github <verified-sha>:refs/heads/main` (use the verified GitHub remote's actual name). Verify the remote SHA afterwards. A rejected/stale update requires refetch and review, not a blind retry.
- Keep checkpoints small and early during long work so a quota cutoff cannot strand a large uncommitted change. Report the published SHA and unfinished acceptance work. Authorization covers Git backups, not app deployment, branch deletion or security-setting changes.


## Codex / Claude shared handoff (owner instruction, 2026-10-09)
- The owner alternates Codex and Claude on this same application. Both follow AGENTS.md and TIIMI.md; CLAUDE.md points here. Git is the shared source of truth.
- Before editing: fetch, read the latest handoff in TIIMI.md, inspect the actual branch/HEAD, worktree and uncommitted changes. Never overwrite the other tool's work, reset it away or assume the local copy is current. Use the existing isolated checkout; a new worktree requires the user’s explicit request.
- At handoff/checkpoint record: exact branch and commit, completed changes, test commands/results and their environment, unfinished acceptance, next concrete task and owned files. Commit/push unfinished work to its work branch with an honest state; do not label it ready or discard it.
- The owner’s shared destination is now main; the former hahmostudio1.0 destination was removed. Resolve combined-branch conflicts, review the final diff and run relevant tests, typecheck/build and actual GUI checks for UI changes. Within the user’s current publication authorization, publish the verified commit to main with a non-forced update and verify the head. Preserve all unique work and do not delete branches without the owner's applicable authorization.
- Quota status is Codex-specific. Claude records its own observed quota/availability and uses the same recovery/checkpoint discipline; do not fabricate one tool's limits from the other's meter.
