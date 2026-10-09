# Käsikirjoitustunnistimen testikorpus (testaajalle)

- `korpus.txt`: 36 tapausta, 233 käsin kirjattua odotusta (muoto ja allekirjoitus tiedoston alussa ja `lib/script-recognizer-corpus.ts`:ssä).
- Aja: `node --experimental-strip-types --test lib/script-recognizer-rules.test.ts` (korpus, säännöt, ominaisuustestit).
- `lahtotaso-ennen.txt` / `tulos-jalkeen.txt`: korpuksen tulos ennen ja jälkeen muutosten.
- `olemassa-olevat-*.json`: projektin omien käsikirjoitusten rivitulkinnat ja esitystapahtumat ennen ja jälkeen (taaksepäin yhteensopivuus, erot: docs/KASIKIRJOITUSSAANNOT.md).
- Uusi tapaus: lisää `=== nimi`-lohko, kirjaa jokaisen ei-tyhjän rivin oikea tulkinta käsin (`unknown`, jos oikea tulos on jättää tunnistamatta).
