// Real Electron/Canvas component check, isolated from the application and owner data.
import {app,BrowserWindow} from 'electron';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep,join} from 'node:path';
const root=resolve('dist-team-preview'),library=resolve('public/library'),out=resolve('docs/tiimi/todennus');
const errors=[],checks=[];
app.whenReady().then(async()=>{
 let server,win;
 try{
  await mkdir(out,{recursive:true});
  server=createServer(async(req,res)=>{
   try{const requested=decodeURIComponent(new URL(req.url,'http://localhost').pathname),base=requested.startsWith('/library/')?library:root,path=resolve(base,'.'+(base===library?requested.slice('/library'.length):requested));if(!path.startsWith(base+sep)){res.writeHead(403).end();return;}
    const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm','.png':'image/png','.svg':'image/svg+xml'}[extname(path)]??'application/octet-stream';res.setHeader('Content-Type',mime);res.end(await readFile(path));
   }catch{res.writeHead(404).end();}
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  win=new BrowserWindow({show:false,width:1440,height:1000,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});
  win.webContents.on('console-message',event=>{if(event.level==='error')errors.push(event.message);});
  await win.loadURL(`http://127.0.0.1:${server.address().port}/docs/tiimi/preview.html`);
  for(let i=0;i<100;i++){if(await win.webContents.executeJavaScript('!!window.teamPreviewReady'))break;if(i===99)throw Error('Preview did not load');await new Promise(r=>setTimeout(r,100));}
  await win.webContents.executeJavaScript("[...document.querySelectorAll('button')].find(b=>b.textContent==='Hahmot · 2D / 3D').click()");
  const before=await win.webContents.executeJavaScript("document.querySelector('[data-selected-style]').dataset.selectedStyle");
  await win.webContents.executeJavaScript("(()=>{const s=[...document.querySelectorAll('select')].find(s=>s.closest('label')?.textContent.startsWith('3D-hahmon tyyli'));if(!s)throw Error('Style selector missing');s.value='flat';s.dispatchEvent(new Event('change',{bubbles:true}));})()");
  await new Promise(r=>setTimeout(r,100));
  const after=await win.webContents.executeJavaScript("document.querySelector('[data-selected-style]').dataset.selectedStyle");
  checks.push({name:'real React style selection updates profile',ok:before==='cel'&&after==='flat',before,after});
  await win.webContents.executeJavaScript("document.querySelector('[data-disable-board]').click()");await new Promise(r=>setTimeout(r,100));
  const disabled=await win.webContents.executeJavaScript("[...document.querySelectorAll('.production-board fieldset select,.production-board fieldset input')].every(e=>e.matches(':disabled'))");
  checks.push({name:'disabled cast fieldset locks representation, style and colors',ok:disabled});
  await win.webContents.executeJavaScript("document.querySelector('[data-disable-board]').click()");await new Promise(r=>setTimeout(r,100));
  const blocked=await win.webContents.executeJavaScript("(()=>{const e=document.querySelector('#ai-fixture [data-ai-feature=\"cloud-render\"]');return !!e&&e.textContent.includes('estetty')&&/lukit/i.test(e.textContent);})()");
  checks.push({name:'cloud status stays blocked without model pins',ok:blocked});
  for(const [width,height] of [[1440,1000],[600,1000]]){
   win.setContentSize(width,height);await new Promise(r=>setTimeout(r,200));
   const geometry=await win.webContents.executeJavaScript('({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,canvases:document.querySelectorAll("figure canvas").length})');
   checks.push({name:`preview ${width}px`,ok:geometry.canvases===20&&geometry.scrollWidth===geometry.width,...geometry});
   await writeFile(join(out,`3d-tyyli-${width}.png`),(await win.webContents.capturePage()).toPNG());
  }
  win.setContentSize(1440,2700);await win.webContents.executeJavaScript("document.querySelector('#character-grid').scrollIntoView()");await new Promise(r=>setTimeout(r,200));
  await writeFile(join(out,'3d-vertailut.png'),(await win.webContents.capturePage()).toPNG());
  const report={ok:checks.every(c=>c.ok)&&!errors.length,checks,errors,electron:process.versions.electron,platform:process.platform,scope:'isolated real Electron component and Canvas, not packaged application, not cloud/GPU'};
  await writeFile(join(out,'preview-report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));win.destroy();server.closeAllConnections();await new Promise(r=>server.close(r));app.exit(report.ok?0:1);
 }catch(e){console.error(e);win?.destroy();server?.closeAllConnections();server?.close();app.exit(1);}
});
