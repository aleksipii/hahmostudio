// Hallintolaskuri: montako hallintaa ja sanaa kullakin työvaiheella on ruudulla.
// Käyttö: npm run dev (toisessa ikkunassa), sitten
//   node scripts/ui-census.mjs [--url http://localhost:5173/] [--check] [--width 1440 --height 900]
// --check epäonnistuu, jos jokin vaihe ylittää docs/UI-MINIMALISMI-SUUNNITELMA.md:n budjetin.
// Tarvitsee Playwrightin (ei projektin riippuvuus): PLAYWRIGHT_MODULE=/polku/playwright tai globaali asennus.
import { createRequire } from 'node:module';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const url = opt('url', 'http://localhost:5173/');
const width = Number(opt('width', 1440));
const height = Number(opt('height', 900));
const check = args.includes('--check');

/** Budjetit: hallintoja yhteensä, sanoja, yläpalkin hallintoja. Lähtötaso mittauksesta, tarkennetaan. */
export const budgets = {
  script: { controls: 25, words: 150 },
  characters: { controls: 30, words: 200 },
  storyboard: { controls: 25, words: 150 },
  shot: { controls: 30, words: 150 },
  timeline: { controls: 35, words: 150 },
  workshop: { controls: 40, words: 200 },
  topbar: 9,
};

const require = createRequire(import.meta.url);
function loadPlaywright() {
  const candidates = [process.env.PLAYWRIGHT_MODULE, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean);
  for (const c of candidates) {
    try {
      return require(c);
    } catch {
      /* seuraava */
    }
  }
  throw new Error('Playwrightia ei löytynyt. Aseta PLAYWRIGHT_MODULE.');
}

const countInPage = () => {
  const visible = (e) => {
    const r = e.getBoundingClientRect();
    const cs = getComputedStyle(e);
    return (
      r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' &&
      r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth &&
      !e.closest('[hidden]') && !e.closest('details:not([open]) > :not(summary)')
    );
  };
  const els = [...document.querySelectorAll('button,input,select,textarea,summary,[role=tab],[role=slider],a[href]')].filter(visible);
  const zone = (e) =>
    e.closest('.s2-top') ? 'ylapalkki' : e.closest('.layers-panel') ? 'vasen' : e.closest('.details-panel') ? 'oikea'
      : e.closest('.timeline-dock') ? 'aikajana' : e.closest('.preview-panel') ? 'nayttamo' : 'muu';
  const zones = {};
  for (const e of els) zones[zone(e)] = (zones[zone(e)] || 0) + 1;
  return { controls: els.length, zones, words: document.body.innerText.split(/\s+/).filter(Boolean).length };
};

const { chromium } = loadPlaywright();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height } });
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);

// Sama lähtötila kuin suunnitelman mittauksessa: Pipsa-3D valittuna ja esimerkkikäsikirjoitus ladattuna.
await page.click('.s2-phase[data-studio-flow-step="characters"]');
await page.waitForTimeout(500);
await page.getByRole('button', { name: 'Valitse Pipsa' }).first().click();
await page.waitForTimeout(3500);

const results = {};
for (const id of ['script', 'characters', 'storyboard', 'shot', 'timeline']) {
  await page.click(`.s2-phase[data-studio-flow-step="${id}"]`);
  await page.waitForTimeout(1000);
  if (id === 'script') {
    const example = page.getByRole('button', { name: 'Kokeile esimerkkiä' });
    if (await example.count()) {
      await example.first().click();
      await page.waitForTimeout(2500);
    }
  }
  results[id] = await page.evaluate(countInPage);
}
await page.click('.s2-workshop');
await page.waitForTimeout(900);
results.workshop = await page.evaluate(countInPage);
await browser.close();

let failed = 0;
console.log(`Hallintolaskuri ${width}×${height}  ${url}`);
console.log('vaihe        hallintoja  sanoja  ylapalkki  budjetti(h/s)  tulos');
for (const [id, r] of Object.entries(results)) {
  const b = budgets[id];
  const top = r.zones.ylapalkki || 0;
  const ok = r.controls <= b.controls && r.words <= b.words && top <= budgets.topbar;
  if (!ok) failed += 1;
  console.log(`${id.padEnd(12)} ${String(r.controls).padStart(10)} ${String(r.words).padStart(7)} ${String(top).padStart(10)}  ${`${b.controls}/${b.words}`.padStart(13)}  ${ok ? 'ok' : 'YLI'}`);
}
if (check && failed) {
  console.error(`${failed} vaihetta ylittää budjetin.`);
  process.exit(1);
}
