/**
 * Palikkaeditori (vaihe F): jokainen esitystapahtuma ja äänimerkintä on palikka aikajanalla.
 *
 * Käsikirjoitusteksti on totuuslähde. Palikan muutos kirjoitetaan tekstin vastaavalle riville kanonisena lauseena,
 * jonka sääntötunnistin lukee takaisin täsmälleen samaksi palikaksi (palikka → teksti → palikka). Rivin muut osat ja
 * käyttäjän muotoilu säilyvät, kun muutos koskee vain yhtä lausetta. Jos tekstiä on muokattu palikan lukemisen jälkeen
 * (rivi ei enää vastaa palikan lähdettä), muutosta ei tehdä hiljaa vaan palautetaan ristiriita.
 *
 * Ajoitus on käsikirjoituksen järjestys: palikan siirto aikajanalla siirtää sen rivin toisen palikan kohdalle
 * (napsautus tapahtumien rajoille); `Samalla:` alkaa edellisen repliikin kanssa. Tarkka kesto annetaan sekunteina.
 */
import {recognizeScript,cleanLine,type Clause} from './script-recognizer.ts';
import {sfxNames,type SfxId} from './sound-library.ts';
import {heldProp} from './held-props.ts';
import {environmentLibrary} from './environment-library.ts';
import {backgrounds} from './backgrounds.ts';
import type {Presentation,Event} from './presentation-model.ts';
import {cueTime} from './soundtrack.ts';

export type BlockKind='liike'|'ilme'|'katse'|'esine'|'kamera'|'tausta'|'ääni'|'tauko'|'repliikki'|'siirtymä';
export type Block={id:string;kind:BlockKind;lane:string;start:number;duration:number;value:string;label:string;line:number;lineText:string;params:BlockParams;editable:boolean};
export type BlockParams={direction?:'left'|'right'|'front';seconds?:number;target?:string;prop?:string;size?:string;sound?:string};

export const blockKindNames:Record<BlockKind,string>={liike:'Liike',ilme:'Ilme',katse:'Katse',esine:'Esine',kamera:'Kamera',tausta:'Tausta',ääni:'Ääni',tauko:'Tauko',repliikki:'Repliikki',siirtymä:'Siirtymä'};
const motionVerb:Record<string,string>={wave:'vilkuttaa',point:'osoittaa',fist:'puristaa nyrkkiä',sit:'istuu',jump:'hyppää',crouch:'kyykistyy',nod:'nyökkää','react-nod':'nyökkää','react-surprise':'hämmästyy','react-wave':'vilkuttaa',stop:'pysähtyy',walk:'kävelee',run:'juoksee'};
export const motionNames:Record<string,string>={wave:'Vilkutus',point:'Osoitus',fist:'Nyrkki',sit:'Istuminen',jump:'Hyppy',crouch:'Kyykky',nod:'Nyökkäys','react-nod':'Nyökkäys','react-surprise':'Hämmästys','react-wave':'Vilkutus',stop:'Pysähdys','walk-left':'Kävely ←','walk-right':'Kävely →','walk-front':'Kävely ↓','run-left':'Juoksu ←','run-right':'Juoksu →','run-front':'Juoksu ↓'};
const expressionText:Record<string,string>={happy:'hymyilee',sad:'näyttää surulliselta',angry:'näyttää vihaiselta',worried:'näyttää huolestuneelta',confused:'näyttää hämmentyneeltä',mildly_hurt:'näyttää loukkaantuneelta',scared:'näyttää peloissaan',dead_stare:'tuijottaa ilmeettömänä',eyebrow_raise:'nostaa kulmiaan'};
export const expressionNames:Record<string,string>={happy:'Iloinen',sad:'Surullinen',angry:'Vihainen',worried:'Huolestunut',confused:'Hämmentynyt',mildly_hurt:'Loukkaantunut',scared:'Peloissaan',dead_stare:'Pokerinaama',eyebrow_raise:'Kulmat ylös'};
const phoneText:Record<string,string>={show_phone:'näyttää puhelinta',phone_tap:'napauttaa puhelinta',phone_ear:'nostaa puhelimen korvalle',phone_transfer:'siirtää puhelimen toiseen käteen',phone_down:'laskee puhelimen pöydälle',phone_camera:'näyttää puhelinta kameralle',phone_hold:'pitää puhelinta',phone_look:'katsoo puhelinta'};
const propCase:Record<string,{partitive:string;accusative:string}>={'phone-v1':{partitive:'puhelinta',accusative:'puhelimen'},'mug-prop-v1':{partitive:'kahvikuppia',accusative:'kahvikupin'},'book-prop-v1':{partitive:'kirjaa',accusative:'kirjan'},'bag-prop-v1':{partitive:'laukkua',accusative:'laukun'},'umbrella-prop-v1':{partitive:'sateenvarjoa',accusative:'sateenvarjon'},
 'tablet-prop-v1':{partitive:'tablettia',accusative:'tabletin'},'keys-prop-v1':{partitive:'avaimia',accusative:'avaimet'},'bottle-prop-v1':{partitive:'juomapulloa',accusative:'juomapullon'},'pen-prop-v1':{partitive:'kynää',accusative:'kynän'},'paper-prop-v1':{partitive:'paperia',accusative:'paperin'},'folder-prop-v1':{partitive:'kansiota',accusative:'kansion'},
 'letter-prop-v1':{partitive:'kirjettä',accusative:'kirjeen'},'icecream-prop-v1':{partitive:'jäätelöä',accusative:'jäätelön'},'flower-prop-v1':{partitive:'kukkaa',accusative:'kukan'},'microphone-prop-v1':{partitive:'mikrofonia',accusative:'mikrofonin'},'flashlight-prop-v1':{partitive:'taskulamppua',accusative:'taskulampun'},'ball-prop-v1':{partitive:'palloa',accusative:'pallon'}};
