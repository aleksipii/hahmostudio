/**
 * Tekoäly-paneelin tilamalli. Puhdas ja deterministinen: rivit syntyvät vain sovelluksen todellisista tiloista
 * (mallin asennus, kameran lupa, istunnon viimeisin tulos). Ominaisuus, jota ei ole, ei saa riviä eikä painiketta.
 * Kustannus on aina €0,00 tai estetty: työpöytä ei koskaan käytä maksullista laskentaa.
 */
export type AiFeatureId='rhubarb'|'whisper'|'kokoro'|'face'|'cloud-render';
export type AiLocation='local'|'cloud'|'off';
export type AiPermission='granted'|'missing'|'denied'|'not-needed'|'unknown';
export type AiActivity={at:string;ok:boolean;text:string};
export type AiStatusRow={id:AiFeatureId;name:string;location:AiLocation;permission:AiPermission;permissionText:string;data:string;cost:'€0,00'|'estetty';last?:AiActivity;note?:string;available:boolean};
export type AiStatusInput={
 audioModel?:{model:boolean;binary:boolean}|null;
 kokoro?:{installed:boolean;error?:string}|null;
 camera?:'granted'|'denied'|'prompt'|'unknown';
 /** Pilvirenderöinti työpöydällä tulee vaiheessa 3. Siihen asti vain ei saatavilla, ei toimintoa. */
 cloud?:{available:false};
 activity?:Partial<Record<AiFeatureId,AiActivity>>;
};
export const LOCATION_FI:Record<AiLocation,string>={local:'Paikallinen',cloud:'Pilvi',off:'Pois'};

export function aiStatusRows(input:AiStatusInput):AiStatusRow[]{
 const last=function(id:AiFeatureId){return input.activity?.[id];};
 const rows:AiStatusRow[]=[];
 rows.push({id:'rhubarb',name:'Suun asennot puheesta (Rhubarb)',location:'local',permission:'not-needed',permissionText:'Ei tarvita: mukana sovelluksessa',data:'Ei lähde minnekään: ääni käsitellään tällä koneella.',cost:'€0,00',last:last('rhubarb'),available:true});
 if(input.audioModel!==undefined){
  const ready=!!input.audioModel&&input.audioModel.model&&input.audioModel.binary;
  rows.push({id:'whisper',name:'Litterointi (whisper.cpp)',location:ready?'local':'off',permission:ready?'granted':'missing',permissionText:ready?'Malli asennettu tälle koneelle':'Mallia ei ole ladattu (lataus kysyy luvan)',data:'Ei lähde minnekään: litterointi tehdään tällä koneella.',cost:'€0,00',last:last('whisper'),available:ready});
 }
 if(input.kokoro!==undefined){
  const ready=!!input.kokoro?.installed&&!input.kokoro.error;
  rows.push({id:'kokoro',name:'Englanninkielinen puhe (Kokoro)',location:ready?'local':'off',permission:ready?'granted':'missing',permissionText:ready?'Malli ladattu luvallasi sovelluksen tietokansioon':'Mallia ei ole ladattu (lataus kysyy luvan)',data:'Ei lähde minnekään: puhe tuotetaan tällä koneella.',cost:'€0,00',last:last('kokoro'),note:'Vain englanninkieliset repliikit. Luodut äänet merkitään synteettisiksi; oma tai tuotu ääni on aina etusijalla.'+(input.kokoro?.error?' Virhe: '+input.kokoro.error:''),available:ready});
 }
 if(input.camera!==undefined){
  const permission:AiPermission=input.camera==='granted'?'granted':input.camera==='denied'?'denied':input.camera==='prompt'?'missing':'unknown';
  const text={granted:'Kameran käyttö sallittu',denied:'Kameran käyttö estetty',missing:'Kysytään, kun kamera otetaan käyttöön',unknown:'Kameran lupaa ei voitu lukea','not-needed':''}[permission];
  rows.push({id:'face',name:'Kasvojen seuranta (MediaPipe)',location:'local',permission,permissionText:text,data:'Ei lähde minnekään: kamerakuva käsitellään tällä koneella.',cost:'€0,00',last:last('face'),available:permission==='granted'});
 }
 if(input.cloud)rows.push({id:'cloud-render',name:'Pilvirenderöinti',location:'off',permission:'not-needed',permissionText:'Ei saatavilla',data:'Ei mitään.',cost:'estetty',note:'Pilvirenderöinti ei ole vielä saatavilla työpöytäsovelluksessa. Kun se tulee, se on oletuksena pois ja vaatii erillisen luvan.',available:false});
 return rows;
}

/** Istunnon viimeisimmät tekoälytulokset. Vain muistissa: ei projektiin, ei levylle. */
const activity:Partial<Record<AiFeatureId,AiActivity>>={};
const listeners=new Set<()=>void>();
export function recordAiActivity(id:AiFeatureId,ok:boolean,text:string,now:Date=new Date()){activity[id]={at:now.toISOString(),ok,text:text.slice(0,160)};for(const l of listeners)l();}
export function aiActivity():Partial<Record<AiFeatureId,AiActivity>>{return {...activity};}
export function onAiActivity(listener:()=>void):()=>void{listeners.add(listener);return function(){listeners.delete(listener);};}

/** Seuraa lupauksen tulosta muuttamatta sitä. Virhe välitetään eteenpäin sellaisenaan. */
export function trackAi<T>(id:AiFeatureId,promise:Promise<T>,describe:(value:T)=>string):Promise<T>{
 return promise.then(function(value){recordAiActivity(id,true,describe(value));return value;},function(error:unknown){recordAiActivity(id,false,error instanceof Error?error.message:'Epäonnistui.');throw error;});
}
