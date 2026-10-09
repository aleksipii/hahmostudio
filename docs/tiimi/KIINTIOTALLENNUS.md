# 10% käyttökiintiön tallennussääntö

Käyttäjän ohje 9.10.2026: kun jäljellä on 10 % tai vähemmän, tee commit ja push mainiin sekä hahmostudio1.0-haaraan. Tämä on pysyvä valtuutus Hahmostudio-projektin Git-tallennukselle.

## Havaitseminen

Aja `node scripts/codex-quota-status.mjs` pitkän työn alussa, ennen suurta vaihetta ja vaiheen jälkeen. Lukija käyttää virallista Codex app-server-rajapintaa `account/rateLimits/read`. Se ei käynnistä mallia, lue tokenia tulosteeseen tai muuta Git-repoa. `checkpointRecommended` koskee oletuksena primary-ikkunaa, jonka pituus on 300 minuuttia. `--any-window` näyttää myös viikkokiintiön laukaisijana, jos käyttäjä valitsee sen. `available:false` ei tarkoita kiintiön loppumista.

Tämän tilin mittari raportoi tarkastuksessa 300minuutin primary-ikkunan ja 10080minuutin weekly-ikkunan; erillistä 24tunnin päiväkiintiötä ei saatu. Käyttäjä vahvisti nimenomaisesti 9.10.2026, että raja tarkoittaa 10 % jäljellä 5 tunnin kiintiössä. Eri mittaikkunaa ei käytetä sen korvikkeena. Viimeinen lukuhavainto: 66 % lyhyttä ja 95 % viikkokiintiötä jäljellä, joten 10 %:n toimenpideraja ei ollut lauennut. Tämä havainto ei ole tulevien ajojen mittari.

Lukija ja AGENTS.md:n työvaihekohtainen tarkistus ovat toteutettuja. Erillistä taustamonitoria tai automaattista ajastinta ei ole asennettu. Ohjeet: [OpenAI Docs, app-server rate limits](https://learn.chatgpt.com/docs/app-server#6-rate-limits-chatgpt) ja [kiintiön dashboard/status](https://learn.chatgpt.com/docs/pricing#where-can-i-see-my-current-usage-limits).

## Tallennus

1. Tallenna nykyinen pieni ehjä muutos ja kirjaa tehty/keskeneräinen/todennus sekä jatko TIIMI.md:hen.
2. Commitoi vain tarkoitettu koodi, testit ja dokumentaatio. Säilytä käyttäjän aineisto ja yksityiset tiedostot.
3. Todennettu lähde voidaan päivittää molempiin päähaaroihin. Epäonnistunut tai keskeneräinen lähde tallennetaan työhaaraan ja sen tila kerrotaan; käyttöraja ei oikeuta hävittämään aiempaa toimivaa pääversiota.
4. Hae nykyiset remote-päät, sovita oma testattu työ ja säilytä molempien historia. Ei force-pushia.
5. Yksi atominen push samaan varmistettuun commitiin: `git push --atomic github <sha>:refs/heads/main <sha>:refs/heads/hahmostudio1.0`.
6. Tarkista molempien GitHub-refien SHA. Uutta keskusteluvahvistusta ei kysytä tähän käyttäjän jo valtuuttamaan tallennukseen; ympäristön Git- ja verkkoluvat pysyvät voimassa.

## Tässä tehtävässä

Mainiin ja hahmostudio1.0-haaraan tallennetaan nyt vain haarakartoitus, arkisto ja tämä käytäntö sekä lukija. Aiempi asiantuntijoiden sovellustoteutus säilyy omassa testatussa työhaarassaan. Muita yhdistämättömiä työhaaroja ei yhdistetä eikä poisteta tämän säännön perusteella.
