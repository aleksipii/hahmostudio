# Laitehyväksyntä: tarkistuslista käyttäjälle

Tämä lista tehdään omalla Macilla uudella paketilla. Automaattiset testit eivät korvaa näitä kohtia. Merkitse jokaiseen **läpi / ei / ei kokeiltu** ja lyhyt havainto. Kirjaa alkuun paketin versio tai commit, macOS-versio sekä mikrofonin ja kameran nimi. Käytä erillistä testiprojektia. Omia äänitteitä ei liitetä GitHubiin.

## Mikrofoni

1. Äänitä lyhyt testirepliikki. macOS kysyy mikrofonilupaa vain ensimmäisellä kerralla. Pysäytyksen jälkeen repliikin pitää kuulua toistossa ja suun liikkua.
2. Aloita uusi äänitys ja paina **Hylkää äänitys**. Edellisen repliikin pitää säilyä.
3. Vaihda äänityksen aikana jokaiseen työvaiheeseen (⌥1–⌥6). Äänityksen pitää jatkua ja pysäytyspainikkeen olla näkyvissä.
4. Jos sinulla on ulkoinen mikrofoni, irrota se kesken äänityksen. Sovellus ei saa jumiutua, ja vanhan repliikin pitää säilyä.

## Kamera

5. Käynnistä kamera ja mikrofoni yhtä aikaa. Hahmon pitää liikkua. Kun suljet toisen, toisen pitää jatkua.
6. Sulje molemmat. Valikkorivin vihreän tai oranssin käyttöilmaisimen pitää sammua.

## VoiceOver ja näppäimistö

7. Käynnistä VoiceOver (⌘F5). Liiku työvaihepainikkeissa. VoiceOverin pitää kertoa vaiheen nimi ja mikä vaihe on valittuna.
8. Avaa toimintohaku (⌘K), kirjoita "vie" ja liiku nuolilla. Paina Esc. Kohdistuksen pitää palata siihen, mistä avasit haun.
9. Avaa Projekti → Asetukset. Paina Tab useita kertoja. Kohdistus ei saa siirtyä ikkunan taakse. Esc sulkee ikkunan ja palauttaa kohdistuksen Projekti-valikkoon.
10. Aloita äänitys pelkällä näppäimistöllä (Tab ja välilyönti). VoiceOverin pitää lukea "Lopeta ja käytä repliikki" kerran. Sekuntimäärän ei pidä toistua puheena jatkuvasti.
11. Lopeta äänitys välilyönnillä. VoiceOverin pitää ilmoittaa, että ääni liitettiin repliikkiin, ja kohdistuksen pitää jäädä äänityspainikkeeseen.
12. Tallenna (⌘S), kumoa (⌘Z) ja tee uudelleen (⇧⌘Z) näppäimillä. Jokaisen onnistumisen tai virheen pitää kuulua tai näkyä tekstinä, ei pelkkänä värinä.

Lähetä tulokset tähän ketjuun tai kirjaa ne TIIMI.md:hen. Jos jokin kohta epäonnistuu, kerro mitä odotit ja mitä tapahtui. Korjaus tehdään erillisessä työhaarassa ja kohta testataan uudelleen.
