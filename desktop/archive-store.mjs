import {mkdir,open,rename,readFile,stat,readdir,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
const digest=b=>createHash('sha256').update(b).digest('hex');
const validHash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
/** Owned, content-addressed archives. Callers serialize complete index transactions. */
export class ArchiveStore{
 constructor(dir,budget){this.dir=dir;this.budget=budget;this.writes=Promise.resolve();}
 serial(work){const result=this.writes.then(work);this.writes=result.catch(()=>{});return result;}
 async index(fallback){try{const path=join(this.dir,'index.json');if((await stat(path)).size>32*1024*1024)throw Error('Tallennushakemisto on liian suuri.');return JSON.parse(await readFile(path,'utf8'));}catch(e){if(e.code==='ENOENT')return fallback;throw e;}}
 async writeIndex(value){await mkdir(this.dir,{recursive:true,mode:0o700});const temp=join(this.dir,'index.next'),file=await open(temp,'w',0o600);try{const text=JSON.stringify(value);if(Buffer.byteLength(text)>32*1024**2)throw Error('Tallennushakemisto on liian suuri.');await file.writeFile(text);await file.sync();}finally{await file.close();}await rename(temp,join(this.dir,'index.json'));}
 async put(bytes){
  if(!(bytes instanceof Uint8Array)||!bytes.length||bytes.length>128*1024*1024)throw Error('Tilannekuvan koko on virheellinen.');
  await mkdir(this.dir,{recursive:true,mode:0o700});const hash=digest(bytes),path=join(this.dir,hash+'.hahmo');
  try{await stat(path);await this.get(hash);return hash;}catch(e){if(e.code!=='ENOENT')throw e;}
  let used=0;for(const name of await readdir(this.dir))if(/^[a-f0-9]{64}\.hahmo$/.test(name))used+=(await stat(join(this.dir,name))).size;
  if(used+bytes.length>this.budget)throw Error('Paikallisen arkiston tilaraja täyttyi. Poista tarpeettomia versioita tai vientitöitä; alkuperäisiä projekteja ei poisteta.');
  const temp=path+'.next',file=await open(temp,'w',0o600);try{await file.writeFile(bytes);await file.sync();}finally{await file.close();}await rename(temp,path);return hash;
 }
 async get(hash){if(!validHash(hash))throw Error('Tilannekuvan tunniste on virheellinen.');const path=join(this.dir,hash+'.hahmo'),size=(await stat(path)).size;if(size>128*1024*1024)throw Error('Tilannekuva on liian suuri.');const bytes=new Uint8Array(await readFile(path));if(digest(bytes)!==hash)throw Error('Tilannekuvan tarkistussumma ei täsmää.');return bytes;}
 async prune(hashes){for(const name of await readdir(this.dir).catch(e=>{if(e.code==='ENOENT')return[];throw e;}))if(/^[a-f0-9]{64}\.hahmo\.next$/.test(name)||/^[a-f0-9]{64}\.hahmo$/.test(name)&&!hashes.has(name.slice(0,-6)))await rm(join(this.dir,name),{force:true});}
}
