import {app,BrowserWindow} from 'electron';
import assert from 'node:assert/strict';
import {countInPage,CONTROL_SELECTOR,ZONE_RULES,CONTENT_RULES} from './ui-census.mjs';
app.whenReady().then(async()=>{
 let win;
 try{
  win=new BrowserWindow({show:false,width:1000,height:600,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});
  const html='<p>Visible label</p><details><summary>Help</summary><p>Hidden instruction should not count</p></details><select><option value="first">Chosen option</option><option value="second">Another hidden choice</option></select><div class="resolve-shot-card">User content remains separate</div>';
  await win.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(html));
  const measure=()=>win.webContents.executeJavaScript('('+countInPage.toString()+')('+JSON.stringify({controlSelector:CONTROL_SELECTOR,zoneRules:ZONE_RULES,contentRules:CONTENT_RULES,list:false})+')');
  const closed=await measure();assert.equal(closed.words,5);assert.equal(closed.contentWords,4);assert.equal(closed.visibleWords,9);
  await win.webContents.executeJavaScript("document.querySelector('details').open=true");
  const opened=await measure();assert.equal(opened.words,10);assert.equal(opened.contentWords,4);
  await win.webContents.executeJavaScript("document.querySelector('details').open=false;document.querySelector('select').value='second'");
  const selected=await measure();assert.equal(selected.words,6);assert.equal(selected.contentWords,4);
  console.log(JSON.stringify({ok:true,scope:'actual Electron DOM word census',closed:{ui:closed.words,content:closed.contentWords},opened:{ui:opened.words},selected:{ui:selected.words}}));win.destroy();app.exit(0);
 }catch(e){console.error(e);win?.destroy();app.exit(1);}
});
