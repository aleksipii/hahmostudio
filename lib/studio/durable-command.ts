/** One mutation in flight. Validation precedes I/O; publication follows its acknowledgment. */
export class DurableCommandGate {
 private pending=false;
 get busy(){return this.pending;}
 async execute<T>(operation:{validate():T;persist(value:T):Promise<void>;publish(value:T):void}):Promise<void>{
  if(this.pending)throw Error('Edellinen muutos odottaa tallennuskuittausta. Kokeile hetken kuluttua uudelleen.');
  this.pending=true;
  try{const value=operation.validate();await operation.persist(value);operation.publish(value);}
  finally{this.pending=false;}
 }
}
export type DurableCommandReceipt={id:string;kind:string;history?:import('./project-history.ts').ProjectHistory};
export function verifyRecoveryAck(ack:unknown,hash:string,size:number,command?:DurableCommandReceipt):void{
 const value=ack as {hash?:unknown;size?:unknown;createdAt?:unknown;command?:DurableCommandReceipt}|null;
 if(command&&value?.command?.id!==command.id)throw Error('Komentojournalin kuittaus osoittaa väärään komentoon.');
 if(!value||value.hash!==hash||value.size!==size||typeof value.createdAt!=='string'||!Number.isFinite(Date.parse(value.createdAt)))throw Error('Pysyvän tallennuksen kuittaus ei vastaa muutosta. Muutosta ei näytetty.');
}

export function assertProjectBase(expected:readonly unknown[],actual:readonly unknown[]):void{if(!expected.slice(0,5).every((v,i)=>v===actual[i]))throw Error('Projektin lähtötila muuttui valmistelun aikana. Yritä uudelleen.');}
