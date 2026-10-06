# Figma-capture · sijoitus (2026-10-06)

Agentti uploadasi PNG:t Figmaan **upload_assets + curl**. **Layout** tehty käsin 2026-10-06 (käyttäjä vahvisti chatissa *layout tehty*).

## Vaihtoehdot nyt

| # | Polku | Mitä teet |
|---|--------|-----------|
| **1** | **~5 min käsin** | Script: [Käsin (~2 min)](#käsin-2-min) · Resolve: [Käsin (~3 min)](#käsin-3-min). Solmut jo canvasilla (`6:2`, `14:2`–`14:4`, `16:2`). |
| **2** | **Agentti + MCP** | Kiintiön paluttua (tai [Figma MCP -upgrade](https://www.figma.com/files/team/1638246236510421238/all-projects?upgrade=mcp_rate_limit_paywall)): chat **aja use_figma-sijoitus** → Script + Resolve. Koodi: [`use_figma`-ajo](#use_figma-ajo-agentti--valmis-koodi). |
| **3** | **Hover (valinnainen)** | Kohta [Oikea `:hover`-kuva (dev)](#oikea-hover-kuva-dev): Storyboard → Kuvakortit → Cmd+Shift+4 → Figma `Capture · hover (live)`. Muuten sim (`14:3`) riittää. |

**Tila (linja A):** upload ✅ · layout ✅ (käsin 2026-10-06) · hover: sim riittää (`14:3`); live Figmaan vain käsin devistä (agentti 2026-10-06: CDP-parse OK, ei luotettavaa `:hover`-capturea Cursor-selaimessa).

## Pikaohje · 1 · käsin (~5 min)

### Script · [FFy68Fynv4Ds2VgRANZoXc](https://www.figma.com/design/FFy68Fynv4Ds2VgRANZoXc)

1. Layers → **Script / Focus · 03 Editor hero**
2. Raahaa **[`6:2`](https://www.figma.com/design/FFy68Fynv4Ds2VgRANZoXc?node-id=6-2)** kehyksen **sisään** (tai *Place inside*)
3. **x/y 0,0** · täytä kehys (1440×900) · **opacity 40 %** · **Send to back**
4. Poista irrallinen **`5:2`** jos näkyy

### Resolve · [vfBqIrcXhys0XoTODSbsI5](https://www.figma.com/design/vfBqIrcXhys0XoTODSbsI5)

1. Luo tai valitse kehys **Capture · shot states** (Storyboard / Shot-kortti -alueen viereen)
2. Vie vierekkäin: [`14:2`](https://www.figma.com/design/vfBqIrcXhys0XoTODSbsI5?node-id=14-2) · [`14:3`](https://www.figma.com/design/vfBqIrcXhys0XoTODSbsI5?node-id=14-3) · [`14:4`](https://www.figma.com/design/vfBqIrcXhys0XoTODSbsI5?node-id=14-4) · [`16:2`](https://www.figma.com/design/vfBqIrcXhys0XoTODSbsI5?node-id=16-2)
3. Nimeä: **Capture · grid** · **Capture · hover (sim)** · **Capture · hover (sim B)** · **Capture · selected**

## Paikalliset lähteet (ei repo)

Agent store:  
`/Users/Aleksi/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/68cec15b-793d-4f7f-aa73-375b8eed6a60/files/`

| Tiedosto | Käyttö |
|----------|--------|
| `s01-focus-1440x900.png` | Script / Focus · 03 overlay |
| `resolve-shot-grid-storyboard-1440x900.png` | Resolve · grid |
| `resolve-shot-hover-sim-1440x900.png` | Resolve · hover (CSS-sim) |
| `resolve-shot-selected-hover-mix-1440x900.png` | Resolve · valittu + hover naapuri |

Finder: `open` yllä oleva `files`-kansio.

---

## Script UI · 0.38

**Tiedosto:** [FFy68Fynv4Ds2VgRANZoXc](https://www.figma.com/design/FFy68Fynv4Ds2VgRANZoXc)

| Solmu | Sisältö | Toimenpide |
|-------|---------|------------|
| **`6:2`** | S-01 focus-capture (uusi upload 2026-10-06) | Siirrä **Script / Focus · 03 Editor hero** -kehyksen **sisään**, x/y 0, koko = kehys 1440×900, **opacity 40 %**, **Send to back** (design päällä). Poista vanha irrallinen `5:2` jos duplikaatti. |

### Käsin (~2 min)

1. Layers → hae **03 Editor hero**.
2. Valitse **`6:2`** (tai raahaa canvasilta uusi kuva).
3. **Place inside** kehykseen → täytä kehys → opacity **40 %** → järjestys taakse.

---

## UI Resolve

**Tiedosto:** [vfBqIrcXhys0XoTODSbsI5](https://www.figma.com/design/vfBqIrcXhys0XoTODSbsI5)

| Solmu | Tiedosto (sisältö) | Toimenpide |
|-------|-------------------|------------|
| **`14:2`** | grid-storyboard | Vie **03 · Storyboard** -sivun viereen tai **Comp / Shot-kortti** -komponentin alle; nimeä `Capture · grid`. |
| **`14:3`** | hover-sim (37 KiB, uudelleenupload solmuun) | Nimeä `Capture · hover (sim)`. |
| **`14:4`** | hover-sim (37 KiB) | Nimeä `Capture · hover (sim B)`. |
| **`16:2`** | selected-mix | Nimeä `Capture · selected` · sama kehys kuin muut. |

### Käsin (~3 min)

1. Etsi **Comp / Shot-kortti** (tai **03 · Storyboard** -frame).
2. Luo kehys **Capture · shot states** (3 vierekkäistä PNG:ää + otsikot).
3. Korjaa **`14:3`** hover-kuvalla (agent store).

---

## Oikea `:hover`-kuva (dev)

Automaatio ei saa hiiren `mouseMoved`-tapahtumaa (Electron-webview). **Valinnainen:**

1. `npm run dev` → Storyboard → **Kuvakortit** (19 korttia).
2. Laajenna keskidock tarvittaessa.
3. **Älä klikkaa** — vie hiiri kortin **002** päälle → macOS **Cmd+Shift+4** (alue) tai Screenshot.
4. Toista valittu tila: klikkaa **Kuva 001** → screenshot.
5. Liitä Resolve-capture-kehykseen; merkitse `Capture · hover (live)`.

---

## MCP-tila (2026-10-06 · ilta)

- **Onnistui:** `upload_assets` + POST — Script **`6:2`**; Resolve **`14:2`–`14:4`** + **`16:2`** (selected-mix).
- **Estyi toistuvasti:** `use_figma`, `get_metadata` (Starter-kiintiö). Käyttäjä valtuutti agentin ajamaan `use_figma`-siirron heti kun kiintiö palautuu.

### Agentti · valmis `use_figma`-ajon jälkeen

1. **Script** (`FFy68Fynv4Ds2VgRANZoXc`): siirrä **`6:2`** kehykseen **Script / Focus · 03 Editor hero** (0,0 · täyskoko · opacity 0.4 · taakse · poista duplikaatti **`5:2`**).
2. **Resolve** (`vfBqIrcXhys0XoTODSbsI5`): kerää **`14:2`–`14:4`** + **`16:2`** kehykseen **Capture · shot states** viereen **Comp / Shot-kortti** / **03 · Storyboard**.

**Live-hover:** ei agentti-capturea (CDP Input estetty). Lisää **`Capture · hover (live)`** käsin devistä tai jätä sim (`14:3`).

Päivitä istunnot kun overlay on kehyksessä: [`FIGMA-S-01-SESSION-2026-10-06.md`](FIGMA-S-01-SESSION-2026-10-06.md), [`FIGMA-SHOT-HOVER-SESSION-2026-10-06.md`](FIGMA-SHOT-HOVER-SESSION-2026-10-06.md).

---

## `use_figma`-ajo (agentti · valmis koodi)

**2026-10-06 (ilta):** käyttäjä pyysi *aja use_figma-sijoitus* — **Starter MCP -kiintiö esti** (`use_figma` ×2). Seuraava yritys: sama koodi alla (tai käsin yllä).

### Script · `FFy68Fynv4Ds2VgRANZoXc`

`description`: Move capture 6:2 into Script / Focus · 03 Editor hero overlay; delete duplicate 5:2

```javascript
function findByName(root, name) {
  if ('name' in root && root.name === name) return root;
  if ('children' in root) {
    for (const c of root.children) {
      const f = findByName(c, name);
      if (f) return f;
    }
  }
  return null;
}

const heroName = 'Script / Focus · 03 Editor hero';
let hero = null;
for (const page of figma.root.children) {
  hero = findByName(page, heroName);
  if (hero) {
    await figma.setCurrentPageAsync(page);
    break;
  }
}
if (!hero || !('appendChild' in hero)) throw new Error('Hero frame not found: ' + heroName);

const capture = await figma.getNodeByIdAsync('6:2');
if (!capture || !('resize' in capture)) throw new Error('Capture node 6:2 not found');

const dup = await figma.getNodeByIdAsync('5:2');
if (dup && dup.parent === figma.currentPage) dup.remove();

if (capture.parent !== hero) hero.appendChild(capture);

capture.x = 0;
capture.y = 0;
capture.resize(hero.width, hero.height);
capture.opacity = 0.4;
capture.name = 'Capture · S-01 focus (1440×900)';
hero.insertChild(0, capture);

figma.commitUndo();
return { ok: true, hero: hero.name, capture: capture.name };
```

### Resolve · `vfBqIrcXhys0XoTODSbsI5`

`description`: Arrange Resolve capture nodes 14:2–14:4 and 16:2 in Capture · shot states frame

```javascript
function findByName(root, name) {
  if ('name' in root && root.name === name) return root;
  if ('children' in root) {
    for (const c of root.children) {
      const f = findByName(c, name);
      if (f) return f;
    }
  }
  return null;
}
function findByNameIncludes(root, part) {
  if ('name' in root && root.name.includes(part)) return root;
  if ('children' in root) {
    for (const c of root.children) {
      const f = findByNameIncludes(c, part);
      if (f) return f;
    }
  }
  return null;
}

const ids = ['14:2', '14:3', '14:4', '16:2'];
const names = ['Capture · grid', 'Capture · hover (sim)', 'Capture · hover (sim B)', 'Capture · selected'];
const nodes = [];
for (let i = 0; i < ids.length; i++) {
  const n = await figma.getNodeByIdAsync(ids[i]);
  if (!n) throw new Error('Missing node ' + ids[i]);
  n.name = names[i];
  nodes.push(n);
}

let anchor = null;
for (const page of figma.root.children) {
  anchor = findByNameIncludes(page, '03 · Storyboard') || findByNameIncludes(page, 'Comp / Shot-kortti');
  if (anchor) {
    await figma.setCurrentPageAsync(page);
    break;
  }
}

const parent = anchor && 'parent' in anchor && anchor.parent && 'appendChild' in anchor.parent
  ? anchor.parent
  : figma.currentPage;

let frame = findByName(figma.currentPage, 'Capture · shot states');
if (!frame) {
  frame = figma.createFrame();
  frame.name = 'Capture · shot states';
  frame.layoutMode = 'HORIZONTAL';
  frame.primaryAxisSizingMode = 'AUTO';
  frame.counterAxisSizingMode = 'AUTO';
  frame.itemSpacing = 24;
  frame.paddingLeft = frame.paddingRight = frame.paddingTop = frame.paddingBottom = 16;
  frame.fills = [{ type: 'SOLID', color: { r: 0.12, g: 0.12, b: 0.14 } }];
  parent.appendChild(frame);
  if (anchor && 'x' in anchor && 'y' in anchor) {
    frame.x = anchor.x;
    frame.y = anchor.y + ('height' in anchor ? anchor.height : 400) + 48;
  }
}

for (const n of nodes) {
  if (n.parent !== frame) frame.appendChild(n);
}

figma.commitUndo();
return { ok: true, frame: frame.name, children: nodes.map(n => n.name) };
```
