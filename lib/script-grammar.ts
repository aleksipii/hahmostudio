import {ScriptRecognizer,detectLanguage} from './script-recognizer.ts';
/** Strict, finite grammar. No substring matching, guessed subjects or generated speech. */
export const verbs={walk:['kävelee','kävele','käveli','kävelen','kävellään','walk','walks','walking'],run:['juoksee','juokse','juoksi','juoksen','juostaan','run','runs','running']} as const;
export const directions={left:['vasemmalle','left'],right:['oikealle','right'],front:['suoraan','forward']} as const;
export const units=['s','sek','sekuntia','sekunnin ajan','second','seconds','sec','secs'] as const;
export const corpusActors=Array.from({length:64},(_,i)=>`Hahmo${i+1}`);
export const durations=Array.from({length:50},(_,i)=>(.5+i/10).toFixed(1));
export function grammarCoverage(){return {actors:64,verbs:Object.values(verbs).flat().length,directions:Object.values(directions).flat().length,durations:50,units:units.length,rules:8,recognizedMotionSentences:64*16*Object.values(directions).flat().length*50*8,lexiconEntries:new Set([...Object.values(verbs).flat(),...Object.values(directions).flat(),...units]).size,lexiconWords:new Set([...Object.values(verbs).flat(),...Object.values(directions).flat(),...units].flatMap(s=>s.split(' '))).size};}
export function* generateSentences(){for(const actor of corpusActors)for(const forms of Object.values(verbs))for(const verb of forms)for(const direction of Object.values(directions).flat())for(const duration of durations)for(const unit of units)yield `${actor} ${verb} ${direction} ${duration} ${unit}`;}
export type Command={id:string;kind:'action'|'dialogue'|'camera'|'expression'|'gaze'|'environment'|'prop'|'hold';target:string;value:string;seconds:number;text?:string;relation:'sequence'|'parallel';anchor?:string;scene:string;source:{line:number;text:string};at:number};
export type ScriptDiagnostic={line:number;problem:string;suggestion:string};
export type ScriptScene={id:string;name:string;commands:Command[]};
export type StructuredScript={version:1;scenes:ScriptScene[];commands:Command[];diagnostics:ScriptDiagnostic[];characters:string[]};
export function parseRuleScript(text:string):StructuredScript{
 const result:StructuredScript={version:1,scenes:[],commands:[],diagnostics:[],characters:[]};
 if(text.length>60000)throw Error('Käsikirjoituksen enimmäispituus on 60 000 merkkiä.');
 let scene:ScriptScene={id:'scene-1',name:'Kohtaus 1',commands:[]},lastActor='',lastProp='',cursor=0;
 result.scenes.push(scene);
 const names=new Map<string,string>();let failed=false;
 const fail=(line:number,problem:string,suggestion='Käytä ohjeen täsmällistä rakennetta; nimeä hahmo ja anna kesto.')=>{result.diagnostics.push({line,problem,suggestion});failed=true;};
 for(const [index,raw] of text.replace(/\r\n?/g,'\n').split('\n').entries()){
  failed=false;const line=index+1;let t=raw.trim();if(!t||t==='#!kilsat'||/^(?:Resurssi|Resource)\s/i.test(t)||/^(?:Jakson nimi|Title|Pituus|Kesto|Duration|Tarkoitus|Purpose|Musiikki|Taustamusiikki|Music|Sarja|Series)\s*:/i.test(t)||/^\/\//.test(t))continue;
  const heading=t.match(/^(?:Kohtaus|Scene):\s*(.+)$/i);if(heading){scene={id:`scene-${result.scenes.length+1}`,name:heading[1],commands:[]};result.scenes.push(scene);continue;}
  const declaration=t.match(/^(?:Hahmo|Character):\s*([\p{L}\d. -]{1,100})$/u);if(declaration){const name=declaration[1].trim();if(names.has(name.toLowerCase())){fail(line,'Hahmo on määritelty kahdesti.');continue;}if(names.size>=4){fail(line,'Enintään neljä hahmoa esitystä kohti.');continue;}names.set(name.toLowerCase(),name);result.characters.push(name);continue;}
  const parallel=/^(?:Samalla|Meanwhile|Simultaneously):\s*/i.test(t);t=t.replace(/^(?:Samalla|Meanwhile|Simultaneously):\s*/i,'').replace(/^(?:Leikkaus|Cut):/i,'Kamera:');
  let match:RegExpMatchArray|null,kind:Command['kind']|undefined,value='',target='',seconds=0,spoken:string|undefined;
  const duration=t.match(/\s+(\d+(?:[.,]\d+)?)\s+(s|sek|sekuntia|sekunnin ajan|second|seconds|sec|secs)$/i);
  if(duration){seconds=Number(duration[1].replace(',','.'));t=t.slice(0,duration.index).trim();if(seconds<.5||seconds>20){fail(line,'Kesto on 0,5–20 sekuntia.');continue;}}
  const actor=(name:string)=>{if(['hän','he','she','they'].includes(name.toLowerCase())){if(!lastActor)fail(line,'Pronominilla hän ei ole yksiselitteistä edeltävää hahmoa.');return lastActor;}const found=names.get(name.toLowerCase());if(!found)fail(line,`Hahmoa ”${name}” ei ole määritelty.`, `Lisää Hahmo: ${name}`);return found??'';};
  if((match=t.match(/^(.+?)\s+(kävelee|kävele|käveli|kävelen|kävellään|walk|walks|walking|juoksee|juokse|juoksi|juoksen|juostaan|run|runs|running)\s+(vasemmalle|oikealle|suoraan|left|right|forward)$/iu))){target=actor(match[1]);kind='action';value=`${(verbs.walk as readonly string[]).includes(match[2].toLowerCase())?'walk':'run'}-${(directions.left as readonly string[]).includes(match[3].toLowerCase())?'left':(directions.right as readonly string[]).includes(match[3].toLowerCase())?'right':'front'}`;}
  else if((match=t.match(/^(.+?)\s+reaktio:\s*(nyökkäys|hämmästys|vilkutus|nod|surprise|wave)$/iu))){target=actor(match[1]);kind='action';value=({nyökkäys:'react-nod',hämmästys:'react-surprise',vilkutus:'react-wave',nod:'react-nod',surprise:'react-surprise',wave:'react-wave'} as Record<string,string>)[match[2].toLowerCase()];}
  else if((match=t.match(/^(.+?)\s+(vilkuttaa|nyökkää|hyppää|kyykistyy|osoittaa|points?|nyrkki|fist|istuu|istu|sits?|waves|nods|jumps|crouches)$/iu))){target=actor(match[1]);kind='action';value=({vilkuttaa:'wave','nyökkää':'nod',hyppää:'jump',kyykistyy:'crouch',osoittaa:'point',point:'point',points:'point',nyrkki:'fist',fist:'fist',istuu:'sit',istu:'sit',sit:'sit',sits:'sit',waves:'wave',nods:'nod',jumps:'jump',crouches:'crouch'} as Record<string,string>)[match[2].toLowerCase()];}
  else if((match=t.match(/^(.+?)\s+(?:sanoo|says):\s*"([^"]*)"$/iu))){target=actor(match[1]);kind='dialogue';value='neutral_talk';spoken=match[2];if(!spoken.trim())fail(line,'Repliikki on tyhjä.');}
  else if((match=t.match(/^(?:Kamera|Camera):\s*(lähikuva|puolikuva|laaja|close-up|medium|wide)(?:\s+(.+))?$/iu))){kind='camera';value=({lähikuva:'close',puolikuva:'medium',laaja:'wide','close-up':'close',medium:'medium',wide:'wide'} as Record<string,string>)[match[1].toLowerCase()];target=match[2]?actor(match[2]):'scene';if(value!=='wide'&&target==='scene')fail(line,'Lähi- tai puolikuva tarvitsee nimetyn hahmon.');}
  else if((match=t.match(/^(.+?)\s+(?:ilme|expression):\s*(vihainen|huolestunut|hämmentynyt|loukkaantunut|kulmakarvat ylös|iloinen|hymy|surullinen|peloissaan|pelokas|angry|worried|confused|hurt|eyebrows raised|happy|smile|sad|scared|afraid)$/iu))){target=actor(match[1]);kind='expression';value=({vihainen:'angry',huolestunut:'worried',hämmentynyt:'confused',loukkaantunut:'mildly_hurt','kulmakarvat ylös':'eyebrow_raise',angry:'angry',worried:'worried',confused:'confused',hurt:'mildly_hurt','eyebrows raised':'eyebrow_raise',iloinen:'happy',hymy:'happy',surullinen:'sad',peloissaan:'scared',pelokas:'scared',happy:'happy',smile:'happy',sad:'sad',scared:'scared',afraid:'scared'} as Record<string,string>)[match[2].toLowerCase()];}
  else if((match=t.match(/^(.+?)\s+(?:katsoo|looks at):\s*(.+)$/iu))){target=actor(match[1]);kind='gaze';const object=['se','it'].includes(match[2].toLowerCase())?lastProp:match[2];if(!object)fail(line,'Pronominilla se ei ole esinettä.');value=['puhelin','phone'].includes(object.toLowerCase())?'phone':['kamera','kameraan','camera','katsoja','katsojaan','viewer'].includes(object.toLowerCase())?'camera':actor(object);}
  else if((match=t.match(/^(?:Tausta|Background):\s*(.+)$/iu))){target='scene';kind='environment';const key=match[1].trim();value=({studio:'studio-v1',olohuone:'apartment-v1','kaupunki ilta':'city-evening-v1','auto moderni':'car-interior-v2','living room':'apartment-v1','city evening':'city-evening-v1','modern car':'car-interior-v2','kartonkikatu':'cutout-street-v1'} as Record<string,string>)[key.toLowerCase()]??key;}
  else if((match=t.match(/^(.+?)\s+(?:puhelin|phone):\s*(esille|pois|edestä|takaa|sivulta|show|hide|front|back|side)$/iu))){target=actor(match[1]);kind='prop';value=['pois','hide'].includes(match[2].toLowerCase())?'phone-off':'phone-on';spoken=['takaa','back'].includes(match[2].toLowerCase())?'back':['sivulta','side'].includes(match[2].toLowerCase())?'side':'front';}
  else if(/^(?:Odota|Wait)$/i.test(t)){kind='hold';target='scene';value='pause';}
  else if((match=strictFromRecognizer(t,[...names.values()]))){target=match[1];kind=match[2] as Command['kind'];value=match[3];}
  else{const hint=recognizerHint(t,[...names.values()],!!duration);fail(line,`Riviä ei tunnistettu: ${raw}`, hint??'Esimerkiksi Kille kävelee oikealle 2 s. Istuminen, ylä-/takakuva ja uudet esineet tarvitsevat erillisen toteutuksen.');continue;}
  if(!duration){fail(line,'Tapahtumalta puuttuu täsmällinen kesto.');continue;}
  if(failed){failed=false;continue;}
  const anchor=result.commands.at(-1);if(parallel&&!anchor){fail(line,'Samalla tarvitsee edeltävän tapahtuman.');failed=false;continue;}
  const at=parallel?anchor!.at:cursor;
  const command:Command={id:`command-${line}`,kind:kind!,value,target,seconds,...(spoken!==undefined?{text:spoken}:{}),relation:parallel?'parallel':'sequence',...(parallel?{anchor:anchor!.id}:{}),at,scene:scene.id,source:{line,text:raw}};
  result.commands.push(command);scene.commands.push(command);if(kind==='prop')lastProp='puhelin';cursor=Math.max(cursor,at+seconds);if(target!=='scene')lastActor=target;
 }
 if(!result.commands.length&&!result.diagnostics.length)result.diagnostics.push({line:1,problem:'Käsikirjoitus on tyhjä.',suggestion:'Lisää hahmomääritys ja tapahtuma.'});
 return result;
}

const strictMotions=new Set(['walk-left','walk-right','walk-front','run-left','run-right','run-front','wave','nod','jump','crouch','point','fist','sit','react-nod','react-surprise','react-wave']);
/** Taivutusmuodot tunnistimen sanastosta ("Kille juoksi vasemmalle", "Mira nyökkäsi"), vain nimetylle hahmolle ja yhdelle tuetulle tapahtumalle. */
function strictFromRecognizer(text:string,characters:string[]):RegExpMatchArray|null{
 if(!characters.length)return null;const r=new ScriptRecognizer(characters),lang=detectLanguage(text),first=(text.match(/^[\p{L}]+/u)?.[0])??'';
 const subject=r.resolveActor(first,lang);if(!subject||!characters.some(c=>c.toLocaleUpperCase('fi-FI')===subject))return null;
 const clauses=r.clauses(text,lang);if(clauses.length!==1)return null;const c=clauses[0];
 const name=characters.find(n=>n.toLocaleUpperCase('fi-FI')===subject)!;
 const hit=(kind:string,value:string)=>Object.assign([text,name,kind,value],{index:0,input:text}) as unknown as RegExpMatchArray;
 if(c.type==='motion'&&c.actor===subject&&strictMotions.has(c.value)&&(!/^(walk|run)-/.test(c.value)||/vasem|oikea|suoraan|eteenpäin|kohti|left|right|forward|toward/i.test(text)))return hit('action',c.value);
 if(c.type==='expression'&&c.actor===subject)return hit('expression',c.value);
 if(c.type==='gaze'&&c.actor===subject){const target=c.target==='phone'||c.target==='camera'?c.target:characters.find(n=>n.toLocaleUpperCase('fi-FI')===c.target);if(target)return hit('gaze',target);}
 return null;
}
/** Ehdotus hylätylle riville: kerrotaan mitä tunnistettiin ja mitä puuttuu. */
function recognizerHint(text:string,characters:string[],hasDuration:boolean):string|undefined{
 const r=new ScriptRecognizer(characters),clauses=r.clauses(text,detectLanguage(text));const c=clauses[0];if(!c||c.type==='unknown')return undefined;
 if(c.type==='unsupported')return c.reason;
 if(c.type==='motion'&&/^(walk|run)-/.test(c.value)&&c.estimated&&!/vasem|oikea|suoraan|left|right|forward/i.test(text))return 'Tunnistettiin liike. Lisää suunta (vasemmalle, oikealle tai suoraan) ja kesto, esim. "… oikealle 2 s".';
 if(!hasDuration)return 'Tunnistettiin tapahtuma. Lisää täsmällinen kesto rivin loppuun, esim. "2 s".';
 if('actor' in c&&!characters.some(n=>n.toLocaleUpperCase('fi-FI')===c.actor))return 'Nimeä hahmo rivin alussa ja määrittele se rivillä Hahmo: Nimi.';
 return undefined;
}
