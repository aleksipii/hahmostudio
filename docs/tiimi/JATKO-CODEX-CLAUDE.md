# Codex ↔ Claude: yhteinen jatko

Molemmat työkalut jatkavat samaa Hahmostudio-projektia. Lue AGENTS.md ja viimeinen TIIMI.md-kirjaus. CLAUDE.md ohjaa samoihin sääntöihin. Main ja hahmostudio1.0 ovat varmistetun työn yhteiset päähaarat; keskeneräinen työ pysyy omassa työhaarassaan.

## Aloitus

1. Hae remote-tila ja katso branch/HEAD sekä paikalliset muutokset. Älä aloita aiempaa valmistunutta työtä uudelleen tai peru toisen työkalun muutoksia.
2. Jatka nimettyä keskeneräistä työhaaraa tai aloita uusi mainin nykyisestä päästä. Sovita omat paikalliset muutokset turvallisesti; ei reset/stash/ylikirjoituksia käyttäjän aineistoon.
3. Varmista lähteestä, mikä on toteutettu. Raportit erottavat koodihavainnot, ehdotukset ja avoimet hyväksynnät.

## Vaihto ja päähaaroihin yhdistäminen

Kirjaa ennen työkalun vaihtoa TIIMI.md:hen haara/commit, tehty työ, testikomennot ja todelliset tulokset, avoimet asiat sekä seuraava konkreettinen tehtävä/tiedostot. Commit/push työhaaraan säilyttää keskeneräisen työn. Kun kokonaisuus on sovitettu ja varmistettu, hae main/hahmostudio1.0 uudelleen, säilytä molempien historia ja päivitä sama testattu commit atomisesti molempiin. Käyttäjä on valtuuttanut valmiiden kokonaisuuksien yhdistämisen.

Kiintiöraja: Codex tarkistaa oman 5 tunnin mittarinsa työvaiheiden välillä; enintään 10 % jäljellä käynnistää AGENTS.md:n tallennuskäytännön. Claude käyttää oman palvelunsa näkyvää kiintiötä ja samaa palautettavan työn tallennuskuria. Codexin lukijan tulosta ei tulkita Clauden käyttörajaksi.

## Tämän kierroksen yhdistetty sisältö

- Codexin testattu asiantuntijatyö: English/Kokoro-pohja, flat/cel-tyyli, PSD-ryhmäraja, mallilukituksen esto, hahmokontrollien disabled sekä vientiperuutuksen suoja.
- Clauden tekoälyhaara: paneeli sovelluksen valikkoon ja toimintohakuun.
- Clauden sääntöhaara: korpus, tunnistimen täsmennykset ja näkyvät syyt tunnistamattomille riveille.
- Clauden hahmografiikkahaara: 30 kolmiulotteista lavastetta ja viivattoman 2D-kirjaston kuvaukset. Integraatiossa legacy-cel säilytettiin; flat-haaran helmakorjaus ja uusi 3D-lavastepolku toimivat yhdessä.
- Clauden UI-haara: selkeämpi yläpalkki, näkymä/tallennus Projekti-valikkoon, seuraava työvaihe, tyhjät tilat ja suurempi aikajana. AI-painike sovitettiin uuteen valikkopaikkaan.
- Jatkokehitys: AI-dialogin Tab/Shift+Tab-rajaus, Escape-eristys ja fokuksen palautus oikealla GUI-testillä.

## Seuraava tuotantohyväksyntä

Aja englanninkielinen esimerkki aidolla, jo hyväksytyllä Kokoro-mallilla sovelluksessa; kuuntele repliikit ja katso MP4:n synkka. Tarkasta 2D/3D-hahmojen liike ja lavasteiden peitto valituissa kuvakulmissa. Paketoidun Mac-sovelluksen toimituskoe ja oikea GPU/pilvi ovat erillisiä hyväksyntöjä. Pelkkä testien läpäisy ei merkitse näitä tehdyiksi.
