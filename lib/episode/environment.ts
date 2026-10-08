import {environmentId} from '../presentation-direction.ts';
import {backgrounds} from '../backgrounds.ts';

/* ───────────────────────── Miljöö ───────────────────────── */

/** Synonyymit → kirjaston tausta. Sanat tunnistetaan vartaloina (keittiö → keittiössä, keittiöön). Tarkemmat ensin. */
const environmentSynonyms:[string[],string][]=[
 [['kotitoimisto','työhuone','home office','study room'],'home-office-scene-v1'],
 [['keittiön vastakuva','keittiö vastakuva','kitchen reverse'],'kitchen-reverse-scene-v1'],[['toimiston vastakuva','toimisto vastakuva','office reverse'],'office-reverse-scene-v1'],
 [['luokan vastakuva','luokkahuoneen vastakuva','classroom reverse'],'classroom-reverse-scene-v1'],[['kahvilan tiski','kahvila tiski','cafe counter'],'cafe-counter-scene-v1'],
 [['yökatu','katu yöllä','street at night','night street'],'street-night-scene-v1'],
 [['makuuhuone','bedroom'],'bedroom-scene-v1'],[['lastenhuone','kids room','nursery'],'kids-room-scene-v1'],[['kylpyhuone','vessa','bathroom','toilet'],'bathroom-scene-v1'],[['sauna','saunassa'],'sauna-scene-v1'],
 [['porraskäytävä','rappukäytävä','porrashuone','stairwell','staircase'],'stairwell-scene-v1'],[['kuntosali','liikuntasali','jumppasali','gym'],'gym-scene-v1'],[['sairaala','terveyskeskus','hospital','clinic'],'hospital-scene-v1'],
 [['juna','metro','raitiovaunu','ratikka','train','tram','subway'],'train-scene-v1'],[['linja auto','bussi','bus'],'bus-scene-v1'],
 [['mökki','kesämökki','järvi','järve','cottage','lake','lakeside'],'cottage-scene-v1'],[['talvipiha','lumipiha','luminen piha','snowy yard','winter yard'],'winter-yard-scene-v1'],[['leikkipuisto','playground'],'playground-scene-v1'],[['kattoterassi','parveke','terassi','rooftop','balcony','terrace'],'rooftop-scene-v1'],
 [['neuvotteluhuone','kokoushuone','meeting room','conference room','palaverihuone'],'meeting-scene-v1'],
 [['bussipysäkki','pysäkki','bus stop','bus station'],'bus-stop-scene-v1'],
 [['parkkipaikka','parkkihalli','pysäköintipaikka','pysäköintialue','parking lot','parking garage','car park'],'parking-scene-v1'],
 [['autotalli','garage'],'garage-scene-v1'],
 [['kartonkistudio','cutout studio'],'cutout-studio-v1'],[['kartonkikatu','cutout street'],'cutout-street-v1'],[['kartonkiauto','cutout car'],'cutout-car-v1'],
 [['takapenki','back seat'],'car-back-v1'],[['kuljettaja','driver seat'],'car-driver-v1'],[['matkustaja','passenger seat'],'car-passenger-v1'],
 [['auto','car','taksi','taxi'],'car-interior-v2'],
 [['keittiö','kitchen','keittokomero'],'kitchen-scene-v1'],
 [['olohuone','living room','asunto','apartment','flat','koti','home','sali','lounge'],'apartment-v1'],
 [['toimisto','office','työpaikka','workplace'],'office-scene-v1'],
 [['eteinen','käytävä','hallway','hall','corridor','entrance','aula','lobby'],'hall-scene-v1'],
 [['kahvila','cafe','café','coffee shop','kahvio'],'cafe-scene-v1'],
 [['ravintola','restaurant','ruokala','diner','baari','bar'],'restaurant-scene-v1'],
 [['ruokakauppa','kauppa','supermarketti','lähikauppa','grocery store','supermarket','store','shop'],'store-scene-v1'],
 [['luokkahuone','luokka','koulu','classroom','school'],'classroom-scene-v1'],
 [['kirjasto','library'],'library-scene-v1'],
 [['palvelupiste','vastaanotto','kassa','reception','service desk','front desk'],'service-scene-v1'],
 [['kaupunki ilta','city evening','city night','yökaupunki'],'city-evening-v1'],
 [['tori','aukio','kaupunkiaukio','square','plaza','town square'],'square-scene-v1'],
 [['katu','jalkakäytävä','kaupunki','street','sidewalk','city','town','road','tie'],'street-scene-v1'],
 [['puisto','piha','puutarha','park','garden','yard','backyard'],'park-scene-v1'],
 [['metsä','metsäpolku','forest','woods','trail'],'forest-scene-v1'],
 [['ranta','uimaranta','beach','shore','seaside'],'beach-scene-v1'],
 [['valkoinen studio','white studio'],'white-studio-scene-v1'],[['tumma studio','dark studio'],'dark-studio-scene-v1'],[['väristudio','color studio'],'color-studio-scene-v1'],
 [['esittelytila','infographic'],'infographic-scene-v1'],
 [['studio'],'studio-v1'],
];
export const caseTail=/^(?:n|a|ä|ta|tä|lle|lta|ltä|lla|llä|ssa|ssä|sta|stä|ksi|na|nä|on|ön|en|in|hin|seen|ssa|ihin|s|es|'s)?$/u;
/** Sana = vartalo + sijapääte; myös heikko aste (pysäkki → pysäkillä, laukku → laukun). */
export function stemMatch(word:string,stem:string){if(word.startsWith(stem)&&caseTail.test(word.slice(stem.length)))return true;const weak=stem.replace(/([kpt])\1([aeiouyäö])$/u,'$1$2');return weak!==stem&&word.startsWith(weak)&&caseTail.test(word.slice(weak.length));}
/** Ympäristön nimi → kirjaston taustan tunniste, tai `undefined` jos sääntöä ei ole (ei arvausta). */
export function resolveEnvironment(name:string):string|undefined{
 const text=name.toLocaleLowerCase('fi-FI').replace(/[–—-]/g,' ').replace(/[^\p{L}\d\s']/gu,' ').replace(/\s+/g,' ').trim();if(!text)return;
 if(backgrounds.some(b=>b.id===name.trim()))return name.trim();
 const words=text.split(' ');
 for(const [terms,id] of environmentSynonyms)for(const term of terms){
  const parts=term.split(' ');
  for(let i=0;i+parts.length<=words.length;i++){
   if(parts.every((p,j)=>j<parts.length-1?words[i+j]===p:stemMatch(words[i+j],p)))return id;
  }
 }
 const legacy=environmentId(name);return legacy&&legacy!=='white'?legacy:undefined;
}
