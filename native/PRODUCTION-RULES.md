# Koeta: tarkistettava käsikirjoitus → 3D-tuotanto

Säännöt kääntävät tuetut ohjeet toteutettuihin toimintoihin. Ne eivät keksi
hahmoa, liikettä, esinettä tai paikkaa vapaasta tekstistä. Tuntematon tai
ristiriitainen olennainen ohje estää lopullisen viennin; esikatselu ja
projektitallennus säilyttävät keskeneräisen työn.

```text
käsikirjoitus → syntaksitarkistus → hahmot ja resurssit
             → todellinen puheaika → liike ja kamera
             → tuotannon tarkistus → renderöinti → videon dekoodaus/QC
```

## Sopimus

- Nimeä tekijä: `KALLE: [walk left 1s]`. Hahmokohtaisen liikkeen, esineen,
  puhelimen, ilmeen, katseen ja kääntymisen kohdetta ei valita arvaamalla.
- Käytä sarjan määritettyä hahmoprofiilia tai nimettyä valmista hahmoa.
  `JANE:` ei saa toisen hahmon ulkonäköä automaattisesti. Oma Jane-profiili
  voidaan tuoda projektissa tai CLI:n `--hahmot`-asetuksella.
- Puhelin ja `view front/left/right/back` kuuluvat rivin nimetylle hahmolle,
  myös silloin kun tämä ei ole ensimmäinen hahmo. Vanha tapahtuma-JSON ilman
  character-kenttää on luettavissa (legacy lead -semantiikka).
- Samalla rivillä on yksi liike. Päällekkäiset tausta-, kamera-, esine-,
  puhelin-, ilme-, katse- tai suuntaohjeet eivät korvaa toisiaan hiljaa;
  myös odottavat ohjeet tarkistetaan ennen seuraavaa toimintariviä.
  Virheellisen rivin asetukset palautetaan kokonaisuutena.
- Hakasulkujen pitää olla ehjät. Sisäkkäinen, sulkematon tai irrallinen
  sulkeva hakasulku antaa rivivirheen, eikä vuoda repliikiksi.
- Liike käyttää käsikirjoituksen kestoa. Pitkä puhe pidentää kohtausta,
  ei kirjoitettua yhden sekunnin kävelyä/nyökkäystä. Liikkeen päätyttyä hahmo
  voi jatkaa puhumista paikallaan. Kamera ja tekstitykset kattavat puheajan.
- Puhelimen näpyttely tuottaa puhelimen koko puheriville: näpyttely voi loppua
  ennen puhetta, minkä jälkeen hahmo pitää puhelinta hiljaa. Muulla rivillä
  näkyvyys määrätään esimerkiksi `[phone front]` / `[phone hidden]` -tageilla.
- Sivuttaiseen kävelyyn ei yhdistetä ristiriitaista vartalon suuntaa; sivuaskel
  on erillinen vielä toteuttamaton liike. Katsetavoite ei voi olla hahmo itse.
- Puhelin ja toinen kädessä oleva esine eivät voi käyttää samoja käsiä
  samanaikaisesti. Vapauta esine `[prop none]` ennen puhelintoimintoa.
- Esineet ja taustat sidotaan nimettyihin olemassa oleviin 3D-malleihin.
  Uutta mallia ei luoda pelkän tuntemattoman sanan perusteella.
- Kirjoitetut kuvakulmat ja leikkaukset säilyvät, myös lyhyet ja toistuvat.
  Kaksikko / olan yli tarvitsee kaksi eri hahmoa. Insertti tarvitsee nykyisen
  toteutuksen näkyvän puhelimen; muuta inserttikohdetta ei esitetä puhelimena.
- Ilman kuvakulmaohjetta deterministinen kuvaussääntö voi valita otoksen.
  Liikkuvan ryhmän laaja kamera seuraa koko hahmoryhmää. Kirjoitettu
  `view front` ei vaihdu automaattiseksi keskustelukumppaniin kääntymiseksi.
- Puheen kasvattama kokonaiskesto tarkistetaan ennen liikepolkujen/miksauksen
  varaamista: enintään 60 s. Puhetta ei nopeuteta tai leikata tähän rajaan.

## Näe, mitä todella toteutuu

Vienti-välilehden **Toteutuvan animaation tarkistus** näyttää lähderivin,
hahmon, kohtausajan, liikkeen erillisen keston, esineen, puhelimen, taustan,
ilmeen, katseen sekä toteutuneet kuvakoot. Kuvakulmasta näkyy, perustuuko
se kirjoitettuun ohjeeseen vai kuvaussääntöön.

CLI:n koneellisesti luettava suunnitelma:

