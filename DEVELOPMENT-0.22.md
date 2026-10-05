# KILSAT Studio 0.22 — kuvan tarkistuslista ja viennin esitarkistus

Vaihe 0.22 jatkaa paikallista tuotantoperustaa. Animointi → Kuvakortit → valitse kuva → tarkistuslista. Näyttää todellisen positiivisen keston, esityksen virheet, ääniviitteet, avoimet kommentit ja käyttäjän hyväksynnän erillisinä asioina. Koko projektin virheet näkyvät jokaisen kuvan tarkistuksessa; puuttuvia tiedostoja ei julisteta tarkistetuiksi pelkän AudioClip-viitteen perusteella.

Mac: Vie… → Tarkista vientivalmius. Painike käyttää samaa freezeRender/inspectRenderSnapshot-polkuja kuin vientijono: nykyisestä projektista muodostetaan .hahmo-tilannekuva, manifesti ja resurssien tarkistussummat tarkistetaan, esitys käännetään uudelleen, vientiprofiili/kesto/ääniedellytykset validoidaan. Onnistuminen näyttää oikean ruutumäärän, arkistomerkintöjen määrän ja render-revision. Ei renderöintiä, tiedoston kirjoitusta tai vientijonoon lisäämistä. Vienti tekee tarkistuksen uudelleen.

Tulosta ei näytetä nykyisenä, kun Episode-viite tai profiilin sisältö muuttuu. Esitarkistus ei todista GPU-piirtoa, FFmpeg-pakkausta, valmista videota, äänen laatua tai taiteellista hyväksyntää. Kommentit ja käyttäjän hyväksyntä eivät ole nykyisen teknisen render-sopimuksen estäviä ehtoja. Ei uusia vientikelpoisuuden sääntöjä tai renderöintimoottoria.

Kuvakohtainen projektiotesti kattaa hyväksynnän erottamisen virheistä/ääniviitteistä, globaalin virheen, avoimen palautteen ja lähteen muuttumattomuuden. Nykyiset render-sopimuksen, manifestin, palautuksen, tallennuksen ja vientitestit säilyvät. Graafista editoria, laitteita tai Safaria ei testata tällä kierroksella. Web-versio käyttää nykyistä legacy-vientiä; uusi esitarkistuspainike on Macin vientijonon ikkunassa.

Asennus: sulje vanha sovellus, pura uusi Mac-ZIP ja korvaa Ohjelmat-kansion KILSAT Studio.app. Koko ammattistudio ei ole valmis. Katso Kooditestit-0.22.0.md.
