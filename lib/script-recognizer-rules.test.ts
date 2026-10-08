import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {recognizeScript,explainUnknownLine,type RecognizedLine} from './script-recognizer.ts';
import {parseRecognizerCorpus,evaluateRecognizerCorpus,existingScripts,lineSignature} from './script-recognizer-corpus.ts';

const corpusText=readFileSync(new URL('../tests/fixtures/script-recognizer/korpus.txt',import.meta.url),'utf8');
const corpus=parseRecognizerCorpus(corpusText);
const sig=(script:string,line:number,characters:string[]=[])=>lineSignature(recognizeScript(script,characters,{discoverActors:true}).lines[line-1]);

test('korpus: nolla väärää tulkintaa ja jokaisella rivillä käsin kirjattu odotus',()=>{
 const r=evaluateRecognizerCorpus(corpus);
 assert.deepEqual(r.missingExpectations,[]);
 assert.deepEqual(r.results.filter(x=>x.verdict==='väärin').map(x=>`${x.case} r${x.line}: odotus ${x.expected} / saatiin ${x.actual}`),[]);
 assert.ok(corpus.length>=34&&r.results.length>=215,'korpus ei kutistu');
 assert.ok(r.counts.oikein>=214,`oikein ${r.counts.oikein}`);
});

/* ───────── Sääntökohtaiset testit: jokaisella nimetyllä säännöllä sopiva ja ei-sopiva tapaus (docs/KASIKIRJOITUSSAANNOT.md) ───────── */
type Row=[rule:string,script:string,line:number,expected:string];
const S='INT. PIHA\n';
const rules:Row[]=[
 ['kohtausotsikko',S,1,'scene-heading scene:PIHA/int'],['kohtausotsikko','Interiööri on kaunis.',1,'comment'],
 ['kohtausnimi','Kohtaus 2: Koulu',1,'scene-heading scene:Koulu'],['kohtausnimi','Kohtaus oli hyvä.',1,'comment'],
 ['aikakoodi','0:00–0:05 — Alku',1,'timecode scene:Alku'],['aikakoodi','Kello 0:05 alkaa.',1,'comment'],
 ['siirtymä',S+'FADE OUT.',2,'transition transition:fade-out'],['siirtymä',S+'Fade out slowly please',2,'unknown'],
 ['metatieto','Pituus: 30 s',1,'metadata meta:duration'],['metatieto','Pituudesta: ei',1,'comment'],
 ['markdown-otsikko','# Jakso 1\n# Toinen',1,'metadata meta:title'],['markdown-otsikko','# Jakso 1\n# Toinen',2,'comment'],
 ['kommentti',S+'// huom',2,'comment'],['kommentti',S+'/ ei kommentti',2,'unknown'],
 ['hahmomääritys','Hahmo: Pipsa',1,'character-decl @PIPSA'],['hahmomääritys','Hahmoja: kaksi',1,'comment'],
 ['puhuja-isot-kirjaimet',S+'PIPSA\nHei.',2,'cue @PIPSA'],['puhuja-isot-kirjaimet',S+'PIPSA\n\nHei.',2,'unknown'],
 ['puhuja-kaksoispiste',S+'PIPSA: Hei.',2,'dialogue @PIPSA «Hei.»'],['puhuja-kaksoispiste',S+'Huomenna: sataa.',2,'unknown'],
 ['puhuja-kaksoispiste-rivi',S+'VILLE:\nMoi.',2,'cue @VILLE'],['puhuja-kaksoispiste-rivi',S+'Huomenna:\nMoi.',2,'direction note'],
 ['sulkeohje',S+'PIPSA\n(hymyilee)\nHei.',3,'parenthetical @PIPSA expression:happy@PIPSA'],['sulkeohje',S+'PIPSA\n(hymyilee\nHei.',3,'dialogue @PIPSA «(hymyilee»'],
 ['repliikki-puhujan-jälkeen',S+'PIPSA\nIstu alas!',3,'dialogue @PIPSA «Istu alas!»'],['repliikki-puhujan-jälkeen',S+'PIPSA\n\nIstu alas!',4,'unknown'],
 ['repliikki-vai-ohje',S+'PIPSA\nPipsa vilkuttaa.',3,'unknown'],['repliikki-vai-ohje',S+'PIPSA\nPipsa on kiva.',3,'dialogue @PIPSA «Pipsa on kiva.»'],
 ['sanoo-repliikki','Hahmo: Pipsa\nHahmo: Ville\n'+S+'Pipsa sanoo Villelle: "Tule." 2 s',4,'dialogue @PIPSA «Tule.»'],['sanoo-repliikki',S+'Pipsalle Ville sanoo: "Tule."',2,'unknown'],
 ['ajatusviivarepliikki',S+'– Hei! Pipsa sanoo.',2,'dialogue @PIPSA «Hei!»'],['ajatusviivarepliikki',S+'– Hei!',2,'unknown'],
 ['kuva','Hahmo: Pipsa\n'+S+'LÄHIKUVA PIPSA',3,'shot shot:close>PIPSA'],['kuva',S+'Pipsa takes a cu of coffee',2,'unknown'],
 ['kuva-kaksoispiste-toiminta','Hahmo: Niko\n'+S+'Tracking shot: Niko walks forward.',3,'shot shot:tracking>NIKO motion:walk-front@NIKO?'],['kuva-kaksoispiste-toiminta','Hahmo: Niko\n'+S+'CUT TO: NIKO MEDIUM',3,'shot shot:medium>NIKO'],
 ['tekijä','Hahmo: Pipsa\n'+S+'Pipsa hyppää.',3,'direction motion:jump@PIPSA?'],['tekijä','Hahmo: Pipsa\n'+S+'Pipsan kissa hyppää.',3,'unknown'],
 ['tekijä-omistus','Hahmo: Pipsa\n'+S+'Pipsalla on puhelin kädessä.',3,'direction phone:phone_hold@PIPSA'],['tekijä-omistus','Hahmo: Pipsa\n'+S+'Pipsalle tulee puhelin.',3,'unknown'],
 ['tekijä-jatkuu','Hahmo: Pipsa\n'+S+'Pipsa hymyilee.\nKatsoo kameraan.',4,'direction gaze@PIPSA>camera'],['tekijä-jatkuu','Hahmo: Pipsa\n'+S+'Pipsan kissa hymyilee.\nKatsoo kameraan.',4,'unknown'],
 ['pronomini','Hahmo: Pipsa\n'+S+'Pipsa hymyilee.\nHän istuu.',4,'direction motion:sit@PIPSA?'],['pronomini','Hahmo: Pipsa\n'+S+'Pipsa hymyilee.\nINT. TALO\nHän istuu.',5,'unknown'],
 ['yhteinen-tekijä','Hahmo: Pipsa\nHahmo: Ville\n'+S+'Pipsa ja Ville hyppäävät.',4,'direction motion:jump@PIPSA? motion:jump@VILLE?'],['yhteinen-tekijä','Hahmo: Pipsa\n'+S+'Pipsa ja kissa hyppäävät.',3,'unknown'],
 ['pilkku-uusi-tekijä','Hahmo: Pipsa\nHahmo: Ville\n'+S+'Pipsa juoksee, Ville kävelee.',4,'direction motion:run-right@PIPSA? motion:walk-right@VILLE?'],['pilkku-uusi-tekijä','Hahmo: Niko\n'+S+'Niko walks left, two seconds.',3,'direction motion:walk-left@NIKO~2'],
 ['yksi-liike-per-lause','Hahmo: Pipsa\n'+S+'Pipsa hyppää juoksee.',3,'unknown'],['yksi-liike-per-lause','Hahmo: Pipsa\n'+S+'Pipsa puristaa nyrkkinsä.',3,'direction motion:fist@PIPSA?'],
 ['kielto','Hahmo: Pipsa\n'+S+'Pipsa ei enää ikinä juokse.',3,'unknown'],['kielto','Hahmo: Pipsa\n'+S+'Pipsa ei juokse vaan hyppää.',3,'direction motion:jump@PIPSA?'],
 ['liike-suunta','Hahmo: Pipsa\n'+S+'Pipsa kävelee vasemmalle 2 s.',3,'direction motion:walk-left@PIPSA~2'],['liike-suunta','Hahmo: Pipsa\n'+S+'Pipsa kävelee.',3,'direction motion:walk-right@PIPSA?'],
 ['ilme','Hahmo: Pipsa\n'+S+'Pipsa on surullinen.',3,'direction expression:sad@PIPSA'],['ilme','Hahmo: Pipsa\n'+S+'Pipsa on väsynyt.',3,'unknown'],
 ['katse','Hahmo: Pipsa\nHahmo: Ville\n'+S+'Pipsa katsoo Villeä.',4,'direction gaze@PIPSA>VILLE'],['katse','Hahmo: Pipsa\nHahmo: Ville\n'+S+'Pipsa katsoo villeä.',4,'unknown'],
 ['puhelin','Hahmo: Pipsa\n'+S+'Pipsa napauttaa puhelinta.',3,'direction phone:phone_tap@PIPSA'],['puhelin','Hahmo: Pipsa\n'+S+'Pipsan puhelin soi.',3,'unknown'],
 ['tauko',S+'Pieni tauko.',2,'direction hold:pause@scene~0.5'],['tauko',S+'Tauon jälkeen.',2,'unknown'],
 ['hiljaisuus',S+'Pidä 0,7 sekuntia hiljaisuutta.',2,'direction hold:silence@scene~0.7'],['hiljaisuus',S+'Pidä 0,7 sekuntia.',2,'direction hold:pause@scene~0.7'],
 ['rajoitus',S+'Älä liikuta kameraa.',2,'direction constraint:camera-still@scene'],['rajoitus',S+'Kamera on uusi.',2,'unknown'],
 ['tausta',S+'Tausta: keittiö 2 seconds',2,'direction environment:keittiö'],['tausta',S+'Taustalla keittiö.',2,'unknown'],
 ['otsikkokortti',S+'Otsikkokortti: Loppu 2 s',2,'direction title-card:Loppu~2'],['otsikkokortti',S+'Otsikko näkyy.',2,'unknown'],
 ['luettelomerkki','Hahmo: Pipsa\n'+S+'1. Pipsa hyppää.',3,'direction motion:jump@PIPSA?'],['luettelomerkki','Hahmo: Pipsa\n'+S+'Kohdat 1. ja 2.',3,'unknown'],
 ['johdanto','Tämä on johdanto.\n'+S,1,'comment'],['johdanto',S+'Tämä on johdanto.',2,'unknown'],
];
for(const [rule,script,line,expected] of rules)test(`sääntö ${rule}: ${JSON.stringify(script.split('\n')[line-1])}`,()=>assert.equal(sig(script,line),expected));

