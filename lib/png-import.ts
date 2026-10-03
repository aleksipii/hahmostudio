import type {PsdDocument} from './psd-model.ts';
/** A PNG is one honest image layer; no body segmentation or hidden-part synthesis. */
export async function importPng(file:Blob,name:string):Promise<PsdDocument>{
 if(file.size>100*1024*1024||file.size<33)throw new Error('PNG-tiedosto on virheellinen tai yli 100 Mt.');
 const header=new Uint8Array(await file.slice(0,33).arrayBuffer()),v=new DataView(header.buffer);
 if(![137,80,78,71,13,10,26,10].every((b,i)=>header[i]===b)||v.getUint32(8)!==13||new TextDecoder().decode(header.slice(12,16))!=='IHDR')throw new Error('PNG-kuvan otsake on virheellinen.');
 const width=v.getUint32(16),height=v.getUint32(20);if(!width||!height||width*height>16000000||width>32768||height>32768)throw new Error('PNG-kuvan enimmäiskoko on 16 megapikseliä.');
 const png=new Blob([file],{type:'image/png'}),warning='PNG tuotiin yhtenä kuvatasona. Osia ei erotella automaattisesti; käytä erillisiä PSD-tasoja raajojen animointiin.';
 return {name,width,height,size:file.size,composite:png,warnings:[warning],layers:[{key:'/0',name:name.replace(/\.png$/i,''),path:name.replace(/\.png$/i,''),kind:'layer',left:0,top:0,width,height,opacity:1,visible:true,blendMode:'normal',png,children:[],warnings:[]}]};
}
