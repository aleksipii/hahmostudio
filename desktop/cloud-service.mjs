// KOETA · pilvipalvelu: erillinen utilityProcess, joka käynnistetään vasta käyttäjän opt-inin jälkeen.
// Ei avaa porttia; puhuu vain pääprosessille. Käyttää samaa lib/cloud-render-koodia kuin yksityinen palvelin,
// joten validoinnit, kustannusportti, PaidComputeFirewall ja tulosten tarkistus ovat samat.
// Ympäristö tulee käynnistysviestissä (pääprosessin sallitulista), ei process.env:stä.
let cloud=null;
const post=message=>process.parentPort.postMessage(message);
process.parentPort.on('message',async({data})=>{
 if(data?.type==='stop'){process.exit(0);}
 if(data?.type==='start'&&!cloud){
  try{
   const {createCloudRender}=await import('../lib/cloud-render/server.ts');
   cloud=createCloudRender(Object.freeze({...data.env}),data.dataDir);
   post({type:'ready',storage:cloud.storage.id,policy:cloud.policy.mode});
  }catch(e){post({type:'error',message:e instanceof Error?e.message:'Pilvipalvelun käynnistys epäonnistui.'});process.exit(1);}
  return;
 }
 if(data?.type==='call'&&cloud){
  const {id,route}=data;
  try{const out=await cloud.handle({method:route.method,path:route.path,body:route.body,user:'owner'});post({type:'result',id,status:out.status,body:out.body});}
  catch{post({type:'result',id,status:500,body:{error:'Pilvipalvelun sisäinen virhe.',code:'internal'}});}
 }
});
process.on('SIGTERM',()=>process.exit(0));
