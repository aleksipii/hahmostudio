# UI/UX — 8.10.2026

Nykyinen vaihe: kaksi rajattua komponenttikorjausta toteutettu ja SSR-regressiot ajettu. Pohjarevisio `d356ad6e7d1ae043d68cb74a3c1bf0143f91d667`; tiimin aiemmat ja rinnakkaiset muutokset säilytetty. Omistetut tiedostot: components/ai-panel.tsx, components/production-board.tsx, server/tiimi-ux.test.mjs ja tämä raportti.

## Koodista todettu

- `components/production-board.tsx:24`, ProductionBoard: Hahmot-välilehden fieldset ei aiemmin käyttänyt komponentin disabled-propia. Uusi 3D-tyylivalinta oli estetty, mutta saman hahmon esitystavan ja värien kontrollit jäivät käytettäviksi. Lisätty fieldset disabled={disabled}: selaimen natiivi estotila koskee nyt koko hahmokohtaista ryhmää. Aiempi eksplisiittinen flat/cel-valinta säilyy ja näkyy edelleen vain toon3d-hahmolle.
- `components/ai-panel.tsx:7–9`, AiPanelView: latausteksti oli tavallinen kappale. Nyt sisältö ilmoittaa aria-busy-tilan ja latausteksti käyttää role=status-roolia. Tämä on semanttinen korjaus; todellinen ruudunlukijan puhetta koskeva hyväksyntä puuttuu.
- `components/ai-panel.tsx:47–49`, AiPanel: avaus fokusoi dialogin ja Escape sulkee sen. Fokusloukkua tai avauspainikkeen fokuksen palautusta ei tässä toteutuksessa ole. Tämä on jatkohavainto, ei tämän kierroksen korjaus.
- `components/script-compose-editor.tsx:435–441`: Aloituspohjat käyttää episodeTemplates-listaa, joten arkkitehdin uusi kokoro-en-pohja näkyy olemassa olevan polun kautta ilman rinnakkaista esimerkkipainiketta.
- `components/presentation-panel.tsx:191`: erillinen vanha englanninkielisen esimerkin toiminto avaa Example-parking-ticket.md-tiedoston; sitä ei muutettu tässä. Uusi Kokoro-pilotti valitaan Aloituspohjista.

## Ajettu näyttö

`node --experimental-strip-types --test server/tiimi-ux.test.mjs server/ai-panel.test.mjs`: **5/5 läpäisi**, fail/skip/todo 0 (kaksi uutta UX-regressiota ja kolme vanhaa AI-paneelitestiä). SSR-loader valitsee Hahmot-välilehden testin lähdefixtuurissa; tuotantokomponentin Kuvakortit-oletus säilyy. Testi tarkastaa oikean React-komponentin renderöimän disabled-fieldsetin molemmat tilat sekä puuttuvan 3D-vastaavuuden eston.

`git diff --check`: läpäisi. `npm run typecheck`: tämän ajon aikana epäonnistui rinnakkaisen 3D-testin `lib/toon-hem.test.ts:8` findLast/implicit-any-virheisiin. Virhe välitetty koordinoijalle; UX-agentti ei muuta 3D-tiedostoja. Lopullinen integraatiotarkistus kuuluu koordinoijalle.

Ei GUI-ajoa, paketoidun sovelluksen ajoa, ruudunlukijakoetta, Kokoro-synteesiä tai käyttäjän työnkulun hyväksyntää tässä agenttiajossa. Vanhoja docs/tiimi/todennus-kuvia ei esitetä tämän diffin hyväksyntänä.

## Ehdotukset ja toistettava hyväksyntäohje

1. Avaa erillinen pilottiprojekti desktopissa; Käsikirjoitus → Aloituspohjat → Kokoro-englanninkielinen pohja. Varmista Pipsa/Ville ja kaksi englanninkielistä repliikkiä. Rakenna jakso ja tarkista näkyvät puuttuvan äänen tilat.
2. Valitse repliikkien Kokoro-äänet olemassa olevassa Kokoro-paneelissa; synteesi vain käyttäjän jo hyväksymällä paikallisella mallilla ja sovelluksessa tehdyillä valinnoilla. Kuuntele molemmat repliikit, tarkista ajoitus ja huulisynkka. Käyttäjän aiempaa ääntä ei korvata automaattisesti.
3. Ohjauspöytä → Hahmot: valitse 3D ja flat/cel. Varmista, että tyyli näkyy, vaihto päivittää esikatselun ja undo palauttaa. Aktivoi sovelluksen todellinen estotila; varmista kaikkien saman hahmon esitystapa-, väri- ja tyylikontrollien estyminen. Tarkista näppäimistöllä ja 600/1440 px näkymissä.
4. Näytä → Tekoäly: varmista tilalataus hitaalla erillisellä testibridgellä, valmistuminen ja toiminnon statusviesti. Tarkista VoiceOverilla; pelkkä SSR-rooli ei todista ilmoituksen kuulumista.
5. Tarkista pilotti ja puuttuvat resurssit ennen vientiä. Hyväksyntä ja tekninen tarkistus arvioidaan erikseen; vienti hyväksytään vasta, kun tiedosto on syntynyt ja kuva/ääni tarkastettu.

## Avoimet kysymykset

- Dialogin Tab/Shift+Tab-rajaus ja fokuksen palautus: jatkokorjaus erillisellä selain/Electron-näppäimistötestillä; UI:ssa on natiiveja pilvidialogeja, joiden kanssa fokus on testattava.
- Viisi vakavinta koko editorin tuotantoestettä, lähderivin löytämisen käyttäjäkoe, tallennuksen havaittavuus ja todellinen vienti eivät ole tämän kahden komponentin rajauksen perusteella pääteltävissä. Tarvitaan koko pilotin käyttäjätesti.
- Disabled-prop ei yksin kuvaa tuotannon lukituksen syytä. Nykyinen kutsuva komponentti ratkaisee, milloin estotila käynnistyy; ei uutta lukituslogiikkaa tässä.

Valmistunut työ: kaksi palautettavaa UI-korjausta ja kohdennettu testinäyttö. Seuraava työ: koordinoijan integraatiotarkistus ja oikea GUI/VoiceOver-pilotti. Jatkoarvio 0,25–0,5 henkilötyöpäivää, kun paikallinen desktop ja hyväksytty Kokoro-malli ovat käytettävissä; mahdollinen fokuskorjaus ja vientivirheiden korjaus arvioidaan havaintojen jälkeen.

## Jatko 9.10.2026

Tallentuneita muutoksia ei aloitettu uudelleen. Lisätty kolmas SSR-regressio: 3D-tyyli näkyy vain toon3d-esitystavassa, kentätön profiili valitsee cel-tyylin ja eksplisiittinen flat säilyy. `node --experimental-strip-types --test server/tiimi-ux.test.mjs`: **3/3 läpäisi**, fail/skip/todo 0. Aiemman viiden testin yhteisajo myös läpäisi tämän päivän uusinnassa (ennen kolmannen testin lisäystä). `git diff --check` läpäisi. Koordinoijan korjaaman findLast-virheen jälkeinen typecheck-uusinta oli raportin kirjoitushetkellä vielä käynnissä; lopputulos välitetään koordinoijalle. GUI/VoiceOver ja Kokoro-kuuntelu ovat edelleen avoimia.
