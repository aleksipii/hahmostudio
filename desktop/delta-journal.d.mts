export class DeltaJournal {
 constructor(root:string,options?:{externalRead?:(r:unknown)=>Promise<unknown>;failpoint?:(phase:string)=>void|Promise<void>});
 transaction(request:any):Promise<any>;importBatch(request:any):Promise<any>;read(reference:any):Promise<any>;latest():Promise<any>;missing(references:any[]):Promise<string[]>;
}
