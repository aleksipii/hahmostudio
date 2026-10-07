import {zipSync,unzipSync,strToU8,strFromU8} from 'fflate';

/** .sarja: series.json + episodes/N.hahmo (sama muoto kuin Jaksot-paneelissa, enintään viisi jaksoa, 128 MiB). */
export const SERIES_LIMIT=5,SERIES_CAP=128*1024*1024;
export type SeriesItem={name:string;bytes:Uint8Array};
export function writeSeriesArchive(items:SeriesItem[]):Uint8Array{
 if(!items.length)throw Error('Sarjassa ei ole jaksoja.');
 if(items.length>SERIES_LIMIT)throw Error('Sarjaan mahtuu enintään viisi jaksoa. Jaa käsikirjoitus useaan sarjaan.');
 const files:Record<string,Uint8Array>={'series.json':strToU8(JSON.stringify({format:'hahmostudio-series',version:1,episodes:items.map(i=>({name:i.name.slice(0,256)}))}))};
 items.forEach((item,i)=>{files[`episodes/${i}.hahmo`]=item.bytes;});
 const data=zipSync(files,{level:0,mtime:new Date('1980-01-01T00:00:00Z')});
 if(data.length>SERIES_CAP)throw Error('Sarjatiedosto ylittää 128 Mt.');
 return data;
}
export function readSeriesArchive(bytes:Uint8Array):SeriesItem[]{
 if(bytes.length>SERIES_CAP)throw Error('Sarja ylittää 128 Mt.');
 let total=0,count=0;const zipped=unzipSync(bytes,{filter:e=>{total+=e.originalSize;if(total>SERIES_CAP||++count>SERIES_LIMIT+1)throw Error('Sarjan purettu koko on liian suuri.');return true;}});
 const m=zipped['series.json']&&zipped['series.json'].length<=10000?JSON.parse(strFromU8(zipped['series.json'])):undefined;
 if(!m||m.format!=='hahmostudio-series'||m.version!==1||!Array.isArray(m.episodes)||m.episodes.length>SERIES_LIMIT)throw Error('Virheellinen sarjatiedosto.');
 return m.episodes.map((e:{name:string},i:number)=>{const b=zipped[`episodes/${i}.hahmo`];if(!b||typeof e?.name!=='string')throw Error('Jakso puuttuu sarjasta.');return {name:e.name,bytes:b};});
}
