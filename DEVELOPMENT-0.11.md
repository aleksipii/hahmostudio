# KILSAT Studio 0.11 — työtilojen uudistus

Nykyinen Hahmostudio jatkuu samalla React/TypeScript-, Electron-, importer-, renderöinti- ja animaatiomoottorilla. Näkyvä työpöytänimi on KILSAT Studio. Paketin tekninen hahmostudio-identiteetti, fi.hahmostudio.desktop, IPC, projektimuodot ja aiemmat tiedot säilyvät.

## Työtilat

- Hahmo: kirjasto/tasot vasemmalla, oikea tasoesikatselu sekä piirto- ja niveltyökalut keskellä, osaominaisuudet oikealla.
- Esitys: mikrofonin, näppäimistön ja kameran nykyiset komponentit siirretään vasemmalle pysyvän portaalin avulla. Sama React-komponentti ja DOM-säiliö säilyvät työtilan vaihdossa. Näyttämö ja ohjauslähteiden yhteenveto näkyvät erikseen. Laitteiden tilariviä ei voi piilottaa.
- Animointi: alkuperäinen käsikirjoitus, omat repliikkiäänet ja valittavat tapahtumat vasemmalla; todellisesta projektista renderöidyt kuvakortit ja esikatselu keskellä; valitun tapahtuman nykyiset kamera-, katse-, ilme- ja lukitusasetukset oikealla. Esikatselu käyttää editorin toistokohtaa huomioiden kohtauksen startFrame-siirtymän. Rakentamattoman valmistelun tapahtumat eivät ole vielä projektin varsinaisen aikajanan raitoja.

Paneelien näkyvyys, erottimilla säädettävät koot, teemat ja nykyiset valikot säilyvät. Yhteiset lisätyylit ovat studio-ui.css. System font on ensisijainen. Piilotetut paneelit eivät pura ohjaimia.

## Tuonti ja vienti

Tuonnin tarkistus näyttää saman tuodun dokumentin tallennetun yhdistelmäkuvan sekä renderLayers-tulkinnan rinnakkain. Puuttuva yhdistelmäkuva ja importer-varoitukset näkyvät sellaisinaan. Tarkistus ei yhdistä tai poista tasoja. Nykyiset MP4/GIF/PNG-viennit, Mac-vientijono, eteneminen, virheet ja peruutus säilyvät; vienti käyttää samaa toteutusta.

## Näppäimet

A/D ohjaavat käsiä; Shift+A/D kyynärvarsia, jos hahmossa on sidokset; W hyppää, S laskee vartaloa, Q/E kallistaa päätä ja 1–3 valitsevat ilmeen. Käyttäjän nykyisillä mukautetuilla näppäimillä on etusija. Command/Control/Alt-oikotiet sekä tekstikentät eivät käynnistä eleitä. Lisäeleet eivät muuta vanhojen QuickProfile-tallennusten rakennetta.

## Tarkistusrajat

Figma-linkin sisältö ei ollut saatavilla eikä neljää uutta referenssikuvaa löytynyt liitteistä tai design-reference-kansiosta. Uudistus perustuu kirjalliseen määrittelyyn; täsmällistä kuvavastaavuutta ei ole vahvistettu. Fyysisen kameran/mikrofonin tai Safarin yhteensopivuutta ei päätellä kooditesteistä. Paketoinnin ja graafisen käynnistymisen tulokset kirjataan toimitusraporttiin erikseen.