const dirWord={left:'vasemmalle',right:'oikealle',front:'suoraan'} as const;
const secondsText=(s:number)=>(Math.round(s*100)/100).toString().replace('.',',')+' s';
/** Nimi kirjoitusasuun: MIRA → Mira. */
export const displayName=(speaker:string)=>speaker.toLocaleLowerCase('fi-FI').replace(/(^|[\s.-])(\p{L})/gu,(_,a,b)=>a+b.toLocaleUpperCase('fi-FI'));
/** Partitiivi nimelle (katsoo Miraa, Nikoa, Killeä); vokaalisointu takavokaaleista. */
export function partitive(name:string){const n=displayName(name),back=/[aou]/i.test(n),v=back?'a':'ä';return /[aeiouyäö]$/i.test(n)?n+v:n+'i'+v;}

/** Palikka → kanoninen suomenkielinen lause (ilman loppupistettä). */
export function blockSentence(b:Pick<Block,'kind'|'lane'|'value'|'params'>):string{
 const who=displayName(b.lane),dur=b.params.seconds!==undefined?' '+secondsText(b.params.seconds):'';
 switch(b.kind){
  case'liike':{const m=b.value.match(/^(walk|run)-(left|right|front)$/);if(m)return `${who} ${motionVerb[m[1]]} ${dirWord[m[2] as 'left']}${dur}`;if(phoneText[b.value])return `${who} ${phoneText[b.value]}`;return `${who} ${motionVerb[b.value]??b.value}${b.value==='stop'?'':dur}`;}
  case'ilme':return `${who} ${expressionText[b.value]??b.value}`;
  case'katse':return b.value==='camera'?`${who} katsoo kameraan`:b.value==='phone'?`${who} katsoo puhelinta`:`${who} katsoo ${partitive(b.value)}`;
  case'esine':{const [verb,id]=b.value.split(':');if(b.value==='phone-on')return `${who} pitää puhelinta`;if(b.value==='phone-off')return `${who} laittaa puhelimen pois`;const c=propCase[id];return verb==='drop'?`${who} laskee ${c?.accusative??id} pöydälle`:`${who} pitää ${c?.partitive??id}${b.params.direction==='left'?' vasemmassa kädessä':b.params.direction==='right'?' oikeassa kädessä':''}`;}
  case'tauko':return b.lane==='scene'?`Odota${dur||' 0,5 s'}`:`${who} odottaa${dur||' 0,5 s'}`;
  case'kamera':return b.value==='wide'||b.params.target==='scene'?'LAAJA KUVA':`${b.value==='close'?'LÄHIKUVA':'PUOLIKUVA'} ${(b.params.target??b.lane).toLocaleUpperCase('fi-FI')}`;
  case'tausta':return `Tausta: ${environmentLibrary.find(e=>e.id===b.value)?.name??backgrounds.find(x=>x.id===b.value)?.name??b.value}`;
  case'siirtymä':return b.value==='fade-out'?'HÄIVYTYS MUSTAAN':b.value==='fade-in'?'HÄIVYTYS SISÄÄN':b.value==='dissolve'?'RISTIKUVA':'LEIKKAUS';
  case'ääni':return b.params.sound==='music'?`Musiikki: ${b.value}`:`Ääni: ${b.value}`;
  case'repliikki':return `${b.lane}: “${b.value}”`;
 }
}

