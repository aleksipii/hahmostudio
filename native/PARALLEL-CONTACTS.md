# Päällekkäinen ajoitus ja esinekontaktit

## Ajoitus

`[at 1s]` samalla rivillä määrää absoluuttisen aloitusajan sekunteina.
Ilman sitä rivi alkaa edellisten rivien viimeisen päättymisen jälkeen.
Puheen todellinen kesto voi pidentää riviä; puhetta ei nopeuteta.
Eri nimetyt hahmot voivat puhua ja liikkua samanaikaisesti. Saman hahmon
päällekkäiset rivit, nimettömät päällekkäisyydet ja 60 sekunnin ylitys estävät viennin.
Inspectorin aloitusaikasäädin kirjoittaa saman ohjeen hyväksyttäväksi luonnokseen.
Aikajana näyttää hahmokohtaiset puhe- ja liikeradat; vapaa raitojen raahaus ei sisälly tähän.

Kamera on yhteinen. Samanaikaiset kirjoitetut kameraohjeet ovat ristiriita.
Kirjoitettu kuvakulma voittaa automaattisen ehdotuksen. Muuten yhtäaikaiset
hahmot saavat yhteisen kuvakulman. MP4:n tekstitys yhdistää päällekkäiset
repliikit puhujanimineen yhteen ajoitettuun tekstipakettiin. Projektin alkuperäisiä
repliikkejä tai niiden ajoituksia ei muuteta.

Esimerkki: [parallel-dialogue.en.txt](examples/parallel-dialogue.en.txt).

## Esineen nosto ja luovutus

```text
[background living room]
[camera two shot]
[object cup mug on stand at -0.25 1.22 0.20]
KALLE: [pick up cup 2s]
MAIJA: [at 0s] [wait 6s]
KALLE: [at 2s] [give cup to Maija 2s]
```

`cup` on yksilöllinen tunniste, `mug` tuettu esinemalli ja koordinaatit ovat
esinespesifisen tartuntapisteen metrejä maailman koordinaatistossa.
Valinnainen `on stand` lisää esineen alle geometrisesti mitoitetun tuen.
Ilman sitä tukea ei arvata. Enintään 16 esinettä; tunnisteessa ASCII-kirjaimet,
numerot tai alaviiva, pituus 1–32. Koordinaatit ovat äärellisiä, enintään
±5 metriä ja korkeus vähintään 0.1 metriä.

Nosto ja luovutus kestävät 1–20 sekuntia. Nosto valitsee lähimmän vapaan
käden, lähestyy esinettä ylhäältä, tarttuu 45 prosentin kohdalla ja nostaa
12 cm. Luovutus siirtää omistajuuden puolivälissä ja vapauttaa antajan käden.
Vastaanottajan pitää olla käsikirjoituksen nimetty hahmo. Esineen on oltava
olemassa ja antajan omistuksessa; toiminnan osapuolet pysyvät paikallaan
kontaktin aikana. Odotus ja pienet pään liikkeet ovat sallittuja.

Puuttuva esine, tavoittamaton ote, varattu käsi, väärä omistaja tai ristiriitainen
liike estää tuotannon. Tarkistus käyttää nykyisten hahmojen luurankoja ja
käsi-IK:ta, mittaa täyden otteen virheen (enintään 2 mm) sekä tarkistaa otteen
jokaisessa renderöidyssä ruudussa. Esinemallit ja tukigeometria välimuistitetaan.
Inspectorissa voi valita tunnetun esineen, vastaanottajan ja kontaktin keston.

Käsikirjoitus tallentuu `.koeta`-projektiin; kontaktit rakennetaan uudelleen
projektin omista hahmoista avaamisen jälkeen. Tämä ei ole jäykkien kappaleiden
fysiikkasimulaatio eikä yleinen sormien tai vartaloiden törmäysratkaisin.
Ovet, pudottaminen, portaat ja mielivaltaisten ulkoisten luurankojen retargetointi
ovat edelleen avoinna. Tarkista kuva, kädet ja ajoitus esikatselusta.

Linux-testit kattavat kontaktigeometrian, omistajuuden, ristiriidat,
tallennuksen ja uudelleenavauksen. TestEngine on simuloitu puhe; se ei todista
Kokoron laatua, kuuntelua tai Mac-laitteiden toimintaa.
