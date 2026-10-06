export type PresentationImage={name:string;blob:Blob};
const png=/^image\/png$/i;
export function readPresentationImage(v:unknown):PresentationImage{
 const p=v as PresentationImage;
 if(!p||typeof p.name!=='string'||p.name.length>200||!(p.blob instanceof Blob)||!png.test(p.blob.type)||p.blob.size>16*1024*1024)throw Error('Taustakuva on virheellinen (vain PNG, enintään 16 Mt).');
 return {name:p.name,blob:p.blob};
}