const kindOf=(e:Event):BlockKind|undefined=>e.kind==='action'?'liike':e.kind==='expression'?'ilme':e.kind==='gaze'?'katse':e.kind==='prop'?'esine':e.kind==='shot'?'kamera':e.kind==='environment'?'tausta':e.kind==='hold'?'tauko':e.kind==='dialogue'?'repliikki':e.kind==='transition'?'siirtymä':undefined;
/** Esityksen palikat aikajärjestyksessä. Arvioidut automaattikuvat ja tehosteet ovat näkyviä mutta johdettuja (ei omaa riviä). */
export function presentationBlocks(p:Presentation):Block[]{
 const lines=p.original.replace(/\r\n?/g,'\n').split('\n'),out:Block[]=[];
 for(const e of p.events){const kind=kindOf(e);if(!kind)continue;const gait=e.value.match(/^(walk|run)-(left|right|front)$/);
  const cap=(t:string)=>t.charAt(0).toLocaleUpperCase('fi-FI')+t.slice(1),label=kind==='liike'?(motionNames[e.value]??(phoneText[e.value]?cap(phoneText[e.value]):e.value)):kind==='ilme'?expressionNames[e.value]??e.value:kind==='katse'?(e.value==='camera'?'Kameraan':e.value==='phone'?'Puhelimeen':'→ '+displayName(e.value)):kind==='esine'?(e.value.startsWith('drop:')?'Laskee ':'Pitää ')+(heldProp(e.value.split(':')[1]??'')?.name??'puhelinta').toLocaleLowerCase('fi-FI'):kind==='kamera'?({wide:'Laaja',medium:'Puolikuva',close:'Lähikuva'}[e.value]??e.value):kind==='tausta'?environmentLibrary.find(x=>x.id===e.value)?.name??e.value:kind==='tauko'?'Tauko':kind==='repliikki'?e.text??'':({'fade-out':'Häivytys mustaan','fade-in':'Häivytys sisään',dissolve:'Ristikuva',cut:'Leikkaus'}[e.value]??e.value);
  const derived=(e.id.startsWith('shot-')&&e.basis==='estimate')||(e.kind==='action'&&e.value==='phone_hold'&&p.events.some(x=>x.kind==='prop'&&x.value==='phone-on'&&x.target===e.target&&x.sourceRef.line===e.sourceRef.line))||(e.kind==='prop'&&e.basis==='estimate');
  out.push({id:e.id,kind,lane:['shot','environment','transition'].includes(e.kind)?(e.kind==='shot'?'kamera':'näyttämö'):e.target,start:e.at??0,duration:e.duration??0,value:kind==='repliikki'?e.text??'':e.value,label,line:e.sourceRef.line,lineText:lines[e.sourceRef.line-1]??e.sourceRef.text,editable:!derived&&e.basis!=='user',
   params:{...(e.seconds!==undefined&&(kind==='liike'||kind==='tauko')&&e.value!=='stop'&&!phoneText[e.value]?{seconds:e.seconds}:{}),...(gait?{direction:gait[2] as 'left'}:{}),...(kind==='katse'?{target:e.value}:{}),...(kind==='esine'&&e.text&&/Hand$/.test(e.text)?{direction:e.text==='leftHand'?'left' as const:'right' as const}:{}),...(kind==='kamera'?{size:e.value,target:e.target}:{})}});}
 for(const c of p.soundCues??[]){const t=cueTime(p,c);if(t===undefined)continue;out.push({id:c.id,kind:'ääni',lane:'ääni',start:t,duration:c.kind==='music'?Math.max(0,(c.duration??p.seconds-t)):.3,value:c.sound,label:c.kind==='music'?'Musiikki: '+c.sound:sfxNames[c.sound as SfxId]??c.sound,line:c.line??0,lineText:c.line?lines[c.line-1]??'':'',editable:!!c.line,params:{sound:c.kind}});}
 return out.sort((a,b)=>a.start-b.start||a.line-b.line);
}

/* ───────────────────────── Tekstimuutokset ───────────────────────── */

