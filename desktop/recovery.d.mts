export interface RecoveryEntry {file:string;name:string;hash:string;size:number;createdAt:string;command?:import('../lib/studio/durable-command.ts').DurableCommandReceipt}
export class RecoveryStore {
 delta:import('./delta-journal.mjs').DeltaJournal;
 constructor(dataDir:string);
 save(snapshot:{name:string;bytes:Uint8Array;command?:import('../lib/studio/durable-command.ts').DurableCommandReceipt}):Promise<RecoveryEntry>;
 transaction(request:import('../lib/studio/delta-protocol.ts').DeltaRequest):Promise<RecoveryEntry>;
 importBatch(request:import('../lib/studio/delta-protocol.ts').RecoveryImport):Promise<import('../lib/studio/delta-protocol.ts').ImportedHistory>;
 latest():Promise<import('../lib/studio/recovery.ts').RecoverySnapshot|null>;
 read(reference:import('../lib/studio/project-history.ts').HistoryReference):Promise<{name:string;bytes:Uint8Array;createdAt:string}>;
 clear():Promise<void>;
}
