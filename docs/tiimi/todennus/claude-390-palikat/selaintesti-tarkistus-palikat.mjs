// Käyttö: npm run dev, sitten PLAYWRIGHT_MODULE=/polku/playwright/index.mjs node <tämä> <kuvakansio>
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const out=process.argv[2];
const b=await chromium.launch({});
const p=await b.newPage({viewport:{width:1440,height:900}});
const errs=[];p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('404'))errs.push(m.text())});p.on('pageerror',e=>errs.push(String(e)));
const log=(...a)=>console.log(...a);
await p.goto('http://localhost:5173/docs/tiimi/editor-preview.html');
await p.waitForSelector('.s2-project-menu',{timeout:60000});
const phase=id=>p.click(`.s2-phase[data-studio-flow-step="${id}"]`);
await phase('characters');await p.getByRole('button',{name:'Valitse Pipsa-3D'}).click();await p.waitForSelector('.artboard canvas');await p.waitForTimeout(500);
await phase('script');await p.getByRole('button',{name:'Kokeile esimerkkiä'}).click();
await p.waitForFunction(()=>[...document.querySelectorAll('textarea')].some(t=>t.value.length>200));
await p.getByRole('button',{name:'Rakenna jakso',exact:true}).click();
await p.waitForFunction(()=>document.body.innerText.includes('Jakso rakennettu'),null,{timeout:60000});
const vis=sel=>p.evaluate(s=>{const e=document.querySelector(s);if(!e)return 'missing';const r=e.getBoundingClientRect();return r.width>0&&r.height>0?'visible':'hidden'},sel);
const res={};
for(const w of [1440,820,390]){
 await p.setViewportSize({width:w,height:900});await phase('storyboard');await phase('script');await p.waitForTimeout(300);
 const r={};
 r.reviewRow=await vis('.tarina-review-row');
 const toggle=p.locator('.tarina-review-toggle');
 r.toggleText=(await toggle.textContent()).trim();
 await toggle.click();await p.waitForTimeout(300);
 r.reviewOpenClass=await p.evaluate(()=>!!document.querySelector('.presentation-panel--review-open'));
 r.expanded=await toggle.getAttribute('aria-expanded');
 r.audioDock=await vis('.production-audio-dock');
 r.reviewText=(await p.evaluate(()=>document.querySelector('.presentation-panel').innerText)).slice(0,0);
 r.stepNav=await vis('.screenplay-step-nav');
 await p.screenshot({path:`${out}/tarkistus-auki-${w}.png`});
 await toggle.click();await p.waitForTimeout(200);
 r.closedAgain=!(await p.evaluate(()=>!!document.querySelector('.presentation-panel--review-open')));
 // palette
 await p.getByRole('button',{name:/Työkalut/}).first().click();await p.waitForTimeout(200);
 const items=await p.evaluate(()=>[...document.querySelectorAll('[role=dialog] [role=option],[role=dialog] li button,[role=dialog] button')].map(e=>e.textContent.trim()).filter(Boolean));
 r.paletteHasReview=items.some(t=>t.includes('Näytä tarkistus ja ohjaus'));r.paletteHasBlocks=items.some(t=>t.includes('Näytä palikkaeditori'));
 await p.getByText('Näytä palikkaeditori').first().click();await p.waitForTimeout(300);
 r.blocksOpen=await vis('.block-editor-dock--open');
 r.blockItems=await p.evaluate(()=>document.querySelectorAll('.block-editor-dock--open button').length);
 await p.screenshot({path:`${out}/palikat-auki-${w}.png`});
 // select first block
 const first=p.locator('.block-editor-dock--open .block-timeline button').first();
 if(await first.count()){await first.click();await p.waitForTimeout(200);r.selectedAfterClick=await p.evaluate(()=>!!document.querySelector('.block-editor-dock--open [aria-pressed=true],.block-editor-dock--open [aria-selected=true],.block-editor-dock--open .is-selected,.block-editor-dock--open .selected'));}
 // close via palette
 await p.getByRole('button',{name:/Työkalut/}).first().click();await p.waitForTimeout(200);
 r.paletteHidesBlocks=await p.getByText('Piilota palikkaeditori').count()>0;
 await p.getByText('Piilota palikkaeditori').first().click();await p.waitForTimeout(200);
 r.blocksClosed=await vis('.block-editor-dock--open')==='missing';
 r.overflow=await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
 res[w]=r;
}
// locked phases: block editor in inspector
await p.setViewportSize({width:1440,height:900});await phase('shot');await p.waitForTimeout(300);
res.shotBlocksDisclosure=await p.evaluate(()=>{const d=document.querySelector('.block-tools-disclosure');return d?{compact:d.dataset.compact,open:d.open,visible:d.getBoundingClientRect().height>0}:null});
await p.screenshot({path:`${out}/kuvaus-palikat-1440.png`});
log(JSON.stringify(res,null,1));log('errors',errs);await b.close();