export type TextEdit={text:string;changedLines:number[]};
export class BlockConflict extends Error{constructor(message:string){super(message);this.name='BlockConflict';}}
const split=(text:string)=>text.replace(/\r\n?/g,'\n').split('\n');
function checkFresh(lines:string[],b:Block){if((lines[b.line-1]??'')!==b.lineText)throw new BlockConflict(`Rivi ${b.line} on muuttunut palikan lukemisen jälkeen. Rakenna jakso uudelleen ennen palikan muokkausta.`);}
/** Rivin lauseet tunnistimen mukaan (sama jako kuin rakennuksessa). */
function lineClauses(text:string,lineNo:number):Clause[]{const r=recognizeScript(text,[],{discoverActors:true});return r.lines[lineNo-1]?.clauses??[];}
/** Korvaa palikan lause rivillä; jos rivillä on vain tämä lause, koko rivi kirjoitetaan uudelleen alkuperäisellä sisennyksellä. */
function replaceClause(text:string,b:Block,sentence:string|null):TextEdit{
 const lines=split(text);checkFresh(lines,b);const raw=lines[b.line-1],indent=raw.match(/^\s*/)?.[0]??'',clauses=lineClauses(text,b.line).filter(c=>c.type!=='note');
 const ending=/[.!?]\s*$/.test(raw.trim())||!raw.trim()?'.':'';
 if(clauses.length<=1||b.kind==='kamera'||b.kind==='tausta'||b.kind==='siirtymä'||b.kind==='ääni'){if(sentence===null)lines.splice(b.line-1,1);else lines[b.line-1]=indent+sentence+(/^(LAAJA|LÄHIKUVA|PUOLIKUVA|HÄIVYTYS|RISTIKUVA|LEIKKAUS)|:/.test(sentence)?'':ending||'.');return {text:lines.join('\n'),changedLines:[b.line]};}
 // Monen lauseen rivi: palikan lause omaksi lauseekseen, muut säilyvät sanatarkasti mutta saavat nimen subjektiksi.
 const own=clauses.find(c=>('value' in c&&c.value===b.value)||('target' in c&&c.target===b.value)||(c.type==='motion'&&b.kind==='liike'));
 const rest=clauses.filter(c=>c!==own).map(c=>c.text.trim()),who=displayName(b.lane);
 const fixed=rest.map(t=>new RegExp('^'+who+'\\b','iu').test(t)||/^(hän|he|she|they)\b/iu.test(t)?t.replace(/^(hän|he|she)\b/iu,who):who+' '+t);
 const parts=[...fixed,...(sentence===null?[]:[sentence])];lines[b.line-1]=indent+parts.map(t=>t.replace(/[.]$/,'')).join('. ')+'.';
 return {text:lines.join('\n'),changedLines:[b.line]};
}
const durationRe=/(\d+(?:[.,]\d+)?|puoli|yksi|yhden|kaksi|kahden|kolme|kolmen|neljä|neljän|viisi|viiden|kuusi|kuuden|seitsemän|kahdeksan|yhdeksän|kymmenen|one|two|three|four|five|six|seven|eight|nine|ten|half a)\s*(?:s|sek|sekunti\p{L}*|sekunni\p{L}*|seconds?|secs?)(?![\p{L}])(\s+ajan)?/iu;
const toDirRe=/(?<![\p{L}])(vasemmalle|oikealle|suoraan|left|right|forward)(?![\p{L}])/iu,fromDirRe=/(?<![\p{L}])(vasemmalta|oikealta|from the left|from the right)(?![\p{L}])/iu;
/**
 * Pienin muutos riville: kesto tai suunta korvataan alkuperäisessä lauseessa sanatarkasti (käyttäjän sanavalinnat,
 * kuten “sisään vasemmalta”, säilyvät). Palauttaa undefined, jos pientä muutosta ei voi tehdä varmasti.
 */