```sh
cd native
cargo run -p hs-cli -- audit examples/english-directed.txt --no-speech
```

`audit`/`explain` palauttaa JSON:n ja epäonnistuu tuotannon olennaisesta virheestä.
Se tarkistaa syntaksin, nimettyjen hahmojen profiilit ja mitat, malliluettelot,
aikajanan vastaavuuden, yhtenäisen kamera-ajan ja käsien ristiriidat.
Tarkistus ei muuta lähdetekstiä eikä ole valmis videovienti.

Editorin ehdotukset vaihtavat saman kategorian olemassa olevan tagin tai
lisäävät puuttuvan. Ehdotusta ei tarjota, jos se tuo uusia syntaksivirheitä,
esimerkiksi toisen liikkeen tai ristiriitaisen odottavan taustan.
Hyväksyntä ja vanhentuneen esikatselun suojaus ovat edelleen pakollisia.

## Rajat ja laadun hyväksyntä

Sääntöpohjainen ei tarkoita todistettua virheettömyyttä. Tämä on rajatun
animaatiokielen ja toteutettujen resurssien tarkistus, ei yleinen englannin
ymmärtäjä, fysikaalinen törmäyssimulaatio tai kaikille kuvakulmille/ilmeille
ammattitason laatutakuu. Esineen siirto kädestä toiselle, sohvalle istuminen, ovien
avaaminen ja muut vielä toteuttamattomat toiminnot tarvitsevat oikean uuden
animaatiototeutuksen ja testit; niitä ei nimetä olemassa olevaksi liikkeeksi.
Hahmojen/lavasteiden fyysinen kontakti ja lopullinen ilme vaativat katselmoinnin.
Katsetavoite käyttää nykyisiä pään käännön rajoja; tarkkaa silmien kohdistusta
kaikissa asennoissa ei ole toteutettu. Tarvittaessa kirjoita vartalon suunta
erikseen ja tarkista lopputulos.

TestEngine-puhe merkitään tarkistusraportissa simulaatioksi. Se ei täytä aidon
Kokoron synteesin/kuuntelun hyväksyntää. Mac/Metal ja fyysiset laitteet jäävät
laitetestattaviksi. MP4:n tekninen QC ei yksin todista taiteellista laatua.

Esimerkki: [english-directed.txt](examples/english-directed.txt).

## Ensimmäinen tuolikontakti

```text
[background living room]
KALLE: [sit on chair 2s]
KALLE: We can talk here. [wait 2s]
KALLE: [nodding 1s]
KALLE: [stand up 2s]
```

`[sit on chair]` / `[istu tuolille]` pyytää hahmolle yhden oikean 3D-tuolin.
Tuoli mitoitetaan hahmon jalkojen/lantion perusteella ja sijoitetaan ensimmäisen
istumisen seisomapaikan taakse, hahmon suuntaan. Se on näkyvissä ennen istumista ja pysyy paikallaan
nousemisen jälkeen. Tämä on eksplisiittisesti pyydetty vakiotuoli, ei tuntemattoman
lavastekalusteen tunnistus. Jokaisella istuvalla hahmolla on oma tuoli; tuolin
jakamista ei tueta. Tuolia ei liikuteta eikä soviteta automaattisesti muihin
lavastekalusteisiin. Tarkista esikatselusta kalusteiden vapaa tila.

Istuminen ja `[stand up]` / `[nouse tuolilta]` tarvitsevat vähintään yhden sekunnin.
Lantio siirtyy istuimelle taaksepäin ja jalat pysyvät seisomapaikan lattiakohteissa.
Asento vaihtuu pehmeästi, jatkuu puheen/tauon/nyökkäyksen ajan ja käyttää samaa
istuinkorkeutta kuin tuolin verkko. Jalkojen IK pitää nilkat lattiakohteissa.
Nouseminen tarvitsee edeltävän istumisen. Kahdesti istuminen, vartalon kääntö tai
muut liikkeet istuen estetään. Oman tuolin kohdalle ja suuntaan pitää palata ennen
uudelleenistumista; tuoli ei seuraa kävelyä. Lavastetta ei vaihdeta tuolin sisältävän
kohtauksen sisällä. Auto-/puhelinlavasteisiin erillistä tuolia ei hyväksytä.

Kamera kohdistaa istuvan hahmon lähikuvan toteutuneeseen pään korkeuteen.
Kontaktin tila näkyy vientiraportissa. Esimerkki: [english-chair.txt](examples/english-chair.txt).
Tämä laajennus ei vielä toteuta ovia, maailmanesineeseen tarttumista tai esineen
luovutusta; näiden ohjeet pysyvät virheinä. Ei yleistä törmäys- tai kontaktifysiikkaa.
