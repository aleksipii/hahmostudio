// Actual Electron renderer using the same census rules as the Playwright command.
import {app,BrowserWindow} from 'electron';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,sep,extname,join} from 'node:path';
import {CONTROL_SELECTOR,ZONE_RULES,CONTENT_RULES,countInPage,tally,evaluate,formatTable} from './ui-census.mjs';
const root=resolve('dist-team-preview'),publicRoot=resolve('public'),out=resolve(process.env.HAHMOSTUDIO_CENSUS_OUT??'docs/tiimi/todennus/codex-handoff');
const errors=[],sleep=ms=>new Promise(r=>setTimeout(r,ms));
app.whenReady().then(async()=>{
 let server,win;
 try{
  await mkdir(out,{recursive:true});
  server=createServer(async(req,res)=>{
   try{const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);let bytes;
    for(const base of [root,publicRoot]){const file=resolve(base,'.'+path);if(!file.startsWith(base+sep))continue;try{bytes=await readFile(file);break;}catch{}}
    if(!bytes){res.writeHead(404).end();return;}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.wasm':'application/wasm'})[extname(path)]??'application/octet-stream');res.end(bytes);
   }catch{res.writeHead(404).end();}
  });
  await new Promise((yes,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',yes);});
  win=new BrowserWindow({show:false,width:1440,height:900,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,partition:'handoff-census-'+Date.now()}});
  win.webContents.on('console-message',e=>{if(e.level==='error'){errors.push(e.message);console.error('Renderer:',e.message);}});
  const js=code=>win.webContents.executeJavaScript(code);
  const wait=async(code,label)=>{for(let i=0;i<150;i++){if(await js(code))return;await sleep(100);}throw Error('Timeout: '+label);};
  const phase=async id=>{await js(`document.querySelector(${JSON.stringify(id==='workshop'?'.s2-workshop':`.s2-phase[data-studio-flow-step="${id}"]`)}).click()`);await sleep(250);};
  const click=async name=>js(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||b.textContent.trim())===${JSON.stringify(name)}&&!b.disabled&&b.getClientRects().length&&!b.closest('[hidden],details:not([open]) > :not(summary)'));if(!b)throw Error('Missing button: '+${JSON.stringify(name)});b.click();})()`);
  await win.loadURL(`http://127.0.0.1:${server.address().port}/docs/tiimi/editor-preview.html`);
  await wait("!!document.querySelector('.s2-project-menu')",'editor');
  await phase('script');
  for(const width of [1440,820,390]){win.setContentSize(width,900);await sleep(250);await writeFile(join(out,`tarina-empty-${width}.png`),(await win.webContents.capturePage()).toPNG());}
  win.setContentSize(1440,900);await phase('characters');await sleep(300);
  await click('Valitse Pipsa-3D');await wait("!!document.querySelector('.artboard canvas')",'character');await sleep(500);
  await phase('script');await click('Kokeile esimerkkiä');await wait("[...document.querySelectorAll('textarea')].some(t=>t.value.includes('MIRA')||t.value.includes('OSKAR'))",'example');
  await click('Rakenna jakso');await wait("document.body.innerText.includes('Jakso rakennettu')",'built episode');
  const arg={controlSelector:CONTROL_SELECTOR,zoneRules:ZONE_RULES,contentRules:CONTENT_RULES,list:true},all=[];
  for(const width of [1440,820,390]){
   win.setContentSize(width,900);await sleep(250);const results={},listings={};
   for(const id of ['script','characters','storyboard','shot','timeline','workshop']){
    await phase(id);const {items,words,contentWords}=await js('('+countInPage.toString()+')('+JSON.stringify(arg)+')');results[id]=tally(items,words,contentWords);listings[id]=items;results[id].visibleText=await js('document.body.innerText');
    const geometry=await js('({width:innerWidth,scrollWidth:document.documentElement.scrollWidth})');
    results[id].horizontalOverflow=geometry.scrollWidth>geometry.width;
    await writeFile(join(out,`${id}-${width}.png`),(await win.webContents.capturePage()).toPNG());
   }
   const rows=evaluate(results);all.push({width,height:900,rows,listings});for(const line of formatTable(rows,{width,height:900,url:'isolated Electron'}))console.log(line);
  }
  win.setContentSize(1440,900);await phase('timeline');
  await js("document.querySelector('.timeline-more').open=true");await sleep(200);
  const setInput=async(label,value)=>{await js(`(()=>{const e=document.querySelector('input[aria-label="${label}"]');if(!e)throw Error('Missing settings input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'${value}');e.dispatchEvent(new Event('input',{bubbles:true}));})()`);await sleep(1100);};
  const ruler=()=>js("document.querySelector('.time-ruler div').lastElementChild.textContent");
  await setInput('Animaation ruutumäärä',120);await setInput('Kuvataajuus',24);
  if(await ruler()!=='5.0 s')throw Error('Duration state did not update');
  await setInput('Kuvataajuus',30);if(await ruler()!=='4.0 s')throw Error('FPS state did not update');
  await click('Kumoa');await sleep(200);if(await ruler()!=='5.0 s')throw Error('Undo did not restore FPS');
  await click('Tee uudelleen');await sleep(200);if(await ruler()!=='4.0 s')throw Error('Redo did not restore FPS');
  await writeFile(join(out,'timeline-actions.json'),JSON.stringify({ok:true,scope:'actual Electron input events and independent timeline ruler',duration120At24:'5.0 s',fps30:'4.0 s',undo:'5.0 s',redo:'4.0 s'},null,2));
  await new Promise(done=>{win.webContents.once('did-finish-load',done);win.reload();});await wait("!!document.querySelector('.s2-project-menu')",'fresh editor');await phase('script');await js("document.querySelector('.script-templates-more').open=true");await click('Try English example');
  await wait("[...document.querySelectorAll('textarea')].some(t=>t.value.includes('Episode 1: The Parking Ticket'))",'English example');
  const english=await js("[...document.querySelectorAll('textarea')].find(t=>t.value.includes('Episode 1: The Parking Ticket'))?.value??''");
  if(!english.includes('Parking Ticket'))throw Error('English sample did not load');
  await writeFile(join(out,'english-example.json'),JSON.stringify({ok:true,scope:'visible Aloituspohjat button loads English built-in source; no Kokoro inference'},null,2));
  await writeFile(join(out,'census.json'),JSON.stringify({scope:'actual Mac Electron, web editor, built-in sample only; no devices, packaged app or provider requests',all,errors},null,2));
  const overflow=all.some(v=>v.rows.some(r=>r.horizontalOverflow));win.destroy();server.closeAllConnections();await new Promise(r=>server.close(r));app.exit(errors.length||overflow||all.some(v=>v.rows.some(r=>!r.ok))?1:0);
 }catch(e){console.error(e);win?.destroy();server?.closeAllConnections();server?.close();app.exit(1);}
});
