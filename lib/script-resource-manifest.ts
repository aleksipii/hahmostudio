import {backgrounds,type BackgroundId} from './backgrounds.ts';
import {propLibrary} from './prop-library.ts';

export type ScriptResourceKind='background'|'backgroundImage'|'character'|'prop';
export type ScriptResource={kind:ScriptResourceKind;speaker?:string;libraryId?:BackgroundId;imageKey?:string;assetKey?:string;propId?:string;sourceLine:number;label:string};
export type ScriptResourceManifest={schemaVersion:1;resources:ScriptResource[]};

const bgAlias:Record<string,BackgroundId>={
 studio:'studio-v1','studio valoisa':'studio-premium-v1',olohuone:'apartment-v1','kaupunki ilta':'city-evening-v1','auto moderni':'car-interior-v2',
 'kartonkistudio':'cutout-studio-v1','kartonkikatu':'cutout-street-v1','kartonkiauto':'cutout-car-v1','cutout studio':'cutout-studio-v1','cutout street':'cutout-street-v1','cutout car':'cutout-car-v1',
};

const propAlias:Record<string,string>={
 puhelin:'phone-v1',phone:'phone-v1',pöytä:'table-prop-v1',table:'table-prop-v1',
};

export function resolveManifestProp(label:string):string|undefined{
 const trimmed=label.trim();
 if(trimmed==='phone-v1'||trimmed==='table-prop-v1')return trimmed;
 const byId=propLibrary.find(p=>p.id===trimmed);
 if(byId)return byId.id;
 const key=trimmed.toLocaleLowerCase('fi');
 if(propAlias[key])return propAlias[key];
 return propLibrary.find(p=>p.id.replace('-prop-v1','')===key||p.name.toLocaleLowerCase('fi')===key)?.id;
}

export function parseScriptResourceManifest(text:string):ScriptResourceManifest{
 const resources:ScriptResource[]=[];
 for(const [index,raw] of text.replace(/\r\n?/g,'\n').split('\n').entries()){
  const line=index+1,t=raw.trim();if(!t)continue;
  const bg=t.match(/^Resurssi\s+tausta\s*:\s*(.+)$/iu)??t.match(/^Resource\s+background\s*:\s*(.+)$/iu);
  if(bg){
   const label=bg[1].trim(),key=label.toLocaleLowerCase('fi'),id=backgrounds.find(b=>b.id===label)?.id??bgAlias[key];
   resources.push({kind:'background',...(id?{libraryId:id}:{}),sourceLine:line,label});
   continue;
  }
  const image=t.match(/^Resurssi\s+taustakuva\s*:\s*([\w.-]{1,100})$/iu)??t.match(/^Resource\s+background\s+image\s*:\s*([\w.-]{1,100})$/iu);
  if(image){const key=image[1].trim();if(!/^[-a-zA-Z0-9_.]{1,100}$/.test(key))throw Error(`Rivi ${line}: taustakuvan tunniste on virheellinen.`);resources.push({kind:'backgroundImage',imageKey:key,sourceLine:line,label:image[0]});continue;}
  const cast=t.match(/^Resurssi\s+hahmo\s+([\p{L}\d. -]{1,100})\s*:\s*([\w.-]{1,100})$/iu)??t.match(/^Resource\s+character\s+([\p{L}\d. -]{1,100})\s*:\s*([\w.-]{1,100})$/iu);
  if(cast){resources.push({kind:'character',speaker:cast[1].trim(),assetKey:cast[2].trim(),sourceLine:line,label:cast[0]});continue;}
  const prop=t.match(/^Resurssi\s+(?:prop|esine)\s*:\s*(.+)$/iu)??t.match(/^Resource\s+prop\s*:\s*(.+)$/iu);
  if(prop){const label=prop[1].trim(),propId=resolveManifestProp(label);resources.push({kind:'prop',propId:propId??label,sourceLine:line,label});continue;}
 }
 return {schemaVersion:1,resources};
}

export function validateScriptResources(m:ScriptResourceManifest){
 const problems:string[]=[];
 for(const r of m.resources){
  if(r.kind==='background'&&r.libraryId&&!backgrounds.some(b=>b.id===r.libraryId))problems.push(`Rivi ${r.sourceLine}: tuntematon tausta ${r.libraryId}`);
  if(r.kind==='backgroundImage'&&!r.imageKey)problems.push(`Rivi ${r.sourceLine}: taustakuva tarvitsee tunnisteen.`);
  if(r.kind==='character'&&(!r.speaker||!r.assetKey))problems.push(`Rivi ${r.sourceLine}: hahmoresurssi tarvitsee puhujan ja asset-avaimen.`);
  if(r.kind==='prop'&&!resolveManifestProp(r.propId??r.label))problems.push(`Rivi ${r.sourceLine}: prop ${r.propId} ei ole tuettu käsikirjoitusmanifestissa.`);
 }
 return problems;
}
