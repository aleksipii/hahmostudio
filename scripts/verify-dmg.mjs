// Mount only the supplied image, read its app, then detach; never installs it.
import {spawnSync} from 'node:child_process';
import {mkdtemp,mkdir,readFile,readlink,rm} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join,resolve,basename} from 'node:path';
if(process.platform!=='darwin'||!process.argv[2])throw Error('Käyttö Macilla: node scripts/verify-dmg.mjs release/KOETA-….dmg');
function run(binary,args){const r=spawnSync(binary,args,{stdio:'inherit'});if(r.error)throw r.error;if(r.status!==0)throw Error(`${binary} epäonnistui (${r.status}).`);}
async function digest(path){const hash=createHash('sha256');for await(const bytes of createReadStream(path))hash.update(bytes);return hash.digest('hex');}
const image=resolve(process.argv[2]),metadata=JSON.parse(await readFile(image+'.json','utf8'));
if(metadata.dmg!==basename(image)||metadata.arch!==process.arch||await digest(image)!==metadata.dmgSha256)throw Error('DMG:n tunniste, arkkitehtuuri tai tarkistussumma ei täsmää.');
const stage=await mkdtemp(join(tmpdir(),'koeta-dmg-check-')),mount=join(stage,'mount');let attached=false;
try{
 await mkdir(mount);run('/usr/bin/hdiutil',['attach',image,'-readonly','-nobrowse','-noautoopen','-mountpoint',mount]);attached=true;
 if(await readlink(join(mount,'Applications'))!=='/Applications')throw Error('Applications-linkki on virheellinen.');
 if(await digest(join(mount,'KOETA.app/Contents/Resources/app.asar'))!==metadata.appAsarSha256)throw Error('Asennuslevyn sovellus ei vastaa lähtöpakettia.');
 run('/usr/bin/codesign',['--verify','--deep','--strict',join(mount,'KOETA.app')]);
 console.log(JSON.stringify({ok:true,dmg:basename(image),appAsarSha256:metadata.appAsarSha256,applicationLink:true,signatureVerified:true,notarized:false,installed:false},null,2));
}finally{
 if(attached)run('/usr/bin/hdiutil',['detach',mount]);await rm(stage,{recursive:true,force:true});
}