function minimalEdit(raw:string,b:Block,params:BlockParams,value:string):string|undefined{
 let line=raw,changed=false;
 if(value!==b.value&&!(params.direction&&/^(walk|run)-/.test(b.value)&&value.replace(/-(left|right|front)$/,'')===b.value.replace(/-(left|right|front)$/,'')))return;
 if(params.seconds!==undefined&&params.seconds!==b.params.seconds){const t=secondsText(params.seconds);if(durationRe.test(line))line=line.replace(durationRe,t);else{const m=line.match(/^(.*?)([.!?]?\s*)$/);line=(m?m[1]:line)+' '+t+(m?m[2]:'');}changed=true;}
 if(params.direction&&params.direction!==b.params.direction){const en=/\b(walks?|runs?)\b/i.test(line);
  if(fromDirRe.test(line)&&params.direction!=='front'){line=line.replace(fromDirRe,(w)=>{const english=/from/i.test(w);return params.direction==='right'?(english?'from the left':'vasemmalta'):(english?'from the right':'oikealta');});changed=true;}
  else if(toDirRe.test(line)){line=line.replace(toDirRe,en?{left:'left',right:'right',front:'forward'}[params.direction]:dirWord[params.direction]);changed=true;}
  else return;}
 return changed?line:undefined;
}
/** Muuta palikan parametreja (arvo, suunta, kesto, kohde). */
export function updateBlock(text:string,b:Block,change:Partial<Pick<Block,'value'>>&{params?:Partial<BlockParams>}):TextEdit{
 if(!b.editable)throw new BlockConflict('Tämä palikka on johdettu (automaattinen kuva tai tehoste). Lisää oma palikka sen tilalle.');
 if(b.kind==='repliikki')throw new BlockConflict('Repliikin sanat muokataan käsikirjoitustekstissä; repliikkejä ei keksitä palikoista.');
 const value=change.value??b.value,params={...b.params,...change.params};let v=value;
 if(b.kind==='liike'&&params.direction&&/^(walk|run)-/.test(value))v=value.replace(/-(left|right|front)$/,'-'+params.direction);
 if(b.kind==='katse'&&params.target)v=params.target;if(b.kind==='kamera'&&params.size)v=params.size;if(b.kind==='kamera'&&v==='wide')params.target='scene';
 const lines=split(text);checkFresh(lines,b);
 if(lineClauses(text,b.line).filter(c=>c.type!=='note').length<=1){const small=minimalEdit(lines[b.line-1],b,params,v);if(small!==undefined){lines[b.line-1]=small;return {text:lines.join('\n'),changedLines:[b.line]};}}
 return replaceClause(text,b,blockSentence({kind:b.kind,lane:b.lane,value:v,params}));
}
export function deleteBlock(text:string,b:Block):TextEdit{if(!b.editable)throw new BlockConflict('Johdettua palikkaa ei voi poistaa; muuta sen lähdettä.');if(b.kind==='repliikki')throw new BlockConflict('Poista repliikki käsikirjoitustekstistä (puhuja- ja repliikkirivit).');return replaceClause(text,b,null);}
/** Kopio heti alkuperäisen perään omalle rivilleen. */
export function duplicateBlock(text:string,b:Block):TextEdit{if(!b.editable||b.kind==='repliikki')throw new BlockConflict('Tätä palikkaa ei voi kopioida.');const lines=split(text);checkFresh(lines,b);lines.splice(b.line,0,(lines[b.line-1].match(/^\s*/)?.[0]??'')+blockSentence(b)+(b.kind==='kamera'||b.kind==='siirtymä'?'':'.'));return {text:lines.join('\n'),changedLines:[b.line+1]};}
/**
 * Siirto aikajanalla: palikka siirtyy ennen sitä palikkaa, jonka alku on lähimpänä uutta aikaa (napsautus rajoille).
 * Monen lauseen riviltä palikka irrotetaan omaksi rivikseen.
 */
export function moveBlock(text:string,blocks:Block[],b:Block,time:number):TextEdit{
 if(!b.editable)throw new BlockConflict('Johdettua palikkaa ei voi siirtää.');if(b.kind==='repliikki')throw new BlockConflict('Repliikin paikka muutetaan käsikirjoitustekstissä.');
 const target=anchorFor(blocks.filter(x=>x.id!==b.id),time);
 const removed=replaceClause(text,b,null),lines=split(removed.text),removedLine=split(text).length!==lines.length;
 let at=target?target.line-1:lines.length;if(removedLine&&target&&target.line>b.line)at-=1;
 // Ei siirretä kohtausotsikon tai puhujarivin ja repliikin väliin: palikka menee ennen puhujariviä.
 if(target?.kind==='repliikki'){const r=recognizeScript(removed.text,[],{discoverActors:true});while(at>0&&r.lines[at-1]?.kind==='cue')at--;}
 const indent=(text.split('\n')[b.line-1].match(/^\s*/)?.[0]??'');lines.splice(at,0,indent+blockSentence(b)+(b.kind==='kamera'||b.kind==='siirtymä'?'':'.'));
 return {text:lines.join('\n'),changedLines:[at+1]};
}
/** Ankkuri ajalle: ensimmäinen hahmon tai kameran palikka, joka alkaa ajan jälkeen (musiikki- ja taustarivit pysyvät otsikko-osassa). */
function anchorFor(blocks:Block[],time:number){return blocks.filter(x=>x.line>0&&x.kind!=='ääni'&&x.kind!=='tausta').sort((x,y)=>x.start-y.start||x.line-y.line).find(x=>x.start>=time-1e-6);}
/** Uusi palikka kirjastosta: lause lisätään ajankohdan kohdalle. */
export function insertBlock(text:string,blocks:Block[],block:Pick<Block,'kind'|'lane'|'value'|'params'>,time:number):TextEdit{
 const target=anchorFor(blocks,time),lines=split(text);let at=target?target.line-1:lines.length;
 if(target?.kind==='repliikki'){const r=recognizeScript(text,[],{discoverActors:true});while(at>0&&r.lines[at-1]?.kind==='cue')at--;}
 lines.splice(at,0,blockSentence(block)+(block.kind==='kamera'||block.kind==='siirtymä'?'':'.'));return {text:lines.join('\n'),changedLines:[at+1]};
}
/** Venytys: uusi kesto sekunteina (0,5–20 s liikkeille, 0,1–60 s tauoille). */
export function stretchBlock(text:string,b:Block,seconds:number):TextEdit{
 if(b.kind!=='liike'&&b.kind!=='tauko')throw new BlockConflict('Vain liikkeen ja tauon kestoa voi venyttää; muiden kesto määräytyy sisällöstä.');
 const s=Math.round(Math.max(b.kind==='liike'?.5:.1,Math.min(b.kind==='liike'?20:60,seconds))*10)/10;return updateBlock(text,b,{params:{seconds:s}});
}
/* ───────────────────────── Vapaa ajoitus ja ryhmäkomennot ───────────────────────── */