test('jokaisella dokumentoidulla säännöllä on sopiva ja ei-sopiva testi',()=>{
 const doc=readFileSync(new URL('../docs/KASIKIRJOITUSSAANNOT.md',import.meta.url),'utf8');
 const named=[...doc.matchAll(/^### `([^`]+)`/gm)].map(m=>m[1]);
 assert.ok(named.length>=30,'säännöt dokumentoitu');
 for(const name of named){const rows=rules.filter(r=>r[0]===name);assert.ok(rows.length>=2,`säännöllä ${name} ei ole kahta testiä`);}
 for(const r of rules)assert.ok(named.includes(r[0]),`testin sääntö ${r[0]} puuttuu dokumentista`);
});

/* ───────── Ominaisuustestit: pätevät mille tahansa syötteelle ───────── */
const seeded=(seed:number)=>()=>{seed=(seed*1103515245+12345)&0x7fffffff;return seed/0x7fffffff;};
const pieces=['PIPSA','Pipsa','Villen','VILLE:','hän','kävelee','juoksee','vasemmalle','2 s','"','“','”','»','(',')',':',' ','  ','\t','\n','\n\n','\r\n','\r','.','!','?','–','—','-','#','# ','//','/*','*/','[[',']]','INT.','EXT.','0:05–0:08','LÄHIKUVA','CUT TO:','ei','ja','😀','ä','ö','Å','1.','*','Hahmo:','Tausta:','sanoo','says','Kohtaus:','\u0000','﻿','𝔸','ﬁ','İ','x'.repeat(50)];
const randomScript=(rand:()=>number,n:number)=>Array.from({length:n},()=>pieces[Math.floor(rand()*pieces.length)]).join(rand()<.5?' ':'');
const inputLines=(text:string)=>text.replace(/\r\n?/g,'\n').split('\n');

const samples=():string[]=>{const rand=seeded(20261008);return [...existingScripts().map(s=>s.text),...corpus.map(c=>c.script),...Array.from({length:300},(_,i)=>randomScript(rand,5+i%80))];};

test('ominaisuus: sama syöte kahdesti antaa täsmälleen saman tuloksen',()=>{
 for(const text of samples()){const a=JSON.stringify(recognizeScript(text,['Pipsa'],{discoverActors:true})),b=JSON.stringify(recognizeScript(text,['Pipsa'],{discoverActors:true}));assert.equal(a,b);}
});

test('ominaisuus: jokainen syötteen rivi löytyy tuloksesta tunnistettuna tai tunnistamattomana, sellaisenaan',()=>{
 for(const text of samples()){
  const lines=inputLines(text),r=recognizeScript(text,[],{discoverActors:true});
  assert.equal(r.lines.length,lines.length);
  r.lines.forEach((l:RecognizedLine,i)=>{
   assert.equal(l.line,i+1);assert.equal(l.raw,lines[i],'raakateksti säilyy muuttamattomana');
   assert.equal(l.kind==='empty',!lines[i].trim()||cleanEmpty(lines[i]),`rivi ${i+1}`);
   if(l.kind==='unknown'){assert.ok(l.reason,'tunnistamattomalla rivillä on syy');assert.ok(explainUnknownLine(l).includes(`Rivi ${l.line}`));}
  });
  assert.equal(r.stats.content,r.lines.filter(l=>l.kind!=='empty').length);
  assert.equal(r.stats.recognized+r.stats.unknown,r.stats.content);
 }
});
// Rivi, joka on pelkkää markdown-korostusta ("**", "# "), siistiytyy tyhjäksi.
function cleanEmpty(line:string){return /^\s*(#{1,6}\s*|\*\*|__|>\s?|\\)*\s*$/.test(line);}

test('ominaisuus: mielivaltainen ja rikkinäinen syöte ei kaada tulkintaa',()=>{
 const rand=seeded(7);
 for(let i=0;i<500;i++){const text=randomScript(rand,1+Math.floor(rand()*120));assert.doesNotThrow(()=>recognizeScript(text,['Pipsa','Ville'],{discoverActors:true}),JSON.stringify(text));}
 for(const text of ['','\n\n\n','\u0000\u0001\u0002',String.fromCharCode(...Array.from({length:2000},(_,i)=>i%0xd7ff+1)),'"'.repeat(5000),'('.repeat(3000)+')'.repeat(3000),'Pipsa '.repeat(4000)+'kävelee','A'.repeat(20000)+':',':'.repeat(10000)])
  assert.doesNotThrow(()=>recognizeScript(text,[],{discoverActors:true}));
});

test('ominaisuus: pitkä käsikirjoitus tulkitaan kohtuullisessa ajassa',()=>{
 const block=corpus.map(c=>c.script).join('\n\n');
 const text=Array.from({length:Math.ceil(20000/block.split('\n').length)},()=>block).join('\n\n');
 const t0=performance.now();const r=recognizeScript(text,[],{discoverActors:true});const ms=performance.now()-t0;
 assert.ok(r.lines.length>=20000);assert.ok(ms<15000,`${r.lines.length} riviä ${Math.round(ms)} ms`);
 const longLine='Pipsa kävelee '+'hyvin '.repeat(20000)+'vasemmalle.';const t1=performance.now();recognizeScript(longLine,['Pipsa']);assert.ok(performance.now()-t1<5000,'pitkä rivi');
});

test('ominaisuus: rivinvaihto (LF, CRLF, CR) ei muuta tulkintaa',()=>{
 for(const c of corpus){const lf=recognizeScript(c.script,c.characters,{discoverActors:true}).lines.map(lineSignature);
  for(const eol of ['\r\n','\r'])assert.deepEqual(recognizeScript(c.script.replace(/\n/g,eol),c.characters,{discoverActors:true}).lines.map(lineSignature),lf,c.name);}
});

test('tunnistamaton rivi näyttää rivin, sijainnin, syyn ja ymmärretyn muodon suomeksi',()=>{
 const l=recognizeScript('Hahmo: Pipsa\nINT. PIHA\nPipsan kissa hyppää.',[],{discoverActors:true}).lines[2];
 assert.equal(l.kind,'unknown');
 const msg=explainUnknownLine(l);
 assert.match(msg,/^Rivi 3: “Pipsan kissa hyppää\.”/);assert.match(msg,/taipunut muoto/);assert.match(msg,/Sovellus ymmärtää muodon: .*esim\./);
 const amb=recognizeScript('INT. PIHA\nPIPSA\nPipsa vilkuttaa.',[],{discoverActors:true}).lines[2];
 assert.match(explainUnknownLine(amb),/Moniselitteinen/);
});

test('ei keksittyjä hahmoja: pronominit, taivutusmuodot ja puhutteluyhdistelmät eivät ole hahmoja',()=>{
 const r=recognizeScript('INT. PIHA\nPIPSA: "Hei."\nHän sanoo: "Moi."\nShe says: "Hi."\nPipsan katse kääntyy.\nVillelle tulee nälkä.\nVILLE: "No."\nPipsalle Ville sanoo: "Ei."\nPipsa sanoo Villelle: "Joo."',[],{discoverActors:true});
 assert.deepEqual(r.characters,['PIPSA','VILLE']);
});
