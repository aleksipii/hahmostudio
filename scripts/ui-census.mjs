// Hallintolaskuri: montako hallintaa ja sanaa kullakin työvaiheella on ruudulla.
// Käyttö: npm run dev (toisessa ikkunassa), sitten
//   node scripts/ui-census.mjs [--url http://localhost:5173/] [--check] [--json] [--list]
//                              [--width 1440 --height 900] [--shots /polku/etuliite]
// --check epäonnistuu, jos jokin vaihe ylittää docs/UI-MINIMALISMI-SUUNNITELMA.md:n budjetin.
// --json tulostaa tulokset JSON-muodossa (taulukon sijaan).
// --list luettelee jokaisen lasketun hallinnan (vyöhyke, sisältö vai kuorma, nimi) vianetsintää varten.
// Tarvitsee Playwrightin (ei projektin riippuvuus): PLAYWRIGHT_MODULE=/polku/playwright tai globaali asennus.
//
// Sisältösääntö (2026-10-09): käyttäjän oma sisältö (aikajanan raidat ja avainruudut, storyboardin
// kuvakortit, hahmokirjaston kortit, käsikirjoituksen rivit, tasopuun rivit) lasketaan omaan
// "sisältö"-sarakkeeseensa eikä kuulu budjettiin. Sen määrä riippuu projektista ja ikkunan
// korkeudesta, ei käyttöliittymän kuormasta. Tunnistus tehdään vain luokilla ja aria-nimillä
// (CONTENT_RULES alla), ei koskaan sijainnilla. Jos komponentin luokka muuttuu, päivitä sääntö tähän.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

/** Budjetit: hallintoja yhteensä (ilman sisältöä), sanoja, yläpalkin hallintoja. */
export const budgets = {
  script: { controls: 25, words: 150 },
  characters: { controls: 30, words: 200 },
  storyboard: { controls: 25, words: 150 },
  shot: { controls: 30, words: 150 },
  timeline: { controls: 35, words: 150 },
  workshop: { controls: 40, words: 200 },
  topbar: 11,
};

/** Laskettavat hallinnat. Käsikirjoitusrivien tekstikentät (.script-line-field) ovat sisältöä. */
export const CONTROL_SELECTOR =
  'button,input,select,textarea,summary,[role=tab],[role=slider],a[href]';

/**
 * Vyöhykkeet suunnitelman kohdan 1 taulukon mukaan. Ensimmäinen osuma voittaa (e.closest(selector)).
 * Komponentit: studio-shell.tsx (.s2-top), editor.tsx (.layers-panel, .details-panel,
 * .timeline-dock, .preview-panel).
 */
export const ZONE_RULES = [
  ['ylapalkki', '.s2-top'],
  ['vasen', '.layers-panel'],
  ['oikea', '.details-panel'],
  ['aikajana', '.timeline-dock'],
  ['nayttamo', '.preview-panel'],
];
export const ZONE_ORDER = ['ylapalkki', 'vasen', 'nayttamo', 'oikea', 'aikajana', 'muu'];

/**
 * Sisältöalueet: hallinta lasketaan sisällöksi, jos se on jonkin valitsimen sisällä (e.closest).
 * Pelkkä säiliö (esim. koko aikajana) ei ole sisältöä; vain toistuvat sisältöalkiot ovat.
 * Tarkoituksella kuormaa (ei sisältöä): palikkakirjaston kiinteä paletti (.block-chip), roolituksen
 * puhuja–hahmopaketti-taulukko (.speaker-binding-table), välilehdet, kuljetin ja "Lisää ⋯".
 */
