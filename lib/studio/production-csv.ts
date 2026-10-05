import {seconds,type Shot} from './domain.ts';
import type {ProductionOverview} from './production-overview.ts';
/** Quote every text cell; protect spreadsheet formula prefixes without executing or interpreting input. */
export function csvText(value:string){const text=value.replace(/\u0000/g,'');const safe=/^[\s\u0001-\u001f]*[=+\-@]/u.test(text)?"'"+text:text;return '"'+safe.replace(/"/g,'""')+'"';}
export function productionCsvFilename(title:string){const cleaned=title.normalize('NFKC').replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g,'-').replace(/^[. -]+|[. -]+$/g,'');let safe='',bytes=0;const encoder=new TextEncoder();for(const char of cleaned){const size=encoder.encode(char).length;if(bytes+size>180)break;safe+=char;bytes+=size;}return(safe||'Jakso')+'-tyojono.csv';}

const statuses={draft:'Luonnos',approved:'Hyväksytty',locked:'Lukittu'};
const audio={missing:'Ääniviite puuttuu',ready:'Ääniviite liitetty',silent:'Ei repliikkejä'};
/** Immutable snapshot of the displayed overview; include all matching rows, not merely the visible page. */
export function exportProductionCsv(overview:ProductionOverview,shots:Shot[]=overview.episode.shots):string{
 const known=new Map(overview.episode.shots.map(s=>[s.id,s])),seen=new Set<string>(),scenes=new Map(overview.episode.scenes.map(s=>[s.id,s.name]));
 const headers=['Jakso-ID','Jakso','Sisältörevisio','Vertailupäivä','Kohtaus','Kuva-ID','Kuva','Tila','Alku (s)','Kesto (s)','Alku (tick)','Kesto (tick)','Hahmot','Vastuuhenkilö','Määräaika','Myöhässä','Ääniviitteet','Avoimet kommentit','Virheet','Teknisesti tarkistettavissa'];
 const rows=[headers.map(csvText).join(';')];
 for(const selected of shots){const shot=known.get(selected.id);if(!shot||seen.has(shot.id))throw Error('CSV-viennin kuva ei kuulu valmisteluun tai esiintyy kahdesti.');seen.add(shot.id);const task=overview.tasks[shot.id],values=[overview.episode.id,overview.episode.name,String(overview.episode.revision),overview.today,scenes.get(shot.sceneId)??'',shot.id,shot.name,statuses[shot.status],seconds(shot.at).toFixed(6).replace('.',','),seconds(shot.duration).toFixed(6).replace('.',','),String(shot.at),String(shot.duration),shot.characterIds.join(' | '),task?.owner??'',task?.dueDate??'',overview.overdue(shot)?'Kyllä':'Ei',audio[shot.audioStatus],String(overview.byShot.get(shot.id)??0),String(shot.errors.length),overview.ready(shot)?'Kyllä':'Ei'];rows.push(values.map(csvText).join(';'));}
 return '\uFEFF'+rows.join('\r\n')+'\r\n';
}
