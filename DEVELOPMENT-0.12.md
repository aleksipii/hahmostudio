# KILSAT Studio 0.12: alkuperäinen kartonkianimaatio

## Toteutus

Tämä vaihe lisää olemassa olevaan React/TypeScript/Electron-sovellukseen kaksi omaa kartonkihahmoa, kolme taustaa ja yhdeksän suuasennon ohjauksen. Vanhoja hahmoja, tallennettuja projekteja tai aiempia moottoreita ei poistettu. South Park on tyylisuunta; sovelluksen hahmot ovat omia alkuperäisiä piirroksia.

- Mr.Kille: sinivihreä takki, tummansininen neulepipo.
- Mr.Handu: kuparinvärinen takki, ruskeat hiukset ja viikset.
- Molemmilla 39 kerrosta, pyöreä 220 px pää ja noin 555 px siluetti: 2,52 pään korkeutta. Tasaiset väripinnat ja mustat pääääriviivat. SVG-lähteet, luusto-JSON, PSD, PNG ja nykyisen editorin .hahmo-paketti.
- Silmät NORMAL/BLINK/SQUINT/ANGRY; suut REST/AI/E/O/U/MBP/FV/CDGKNRSThYZ/L_WQ; kädet DEFAULT/POINT/FIST. Kädet pysyvät lapasmaisina.
- Suomalaisessa käyttöliittymässä hahmot ja kartonkistudio/kauppakatu/auton sisätila ovat kirjaston ensimmäiset lisäykset. Taustojen samat vektorimuodot toimivat Canvas-esikatselussa, viennissä ja SVG-latauksina. Aiemmat resurssit säilyvät.

## Nivelet ja yhteensopivuus

SVG/luusto säilyttää pyydetyt normalisoidut data-pivot-x/y-arvot. Joissakin raajoissa ja päässä pivotFrame määrittää nivelpisteen viitekoordinaatiston erillään kuvan rajauslaatikosta. Näin .15/.85-tyyppinen normalisoitu arvo voidaan säilyttää samalla, kun todellinen olkapää on kohdassa 95/290 tai 305/290 ja kaula kohdassa 200/244. PSD/editorin luusto käyttää näitä todellisia dokumenttitilan nivelpisteitä. Pää, silmät, suu ja hiukset periyttävät vartalon muunnoksen. Korjattu liitosketju on ROOT → TORSO → PANTS → LEG_LEFT/LEG_RIGHT. Housut ja jalat seuraavat vartalon muunnoksia; olkapäät ovat kohdissa 110/290 ja 290/290, vartalon kiertokeskus 200/430 ja lantion 200/445. Normalisoidut nivelarvot säilyvät pivotFrame-koordinaatistolla. Korjaus koskee uusia kirjastopaketteja, ei aiemmin tallennettujen projektien automaattista muokkausta.

QuickProfile sisältää vapaaehtoiset validoidut switchDefaults-oletukset. Tämä estää vaihtoehtoisten silmien ja suiden piirtymisen päällekkäin esityksen alussa. Vanhoissa profiileissa kenttä ei ole pakollinen. Uudet hahmot tarvitsevat 0.12-version; vanhat .hahmo v1–v5 -projektit toimivat edelleen.

Nykyinen AudioClip voi tallentaa vapaaehtoisen viseme-arvon jokaiselle suuajoitukselle. Nykyinen käsikirjoitusmoottori käyttää hahmon yhdeksää suuta, kun sidokset ovat olemassa, ja säilyttää kolmen suun vaihtoehdon vanhoille hahmoille. Myös editorin olemassa oleva paikallinen äännetunnistus säilyttää uudet suuarvot. Pyydetty Rhubarb A→REST-kartoitus on toteutettu sellaisenaan; se poikkeaa Rhubarbin normaalista A=huulet kiinni -nimityksestä. MBP on erillisenä kuvatilana, mutta mikään pyydetyn kartan A–H/X-arvo ei valitse sitä.

## Sääntöpohjaiset moduulit

`lib/cutout`: eksplisiittinen käsikirjoitusparseri, Rhubarb→viseme-kartta, vanhempien nivelmatriisit ja Z-järjestys, 24 fps porrastettu liike ja deterministinen räpäytys, ortografinen kamera/taustat/etualakerros, ruututilan JSON ja todellinen SVG-renderöijä. `read.ts` validoi tapahtuma-akselin, animaatiopaketin ja täydellisten ruututilojen tuonnin. JSON Schema -tiedostot ovat public/schemas-kansiossa.

Kolme–kaksi tarkoittaa tässä 24 fps animaation vuorottelevia kolmen ja kahden ruudun pitoja; se ei ole videon kenttien 24→60 telecine-muunnos. Kävelyn pystysykli on kaksi ruutua ala-asennossa / kolme yläasennossa. Raajojen liikkeet ovat tyyliteltyjä pohjia, eivät valmiita luonnollisia kävely- tai juoksuanimaatioita eri kuvakulmista.

