import type {HistoryReference,ProjectHistory} from './project-history';
import type {DurableCommandReceipt} from './durable-command';
import type {SemanticDelta} from './semantic-delta';
export type ResourceReference={path:string;hash:string;size:number;chunks?:{hash:string;size:number}[]};
export type DeltaRequest={version:1;name:string;base?:HistoryReference;delta:SemanticDelta;resources:{set:ResourceReference[];remove:string[]};uploads:{hash:string;bytes:Uint8Array}[];command:DurableCommandReceipt};
export type RecoveryImport={name:string;past:Uint8Array[];future:Uint8Array[];current:Uint8Array};
export type ImportedHistory={history:ProjectHistory;reference:HistoryReference};