export const CONTENT_RULES = [
  // Aikajana: animaatioraitojen nimet ja avainruudut (animation-panel.tsx: .animation-tracks >
  // .animation-track > .track-name / .track-keys), palikka-aikajanan raidat ja niiden palikat
  // (block-timeline.tsx: .block-lane, role=group "Raita: …"), esitysaikajanan raidat
  // (presentation-timeline.tsx: .presentation-track) ja kuvanauhan kuvat "001", "002" …
  // (shot-timeline-strip.tsx: .shot-timeline-track).
  ['aikajana-raidat', '.animation-tracks'],
  ['aikajana-raidat', '.block-lane'],
  ['aikajana-raidat', '.presentation-track'],
  ['aikajana-raidat', '.shot-timeline-track'],
  // Storyboard: kuvakortit ja niiden oma "Hyväksy kuva" (studio-shot-board.tsx: .resolve-shot-card).
  ['kuvakortit', '.resolve-shot-card'],
  // Hahmokirjaston kortit: Valitse ja Tiedot (asset-library.tsx: .character-card).
  ['kirjastokortit', '.character-card'],
  // Käsikirjoitus: rivikentät "Rivi N" (script-compose-editor.tsx: textarea.script-line-field) ja
  // tuotannon tapahtumalista, yksi painike per repliikki (production-board.tsx: .production-source-list).
  ['kasikirjoitus', '.script-line-field'],
  ['kasikirjoitus', '.production-source-list'],
  // Tasopuu: osien rivit ja ryhmien avauspainikkeet (editor.tsx: .layer-tree > .layer-row).
  ['tasopuu', '.layer-tree'],
];

/**
 * Luokittelee yhden hallinnan. `closest(selector)` palauttaa totuusarvon (selaimessa e.closest).
 * Puhdas funktio: testattavissa ilman selainta.
 */
export function classify(closest, zoneRules = ZONE_RULES, contentRules = CONTENT_RULES) {
  const zone = zoneRules.find(([, sel]) => closest(sel))?.[0] ?? 'muu';
  const content = contentRules.find(([, sel]) => closest(sel))?.[0] ?? null;
  return { zone, content };
}

/** Kokoaa luokitellut hallinnat vaiheen tulokseksi. */
export function tally(items, words) {
  const zones = Object.fromEntries(ZONE_ORDER.map((z) => [z, 0]));
  const contentByKind = {};
  let content = 0;
  for (const { zone, content: kind } of items) {
    if (kind) {
      content += 1;
      contentByKind[kind] = (contentByKind[kind] || 0) + 1;
    } else {
      zones[zone] = (zones[zone] || 0) + 1;
    }
  }
  return { controls: items.length - content, content, contentByKind, zones, words };
}

/** Vertaa budjettiin. Sisältö ei kuulu budjettiin. */
export function evaluate(results, b = budgets) {
  return Object.entries(results).map(([id, r]) => {
    const budget = b[id];
    const top = r.zones.ylapalkki || 0;
    const ok = !!budget && r.controls <= budget.controls && r.words <= budget.words && top <= b.topbar;
    return { id, ...r, topbar: top, budget, ok };
  });
}

/** Muotoilee taulukon (merkkijonorivit). */
export function formatTable(rows, { width, height, url }) {
  const out = [`Hallintolaskuri ${width}×${height}  ${url}`];
  out.push('vaihe        kuorma sisältö  sanoja | ylä vasen näytt oikea aikaj muu | budjetti(h/s)  tulos');
  for (const r of rows) {
    const z = ZONE_ORDER.map((k, i) => String(r.zones[k] || 0).padStart([3, 5, 5, 5, 5, 3][i])).join(' ');
    const b = r.budget ? `${r.budget.controls}/${r.budget.words}` : '-';
    out.push(
      `${r.id.padEnd(12)} ${String(r.controls).padStart(6)} ${String(r.content).padStart(7)} ${String(r.words).padStart(7)} | ${z} | ${b.padStart(13)}  ${r.ok ? 'ok' : 'YLI'}`,
    );
  }
  const kinds = rows.filter((r) => r.content).map((r) => `${r.id}: ${Object.entries(r.contentByKind).map(([k, n]) => `${k} ${n}`).join(', ')}`);
  if (kinds.length) out.push(`sisältö (ei budjetissa): ${kinds.join(' · ')}`);
  return out;
}

