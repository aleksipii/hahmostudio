// Maintainer build only (Mac). Asentaa Kokoro-ajoympäristön (kokoro-js + riippuvuudet) kansioon .private-runtime/kokoro,
// josta se pakataan sovelluksen resursseihin. Mallipainoja EI pakata: ne ladataan käyttäjän luvalla tietokansioon.
import {mkdir,writeFile,rm} from 'node:fs/promises';import {resolve,join} from 'node:path';import {spawnSync} from 'node:child_process';
const out=resolve('.private-runtime/kokoro');await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
await writeFile(join(out,'package.json'),JSON.stringify({name:'kokoro-runtime',private:true,type:'commonjs',dependencies:{'kokoro-js':'1.2.1'}}));
const r=spawnSync('npm',['install','--omit=dev','--no-audit','--no-fund'],{cwd:out,stdio:'inherit'});
if(r.status!==0)throw Error('Kokoro-ajoympäristön asennus epäonnistui.');
console.log('Valmis: '+out+' (ilman mallipainoja).');
