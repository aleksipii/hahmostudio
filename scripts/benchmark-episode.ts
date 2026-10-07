// Jaksonrakennuksen mittaus: 60 s jakso, kaksi hahmoa, 10 toistoa. Ajo: node --experimental-strip-types scripts/benchmark-episode.ts
import {readFileSync} from 'node:fs';
import os from 'node:os';
import {readProject} from '../lib/project-file.ts';
import {buildEpisode,catalogFromNames,packsNeeded} from '../lib/episode-builder.ts';
import {CHARACTER_PACK_OPTIONS} from '../lib/speaker-pack-options.ts';
const scene=(i:number)=>`MIRA:\n"Repliikki numero ${i} on tässä ja kestää hetken."\nNiko nyökkää.\nNIKO:\n"Vastaus ${i} tulee tässä."\nMira vilkuttaa 1 s.\nNiko kävelee oikealle 2 s.\n`;
const text='Musiikki: rauhallinen\nINT. KEITTIÖ\nMira seisoo puhelin kädessä.\n'+Array.from({length:10},(_,i)=>scene(i)).join('');
const packs=catalogFromNames(CHARACTER_PACK_OPTIONS),assets:Record<string,any>={};
for(const n of packsNeeded(text,packs)){const r=await readProject(new Blob([readFileSync(new URL(`../public/library/${n}.hahmo`,import.meta.url))]));assets[n]={doc:r.doc,animation:r.animation};}
const times:number[]=[];let seconds=0;
for(let i=0;i<10;i++){const t=performance.now();const b=buildEpisode(text,{packs,assets},{fps:24});times.push(performance.now()-t);seconds=b.presentation.seconds;}
times.sort((a,b)=>a-b);
console.log(JSON.stringify({machine:`${os.cpus()[0]?.model} · ${os.cpus().length} ytimen · Node ${process.version}`,episodeSeconds:+seconds.toFixed(1),medianMs:+times[5].toFixed(1),maxMs:+times[9].toFixed(1),minMs:+times[0].toFixed(1)}));
