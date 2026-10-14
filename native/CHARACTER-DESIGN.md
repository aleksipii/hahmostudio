# Koetan alkuperäinen hahmoperhe

Kalle, Maija, Eetu ja Ronja käyttävät lämmintä, tyyliteltyä 3D-muotokieltä:
yhtenäinen vaatteen runko, pään pintaa seuraavat hiukset, selkeät iirikset ja
pupillit sekä pienet valopisteet. Vaatepaletti yhdistää luonnonvalkoisen,
petroolin, korallin ja mustikan sävyt. Ronjan poninhäntä näkyy ilman lippalakkia.

Hahmot generoidaan Rustissa olemassa olevaan luurankoon. Geometria rakennetaan
hahmon luomisen tai ulkonäkömuutoksen yhteydessä; sitä ei luoda uudelleen
jokaisessa animaatioruudussa. Uusia mallipainoja tai riippuvuuksia ei tarvita.
Hahmon mittasuhteet, käsi-/jalkakontaktien kiinnityspisteet ja suun luusidonnat
säilyvät. Uudet oletusvärit koskevat uusia hahmoja; projektin tallennetut värit
ja ulkonäköparametrit luetaan edelleen sellaisinaan. Uusi geometria näkyy myös
vanhoilla parametreilla rakennetuissa hahmoissa.

Ulkonäkö tarkistetaan todellisista renderöinneistä, ei pelkästä konseptikuvasta.
Kehittäjän katselmuskuva näyttää vasemmalta Kallen, Maijan, Eetun ja Ronjan.
Riveillä näkyvät koko hahmo, kasvot edestä, kasvot viistosta ja iloinen ilme:

```sh
cd native
cargo run --locked -p hs-agents --example character_gallery -- /tmp/family.png
```

Integraatiotestit tarkistavat deformoidut kärkipisteet, luusidonnat,
CPU-lähikuvat kolmesta suunnasta ja näkyvän suun muutoksen visemeillä.
Ne eivät yksin todista esteettistä laatua. Silmät ja kulmakarvat ovat yhä
pään mukana liikkuvaa geometriaa; erillinen katse-/luomi-/kulmakarvariigi ja
kasvojen laajempi näyttely ovat jatkotyötä. Parametrinen perhe ei korvaa
käsin veistettyä tuotantohahmoa tai studiotason kasvonpiirteiden ohjausta.
