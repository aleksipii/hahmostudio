import {phoneInstruction} from './phone-actions.ts';
import {cameraInstruction,initProduction} from './production-model.ts';
import {environmentId,enrichDirection} from './presentation-direction.ts';
import {stableId,normalizeSpeaker,type Presentation,type Event,type Ref} from './presentation-model.ts';
const clock=(s:string)=>{const [m,n]=s.split(':').map(Number);return m*60+n;};
export function parsePresentation(original:string,aliases:Record<string,string>={}):Presentation{
 if(!original.trim()||original.length>60000)throw Error('Liitä käsikirjoitus (enintään 60 000 merkkiä).');
 const lines=original.replace(/\r\n?/g,'\n').split('\n'),p:Presentation={schemaVersion:1,id:'script-'+stableId(original),original,metadata:{series:'Käsikirjoitus',season:1,episode:1,title:'Kohtaus',target:60,purpose:'',environment:''},characters:[],assets:[{id:'phone-v1',kind:'prop'}],world:{width:1080,height:1920,background:'#ffffff',phone:{enabled:/puheli[mn]|phone/i.test(original),model:'phone-v1',carrier:'',hand:'leftHand',view:'front'}},sections:[],events:[],comments:[],bindings:[],audioClips:[],diagnostics:[],seconds:0,natural:false,source:'script'};
 const speakers=lines.flatMap((l,i)=>{const s=l.trim().replace(/\*\*/g,'');const next=lines.slice(i+1).find(l=>l.trim());const m=s.match(/^([\p{L}][\p{L}\s.]{0,35}):\s*(.*)$/u);return m&&(/^[“"„]/.test(m[2])||/^[“"„]/.test(next?.trim()??''))&&!/^(Jakson nimi|Title|Lopetus|Otsikkokortti|Title card|Ending)$/i.test(m[1])?[m[1]]:[];});
 for(const line of lines){const m=line.trim().match(/^(?:Hahmo|Character)\s+([\p{L}][\p{L}\s.]{0,35}):/u);if(m&&!speakers.includes(m[1]))speakers.push(m[1]);}
 for(const line of lines){const m=line.trim().match(/^([\p{L}][\p{L} .]{0,35}?)\s+(?:sanoo|vastaa|says|replies)(?:\s*[:,])?\s*[“"„]/iu);if(m&&!/^(kun|when)\s/i.test(m[1])&&!speakers.includes(m[1]))speakers.push(m[1]);}
 const alias=Object.fromEntries(Object.entries(aliases).map(([k,v])=>[normalizeSpeaker(k),normalizeSpeaker(v)]));
 const resolve=(name:string)=>{const n=normalizeSpeaker(name);const base=speakers.map(normalizeSpeaker).find(stem=>n===stem||(n.startsWith(stem)&&/^(N|EN|UN|AN|ÄN|A|Ä|LLE|LTA|LTÄ|LLA|LLÄ|STA|STÄ)$/.test(n.slice(stem.length))))??n;return alias[base]??base;};
 for(const s of speakers){const n=resolve(s);if(!p.characters.includes(n))p.characters.push(n);}
 if(p.characters.length>4)throw Error('Esityksessä voi olla enintään neljä nimettyä hahmoa. Tekstiä ei katkaistu.');
 p.world.phone.carrier=p.characters[0]??'';
 let section='intro',speaker='',lastDialogue='',comment=false,lastTarget=p.characters[0]??'',count:Record<string,number>={};
 const add=(kind:Event['kind'],target:string,value:string,ref:Ref,extra:Partial<Event>={})=>{const sig=[kind,target,value,ref.text].join('|'),occ=count[sig]=(count[sig]??0)+1;const e:Event={id:'e-'+stableId(sig+'|'+occ),kind,target,value,sourceRef:ref,basis:'rule',section,...extra};p.events.push(e);return e;};
 for(let i=0;i<lines.length;i++){
  const raw=lines[i],line=raw.trim().replace(/^#{1,6}\s*/, '').replace(/\*\*/g,'').replace(/\\$/,'').trim(),ref={line:i+1,text:raw};if(!line)continue;
  if(/^(Character Animator.*ohjaus|Leikkauskieli)/i.test(line)){comment=true;p.comments.push(ref);continue;}if(comment&&/\d+:\d{2}\s*[-–—]\s*\d+:\d{2}/.test(line))comment=false;if(comment){p.comments.push(ref);continue;}
  if(/^(?:Jakson nimi|Title):/i.test(line)){p.metadata.title=line.slice(line.indexOf(':')+1).trim();continue;}
  const title=line.match(/^(.*?)\s*[—–-]\s*S(\d+)E(\d+)\s*:\s*[“"']?(.*?)[”"']?$/i);if(title){p.metadata.series=title[1];p.metadata.season=+title[2];p.metadata.episode=+title[3];p.metadata.title=title[4];continue;}
  if(/^(?:Pituus|Duration|Tavoitepituus):/i.test(line)){const n=line.match(/(\d+)\s*[–—-]\s*(\d+)/);p.metadata.target=n?+n[2]:+(line.match(/\d+/)?.[0]??60);continue;}
  if(/^(?:Tarkoitus|Purpose):/i.test(line)){p.metadata.purpose=line.slice(line.indexOf(':')+1).trim();continue;}if(/^(?:Miljöö|Environment):/i.test(line)){p.metadata.environment=line.slice(line.indexOf(':')+1).trim();continue;}
  if(/^(Kohtaus|Scene):/i.test(line)){section='scene-'+p.sections.length;p.sections.push({id:section,name:line.slice(line.indexOf(':')+1).trim(),start:0,end:1200,sourceRef:ref});speaker='';continue;}
  const times=line.match(/(\d+:\d{2})\s*[-–—]\s*(\d+:\d{2})\s*[-–—]?\s*(.*)/);if(times){section='section-'+p.sections.length;p.sections.push({id:section,name:times[3],start:clock(times[1]),end:clock(times[2]),sourceRef:ref,locked:/lukittu|locked/i.test(times[3])});speaker='';continue;}
  const spoken=line.match(/^([\p{L}][\p{L} .]{0,35}?)\s+(?:sanoo|vastaa|says|replies)(?:\s*[:,])?\s*[“"„](.*)[”"]\.?$/iu);if(spoken&&p.characters.includes(resolve(spoken[1]))){const who=resolve(spoken[1]);lastTarget=who;lastDialogue=add('dialogue',who,'neutral_talk',ref,{text:spoken[2],basis:'estimate'}).id;continue;}
  const inline=line.match(/^([^:]+):\s*[“"„](.*)[”"]$/)??line.match(/^([^:]+):\s*(\S.*)$/);if(inline&&speakers.some(s=>resolve(s)===resolve(inline[1]))){speaker=resolve(inline[1]);lastTarget=speaker;lastDialogue=add('dialogue',speaker,'neutral_talk',ref,{text:inline[2],basis:'estimate'}).id;speaker='';continue;}
  if(speakers.includes(line.replace(/:$/,''))&&line.endsWith(':')){speaker=resolve(line.slice(0,-1));lastTarget=speaker;continue;}
  const quote=line.match(/^[“"„](.*)[”"]$/);if(quote&&speaker){const text=quote[1];lastDialogue=add('dialogue',speaker,'neutral_talk',ref,{text,basis:'estimate'}).id;speaker='';continue;}
  if(/^CUT\s+TO\s+/i.test(line)&&line.toUpperCase().includes(p.metadata.series.toUpperCase())){add('title','scene',p.metadata.series,ref);continue;}
  const cameraLine=line.replace(/laaja(?: kuva)?/ig,'WIDE').replace(/puolikuva/ig,'MEDIUM').replace(/lähikuva/ig,'CLOSE-UP').replace(/^leikkaus(?:\s+hahmoon)?/i,'CUT');
  if(/WIDE|MEDIUM|CLOSE[- ]UP|^CUT\b|olkapään yli|over.*shoulder|zoom|panor|tracking/i.test(cameraLine)){
   for(const fragment of cameraLine.split(/→/)){const size=/WIDE/i.test(fragment)?'wide':/CLOSE[- ]UP/i.test(fragment)?'close':/MEDIUM/i.test(fragment)?'medium':'cut';const t=fragment.match(/^(?:CUT(?:\s+TO)?\s+)?([\p{L}.]+)(?=\s|[.]*$)/iu)?.[1]??'';const match=speakers.find(s=>normalizeSpeaker(fragment).includes(normalizeSpeaker(s)));const target=p.characters.includes(resolve(t))?resolve(t):resolve(match??lastTarget);if(size==='wide'&&!/zoom|panor|tracking/i.test(fragment))add('shot','scene','wide',ref);else if(p.characters.includes(target)){lastTarget=target;add('shot',target,size==='cut'?'medium':size,ref,{after:/repliik.*aikana|during.*line|while.*speaking/i.test(line)?lastDialogue:undefined});}else{add('note',lastTarget,fragment.trim(),ref);p.diagnostics.push({code:'unclear-shot',severity:'warning',message:'Tarkista kuvakohde: '+fragment});}}continue;
  }
  const low=line.toLocaleLowerCase('fi-FI'),namedOriginal=speakers.find(s=>low.startsWith(s.toLocaleLowerCase('fi-FI'))),named=namedOriginal?resolve(namedOriginal):undefined,target=named??lastTarget;
  if(named)lastTarget=named;
  const protectedSeconds=low.match(/(\d+(?:[.,]\d+)?)\s*(?:sekun(?:t|n)|seconds?\b|s\b)/),hold=protectedSeconds?+protectedSeconds[1].replace(',','.'):undefined;
  if((hold!==undefined&&/tauko|hiljais|pidä|odota|ei dialogia|hold|pause|silence|wait/.test(low))||/pieni tauko|hetken aidosti|katsoo .* hetken/.test(low)){const h=add('hold',target,/hiljaisuus|ilmeetön|dead stare|silence/.test(low)?'dead_stare':'pause',ref,{seconds:hold??.25,protected:hold!==undefined,after:lastDialogue||undefined});if(/ei dialogia/.test(low))h.value='silence';continue;}
  let recognized=false;const phoneAction=phoneInstruction(line);if(phoneAction&&phoneAction!=='phone_look'){add('action',target,phoneAction,ref,{seconds:hold??.8});recognized=true;}
  if(/^(ei|älä|do not|don't)(?=\s|[.!:]|$)/.test(low)){add('note',target,line,ref);continue;}
  if(/ei isoa elettä|älä liikuta|ei dissolve|ei dialogia|ei vihaiselta/.test(low)&&!low.includes('loukkaantuneelta')){add('note',target,line,ref);recognized=true;}
  if(/puheli[mn]|phone/.test(low)&&/katsoo|vilkaisee|looks? at|glances?/.test(low)){add('gaze',target,'phone',ref);recognized=true;}
  else if(/katsoo|vilkaisee|tuijottaa|looks? at|glances?/.test(low)){const other=p.characters.find(s=>s!==target&&normalizeSpeaker(line).includes(s))??p.characters.find(s=>s!==target);if(other){add('gaze',target,other,ref);recognized=true;}}
  if(!phoneAction&&/näyttää puhelin|shows? (?:the |a )?phone/.test(low)){add('action',target,'show_phone',ref);recognized=true;}
  const expr=/huolest|worried/.test(low)?'worried':/loukkaant|hurt/.test(low)?'mildly_hurt':/confused|miettii/.test(low)?'confused':/pokerinaam|ilmeetön|vain tuijottaa|dead stare/.test(low)?'dead_stare':/kulmakar|eyebrow/.test(low)?'eyebrow_raise':undefined;
  if(expr){add('expression',target,expr,ref,{after:/sanoo tämän/.test(low)?lastDialogue:undefined});recognized=true;}
  if(!recognized){add('note',target,line,ref);p.diagnostics.push({code:'review-instruction',severity:'warning',message:'Tarkistettava ohje: '+line});}
 }
 let shotTarget='scene';const ordered:Event[]=[];for(const e of p.events){if(e.kind==='shot')shotTarget=e.target;if(e.kind==='dialogue'&&shotTarget!==e.target){ordered.push({...e,id:'shot-'+e.id,kind:'shot',value:'medium',text:undefined,basis:'estimate'});shotTarget=e.target;}ordered.push(e);}p.events=ordered;
 const result=enrichDirection(p);if(!result.events.some(e=>['dialogue','action','title','hold'].includes(e.kind)))throw Error('Esitystapahtumia ei löytynyt. Käytä PUHUJA: ja lainattua repliikkiä tai nimettyjä hahmoja ja tuettuja liikeohjeita.');
 result.production=initProduction(result);return result;
}
