# Arkkitehti / sääntömoottori — 8.10.2026

Nykyinen vaihe: rajattu englanninkielinen Kokoro-esimerkki toteutettu ja kooditesteillä varmennettu. Pohjarevisio `d356ad6e7d1ae043d68cb74a3c1bf0143f91d667`; tämän kierroksen muutokset ovat työkopiossa tämän revision päällä. Käyttäjän uusi englanninkielinen vaatimus täydentää promptin suomenkielistä pilottia.

## Koodista todettu

- `lib/episode-builder.ts:60`, `buildEpisode`: rajattu deterministinen rakennuspolku ottaa kirjaston syötteenä; resurssimanifesti luetaan rivillä 80. Repliikkejä ei keksitä esimerkistä.
- `lib/episode-builder.ts:138`, `audioPlan`: puuttuva ääni ja Kokoro-tuotettavuus ovat erillisiä tiloja. Suunnitelma ei ole äänitallenne eikä vientihyväksyntä.
- `lib/kokoro.ts:49`, `isEnglishLine`: olemassa oleva tarkistus tunnistaa ASCII-kirjaimia ja sulkee pois rajatun joukon suomen piirteitä. Se on heuristinen raja, ei yleinen kielentunnistus.
- `lib/episode-templates.ts:11`: uusi `kokoro-en`-aloituspohja käyttää nykyisiä Pipsa/Ville-paketteja eksplisiittisesti. Vanha `chat-en` säilyy. Lähdekäsikirjoitus jaettava myös `public/library/Esimerkki-kokoro-en.md`-tiedostona. Käyttöliittymän nimi/kuvaus säilyvät suomeksi; kaikki käsikirjoituksen rivit ovat englanniksi.
- `lib/kokoro-example.test.ts:11`: sama syöte samoilla nykyisillä resursseilla tuottaa saman esityksen, kummallakin repliikillä on `missing`/`possible`-äänisuunnitelma, puuttuvien äänten lisäksi ei tule olennaisia virheitä tai tuntemattomia rivejä. Esimerkki ja aloituspohja ovat identtiset.

## Ajettu todennus

`node --experimental-strip-types --test lib/kokoro-example.test.ts lib/episode-builder.test.ts`: **16/16 läpäisi**, fail/skip/todo 0. Kesto 23,9 s. Testit lukevat oikeat kirjastopaketit; eivät lataa mallia eivätkä synteettisoi puhetta. Mukana olevat vanhat regressiot todentavat aiemman repliikkiäänen säilymisen uudelleenrakennuksessa sekä tuntemattoman rivin näkyvän käsittelyn. `git diff --check` läpäisi tämän työvaiheen tarkastuksessa.

## Ehdotukset

Seuraava työ on ajaa esimerkki desktopin Kokoro-työnkulussa käyttäjän jo hyväksymällä malliasennuksella. Äänivastuu valitsee/varmentaa molemmat äänet, kuuntelee repliikit ja hyväksyy ajoituksen; QA varmentaa vientituloksen. Mallilatausta ei tarvita tämän esimerkin ohjelmalliseen hyväksyntään. Rajapinta UX:lle on olemassa oleva aloituspohjalista, animaatiolle samat nykyiset Pipsa/Ville-paketit ja äänelle `audioPlan.dialogue` sekä bindingien Kokoro-äänitunnisteet.

## Avoimet kysymykset

- Oikea Kokoro-äänenlaatu, ääneen perustuva kesto ja huulisynkka ovat tässä ajossa todentamatta. Selvitys tehdään oikealla paikallisella synteesillä ja kuuntelulla.
- Hahmojen taiteellinen hyväksyntä, paketoitu sovellus ja lopullinen äänen sisältävä video eivät kuulu tämän rajatun kooditestin näyttöön.

Valmistunut työ: esimerkki, käyttöliittymän aloituspohja ja kohdennettu regressio. Seuraava työ: ääniasiantuntijan kuuntelu ja QA:n tuotantopolku. Jatkotyön arvio 0,25–0,5 henkilötyöpäivää, jos desktop ja hyväksytty Kokoro-malli ovat jo käyttövalmiit; malliasennuksen tai paketoidun sovelluksen korjauksia ei sisälly arvioon.
