/**
 * Aloituspohjat (Rakenna jakso): lyhyitä, heti rakennettavia käsikirjoituksia vapaalla sääntöpohjaisella kielellä.
 * Pohjat käyttävät vain tunnistimen kanonisia lauseita (docs/KASIKIRJOITUS-KIELIOPPI.md), joten ne rakentuvat ilman
 * tunnistamattomia rivejä. Repliikit ovat esimerkkejä, jotka käyttäjä korvaa omillaan: ohjelma ei keksi repliikkejä.
 * Hahmot ovat Mira ja Niko; roolitus valitsee kirjaston hahmot (tai `Resurssi hahmo`-rivi vaihtaa ne).
 */
/** `approxSeconds`: rakennuksen arvio ilman repliikkiääniä (tekstiajoitus); oikea kesto määräytyy äänistä ja venyy tyypillisesti 2–4 s per repliikki. */
export type EpisodeTemplate={id:string;name:string;description:string;language:'fi'|'en';approxSeconds:[number,number];source:string};

export const episodeTemplates:EpisodeTemplate[]=[
 {id:'kokoro-en',name:'Kokoro: englanninkielinen studiokoe',description:'Pipsa ja Ville studiossa. Englanninkieliset repliikit paikalliselle Kokorolle; tuota ja tarkista ääni ennen vientiä.',language:'en',approxSeconds:[4,9],source:`Resource character MIRA: Pipsa
Resource character NIKO: Ville

Episode 1: Studio check
Music: calm

INT. STUDIO
Mira looks at Niko.

MIRA:
“Hello, Ville. Are you ready?”

Niko nods.

NIKO:
“Yes, Pipsa. Let us begin.”

Mira smiles.
Niko looks at camera.
FADE OUT
`},
 {id:'dialogi',name:'Dialogi kahdelle',description:'Kaksi hahmoa kahvilassa: repliikit, katseet ja reaktiot.',language:'fi',approxSeconds:[4,8],source:`Jakso 1: Kahvilassa
Musiikki: rauhallinen

INT. KAHVILA - PÄIVÄ
Mira pitää kahvikuppia.
Niko istuu.

MIRA:
“Ehditkö kuulla yhden jutun?”

Niko katsoo Miraa ja nyökkää.

NIKO:
“Kerro vain.”

LÄHIKUVA MIRA
Mira hymyilee ja katsoo Nikoa.
Niko nostaa kulmiaan.
HÄIVYTYS MUSTAAN
`},
 {id:'uutinen',name:'Uutiskatsaus',description:'Kaksi juontajaa studiossa, otsikkokortti ja siirtymä.',language:'fi',approxSeconds:[7,12],source:`Jakso 1: Päivän uutiset
Musiikki: jännittävä

INT. STUDIO
Otsikkokortti: Päivän uutiset 2 s

MIRA:
“Hyvää iltaa ja tervetuloa uutisiin.”

Mira katsoo kameraan.

NIKO:
“Tänään puhumme yhdestä isosta aiheesta.”

PUOLIKUVA NIKO
Niko katsoo kameraan ja nyökkää.
Mira osoittaa Nikoa.
HÄIVYTYS MUSTAAN
`},
 {id:'tuote',name:'Tuote-esittely',description:'Hahmo esittelee puhelimen ja toinen reagoi.',language:'fi',approxSeconds:[4,8],source:`Jakso 1: Uusi puhelin
Musiikki: iloinen

INT. TOIMISTO
Mira pitää puhelinta.

MIRA:
“Katso, tämä on uusi malli.”

Mira näyttää Nikolle puhelinta.
Niko katsoo puhelinta.
Niko hämmästyy.

LÄHIKUVA NIKO
Niko hymyilee.
Mira katsoo kameraan.
HÄIVYTYS MUSTAAN
`},
 {id:'opetus',name:'Opetusvideo',description:'Opettaja luokkahuoneessa osoittaa taulua ja oppilas kysyy.',language:'fi',approxSeconds:[8,13],source:`Jakso 1: Päivän aihe
Musiikki: rauhallinen

INT. LUOKKAHUONE
Mira odottaa 0,5 s.
Niko istuu.

MIRA:
“Tänään opimme yhden uuden asian.”

Mira osoittaa 1,5 s.
Niko nostaa kulmiaan.

NIKO:
“Voitko näyttää vielä kerran?”

Mira nyökkää.
Mira vilkuttaa 2 s.
HÄIVYTYS MUSTAAN
`},
 {id:'tarina',name:'Pieni tarina',description:'Yllätys puistossa: kävely, hämmästys ja juoksu.',language:'fi',approxSeconds:[9,14],source:`Jakso 1: Yllätys puistossa
Musiikki: jännittävä

EXT. PUISTO - ILTA
Mira kävelee oikealle 3 s.
Niko kävelee vasemmalle 3 s.
Mira pysähtyy.
Niko pysähtyy.
Mira hämmästyy.
Niko näyttää peloissaan.

MIRA:
“Mitä ihmettä tuo oli?”

LÄHIKUVA NIKO
Niko katsoo Miraa.
Niko juoksee oikealle 2 s.
HÄIVYTYS MUSTAAN
`},
 {id:'puhelu',name:'Puhelinsoitto',description:'Puhelin soi, hahmo vastaa ja laskee puhelimen pöydälle.',language:'fi',approxSeconds:[3,7],source:`Resurssi esine: pöytä

Jakso 1: Puhelu
Musiikki: rauhallinen

INT. OLOHUONE
Mira seisoo puhelin kädessä.
Puhelin soi.
Mira katsoo puhelinta.
Mira nostaa puhelimen korvalle.

MIRA:
“Hei, kuulen sinut.”

Mira hymyilee.
Mira laskee puhelimen pöydälle.
HÄIVYTYS MUSTAAN
`},
 {id:'chat-en',name:'English chat (Kokoro)',description:'Two characters, English lines: the voices can be generated locally with Kokoro on the Mac app.',language:'en',approxSeconds:[5,10],source:`Episode 1: Quick chat
Music: calm

INT. CAFE - DAY
Mira holds a coffee cup.
Niko sits.

MIRA:
“Did you see the news today?”

Niko looks at Mira and nods.

NIKO:
“Not yet. What happened?”

CLOSE-UP MIRA
Mira smiles and looks at Niko.
FADE OUT
`},
];
export const episodeTemplate=(id:string)=>episodeTemplates.find(t=>t.id===id);