export type PlaceEdit=TextEdit&{placedAt:number;note?:string};
const timelineBlocks=(blocks:Block[],skip:Set<string>)=>blocks.filter(x=>!skip.has(x.id)&&x.editable&&x.line>0&&x.kind!=='ääni'&&x.kind!=='tausta');
/** Poistettujen palikoiden vaikutus muiden alkuaikoihin (peräkkäinen kursori etenee palikan keston verran). */
const shifted=(x:Block,removed:Block[])=>x.start-removed.filter(r=>r.line<x.line).reduce((sum,r)=>sum+r.duration,0);
const roundSec=(n:number)=>Math.round(n*100)/100;
/**
 * Sijoitus mihin tahansa ajanhetkeen. Käsikirjoituksen ajoitus on peräkkäinen, joten tarkka hetki on mahdollinen
 * kolmessa tapauksessa: tauon sisällä (tauko jaetaan kahtia ja palikka asetetaan väliin), kaiken sisällön jälkeen
 * (lisätään tauko) sekä `together`-tilassa repliikin kanssa yhtä aikaa (`Samalla`-rivi). Muuten palikka napsahtaa
 * lähimmälle tapahtumarajalle (kuten moveBlock) ja muutoksen huomautus kertoo sen.
 * Aika tulkitaan siirron jälkeisellä aikajanalla: palikka alkaa pudotuskohdassa.
 */
