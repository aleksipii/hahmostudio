# KILSAT Studio 0.34 — käyttöliittymä ja tallennuksen ajoitus

## Käyttöliittymä
Käyttäjän alkuperäinen KILSAT LOGO.png säilytetään public/branding/kilsat-studio.png-tiedostossa. Sama kuva näkyy oikeassa yläreunassa ja faviconissa. create-app-icon.py muodostaa 11 PNG-pohjaista ICNS-esitystä 16–1024 px Mac-kuvakkeeksi. Macin sips avasi ICNS:n PNG-kuvaksi onnistuneesti. Sovelluksen nimi on KILSAT Studio; bundle ID, userData ja projektien tallennusmuodot säilyvät.

styles/tokens.css ja styles/app-shell.css yhtenäistävät varsinaisen editorin pinnat, teemat, painikkeet ja paneelit. Hahmo, Esitys ja Animointi säilyvät. Kaksi saman toiminnon toistopainikeriviä on yhdistetty: editorissa käytetään yhtä transport-ohjausta. AnimationPanel säilyttää itsenäisen komponentin toistopainikkeet oletuksena. Valmiit liikkeet ja toiston fps-mittaus ovat avattavissa riveissä. Pikavienti löytyy Vie-ikkunasta. Aikajanan kuvataajuus, ruutumäärä ja PNG-vienti ovat Aikajanan asetukset -valikossa. Paneelien koko/näkyvyys, alkuperäinen aikajana, avainruudut, easing-editori, tilakaavio ja kaikki nykyiset tuonti-/vientitoiminnot säilyvät. Teemapainikkeiden kontrasti on testattu AA-rajaa vasten. Näytön todellista ikkuna-/graafista renderöintiä ei tässä muutoksessa mitattu.

## Käsikirjoitus
Lähdetekstin Rakenne, esimerkit ja kirjoitusohje näyttää suomenkielisen rakenteen ja kolme valittavaa mallia. Liike ilman puhetta, kaksi hahmoa ja repliikit, kamera ja ympäristö. Malli voidaan lisätä vain tyhjään kenttään; muuten kopioidaan tarvittavat rivit. Tämä ei ylikirjoita nykyistä tekstiä. Teksti kulkee nykyistä luonnos-/komentojournalireittiä pitkin. Parserit ja animaatiokääntäjä säilyvät. Repliikkimalliin tarvitaan oikeat ääniresurssit ja niitä vastaava kesto; mallin näyttäminen ei ole lupaus valmiista puheäänestä.

## Kamera ja ääni
Kasvotyöntekijä palauttaa kuvan alkuperäisen aikaleiman. Tuetuilla selaimilla requestVideoFrameCallback ottaa uuden videoruudun, vanhemmilla käytetään 33 ms ajastinta. Kasvosuodatin, kameran oma tallennus sekä yhteisen oton kameraomisteiset kanavat käyttävät kuvan aikaa, eivät analyysin vastaanottohetkeä. Vanha, ennen ottoa kuvattu ruutu jätetään pois. Mikrofonin omistamia suukanavia ei aikaisteta kameran kellolla. Projektin kopiointi tapahtuu ennen mikrofonin ja oton yhteistä aloitushetkeä. Ruudunpäivityksen viive ja positiivinen ajoituskorjaus rajataan oton sallittuun viimeiseen ruutuun, jotta aikajanan enimmäispituus ei ylity.

Mikrofonin AudioWorklet vastaanottaa tallennusepookin ja sample-alkuruudun. Näytepalat sisältävät alkuperäisen sample-paikan; aukot pysyvät hiljaisuutena eivätkä puristu pois. Lopetus odottaa worklet-kuittausta ennen WAV:n kokoamista, jotta viimeiset jonossa olevat palat säilyvät. Epäonnistunut kuittaus raportoi virheen. Samanaikainen lopetus/aloitus estetään. Kooditesteissä viive, aukot, vanha epookki, osittainen ensimmäinen audiokvantti ja viimeinen pala testataan ilman fyysistä laitetta.

Esitys → Äänen ja kameran ajoitus tarjoaa käsin säädettävän cameraOffsetMs-asetuksen -500…500 ms. Oletus 0. Miinus aikaistaa tallennettua kameraliikettä, plus myöhentää. Asetus validoidaan, säilyy .hahmo-tiedostossa ja vanhat profiilit toimivat ilman sitä.

## Tarkistus ja rajat
889 kooditestiä läpäisi. TypeScript ja ARM64 Mac-build/paketointi tarkistetaan toimituksessa, samoin codesign, paketoitu Electron/Node-runtime sekä ZIP-versionumerot ja CRC. Fyysistä kameraa/mikrofonia, laitekohtaista latenssia, uutta fps-mittausta tai graafista Mac-käynnistystä ei tässä ajossa varmennettu. 0.32:n havaittua React-päivitysvaroitusta ei ole todistetusti ratkaistu. Käyttöliittymän uudistus ei korvaa nykyisiä animaatio-, PSD-, luusto-, kamera-, ääni- tai vientimoottoreita. ICNS-paketointi käyttää nykyistä ad hoc -allekirjoitusta; ei notarisoitu Developer ID -julkaisu.

## Toimitus
Hahmostudio-Mac-0.34.0-arm64.zip ja lähdekoodi ZIP. Pura Mac ZIP, sulje vanha KILSAT Studio ja korvaa Ohjelmat-kansion sovellus. Tämä ei ylikirjoita projekteja tai asennettua appia automaattisesti. Lataukset-kansion vanha app pitää myös korvata, jos käytät sitä. Lisätietoja README.md.
