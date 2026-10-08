// Pilvirenderöintien kirjanpito työpöydällä (AGENTS.md: checkpoint ennen dispatchia).
// Järjestys: validoi → kirjoita levylle → vasta sitten lähetä pilviprosessille. Pilviprosessin työt ovat vain
// muistissa, joten sovelluksen tai prosessin uudelleenkäynnistyksen jälkeen keskeneräinen työ on 'interrupted'
// ja vaatii käyttäjän uuden yrityksen. Mitään ei lähetetä uudelleen automaattisesti.
import {join} from 'node:path';
import {readFile,writeFile,rename,mkdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';

export const MAX_RECORDS=50;
const TERMINAL=new Set(['COMPLETED','BLOCKED','FAILED','CANCELLED','interrupted']);
const ID=/^[A-Za-z0-9_.:-]{1,100}$/;
function valid(r){return r&&typeof r.id==='string'&&ID.test(r.id)&&typeof r.state==='string'&&/^[A-Za-z_]{1,40}$/.test(r.state)&&typeof r.at==='string'&&['projectId','sceneId','workflowId'].every(k=>typeof r[k]==='string'&&ID.test(r[k]))&&(r.jobId===undefined||typeof r.jobId==='string'&&ID.test(r.jobId));}

export class CloudJobJournal{
 constructor({dir,now=()=>new Date()}){this.dir=dir;this.file=join(dir,'cloud-render-jobs.json');this.now=now;this.records=null;}
 async #load(){
  if(this.records)return this.records;
  let data=[];try{const parsed=JSON.parse(await readFile(this.file,'utf8'));if(parsed?.schema===1&&Array.isArray(parsed.records))data=parsed.records.filter(valid);}catch{}
  // Edellisen käynnistyksen keskeneräiset työt eivät voi jatkua: pilviprosessin tila oli muistissa.
  let changed=false;this.records=data.map(r=>{if(TERMINAL.has(r.state))return r;changed=true;return {...r,state:'interrupted',at:this.now().toISOString()};});
  if(changed)await this.#persist();
  return this.records;
 }
 async #persist(){
  await mkdir(this.dir,{recursive:true});
  const keep=[...this.records];while(keep.length>MAX_RECORDS){const i=keep.findIndex(r=>TERMINAL.has(r.state));if(i<0)break;keep.splice(i,1);}
  this.records=keep;const tmp=this.file+'.tmp';await writeFile(tmp,JSON.stringify({schema:1,records:keep}),{mode:0o600});await rename(tmp,this.file);
 }
 async list(){return (await this.#load()).map(r=>({...r}));}
 /** Checkpoint ennen lähetystä. Palauttaa kirjauksen tunnisteen; vasta tämän jälkeen saa lähettää. */
 async begin({projectId,sceneId,workflowId}){
  const records=await this.#load();
  if(records.filter(r=>!TERMINAL.has(r.state)).length>=MAX_RECORDS)throw new Error('Liian monta keskeneräistä pilvirenderöintiä.');
  const r={id:randomUUID(),state:'dispatching',projectId,sceneId,workflowId,at:this.now().toISOString()};
  if(!valid(r))throw new Error('Virheellinen renderöintipyyntö.');
  records.push(r);await this.#persist();return r.id;
 }
 async update(id,patch){
  const records=await this.#load(),r=records.find(x=>x.id===id);if(!r)return;
  const next={...r,...patch,at:this.now().toISOString()};if(!valid(next))throw new Error('Virheellinen renderöinnin tila.');
  records[records.indexOf(r)]=next;await this.#persist();
 }
 async byJob(jobId){return (await this.#load()).find(r=>r.jobId===jobId);}
 /** Pilviprosessi päättyi: sen muistissa olleet työt eivät jatku. */
 async interruptAll(){const records=await this.#load();let changed=false;for(let i=0;i<records.length;i++)if(!TERMINAL.has(records[i].state)){records[i]={...records[i],state:'interrupted',at:this.now().toISOString()};changed=true;}if(changed)await this.#persist();}
 static terminal(state){return TERMINAL.has(state);}
}