export function placeBlock(text:string,blocks:Block[],b:Block,time:number,mode:'sequence'|'together'='sequence'):PlaceEdit{
 if(!b.editable)throw new BlockConflict('Johdettua palikkaa ei voi siirtää.');if(b.kind==='repliikki')throw new BlockConflict('Repliikin paikka muutetaan käsikirjoitustekstissä.');
 const others=timelineBlocks(blocks,new Set([b.id])),t=Math.max(0,time);
 const indent=(text.split('\n')[b.line-1].match(/^\s*/)?.[0]??'');
 if(mode==='together'){
  if(!['liike','ilme','katse','esine'].includes(b.kind))throw new BlockConflict('Samalla toimii liikkeelle, ilmeelle, katseelle ja esineelle.');
  const d=others.find(x=>x.kind==='repliikki'&&t>=shifted(x,[b])-1e-6&&t<shifted(x,[b])+x.duration);
  if(!d)throw new BlockConflict('Samalla alkaa repliikin kanssa yhtä aikaa: pudota palikka repliikin päälle.');
  const removed=replaceClause(text,b,null),lines=split(removed.text),lineRemoved=split(text).length!==lines.length;
  const at=d.line-(lineRemoved&&d.line>b.line?1:0);
  lines.splice(at,0,indent+'Samalla '+blockSentence(b)+'.');
  return {text:lines.join('\n'),changedLines:[at+1],placedAt:roundSec(shifted(d,[b])),note:`Alkaa samaan aikaan repliikin kanssa (${roundSec(shifted(d,[b]))} s).`};
 }
 const pause=others.find(x=>x.kind==='tauko'&&x.params.seconds!==undefined&&t>shifted(x,[b])+.05&&t<shifted(x,[b])+x.duration-.05);
 if(pause){
  const start=shifted(pause,[b]),first=roundSec(t-start),second=roundSec(pause.duration-first);
  if(first>=.1&&second>=.1){
   const removed=replaceClause(text,b,null),lines0=split(removed.text),lineRemoved=split(text).length!==lines0.length;
   const pLine=pause.line-(lineRemoved&&pause.line>b.line?1:0),fresh={...pause,line:pLine,lineText:lines0[pLine-1]??''};
   const first_=updateBlock(removed.text,fresh,{params:{seconds:first}}),lines=split(first_.text);
   const tail=indent+blockSentence({...pause,params:{...pause.params,seconds:second}})+'.';
   lines.splice(pLine,0,indent+blockSentence(b)+(b.kind==='kamera'||b.kind==='siirtymä'?'':'.'),tail);
   return {text:lines.join('\n'),changedLines:[pLine+1],placedAt:roundSec(t),note:`Tauko jaettiin (${first} s + ${second} s); palikka alkaa kohdassa ${roundSec(t)} s.`};
  }
 }
 const content=others.filter(x=>['liike','ilme','katse','esine','tauko','repliikki'].includes(x.kind));
 const end=content.reduce((m,x)=>Math.max(m,shifted(x,[b])+x.duration),0),last=content.reduce<Block|undefined>((m,x)=>!m||x.line>m.line?x:m,undefined);
 if(last&&t>end+.05){
  const removed=replaceClause(text,b,null),lines=split(removed.text),lineRemoved=split(text).length!==lines.length;
  const at=last.line-(lineRemoved&&last.line>b.line?1:0),gap=roundSec(t-end);
  lines.splice(at,0,indent+blockSentence({kind:'tauko',lane:'scene',value:'pause',params:{seconds:gap}})+'.',indent+blockSentence(b)+(b.kind==='kamera'||b.kind==='siirtymä'?'':'.'));
  return {text:lines.join('\n'),changedLines:[at+1,at+2],placedAt:roundSec(t),note:`Lisättiin ${gap} s tauko; palikka alkaa kohdassa ${roundSec(t)} s.`};
 }
 const snapped=moveBlock(text,blocks,b,t),anchor=anchorFor(blocks.filter(x=>x.id!==b.id),t),landed=roundSec(anchor?shifted(anchor,[b]):end);
 return {...snapped,placedAt:landed,note:Math.abs(landed-t)>.05?`Napsahti tapahtumarajalle ${landed} s: käynnissä olevaa liikettä tai repliikkiä ei voi jakaa. Pudota tauon päälle, kaiken jälkeen tai pidä Alt (Samalla) repliikin päällä.`:undefined};
}

