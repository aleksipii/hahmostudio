# Haarojen yhteinen integraatio — 9.10.2026

## Valmistunut ja yhdistettävä työ
Codexin asiantuntijatyö ja neljän Claude-työhaaran lähtöpäät on yhdistetty säilyttävällä Git-merge-historialla. Käsikirjoitustunnistimen säännöt/korpus/selitykset, selkeämpi käyttöliittymä ja aikajana, tekoälypaneelin valikko/toimintohaku sekä 30kolmiulotteista lavastetta ovat yhteisessä lähteessä. Tekoälydialogiin lisättiin fokusrajaus ja palautus. Vanhojen profiilien cel-tyyli, nykyinen flat-valinta ja helmakorjaus säilyvät; geneeristä profile.outline=0-oletusta ei tuotu vanhoja projekteja muuttamaan.

## Ajettu näyttö
- Lopullinen normaali `npm test`: 1383/1383 pass,fail/cancelled/skipped/todo 0,exit 0. Komento käyttää nyt kahden tiedoston rinnakkaisuutta. Tämä hallitsee koneen kuormitusta; yhtään testiä ei poistettu eikä startup/performance-rajoja muutettu.
- `npm run typecheck`: exit 0.
- `npm run build:private -- -- --configLoader runner`: exit 0. Vanhoja chunk/dynamic-import-varoituksia jää.
- `npm run team:test:preview`: exit 0,9/9 todellista Electron 44.5.1 darwin-tarkistusta: flat/cel,disabled/modelPins,600/1440px näytteet, koko editorin AI-valikko,Tab/Shift+Tab,Escape/fokuksen palautus ja 600/1440 px koko editori ilman vaakaylivuotoa.
- Oikea startup-moduuli ladattu erikseen 0.401 s; alkuperäinen 3000 ms-regressio myös läpäisi ilman rajamuutosta.

Ensimmäisessä oletusrinnakkaisuuden ajossa 1381/1383 läpäisi; kaksi kuormituksen aikarajatestiä epäonnistui. Rajatun uusinnan jälkeen myös lopullinen npm-komento läpäisi. Ensimmäisiä epäonnistumisia ei esitetä läpäisseinä.

## Codex/Claude-jatko
CLAUDE.md ja AGENTS.md ohjaavat samaan TIIMI.md-työlokiin. Lue lähtöhaara/commit ja fetch ennen editointia. Valmis lähde päivitetään samaan commitiin mainissa ja hahmostudio1.0-haarassa atomisesti, ilman force-pushia. Keskeneräinen työ pysyy nimetyssä työhaarassa.

## Avoimet tuotantohyväksynnät
Aidon Kokoron kuuntelu ja lopullisen MP4:n huulisynkka,2D/3D-liike/taide,VoiceOver,paketoidun sovelluksen toimituskoe ja oikea GPU/pilvi eivät sisälly tähän source-integraation hyväksyntään. Tämä ajo käyttää eristettyä editorin web-buildia oikeassa Electronissa, ei asennettua KOETA-bundlea. Käyttäjän ääniä/projekteja ei lähetetty tai korvattu.

Seuraava konkreettinen työ: englanninkielisen kokoro-en-pohjan kuuntelu- ja vientipilotti hyväksytyllä paikallisella mallilla, QA:n katsottu kuva/ääni ja tuotantokierroksen läpimeno. Katso docs/tiimi/JATKO-CODEX-CLAUDE.md ja TIIMI.md.
