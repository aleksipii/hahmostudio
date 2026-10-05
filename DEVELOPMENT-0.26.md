# KILSAT Studio 0.26 — kehitystoimet 6–10

Vaiheet 6–10 on rajattu aiemman tuotantoperustan jatkoksi. Tämä toimitus ei tarkoita koko aiemman studiotason roadmapin valmistumista.

## 6. Yhteinen tuotantokomentoraja

executeProductionCommand kokoaa ohjausmuutoksen, repliikkiäänen vaihdon, hyväksynnän/lukituksen, kommentit ja yhden/usean kuvan työjonotiedot. Nykyinen compiler, vaikutustarkistus ja validointi suoritetaan ennen updatea; yksi undo säilyy. PresentationPanelin nämä toiminnot kytkettiin komentorajaan. Parserin uuden luonnoksen muodostus ja koko editorin muut toiminnot eivät vielä käytä sitä.

TransactionHistory omistaa kopiot commit/undo/redo-vaiheissa, joten alkuperäisen olion jälkimuutos ei muuta historiaa. Busy/recording estää myös tuotannon undo/redo-painikkeet.

## 7. Tallentuva komentohistoria ja palautus

StudioMetadata.commandJournal on valinnainen skeema-1-kenttä, enintään 100 merkintää: UUID, komentotyyppi, lähtö-/tulosrevisio ja aikaleima. Virheellinen tyyppi, ID, määrä tai tuleva revisio hylätään. Tiedot roundtrippaavat .hahmo-tallennuksessa ja nykyisissä autosave-vedoksissa. Kumoaminen palauttaa myös komentohistorian.

Tämä on rajattu audit-historia, ei täydellinen write-ahead journal, komentojen payload-arkisto tai inkrementaalinen replay. Nykyiset kaksi tarkistettua palautusvedosta ja erilliset nimetyt muuttumattomat revisiot säilyvät. Uutta takuuta jokaisen näppäinpainalluksen kaatumisturvallisuudesta ei anneta. Historiassa ei ole käyttäjätiliä tai tiimi-identiteettiä.

## 8. Resurssit ja alkuperäisen äänen uudelleenkytkentä

Käsikirjoituksesta jaksoksi → Tuotannon resurssit ja komentohistoria näyttää nykyiset hahmosidokset ja repliikkien ääniresurssit. Hahmon sidosten ja ei-tyhjän paikallisen ääniblobin olemassaolo tarkistetaan. Äänen puuttuessa content-addressed audio-SHA256-viitteelle voi valita alkuperäisen tiedoston. Tavut hashataan ja vain täsmälleen sama sisältö hyväksytään, ei samannimistä eri tiedostoa. Ajoitus, suu, hyväksyntä ja sisältörevisio säilyvät; palautus on yksi kumottava muutos. Async-palautus hylätään, jos malli vaihtui odotuksen aikana.

Legacy-ääniviite ilman SHA-256:ta ohjaa tavalliseen repliikkiäänen vaihtoon. Muuttunut tiedosto kuuluu samaan vaihtotransaktioon; sitä ei hyväksytä alkuperäisenä. Hahmoresurssin puute ohjaa nykyiseen valitse/tuo .hahmo -toimintoon. Ei uutta PSD/rig-autoretargetointia tai levyhakua.

## 9. Revisioon ja resursseihin sidottu hyväksyntä

Komentoraja tarkistaa lähtörevision ja resurssien saatavuuden ennen approve/lock. Tarkistus on konservatiivinen: avoimen valmistelun kaikkien sidottujen hahmojen ja repliikkien resurssien tulee olla saatavilla. Puuttuva resurssi estää transaktion muuttamatta hyväksyntää/historiaa. Undo/unlock eivät edellytä resurssien korjaamista.

Saatavilla ei todista äänen dekoodausta, laatua tai rig-anatomiaa. .hahmo-manifesti ja render-preflight pysyvät varsinaisen vientivedoksen tiedostotarkistuksina. Renderer, hyväksynnän vaikutusvertailu ja vientiversiosopimus säilyvät.

## 10. Hyväksymistestit ja toimitus

Testit kattavat kaikkien komentotyyppien reitin, historiarajat ja skeeman, tallennus/avaus, puuttuvan resurssin hyväksyntäeston, SHA-256-palautuksen, väärän tiedoston hylkäyksen, alkuperäisen äänen ajoituksen/hyväksynnän säilymisen ja palautuksen undo/redo-toiminnot sekä historian kopiosuojan. Aiempi integroitu tuotantopolku ja 500 rivin datatesti säilyvät.

Kooditestit eivät ole graafinen editori-, Safari- tai fyysinen kamera/mikrofonitesti. Mac-paketointi ja paketoidun runtimen testit raportoidaan erikseen. Koko ammattistudio, kattava komentojournal/replay, kaikkien editorimuutosten komennot ja yleinen resurssirelink ovat vielä kesken.

Asennus: sulje vanha KILSAT Studio, pura Mac-ZIP ja korvaa Ohjelmat-kansion app. Tarkistusraportti: Kooditestit-0.26.0.md.