SVG:n tasovarjo käyttää stdDeviation 1.5, dx 1, dy 2, opacity 0.25. Suora SVG-video käyttää näitä varjoja. PSD-pakettien rasteroiduissa tasoissa varjoja ei ole leivottu; editorin vanha rasterirenderöinti säilytetään.

## Oikea esimerkkivideo ja muokattava projekti

KILSAT-kartonkidemo-1080x1920.mp4 on paikallisesti renderöity oikea 24 fps video molemmilla uusilla hahmoilla ja käyttäjän 16 alkuperäisellä äänirepliikillä. Valmiin videon AAC-ääni koodataan suoraan alkuperäisistä MP3-tiedostoista 48 kHz:n näytetaajuudella; tunnistusta varten käytetyt 16 kHz WAV-tiedostot eivät ole viennin äänilähde. Rhubarb phonetic analysoi 185 suuajoitusta; ääniä ei syntetisoida eikä nopeuteta. Mukana on lyhyitä eksplisiittisiä eleitä, kahden ruudun räpäytyksiä, puheen pieni pään liike ja yksi vihainen ilme. Kesto 749/24 = 31,208 sekuntia, mukaan lukien erikseen annetut tauot ja ruuturajojen pyöristys.

KILSAT-kartonkidemo.hahmo on nykyisessä editorissa muokattava rinnakkaisprojekti: kaksi uutta hahmoa, yhdeksän suun ohjaus, samojen alkuperäisten MP3-tiedostojen 16 repliikin keskustelu ja 30,914 sekunnin alkuperäisäänien mittainen ajoitus taukoineen. Se käyttää nykyistä käsikirjoitus- ja esitysmoottoria. Se ei sisällä SVG-demon erikseen lisättyjä eleitä/räpäytyksiä; nämä kaksi esityspolkua eivät ole ruudulleen sama video.

Mukana toimitetaan SVG-demon käsikirjoitus, tapahtuma-akseli, suuajoitukset ja kaikki ruututilat JSONina. Litterointitekstit perustuvat aiemmin paikallisesti tehtyyn tarkistamattomaan puheentunnistukseen. Keskustelu järjestettiin sisällön mukaan käyttäjän luvalla. Alkuperäisiä MP3-tiedostoja ei muutettu, eikä yksityisiä ääniä sisällytetä sovelluspakettiin tai lähdekoodiin.

## Rajat

- YouTube-vertailuvideota ei saatu luotettavasti katsottua. Yhtenevyyttä sen yksittäisiin kohtauksiin ei väitetä.
- Kyseessä on 2D-kartonkianimaatio. Aiempi 2.5D/3D-toiminnallisuus säilyy; uudet hahmot eivät ole tilavuudellisia 3D-verkkoja.
- Mr.Kille ja Mr.Handu ovat etunäkymän hahmoja; sivu- ja takakulmat eivät vielä kuulu uusiin paketteihin.
- Sääntöpohjainen SVG-tapahtuma-akseli on tiedosto/API-työnkulku, ei vielä editorin erillinen interaktiivinen työtila. Nykyiseen editoriin on kytketty hahmot, taustat, oletustilat ja yhdeksän suun tuki.
- Fyysisen kameran/mikrofonin, Safarin ja paketoidun Mac-sovelluksen graafisen käynnistyksen toimivuutta ei tässä ympäristössä vahvisteta.

## Käyttö

Pura uusi Mac-ZIP Lataukset-kansiossa. Sulje aiempi KILSAT Studio ja siirrä uusi KILSAT Studio.app Ohjelmat-kansioon vanhan sovelluspaketin tilalle. Älä poista projektitiedostoja tai käyttäjätietokansiota. Avaa sovelluksessa Tiedosto → Avaa projekti ja valitse KILSAT-kartonkidemo.hahmo. Uudet hahmot löytyvät myös Hahmot ja taustat -kirjastosta.

Rakennus: npm test, npm run typecheck, npm run desktop:build, node scripts/package-mac.mjs. Resurssien uudelleenluonti käyttää kehitysympäristön sharp-moduulia erikseen annetusta polusta; sovelluksen ajo ei tarvitse sitä. Katso scripts/create-cutout-svg.py, build-cutout-packs.ts, create-cutout-schemas.py, render-cutout-demo.ts ja create-cutout-editor-demo.ts.

## Tämän toimituksen tarkistukset

174 kooditestiä läpäisi. TypeScript ja tuotantokoostaminen läpäisivät. MP4 purettiin kokonaan ilman dekoodausvirheitä, ja kuusi todellista pakattua ruutua tarkistettiin kuvina. FFprobe vahvisti 749 H.264-ruutua, 1080×1920, 24 fps ja 48 kHz AAC-ääniraidan. Paikallisen selainversion Mr.Killen valinta ja todellinen näyttämö tarkistettiin 1280×720-ikkunassa. Tämä ei ole paketoidun Mac-sovelluksen graafinen käynnistystesti.
