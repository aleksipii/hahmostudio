import http from 'node:http';
import {recognizeSpeech,validateSpeechWav} from './speech-recognizer.mjs';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { readFile, writeFile, mkdir, realpath } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
const derive=promisify(scrypt);
const hash=async(password,salt)=>Buffer.from(await derive(password,salt,64,{N:32768,maxmem:64*1024*1024}));
const equal=(a,b)=>{const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);};
export async function createPrivateServer({distDir,dataDir,origin,setupToken='',secure=false,speechRecognizer=recognizeSpeech}={}) {
 const root=await realpath(distDir),store=resolve(dataDir),ownerPath=resolve(store,'owner.json');await mkdir(store,{recursive:true,mode:0o700});
 let owner=null;try{owner=JSON.parse(await readFile(ownerPath,'utf8'));if(typeof owner.username!=='string'||typeof owner.salt!=='string'||typeof owner.hash!=='string')throw new Error('Invalid owner record');}catch(e){if(e.code!=='ENOENT')throw e;}
 const sessions=new Map(),attempts=new Map();let settingUp=false,speechRunning=false;
 const cookie=(name,value,age)=>`${name}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${secure?'; Secure':''}`;
 const body=async(req)=>{let bytes=0,chunks=[];for await(const chunk of req){bytes+=chunk.length;if(bytes>8192)throw new Error('Body too large');chunks.push(chunk);}return JSON.parse(Buffer.concat(chunks).toString('utf8'));};
 const loginPage=(nonce)=>`<!doctype html><html lang="fi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hahmostudio · oma studio</title><style nonce="${nonce}">*{box-sizing:border-box}body{margin:0;background:#191c1e;color:#e4e7e7;font:16px system-ui;min-height:100vh;display:grid;place-items:center;padding:24px}main{width:min(440px,100%)}small{color:#b6e976;letter-spacing:2px}h1{font-size:38px}p{line-height:1.6;color:#aeb5b9}label{display:block;margin:18px 0 6px}input{width:100%;padding:14px;border:1px solid #4b5357;border-radius:7px;background:#252a2d;color:#fff;font:inherit}button{width:100%;padding:14px;margin-top:24px;background:#b6e976;border:0;border-radius:7px;font:inherit;font-weight:600;cursor:pointer}button:disabled{opacity:.5}#error{color:#ffb5a3}a{color:#b6e976}</style><main><small>OMA ANIMAATIOSTUDIO</small><h1>hahmostudio.</h1><p id="intro">Kirjaudu omaan studioosi. Hahmot ja animaatiot käsitellään tällä koneella.</p><form id="form"><label for="username">Käyttäjätunnus</label><input id="username" name="username" autocomplete="username" minlength="3" maxlength="64" required><label for="password">Salasana</label><input id="password" name="password" type="password" autocomplete="current-password" maxlength="128" required><div id="setup" hidden><label for="confirm">Salasana uudelleen</label><input id="confirm" type="password" autocomplete="new-password"><div id="token-row" hidden><label for="token">Käyttöönottoavain</label><input id="token" type="password" autocomplete="off"></div><p>Ensimmäinen käyttäjä on studion ainoa käyttäjä. Salasanan tulee olla vähintään 12 merkkiä.</p></div><p id="error" role="alert"></p><button id="submit" disabled>Odota…</button></form></main><script nonce="${nonce}">
let setup=false;const form=document.querySelector('#form'),button=document.querySelector('#submit'),error=document.querySelector('#error');
fetch('/api/auth/status').then(r=>r.json()).then(s=>{setup=!s.hasOwner;document.querySelector('#setup').hidden=!setup;document.querySelector('#token-row').hidden=!s.needsToken;document.querySelector('#password').autocomplete=setup?'new-password':'current-password';document.querySelector('#confirm').required=setup;if(setup){document.querySelector('#password').minLength=12;document.querySelector('#intro').textContent='Luo oma käyttäjätunnuksesi. Tämän jälkeen uusien tunnusten luominen suljetaan.';}button.textContent=setup?'Luo oma tunnus':'Kirjaudu';button.disabled=false;}).catch(()=>{error.textContent='Palvelimeen ei saada yhteyttä.';});
form.addEventListener('submit',async e=>{e.preventDefault();error.textContent='';const password=document.querySelector('#password').value;if(setup&&password!==document.querySelector('#confirm').value){error.textContent='Salasanat eivät täsmää.';return;}button.disabled=true;try{const r=await fetch(setup?'/api/auth/setup':'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:document.querySelector('#username').value,password,setupToken:document.querySelector('#token').value})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Kirjautuminen epäonnistui.');location.assign('/');}catch(e){error.textContent=e.message;}finally{button.disabled=false;}});
</script></html>`;
 const server=http.createServer(async(req,res)=>{
  const nonce=randomBytes(18).toString('base64');
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Content-Security-Policy',`default-src 'self'; script-src 'self' 'wasm-unsafe-eval' 'nonce-${nonce}'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; worker-src 'self' blob:; connect-src 'self'; media-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'`);
  const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
  try {
   const address=new URL(req.url,'http://localhost'),path=address.pathname;
   const expected=origin??`http://${req.headers.host}`;
   if(!origin&&!['localhost','127.0.0.1','[::1]'].includes(new URL(expected).hostname)){send(403,{error:'Virheellinen palvelinosoite.'});return;}
   const cookieName=`hahmostudio_session_${new URL(expected).port||(secure?'443':'80')}`;
   const token=req.headers.cookie?.split(';').map(c=>c.trim()).find(c=>c.startsWith(cookieName+'='))?.slice(cookieName.length+1);
   const session=token?sessions.get(token):undefined;const authorized=!!session&&session> Date.now();if(session&&!authorized)sessions.delete(token);
   if(req.method==='GET'&&path==='/api/auth/status'){send(200,{hasOwner:!!owner,needsToken:!!setupToken,authenticated:authorized});return;}
   if(req.method==='POST'&&path.startsWith('/api/auth/')){
    if(req.headers.origin!==expected||!req.headers['content-type']?.startsWith('application/json')){send(403,{error:'Pyyntö ei ole sallittu.'});return;}
    if(path==='/api/auth/logout'){if(token)sessions.delete(token);res.setHeader('Set-Cookie',cookie(cookieName,'',0));send(200,{ok:true});return;}
    if(!['/api/auth/login','/api/auth/setup'].includes(path)){send(404,{error:'Ei löydy.'});return;}
    const ip=req.socket.remoteAddress,now=Date.now(),count=attempts.get(ip);if(count&&count.until>now&&count.count>=8){send(429,{error:'Liian monta yritystä. Odota 15 minuuttia.'});return;}
    for(const[k,v]of attempts)if(v.until<=now)attempts.delete(k);attempts.set(ip,{count:count&&count.until>now?count.count+1:1,until:count&&count.until>now?count.until:now+900000});
    let data;try{data=await body(req);}catch{send(400,{error:'Virheellinen pyyntö.'});return;}
    const {username,password}=data??{};if(typeof username!=='string'||typeof password!=='string'||password.length>128||username.length>64){send(400,{error:'Virheelliset kirjautumistiedot.'});return;}
    if(path==='/api/auth/setup'){
     if(owner||settingUp){send(409,{error:'Käyttäjätunnus on jo luotu.'});return;}
     if(setupToken&&!equal(String(data.setupToken??''),setupToken)){send(403,{error:'Virheellinen käyttöönottoavain.'});return;}
     if(!/^[a-zA-Z0-9._-]{3,64}$/.test(username)||password.length<12){send(400,{error:'Tunnus: 3–64 kirjainta, numeroa tai ._-; salasana: vähintään 12 merkkiä.'});return;}
     settingUp=true;
     try{const salt=randomBytes(32).toString('hex'),record={username,salt,hash:(await hash(password,salt)).toString('hex')};await writeFile(ownerPath,JSON.stringify(record),{flag:'wx',mode:0o600});owner=record;}finally{settingUp=false;}
    }else{
     const derived=await hash(password,owner?.salt??'unconfigured-owner');
     if(!owner||username!==owner.username||!equal(derived,Buffer.from(owner.hash,'hex'))){send(401,{error:'Tunnus tai salasana on väärä.'});return;}
    }
    attempts.delete(ip);for(const[k,v]of sessions)if(v<=now)sessions.delete(k);const id=randomBytes(32).toString('hex');sessions.set(id,Date.now()+12*3600000);res.setHeader('Set-Cookie',cookie(cookieName,id,12*3600));send(200,{ok:true});return;
   }
   if(path==='/login'&&req.method==='GET'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(loginPage(nonce));return;}
   if(!authorized){if(path.startsWith('/api/'))send(401,{error:'Kirjaudu ensin.'});else{res.writeHead(302,{Location:'/login'});res.end();}return;}
   if(path==='/api/speech/recognize'&&req.method==='POST'){
    if(req.headers.origin!==expected||!req.headers['content-type']?.startsWith('audio/wav')){send(403,{error:'Pyyntö ei ole sallittu.'});return;}
    const language=address.searchParams.get('language');if(!['fi','en'].includes(language)){send(400,{error:'Valitse suomi tai englanti.'});return;}
    if(speechRunning){send(409,{error:'Edellinen äännetunnistus on kesken.'});return;}speechRunning=true;const controller=new AbortController();const disconnected=()=>{if(!res.writableEnded)controller.abort();};res.on('close',disconnected);
    try{let bytes=0;const chunks=[];for await(const chunk of req){bytes+=chunk.length;if(bytes>1920044)throw new Error('Äänitiedosto on liian suuri. Enimmäiskesto on 60 sekuntia.');chunks.push(chunk);}const wav=Buffer.concat(chunks);validateSpeechWav(wav);const mouthCues=await speechRecognizer(wav,language,controller.signal);if(!controller.signal.aborted)send(200,{mouthCues});}catch(e){if(!controller.signal.aborted)send(400,{error:e.message?.includes('Paikallinen äännetunnistin')?e.message:e.message?.includes('WAV')||e.message?.includes('Enimmäiskesto')?e.message:'Äännetunnistus epäonnistui. Tarkista äänitiedosto ja paikallinen tunnistin.'});}finally{res.off('close',disconnected);speechRunning=false;}return;
   }
   if(!['GET','HEAD'].includes(req.method)){send(405,{error:'Menetelmä ei ole sallittu.'});return;}
   let decoded;try{decoded=decodeURIComponent(path);}catch{send(400,{error:'Virheellinen polku.'});return;}
   const candidate=resolve(root,'.'+(decoded==='/'?'/index.html':decoded));if(!candidate.startsWith(root+sep)){send(404,{error:'Ei löydy.'});return;}
   let file;try{file=await realpath(candidate);}catch{send(404,{error:'Ei löydy.'});return;}if(!file.startsWith(root+sep)){send(404,{error:'Ei löydy.'});return;}
   const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json','.psd':'application/octet-stream','.wasm':'application/wasm'};
   const bytes=await readFile(file);res.writeHead(200,{'Content-Type':types[extname(file)]??'application/octet-stream'});res.end(req.method==='HEAD'?undefined:bytes);
  }catch{if(!res.headersSent)send(500,{error:'Palvelinvirhe. Kokeile uudelleen.'});else res.end();}
 });return server;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const host=process.env.HAHMOSTUDIO_HOST??'127.0.0.1',origin=process.env.HAHMOSTUDIO_ORIGIN,remote=!['127.0.0.1','localhost','::1'].includes(host);
 if(remote&&(!origin?.startsWith('https://')||!process.env.HAHMOSTUDIO_SETUP_TOKEN)){throw new Error('Remote hosting requires HTTPS origin and a setup token.');}
 const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
 const server=await createPrivateServer({distDir:resolve(root,'dist'),dataDir:process.env.HAHMOSTUDIO_DATA_DIR??resolve(root,'.private-storage'),origin,setupToken:process.env.HAHMOSTUDIO_SETUP_TOKEN,secure:!!origin?.startsWith('https://')});
 server.listen(Number(process.env.PORT??4176),host,()=>console.log(`Hahmostudio: ${origin??`http://${host}:${process.env.PORT??4176}`}`));
}
