// Claude 12.10.2026: selaimen näppäimistö-, fokus- ja axe-tarkistus (Chromium + valemikrofoni). Ei VoiceOver, ei fyysinen laite.
// Ajo: npm run dev (portti 5173), erillisessä kansiossa: npm i playwright@1.56.1 axe-core@4.10.2 && node selain-nappaimisto.mjs
import {chromium} from 'playwright';import {readFileSync,writeFileSync} from 'node:fs';
const axe=readFileSync('node_modules/axe-core/axe.min.js','utf8');
const b=await chromium.launch({args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']});
let p,ctx;const errs=[];const newPage=async()=>{if(ctx)await ctx.close();ctx=await b.newContext({viewport:{width:1440,height:900}});p=await ctx.newPage();p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,200))});};await newPage();
const out=[];const log=(name,ok,detail)=>{out.push({name,ok,detail});console.log((ok===true?'PASS ':ok===false?'FAIL ':'INFO ')+name+(detail!==undefined?' '+JSON.stringify(detail).slice(0,600):''));};
const sleep=ms=>p.waitForTimeout(ms);
const click=async name=>{await p.evaluate(n=>{const e=[...document.querySelectorAll('button')].find(e=>(e.getAttribute('aria-label')||e.textContent.trim())===n&&!e.disabled&&e.getClientRects().length);if(!e)throw Error('Missing '+n);e.click();},name);await sleep(300);};
const phase=async n=>{await p.evaluate(n=>document.querySelector(n==='workshop'?'.s2-workshop':`.s2-phase[data-studio-flow-step="${n}"]`).click(),n);await sleep(300);};
const active=()=>p.evaluate(()=>{const e=document.activeElement;if(!e||e===document.body)return {tag:'BODY'};const cs=getComputedStyle(e);const name=(e.getAttribute('aria-label')||e.labels?.[0]?.textContent||e.getAttribute('title')||e.textContent||e.getAttribute('placeholder')||'').trim().replace(/\s+/g,' ').slice(0,50);const r=e.getBoundingClientRect();return {tag:e.tagName,role:e.getAttribute('role'),name,ring:(cs.outlineStyle!=='none'&&parseFloat(cs.outlineWidth)>0)||cs.boxShadow!=='none',visible:r.width>0&&r.height>0&&r.bottom>0&&r.top<innerHeight,inDialog:!!e.closest('[role=dialog],[role=alertdialog],dialog,[aria-modal=true]')};});
const runAxe=async label=>{await p.addScriptTag({content:axe}).catch(()=>{});const r=await p.evaluate(async()=>{const r=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}});return r.violations.map(v=>({id:v.id,impact:v.impact,n:v.nodes.length,ex:v.nodes.slice(0,3).map(n=>n.target.join(' ')+' :: '+(n.failureSummary||'').split('\n')[1]?.trim())}));});log('axe '+label,r.filter(v=>v.impact==='critical'||v.impact==='serious').length===0?true:'review',r);return r;};
await p.goto('http://localhost:5173/');await p.waitForSelector('.s2-project-menu',{timeout:30000});await sleep(1500);
// 1. Tab order from start
await p.evaluate(()=>{document.activeElement?.blur();});await p.keyboard.press('Tab');
const order=[];for(let i=0;i<40;i++){order.push(await active());await p.keyboard.press('Tab');}
const noRing=order.filter(o=>!o.ring&&o.tag!=='BODY'),noName=order.filter(o=>!o.name&&o.tag!=='BODY'),hidden=order.filter(o=>!o.visible);
log('tab order first 40 stops',undefined,order.map(o=>o.name||o.tag));
log('every tab stop has visible focus ring',noRing.length===0,noRing.map(o=>o.name||o.tag));
log('every tab stop has accessible name',noName.length===0,noName);
log('no tab stop off-screen',hidden.length===0,hidden.map(o=>o.name));
// phase state exposed
log('phase buttons expose current step',undefined,await p.evaluate(()=>[...document.querySelectorAll('.s2-phase,.s2-workshop')].map(e=>({t:e.textContent.trim(),cur:e.getAttribute('aria-current'),pressed:e.getAttribute('aria-pressed'),sel:e.getAttribute('aria-selected')}))));
// 2. dialogs via keyboard
const D='[role=dialog],[role=alertdialog],dialog[open],[aria-modal=true]';
const fresh=async()=>{await newPage();await p.goto('http://localhost:5173/');await p.waitForSelector('.s2-project-menu',{timeout:30000});await sleep(1200);};
async function dialogTest(label,open){
 await fresh();const base=await p.evaluate(D=>document.querySelectorAll(D).length,D);
 await open();await sleep(700);
 const n=await p.evaluate(D=>document.querySelectorAll(D).length,D);const first=await active();
 if(n<=base){log(label+': ei modaalia verkkoversiossa (vienti-ikkuna on vain Mac-sovelluksessa, Tekoäly avaa paneelin)',undefined,{first,base,n});return;}
 log(label+': initial focus inside dialog',first.inDialog,first);
 await p.keyboard.press('Escape');await sleep(500);
 const left=await p.evaluate(D=>document.querySelectorAll(D).length,D);
 log(label+': Esc closes (focus where it landed)',left<n,{before:n,after:left});
 if(left<n){const back=await p.evaluate(()=>document.activeElement===window.__openerEl);const now=await active();log(label+': focus returns to opener',back,{opener:await p.evaluate(()=>window.__opener),now:now.name||now.tag});}
 await fresh();await open();await sleep(700);
 const escaped=[];for(let i=0;i<25;i++){await p.keyboard.press('Tab');const a=await active();if(!a.inDialog)escaped.push(a.name||a.tag);}
 log(label+': Tab stays inside dialog (25 presses)',escaped.length===0,escaped.slice(0,5));
 await p.keyboard.press('Escape');await sleep(400);const still=await p.evaluate(D=>document.querySelectorAll(D).length,D);
 if(escaped.length)log(label+': Esc closes after focus escaped to background',still<n,{before:n,after:still});
 await fresh();await open();await sleep(700);
 const esc2=[];for(let i=0;i<10;i++){await p.keyboard.press('Shift+Tab');const a=await active();if(!a.inDialog)esc2.push(a.name||a.tag);}
 log(label+': Shift+Tab stays inside dialog',esc2.length===0,esc2.slice(0,5));
}
const viaMenu=name=>async()=>{await p.focus('.s2-project-menu > summary');await p.keyboard.press('Enter');await sleep(200);await p.evaluate(n=>{const e=[...document.querySelectorAll('.s2-project-menu button')].find(e=>(e.getAttribute('aria-label')||e.textContent.trim())===n);window.__openerEl=document.querySelector('.s2-project-menu > summary');window.__opener='Projekti-valikko';e.focus();},name);await p.keyboard.press('Enter');};
const viaButton=name=>async()=>{await p.evaluate(n=>{const e=[...document.querySelectorAll('button')].find(e=>(e.getAttribute('aria-label')||e.textContent.trim())===n&&e.getClientRects().length);window.__openerEl=e;window.__opener=n;e.focus();},name);await p.keyboard.press('Enter');};
if(!process.env.SKIPD)await dialogTest('Toimintohaku (painike)',viaButton('Hae toimintoa (⌘K)'));
if(!process.env.SKIPD)await dialogTest('Toimintohaku (Ctrl+K)',async()=>{await p.evaluate(()=>{const e=[...document.querySelectorAll('button')].find(e=>e.textContent.trim()==='Vie…');window.__openerEl=e;window.__opener='Vie… (fokus ennen Ctrl+K)';e.focus();});await p.keyboard.press('Control+k');});
if(!process.env.SKIPD)for(const name of ['Asetukset…','Käyttöohje','Vie video…','Tekoäly…']) await dialogTest(name,viaMenu(name));
await fresh();
await runAxe('start (Tarina, tyhjä)');
// 3. build sample episode
await phase('characters');await click('Valitse Pipsa-3D');await p.waitForSelector('.artboard canvas');
await phase('script');await sleep(1000);
for(let i=0;i<5;i++){await p.evaluate(()=>{const e=[...document.querySelectorAll('button')].find(e=>/^(Kokeile esimerkkiä|Lataa KILSAT-esimerkki)/.test(e.textContent.trim()));e.click();});await sleep(2500);if(await p.evaluate(()=>[...document.querySelectorAll('textarea')].some(e=>e.value.length>1000)))break;}
if(!await p.evaluate(()=>document.body.textContent.includes('Kuva 019'))){await click('Rakenna jakso');}
await p.waitForFunction(()=>document.body.textContent.includes('Kuva 0'),null,{timeout:60000});
for(const s of ['script','characters','storyboard','shot','timeline','workshop']){await phase(s);await runAxe('vaihe '+s);}
async function inPlace(label,open){const n0=await p.evaluate(D=>document.querySelectorAll(D).length,D);await open();await sleep(800);const n=await p.evaluate(D=>document.querySelectorAll(D).length,D);const first=await active();if(n<=n0){log(label+': ei modaalia verkkoversiossa',undefined,first);await p.keyboard.press('Escape');return;}log(label+': initial focus inside dialog',first.inDialog,first);const esc=[];for(let i=0;i<25;i++){await p.keyboard.press('Tab');const a=await active();if(!a.inDialog)esc.push(a.name||a.tag);}log(label+': Tab stays inside dialog',esc.length===0,esc.slice(0,5));await p.evaluate(D=>{const d=[...document.querySelectorAll(D)].pop();const f=d.querySelector('button,input,select,[tabindex]');(f||d).focus();},D);await p.keyboard.press('Escape');await sleep(500);const left=await p.evaluate(D=>document.querySelectorAll(D).length,D);log(label+': Esc closes (focus inside)',left<n,{n,left});if(left<n){const now=await active();log(label+': focus returns to opener',await p.evaluate(()=>document.activeElement===window.__openerEl),{now:now.name||now.tag});}else{await p.evaluate(()=>{const c=[...document.querySelectorAll('[role=dialog] button,dialog button')].find(b=>/^(Sulje|Peruuta)/.test(b.textContent.trim()||b.getAttribute('aria-label')||''));c?.click();});await sleep(300);}}
await phase('timeline');
for(const name of ['Vie video…','Tekoäly…']) await inPlace(name+' (jakso ladattu)',viaMenu(name));
await inPlace('Vie… (yläpalkki, jakso ladattu)',viaButton('Vie…'));
// Alt+digit phase keys
await phase('script');for(const d of [1,2,3,4,5,6]){await p.keyboard.press('Alt+Digit'+d);await sleep(250);}
log('Alt+6 opens Työpaja',await p.evaluate(()=>document.querySelector('.kilsat-app')?.className.includes('workspace-')),await p.evaluate(()=>document.querySelector('.studio')?.className));
// 4. recorder with Chromium fake microphone
await phase('script');await p.evaluate(()=>document.querySelector('.tarina-review-toggle').click());await sleep(300);
await p.evaluate(()=>{const e=document.querySelector('.production-audio-dock .performance-panel select');e.value=e.options[1].value;e.dispatchEvent(new Event('change',{bubbles:true}));});await sleep(300);
const recBtn='.production-audio-dock .performance-panel .dialogue-recorder button.primary';
await p.focus(recBtn);await p.keyboard.press('Enter');
await p.waitForFunction(s=>document.querySelector(s)?.textContent.includes('Lopeta'),recBtn,{timeout:15000}).then(()=>log('keyboard Enter starts recording (fake mic)',true)).catch(async()=>log('keyboard Enter starts recording (fake mic)',false,await p.evaluate(()=>document.querySelector('.dialogue-recorder')?.textContent)));
const n1=await p.evaluate(s=>({l:document.querySelector(s).getAttribute('aria-label'),t:document.querySelector(s).textContent}),recBtn);await sleep(400);const n2=await p.evaluate(s=>({l:document.querySelector(s).getAttribute('aria-label'),t:document.querySelector(s).textContent}),recBtn);
log('recording name stable while visible time changes',n1.l===n2.l&&n1.t!==n2.t&&n1.l==='Lopeta ja käytä repliikki',{n1,n2});
log('focus stays on stop button after start',(await active()).name==='Lopeta ja käytä repliikki',await active());
await p.keyboard.press('Tab');log('Tab reaches Hylkää äänitys',(await active()).name==='Hylkää äänitys',await active());
await p.keyboard.press('Shift+Tab');
// phase switch by keyboard while focused on stop
const results=[];for(const d of [2,3,4,5,6,1]){await p.keyboard.press('Alt+Digit'+d);await sleep(400);const a=await active();const still=await p.evaluate(()=>!!document.querySelector('.production-audio-dock.is-recording'));results.push({d,focus:a.name||a.tag,recording:still});}
log('recording continues through Alt+1..6 phase switches',results.every(r=>r.recording),results);
log('focus kept on stop button through phase switches',results.every(r=>r.focus==='Lopeta ja käytä repliikki'),results.map(r=>r.focus));
// reach stop by keyboard if focus lost
await p.evaluate(s=>document.querySelector(s)?.scrollIntoView({block:'center'}),recBtn);
await p.focus('.production-audio-dock .dialogue-recorder button.secondary');await p.keyboard.press('Enter');await sleep(500);
log('Hylkää via keyboard cancels and announces',await p.evaluate(()=>!document.querySelector('.production-audio-dock.is-recording')&&document.querySelector('.dialogue-recorder [role=status]').textContent.includes('peruttiin')));
const fa=await active();log('focus after cancel (Hylkää-painike poistuu)',fa.tag!=='BODY',fa);
// record + commit via keyboard
await p.focus(recBtn);await p.keyboard.press('Enter');await p.waitForFunction(s=>document.querySelector(s)?.textContent.includes('Lopeta'),recBtn);await sleep(1500);await p.keyboard.press('Enter');
await p.waitForFunction(()=>document.querySelector('.dialogue-recorder [role=status]')?.textContent.includes('Oma äänesi liitettiin'),null,{timeout:20000}).then(()=>log('keyboard commit attaches recording, status announced',true)).catch(async()=>log('keyboard commit',false,await p.evaluate(()=>document.querySelector('.dialogue-recorder')?.textContent)));
const fc=await active();log('focus after commit',fc.tag!=='BODY',fc);
log('device status line',undefined,await p.evaluate(()=>document.querySelector('.device-status')?.textContent));
log('page errors',errs.length===0,errs.slice(0,10));
writeFileSync('a11y-report.json',JSON.stringify(out,null,2));await p.screenshot({path:'end.png'});await b.close();
