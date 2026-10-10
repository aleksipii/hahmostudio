// Wrap an already built, locally signed KOETA.app in a read-only installation image.
import {spawnSync} from 'node:child_process';
import {mkdtemp,mkdir,writeFile,symlink,rename,rm,stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join,resolve,basename} from 'node:path';
if(process.platform!=='darwin')throw Error('DMG rakennetaan Macilla.');
function run(binary,args){const r=spawnSync(binary,args,{stdio:'inherit'});if(r.error)throw r.error;if(r.status!==0)throw Error(`${binary} epäonnistui (${r.status}).`);}
async function digest(path){const hash=createHash('sha256');for await(const bytes of createReadStream(path))hash.update(bytes);return hash.digest('hex');}
const bundle=resolve(process.argv[2]??`release/KOETA-darwin-${process.arch}/KOETA.app`);
await stat(join(bundle,'Contents/MacOS/KOETA'));run('/usr/bin/codesign',['--verify','--deep','--strict',bundle]);
const plist=spawnSync('/usr/libexec/PlistBuddy',['-c','Print :CFBundleShortVersionString',join(bundle,'Contents/Info.plist')],{encoding:'utf8'});
const version=plist.stdout?.trim();if(plist.status!==0||!/^\d+\.\d+\.\d+(?:[-.][a-zA-Z0-9]+)*$/.test(version))throw Error('Sovelluspaketin versio puuttuu tai on virheellinen.');
const appHash=await digest(join(bundle,'Contents/Resources/app.asar'));
const output=resolve('release',`KOETA-${version}-${process.arch}-${appHash.slice(0,8)}.dmg`),stage=await mkdtemp(join(tmpdir(),'koeta-dmg-'));
try{
 const content=join(stage,'content'),image=join(stage,'KOETA.dmg');await mkdir(content);
 run('/usr/bin/ditto',[bundle,join(content,'KOETA.app')]);await symlink('/Applications',join(content,'Applications'));
 await writeFile(join(content,'ASENNUS.txt'),`KOETA ${version} (${process.arch})\n\nVedä KOETA.app Applications-kansioon. Käynnistä sovellus Ohjelmat-kansiosta.\nPäivitys: tallenna projektit, sulje KOETA (⌘Q), korvaa vanha KOETA.app uudella.\nProjektit ja käyttäjäasetukset sijaitsevat sovelluspaketin ulkopuolella.\nPoista asennuslevy käytöstä asennuksen jälkeen.\n\nLähdekoodi säilyy erillisessä Git-projektissa. DMG ei sisällä kehitysympäristöä\neikä päivitä sovellusta automaattisesti.\n\nPaikallinen ad hoc -allekirjoitus; ei Apple Developer ID -allekirjoitusta\neikä notarisaatiota. Sovelluskohtainen avaamisohje:\nhttps://support.apple.com/102445\n\nBuildin app.asar SHA-256: ${appHash}\n`);
 run('/usr/bin/hdiutil',['create','-volname','KOETA','-srcfolder',content,'-fs','HFS+','-format','UDZO',image]);
 run('/usr/bin/hdiutil',['verify',image]);await mkdir(resolve('release'),{recursive:true});await rename(image,output);
 const imageHash=await digest(output);await writeFile(output+'.sha256',`${imageHash}  ${basename(output)}\n`);
 await writeFile(output+'.json',JSON.stringify({schemaVersion:1,version,arch:process.arch,appAsarSha256:appHash,dmgSha256:imageHash,dmg:basename(output),signature:'ad hoc',notarized:false},null,2)+'\n');
 console.log(output);
}finally{await rm(stage,{recursive:true,force:true});}