/** Ajetaan selaimessa (page.evaluate); ei saa viitata moduulin muuttujiin. */
const countInPage = ({ controlSelector, zoneRules, contentRules, list }) => {
  const visible = (e) => {
    const r = e.getBoundingClientRect();
    const cs = getComputedStyle(e);
    return (
      r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' &&
      r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth &&
      !e.closest('[hidden]') && !e.closest('details:not([open]) > :not(summary)')
    );
  };
  const els = [...document.querySelectorAll(controlSelector)].filter(visible);
  const items = els.map((e) => {
    const closest = (sel) => !!e.closest(sel);
    const zone = zoneRules.find(([, sel]) => closest(sel))?.[0] ?? 'muu';
    const content = contentRules.find(([, sel]) => closest(sel))?.[0] ?? null;
    const item = { zone, content };
    if (list) {
      const name = (e.getAttribute('aria-label') || e.textContent || e.getAttribute('title') || e.getAttribute('placeholder') || '').trim().replace(/\s+/g, ' ').slice(0, 40);
      const chain = [];
      for (let p = e.parentElement; p && chain.length < 4; p = p.parentElement) if (p.className && typeof p.className === 'string') chain.push(p.className.split(/\s+/)[0]);
      item.desc = `${e.tagName.toLowerCase()}${e.className && typeof e.className === 'string' ? '.' + e.className.split(/\s+/)[0] : ''} "${name}" < ${chain.join(' < ')}`;
    }
    return item;
  });
  return { items, words: document.body.innerText.split(/\s+/).filter(Boolean).length };
};

function loadPlaywright() {
  const require = createRequire(import.meta.url);
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

async function main(args) {
  const opt = (name, fallback) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
  };
  const url = opt('url', 'http://localhost:5173/');
  const width = Number(opt('width', 1440));
  const height = Number(opt('height', 900));
  const check = args.includes('--check');
  const json = args.includes('--json');
  const list = args.includes('--list');
  const shots = opt('shots', '');

  const { chromium } = loadPlaywright();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width, height } });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Lähtötila: Pipsa-3D valittuna, esimerkkikäsikirjoitus ladattuna ja jakso rakennettuna.
  await page.click('.s2-phase[data-studio-flow-step="characters"]');
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Valitse Pipsa' }).first().click();
  await page.waitForTimeout(3500);

  const arg = { controlSelector: CONTROL_SELECTOR, zoneRules: ZONE_RULES, contentRules: CONTENT_RULES, list };
  const results = {};
  const listings = {};
  const measure = async (id) => {
    const { items, words } = await page.evaluate(countInPage, arg);
    results[id] = tally(items, words);
    if (list) listings[id] = items;
  };
  for (const id of ['script', 'characters', 'storyboard', 'shot', 'timeline']) {
    await page.click(`.s2-phase[data-studio-flow-step="${id}"]`);
    await page.waitForTimeout(1000);
    if (id === 'script') {
      const example = page.getByRole('button', { name: 'Kokeile esimerkkiä' });
      if (await example.count()) {
        await example.first().click();
        await page.waitForTimeout(2500);
      }
      const build = page.getByRole('button', { name: 'Rakenna jakso' });
      if (await build.count()) {
        await build.first().click();
        await page.waitForTimeout(5000);
      }
    }
    await measure(id);
    if (shots) await page.screenshot({ path: `${shots}-${id}.png` });
  }
  await page.click('.s2-workshop');
  await page.waitForTimeout(900);
  await measure('workshop');
  await browser.close();

  const rows = evaluate(results);
  const failed = rows.filter((r) => !r.ok).length;
  if (json) {
    console.log(JSON.stringify({ url, width, height, budgets, rows, ...(list ? { listings } : {}) }, null, 2));
  } else {
    for (const line of formatTable(rows, { width, height, url })) console.log(line);
    if (list) {
      for (const [id, items] of Object.entries(listings)) {
        console.log(`\n== ${id}`);
        for (const it of items) console.log(`  ${it.zone.padEnd(9)} ${(it.content ?? '-').padEnd(15)} ${it.desc}`);
      }
    }
  }
  if (check && failed) {
    console.error(`${failed} vaihetta ylittää budjetin.`);
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main(process.argv.slice(2));
}
