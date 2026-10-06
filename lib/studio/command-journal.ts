export type CommandEntry={id:string;kind:string;revisionBefore:number;revisionAfter:number;createdAt:string};
export function validateCommandJournal(value:unknown):CommandEntry[]{
 if(!Array.isArray(value)||value.length>100)throw Error('Komentohistoria on virheellinen.');const ids=new Set<string>();
 for(const e of value){if(!e||typeof e.id!=='string'||!/^[-a-f0-9]{36}$/.test(e.id)||ids.has(e.id)||!['edit','bind-cast','review','task','tasks','comment','voice','relink-audio'].includes(e.kind)||!Number.isSafeInteger(e.revisionBefore)||e.revisionBefore<1||!Number.isSafeInteger(e.revisionAfter)||e.revisionAfter<e.revisionBefore||typeof e.createdAt!=='string'||!Number.isFinite(Date.parse(e.createdAt)))throw Error('Komentohistorian merkintä on virheellinen.');ids.add(e.id);}
 return structuredClone(value);
}
