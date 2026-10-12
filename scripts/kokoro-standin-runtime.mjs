// Pilvi/Linux-testiympäristö: Kokoron sijaismoottori ja ffmpeg-kääre vientisynkan GUI-testiin ilman mallipainoja.
// EI aito Kokoro-inferenssi: tuottaa deterministisen tavumaisen äänen (sävelkorkeus + kohina + verhokäyrä), jotta
// repliikin liittäminen, suuajat, jakson koostus, MP4-vienti ja dekoodatun äänen ajoitus voidaan mitata.
// Kieltäytyy, jos .private-runtime/kokoro sisältää jo oikean runtimen. Mac-ajo käyttää aina oikeaa runtimea ja mallia.
import {createHash} from 'node:crypto';
import {existsSync} from 'node:fs';
import {chmod,mkdir,readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const root=resolve('.private-runtime'),runtime=join(root,'kokoro'),data=resolve(process.argv[2]??'.private-runtime/kokoro-standin-data');
const marker=join(runtime,'STANDIN');
if(existsSync(join(runtime,'node_modules','kokoro-js'))&&!existsSync(marker))throw Error('Oikea Kokoro-runtime löytyi; sijaismoottoria ei kirjoiteta sen päälle.');

const pkg=(name,body)=>[[join(runtime,'node_modules',name,'package.json'),JSON.stringify({name,version:'0.0.0-standin',main:'index.js'})+'\n'],[join(runtime,'node_modules',name,'index.js'),body]];
const files=[
 [join(runtime,'package.json'),JSON.stringify({name:'kokoro-standin-runtime',private:true})+'\n'],
 [marker,'Sijaismoottori pilvitestiin. Ei Kokoro-mallia eikä aitoa inferenssiä.\n'],
 ...pkg('@huggingface/transformers','exports.env={};\n'),
 ...pkg('kokoro-js',await readFile(new URL('./kokoro-standin-engine.cjs',import.meta.url),'utf8'))
];
for(const [path,body] of files){await mkdir(join(path,'..'),{recursive:true});await writeFile(path,body);}

// Mallikansio: manifestin koko ja tarkiste vastaavat tiedostoja, sisältö kertoo olevansa sijainen.
const modelId='onnx-community/Kokoro-82M-v1.0-ONNX',modelDir=join(data,'kokoro','models',modelId),entries=[];
for(const path of ['config.json','tokenizer.json','tokenizer_config.json','onnx/model_quantized.onnx']){
 const file=join(modelDir,path),body=Buffer.from(JSON.stringify({standin:true,path})+'\n');await mkdir(join(file,'..'),{recursive:true});await writeFile(file,body);
 entries.push({path,size:body.length,sha256:createHash('sha256').update(body).digest('hex')});
}
await writeFile(join(data,'kokoro','manifest.json'),JSON.stringify({schemaVersion:1,modelVersion:'Kokoro-82M-v1.0-ONNX',source:'standin',license:'Apache-2.0',downloadedAt:new Date().toISOString(),files:entries}));

// ffmpeg-kääre: Linuxin ffmpegissä ei ole libopenh264:ää eikä VideoToolboxia; libopenh264 → libx264 vain tässä testissä.
const system=spawnSync('sh',['-c','command -v ffmpeg'],{encoding:'utf8'}).stdout.trim();if(!system)throw Error('ffmpeg puuttuu');
const bin=join(root,'native','bin');await mkdir(bin,{recursive:true});
await writeFile(join(bin,'ffmpeg'),`#!/bin/sh\n# Sijaiskääre pilvitestiin (ei Mac-paketin ffmpeg).\nfor a; do shift; [ "$a" = libopenh264 ] && a=libx264; set -- "$@" "$a"; done\nexec ${system} "$@"\n`);await chmod(join(bin,'ffmpeg'),0o755);
const probe=spawnSync('sh',['-c','command -v ffprobe'],{encoding:'utf8'}).stdout.trim();if(!probe)throw Error('ffprobe puuttuu');
await writeFile(join(bin,'ffprobe'),`#!/bin/sh\nexec ${probe} "$@"\n`);await chmod(join(bin,'ffprobe'),0o755);
console.log(JSON.stringify({runtime,modelData:data,ffmpeg:join(bin,'ffmpeg'),standin:true,realInference:false}));
