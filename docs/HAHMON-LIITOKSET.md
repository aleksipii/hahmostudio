# Hahmon liitokset: Mr.Kille ja Mr.Handu

Korjaus 4.10.2026. Kädet ovat vartalon lapsia olkapään nivelpisteellä. Housut muodostavat lantion: ROOT → TORSO → PANTS → LEG_LEFT/LEG_RIGHT. HEAD_GROUP on TORSOn lapsi, ja suu sekä silmät ovat pään lapsia. Käsiin ei lisätty uusia sormia eikä vanhoja hahmoja poistettu.

## Nivelpisteet (400 × 600 -dokumentti)

- Vartalo: 200, 430 (lantion yläosa).
- Lantio/housut: 200, 445.
- Vasemmalla kuvassa oleva olkapää: 110, 290.
- Oikealla kuvassa oleva olkapää: 290, 290.
- Jalkojen lonkat: 150, 445 ja 250, 445.
- Pään nivel: 200, 244 (kaula). Pään yläreuna ei sovellu tavallisen kaulakäännöksen kiertokeskukseksi.

Piirtojärjestys ja nivelten vanhempisuhteet ovat eri asioita. Raajat säilyttävät tasotunnisteensa ja alkuperäiset PSD-ID:t. Olkavarren pyöreä yläosa ulottuu vartalon sisälle, joten kierto ei avaa olkapäähän rakoa. Housunlahkeen yläreunan erillinen ääriviiva poistettiin.

## Avaaminen

Avaa korjattu Mr.Kille.hahmo tai Mr.Handu.hahmo kohdasta Tiedosto → Avaa projekti. .hahmo sisältää kuvat, liitokset, nivelpisteet ja suusidokset. Tallenna uudella nimellä, jotta vanha projektisi säilyy. Tämä ei päivitä jo avatun projektin hahmoja automaattisesti.

PSD sisältää korjatun ryhmähierarkian, mutta PSD-tuonti ei automaattisesti siirrä SVG/JSON-luustoa. PSD:tä varten mukana on vastaava .editor-rig.json: tuo se Hahmo-työtilan nivelmäärityksen nykyisellä JSON-tuonnilla. .hahmo on helpoin valmis vaihtoehto.

## Tarkistukset

175 kooditestiä, tyyppitarkistus ja yksityisen version build läpäisivät. Uusi regressiotesti avaa molemmat .hahmo-tiedostot ja tarkistaa vartalon siirron/kierron periytymisen housuihin, jalkoihin, käsiin ja päähän sekä olkapään pysymisen paikallaan käsivarren kierrossa. PSD ja .hahmo rakennettiin uudelleen ja .hahmo avattiin takaisin. Kolmen asennon kuva tarkistettiin paikallisesta SVG-renderistä; selainta tai fyysisiä laitteita ei testattu.

Mac-sovelluspakettia ei tässä korjauksessa rakennettu uudelleen. Korjattu .hahmo avautuu aiemmassa 0.12-sovelluksessa. Vanha esimerkkivideo ja projektit ovat alkuperäisessä muodossaan.