/** Rivit, jotka kuuluvat palikkaan (repliikillä myös edeltävä puhujarivi). */
function blockLines(text:string,b:Block):number[]{
 if(b.kind!=='repliikki')return [b.line];
 const r=recognizeScript(text,[],{discoverActors:true}),lines=[b.line];
 let at=b.line-1;while(at>0&&r.lines[at-1]?.kind==='cue'){lines.unshift(at);at--;}
 return lines;
}
function groupLines(text:string,group:Block[]):number[]{
 if(!group.length)throw new BlockConflict('Valitse ensin palikoita.');
 const lines=split(text),all=new Set<number>(),count=new Map<number,number>();
 for(const b of group){
  if(!b.editable)throw new BlockConflict('Valinnassa on johdettu palikka (automaattinen kuva tai tehoste). Poista se valinnasta.');
  checkFresh(lines,b);
  if(b.kind!=='repliikki'&&lineClauses(text,b.line).filter(c=>c.type!=='note').length>1)throw new BlockConflict(`Rivillä ${b.line} on useita lauseita. Ryhmäkomennot toimivat vain riveille, joilla on yksi palikka; muokkaa riviä yksittäin.`);
  for(const n of blockLines(text,b)){all.add(n);count.set(n,(count.get(n)??0)+1);}
 }
 if([...count.values()].some(c=>c>1))throw new BlockConflict('Kaksi valittua palikkaa jakaa saman rivin. Valitse ne yksitellen.');
 return [...all].sort((a,b)=>a-b);
}
export function deleteBlocks(text:string,blocks:Block[],ids:string[]):TextEdit{
 const group=blocks.filter(b=>ids.includes(b.id)),idx=groupLines(text,group),lines=split(text);
 for(const n of [...idx].reverse())lines.splice(n-1,1);
 return {text:lines.join('\n'),changedLines:[Math.max(1,idx[0])]};
}
/** Ryhmän kopio heti viimeisen valitun rivin perään samassa järjestyksessä (vain repliikittömät ryhmät). */
export function duplicateBlocks(text:string,blocks:Block[],ids:string[]):TextEdit{
 const group=blocks.filter(b=>ids.includes(b.id));if(group.some(b=>b.kind==='repliikki'))throw new BlockConflict('Repliikkejä ei kopioida palikoina. Poista repliikit valinnasta.');
 const idx=groupLines(text,group),lines=split(text),copy=idx.map(n=>lines[n-1]),at=idx[idx.length-1];
 lines.splice(at,0,...copy);return {text:lines.join('\n'),changedLines:copy.map((_,i)=>at+1+i)};
}
/** Ryhmän siirto: valitut rivit (repliikeillä myös puhujarivi) säilyttävät järjestyksensä ja menevät yhtenä lohkona tapahtumarajalle. */
export function moveBlocks(text:string,blocks:Block[],ids:string[],time:number):PlaceEdit{
 const group=blocks.filter(b=>ids.includes(b.id)),idx=groupLines(text,group),lines=split(text),moved=idx.map(n=>lines[n-1]);
 const others=timelineBlocks(blocks,new Set(ids)),anchor=anchorFor(others.map(x=>({...x,start:shifted(x,group)})),Math.max(0,time));
 const remaining=lines.filter((_,i)=>!idx.includes(i+1));
 let at=anchor?anchor.line-1-idx.filter(n=>n<anchor.line).length:remaining.length;
 if(anchor?.kind==='repliikki'){const r=recognizeScript(remaining.join('\n'),[],{discoverActors:true});while(at>0&&r.lines[at-1]?.kind==='cue')at--;}
 remaining.splice(at,0,...moved);
 const landed=roundSec(anchor?anchor.start:others.reduce((m,x)=>Math.max(m,x.start+x.duration),0));
 return {text:remaining.join('\n'),changedLines:[at+1],placedAt:landed,note:`Ryhmä (${group.length} palikkaa) siirrettiin kohtaan ${landed} s.`};
}
/** Kirjaston palikat (vedä aikajanalle). */
export const blockLibrary:{label:string;kind:BlockKind;value:string;params:BlockParams}[]=[
 {label:'Vilkuta',kind:'liike',value:'wave',params:{seconds:2}},{label:'Nyökkää',kind:'liike',value:'nod',params:{seconds:1}},{label:'Osoita',kind:'liike',value:'point',params:{seconds:1.6}},
 {label:'Kävele →',kind:'liike',value:'walk-right',params:{seconds:2,direction:'right'}},{label:'Kävele ←',kind:'liike',value:'walk-left',params:{seconds:2,direction:'left'}},{label:'Istu',kind:'liike',value:'sit',params:{seconds:1.8}},{label:'Hyppää',kind:'liike',value:'jump',params:{seconds:1.8}},
 {label:'Hymyile',kind:'ilme',value:'happy',params:{}},{label:'Surullinen',kind:'ilme',value:'sad',params:{}},{label:'Hämmästy',kind:'liike',value:'react-surprise',params:{seconds:1.2}},
 {label:'Katso kameraan',kind:'katse',value:'camera',params:{target:'camera'}},{label:'Tauko 1 s',kind:'tauko',value:'pause',params:{seconds:1}},
 {label:'Lähikuva',kind:'kamera',value:'close',params:{size:'close'}},{label:'Laaja kuva',kind:'kamera',value:'wide',params:{size:'wide'}},{label:'Ääni: ovi',kind:'ääni',value:'ovi',params:{sound:'sfx'}},
];
/** Palikoista kanoninen käsikirjoitus (palikka → teksti). Johdetut palikat jätetään pois; ne syntyvät uudelleen. */
export function blocksToScript(blocks:Block[]):string{
 const out:string[]=[];let section='';
 for(const b of blocks){if(!b.editable)continue;
  if(b.kind==='repliikki'){out.push(b.lane+':','“'+b.value+'”');continue;}
  const s=blockSentence(b);out.push(s+(b.kind==='kamera'||b.kind==='siirtymä'||b.kind==='tausta'||b.kind==='ääni'?'':'.'));void section;}
 return out.join('\n');
}
/** Lukittujen kuvien suoja: palikkamuutos, joka vaikuttaa lukittuun kuvaan, estetään (ei hiljaista ohitusta). */
export function lockedShotConflict(before:Presentation,after:Presentation,affected:Set<string>,locked:Set<string>):string|null{const hit=[...affected].filter(id=>locked.has(id));return hit.length?`Muutos vaikuttaa ${hit.length} lukittuun kuvaan. Avaa lukitus tuotantonäkymässä tai muokkaa toista kohtaa.`:null;}
export {cleanLine};
