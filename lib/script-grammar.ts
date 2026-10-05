/** Strict, finite grammar. No substring matching, guessed subjects or generated speech. */
export const verbs={walk:['kävelee','kävele','käveli','kävelen','kävellään','walk','walks','walking'],run:['juoksee','juokse','juoksi','juoksen','juostaan','run','runs','running']} as const;
export const directions={left:['vasemmalle'],right:['oikealle'],front:['suoraan']} as const;
export const units=['s','sek','sekuntia','sekunnin ajan','second','seconds','sec','secs'] as const;
export const corpusActors=Array.from({length:64},(_,i)=>`Hahmo${i+1}`);
export const durations=Array.from({length:50},(_,i)=>(.5+i/10).toFixed(1));
export function grammarCoverage(){return {actors:64,verbs:Object.values(verbs).flat().length,directions:3,durations:50,units:units.length,rules:8,recognizedMotionSentences:64*16*3*50*8,lexiconEntries:new Set([...Object.values(verbs).flat(),...Object.values(directions).flat(),...units]).size,lexiconWords:new Set([...Object.values(verbs).flat(),...Object.values(directions).flat(),...units].flatMap(s=>s.split(' '))).size};}
export function* generateSentences(){for(const actor of corpusActors)for(const forms of Object.values(verbs))for(const verb of forms)for(const direction of ['vasemmalle','oikealle','suoraan'])for(const duration of durations)for(const unit of units)yield `${actor} ${verb} ${direction} ${duration} ${unit}`;}
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
  failed=false;const line=index+1;let t=raw.trim();if(!t||t==='#!kilsat')continue;
  const heading=t.match(/^Kohtaus:\s*(.+)$/i);if(heading){scene={id:`scene-${result.scenes.length+1}`,name:heading[1],commands:[]};result.scenes.push(scene);continue;}
  const declaration=t.match(/^Hahmo:\s*([\p{L}\d. -]{1,100})$/u);if(declaration){const name=declaration[1].trim();if(names.has(name.toLowerCase())){fail(line,'Hahmo on määritelty kahdesti.');continue;}if(names.size>=4){fail(line,'Enintään neljä hahmoa esitystä kohti.');continue;}names.set(name.toLowerCase(),name);result.characters.push(name);continue;}
  const parallel=/^Samalla:\s*/i.test(t);t=t.replace(/^Samalla:\s*/i,'').replace(/^Leikkaus:/i,'Kamera:');
  let match:RegExpMatchArray|null,kind:Command['kind']|undefined,value='',target='',seconds=0,spoken:string|undefined;
  const duration=t.match(/\s+(\d+(?:[.,]\d+)?)\s+(s|sek|sekuntia|sekunnin ajan|second|seconds|sec|secs)$/i);
  if(duration){seconds=Number(duration[1].replace(',','.'));t=t.slice(0,duration.index).trim();if(seconds<.5||seconds>20){fail(line,'Kesto on 0,5–20 sekuntia.');continue;}}
  const actor=(name:string)=>{if(name.toLowerCase()==='hän'){if(!lastActor)fail(line,'Pronominilla hän ei ole yksiselitteistä edeltävää hahmoa.');return lastActor;}const found=names.get(name.toLowerCase());if(!found)fail(line,`Hahmoa ”${name}” ei ole määritelty.`, `Lisää Hahmo: ${name}`);return found??'';};
  if((match=t.match(/^(.+?)\s+(kävelee|kävele|käveli|kävelen|kävellään|walk|walks|walking|juoksee|juokse|juoksi|juoksen|juostaan|run|runs|running)\s+(vasemmalle|oikealle|suoraan)$/iu))){target=actor(match[1]);kind='action';value=`${(verbs.walk as readonly string[]).includes(match[2].toLowerCase())?'walk':'run'}-${match[3].toLowerCase()==='vasemmalle'?'left':match[3].toLowerCase()==='oikealle'?'right':'front'}`;}
  else if((match=t.match(/^(.+?)\s+(vilkuttaa|nyökkää|hyppää|kyykistyy)$/iu))){target=actor(match[1]);kind='action';value=({vilkuttaa:'wave','nyökkää':'nod',hyppää:'jump',kyykistyy:'crouch'} as Record<string,string>)[match[2].toLowerCase()];}
  else if((match=t.match(/^(.+?)\s+sanoo:\s*"([^"]*)"$/iu))){target=actor(match[1]);kind='dialogue';value='neutral_talk';spoken=match[2];if(!spoken.trim())fail(line,'Repliikki on tyhjä.');}
  else if((match=t.match(/^Kamera:\s*(lähikuva|puolikuva|laaja)(?:\s+(.+))?$/iu))){kind='camera';value=({lähikuva:'close',puolikuva:'medium',laaja:'wide'} as Record<string,string>)[match[1].toLowerCase()];target=match[2]?actor(match[2]):'scene';if(value!=='wide'&&target==='scene')fail(line,'Lähi- tai puolikuva tarvitsee nimetyn hahmon.');}
  else if((match=t.match(/^(.+?)\s+ilme:\s*(huolestunut|hämmentynyt|loukkaantunut|kulmakarvat ylös)$/iu))){target=actor(match[1]);kind='expression';value=({huolestunut:'worried',hämmentynyt:'confused',loukkaantunut:'mildly_hurt','kulmakarvat ylös':'eyebrow_raise'} as Record<string,string>)[match[2].toLowerCase()];}
  else if((match=t.match(/^(.+?)\s+katsoo:\s*(.+)$/iu))){target=actor(match[1]);kind='gaze';const object=match[2].toLowerCase()==='se'?lastProp:match[2];if(!object)fail(line,'Pronominilla se ei ole esinettä.');value=object==='puhelin'?'phone':actor(object);}
  else if((match=t.match(/^Tausta:\s*(studio|olohuone|kaupunki ilta|auto moderni)$/iu))){target='scene';kind='environment';value=({studio:'studio-v1',olohuone:'apartment-v1','kaupunki ilta':'city-evening-v1','auto moderni':'car-interior-v2'} as Record<string,string>)[match[1].toLowerCase()];}
  else if((match=t.match(/^(.+?)\s+puhelin:\s*(esille|pois|edestä|takaa|sivulta)$/iu))){target=actor(match[1]);kind='prop';value=match[2].toLowerCase()==='pois'?'phone-off':'phone-on';spoken=match[2].toLowerCase()==='takaa'?'back':match[2].toLowerCase()==='sivulta'?'side':'front';}
  else if(/^Odota$/i.test(t)){kind='hold';target='scene';value='pause';}
  else{fail(line,`Riviä ei tunnistettu: ${raw}`, 'Esimerkiksi Kille kävelee oikealle 2 s. Istuminen, ylä-/takakuva ja uudet esineet tarvitsevat erillisen toteutuksen.');continue;}
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
