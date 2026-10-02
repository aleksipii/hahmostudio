'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Layers, Upload, ChevronRight, ChevronDown, Eye, EyeOff, Folder, Image as ImageIcon, Download, X, ZoomIn, ZoomOut, Scan, AlertTriangle, Check, FileImage, Square, LoaderCircle, Package, Info } from 'lucide-react';
import { flatten, releaseDocument, safeName, type LayerNode, type PsdDocument } from '@/lib/psd-model';
import { renderLayers } from '@/lib/psd-render';

function save(blob: Blob, name: string) {
 const url = URL.createObjectURL(blob), a = document.createElement('a');
 a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
}
async function imageOf(blob: Blob) {
 const url = URL.createObjectURL(blob), image = new Image(); image.src = url;
 try { await image.decode(); return { url, image }; } catch (e) { URL.revokeObjectURL(url); throw e; }
}
export default function Editor() {
 const [doc, setDoc] = useState<PsdDocument | null>(null), docRef = useRef<PsdDocument | null>(null);
 const [selected, setSelected] = useState<string | null>(null), [collapsed, setCollapsed] = useState<Set<string>>(new Set());
 const [revision, setRevision] = useState(0), [mode, setMode] = useState<'layers'|'original'|'solo'>('layers');
 const [zoom, setZoom] = useState<number | null>(null), [fit, setFit] = useState(1), [background, setBackground] = useState<'checker'|'dark'|'white'>('checker');
 const [busy, setBusy] = useState(false), [progress, setProgress] = useState(''), [error, setError] = useState('');
 const [drag, setDrag] = useState(false), [help, setHelp] = useState(false), [exporting, setExporting] = useState(false);
 const helpDialog = useRef<HTMLElement>(null), helpButton = useRef<HTMLButtonElement>(null);
 const worker = useRef<Worker | null>(null), generation = useRef(0), timer = useRef<ReturnType<typeof setTimeout> | null>(null);
 const input = useRef<HTMLInputElement>(null), stage = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null);
 useEffect(() => {
  if (!help) return;
  const keyboard = (e: KeyboardEvent) => {
   if (e.key === 'Escape') { setHelp(false); helpButton.current?.focus(); }
   if (e.key === 'Tab' && helpDialog.current) {
    const all = Array.from(helpDialog.current.querySelectorAll<HTMLElement>('button, a[href]'));
    const first = all[0], last = all.at(-1);
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
    if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
   }
  };
  document.addEventListener('keydown', keyboard); return () => document.removeEventListener('keydown', keyboard);
 }, [help]);
 const nodes = doc ? flatten(doc.layers) : [], current = nodes.find(n => n.key === selected);
 const cancel = useCallback(() => {
  generation.current++; worker.current?.terminate(); worker.current = null;
  if (timer.current) clearTimeout(timer.current); setBusy(false); setProgress('');
 }, []);
 useEffect(() => () => { generation.current++; worker.current?.terminate(); if (timer.current) clearTimeout(timer.current); releaseDocument(docRef.current); }, []);
 const install = useCallback(async (incoming: PsdDocument, token: number) => {
  try {
   // Decode sequentially to limit peak memory for large layer sets.
   for (const n of flatten(incoming.layers)) if (n.png) { const img = await imageOf(n.png); n.url = img.url; n.image = img.image; }
   if (incoming.composite) { const img = await imageOf(incoming.composite); incoming.compositeUrl = img.url; incoming.compositeImage = img.image; }
   if (token !== generation.current) { releaseDocument(incoming); return; }
   releaseDocument(docRef.current); docRef.current = incoming; setDoc(incoming);
   setSelected(null); setCollapsed(new Set()); setMode('layers'); setZoom(null); setRevision(r => r + 1); setBusy(false); setProgress('');
  } catch (e) { releaseDocument(incoming); if (token === generation.current) { setError('Tasokuvan avaaminen epäonnistui. Kokeile tallentaa PSD uudelleen Photoshopissa.'); setBusy(false); } }
 }, []);
 const openFile = useCallback(async (file: File) => {
  cancel(); setError('');
  if (!/\.psd$/i.test(file.name)) { setError('Valitse .psd-tiedosto. PSB- ja kuvatiedostot eivät ole vielä tuettuja.'); return; }
  if (file.size > 100 * 1024 * 1024) { setError('Tiedosto on yli 100 Mt. Pienennä PSD:tä Photoshopissa.'); return; }
  if (typeof OffscreenCanvas === 'undefined' || typeof Worker === 'undefined') { setError('Selain ei tue tämän editorin kuvankäsittelyä. Avaa sovellus ajantasaisessa Chromessa tai Edgessä.'); return; }
  const token = generation.current; setBusy(true); setProgress('Luetaan tiedostoa…');
  try {
   const buffer = await file.arrayBuffer(); if (token !== generation.current) return;
   const w = new Worker(new URL('../lib/psd.worker.ts', import.meta.url), { type: 'module' }); worker.current = w;
   const fail = (message: string) => { if (token !== generation.current) return; cancel(); setError(message); };
   timer.current = setTimeout(() => fail('Avaaminen kesti liian kauan. Pienennä PSD:tä ja kokeile uudelleen.'), 90000);
   w.onerror = () => fail('PSD:n lukeminen epäonnistui. Tallenna tiedosto 8-bittisenä RGB-PSD:nä ja kokeile uudelleen.');
   w.onmessage = e => {
    if (token !== generation.current) return;
    if (e.data.type === 'progress') setProgress(`Puretaan tasoja ${e.data.done} / ${e.data.total}`);
    if (e.data.type === 'error') fail(e.data.message);
    if (e.data.type === 'done') {
     if (timer.current) clearTimeout(timer.current); w.terminate(); worker.current = null;
     setProgress('Valmistellaan esikatselua…'); void install(e.data.doc, token);
    }
   };
   w.postMessage({ buffer, name: file.name }, [buffer]);
  } catch (e) { if (token === generation.current) { cancel(); setError('Tiedoston avaaminen epäonnistui. Kokeile uudelleen.'); } }
 }, [cancel, install]);
 const demo = async () => {
  cancel(); setError(''); setBusy(true); setProgress('Avataan tasotestiä…'); const token = generation.current;
  try { const response = await fetch(`${import.meta.env.BASE_URL}tasotesti.psd`); if (!response.ok) throw new Error(); const blob = await response.blob(); if (token === generation.current) await openFile(new File([blob], 'Tasotesti.psd')); }
  catch { if (token === generation.current) { setBusy(false); setError('Tasotestin lataus epäonnistui. Voit silti avata oman PSD-tiedoston.'); } }
 };
 useEffect(() => {
  if (!stage.current) return;
  const observer = new ResizeObserver(([e]) => {
   if (doc) setFit(Math.min((e.contentRect.width - 80) / doc.width, (e.contentRect.height - 80) / doc.height, 1));
  }); observer.observe(stage.current); return () => observer.disconnect();
 }, [doc]);
 useEffect(() => {
  if (!canvas.current || !doc) return;
  if (mode === 'original' && doc.compositeImage) {
   const c = canvas.current, r = Math.min(1, 2048 / Math.max(doc.width, doc.height)); c.width = Math.round(doc.width * r); c.height = Math.round(doc.height * r);
   c.getContext('2d')!.drawImage(doc.compositeImage, 0, 0, c.width, c.height);
  } else renderLayers(canvas.current, doc, mode === 'solo' && selected ? selected : undefined);
 }, [doc, mode, selected, revision]);
 const toggle = (n: LayerNode) => { n.visible = !n.visible; setRevision(r => r + 1); setMode('layers'); };
 const downloadAll = async () => {
  if (!doc) return; setExporting(true); setError('');
  try {
   const { zip, strToU8 } = await import('fflate'); const files: Record<string, Uint8Array> = {};
   const metadata = [];
   for (const [i, n] of nodes.entries()) {
    const filename = n.png ? `tasot/${String(i + 1).padStart(3, '0')}_${safeName(n.name)}.png` : null;
    if (filename && n.png) files[filename] = new Uint8Array(await n.png.arrayBuffer());
    metadata.push({ key: n.key, psdId: n.psdId, name: n.name, path: n.path, kind: n.kind, left: n.left, top: n.top, width: n.width, height: n.height, opacity: n.opacity, visible: n.visible, blendMode: n.blendMode, file: filename, warnings: n.warnings });
   }
   files['tasot.json'] = strToU8(JSON.stringify({ version: 1, source: doc.name, width: doc.width, height: doc.height, note: 'PNG:t ovat rajattuja tasokuvia. Sijainti on left/top. Rasterimaskit on yhdistetty PNG:n läpinäkyvyyteen. Tasotehosteet ja leikkausmaskit eivät sisälly PNG-kuviin.', layers: metadata }, null, 2));
   const data = await new Promise<Uint8Array>((resolve, reject) => zip(files, { level: 0 }, (err, data) => err ? reject(err) : resolve(data)));
   save(new Blob([new Uint8Array(data)], {type: 'application/zip'}), `${safeName(doc.name.replace(/\.psd$/i, ''))}_tasot.zip`);
  } catch { setError('Tasojen lataaminen epäonnistui. Kokeile ladata yksittäinen taso.'); } finally { setExporting(false); }
 };
 function tree(ls: LayerNode[], depth = 0, parentHidden = false): React.ReactNode {
  return [...ls].reverse().map(n => <div key={n.key}>
   <div className={`layer-row ${selected === n.key ? 'selected' : ''} ${(!n.visible || parentHidden) ? 'muted-layer' : ''}`} style={{paddingLeft: 12 + depth * 16}}>
    {n.kind === 'group' ? <button className="tiny" aria-label={`${collapsed.has(n.key) ? 'Avaa' : 'Sulje'} ryhmä ${n.name}`} aria-expanded={!collapsed.has(n.key)} onClick={() => setCollapsed(s => { const next = new Set(s); if (next.has(n.key)) next.delete(n.key); else next.add(n.key); return next; })}>{collapsed.has(n.key) ? <ChevronRight size={14}/> : <ChevronDown size={14}/>}</button> : <span className="tree-spacer"/>}
    <button className="layer-select" onClick={() => setSelected(n.key)} aria-pressed={selected === n.key} title={n.path}>
     <span className={`layer-thumb ${n.kind === 'group' ? 'folder-thumb' : 'checker'}`}>{n.kind === 'group' ? <Folder size={17}/> : n.url ? <img src={n.url} alt=""/> : <ImageIcon size={14}/>}</span>
     <span className="layer-name">{n.name}</span>{n.warnings.length > 0 && <AlertTriangle className="warning-icon" size={13}/>}</button>
    <button className="tiny visibility" onClick={() => toggle(n)} aria-label={`${n.visible ? 'Piilota' : 'Näytä'} ${n.name}`} aria-pressed={n.visible}>{n.visible ? <Eye size={15}/> : <EyeOff size={15}/>}</button>
   </div>{n.kind === 'group' && !collapsed.has(n.key) && tree(n.children, depth + 1, parentHidden || !n.visible)}
  </div>);
 }
 const scale = Math.max(.01, zoom ?? fit);
 return <main className="studio" onDragOver={e => { e.preventDefault(); if (e.dataTransfer.types.includes('Files')) setDrag(true); }} onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDrag(false); }} onDrop={e => { e.preventDefault(); setDrag(false); const file = e.dataTransfer.files[0]; if (file) void openFile(file); }}>
  <input ref={input} type="file" accept=".psd" hidden onChange={e => { const file = e.target.files?.[0]; if (file) void openFile(file); e.target.value = ''; }}/>
  <header className="topbar"><div className="brand"><span className="brand-mark"><Layers size={21}/></span><h1>hahmostudio<span className="brand-dot">.</span></h1><span className="version">VAIHE 01</span></div>
   <div className="header-actions"><button ref={helpButton} className="text-button" onClick={() => setHelp(true)}><Info size={16}/><span>PSD-ohje</span></button><button className="primary" onClick={() => input.current?.click()}><Upload size={16}/><span>Avaa PSD</span></button></div></header>
  <div className="projectbar"><div className="project-title"><FileImage size={17}/><span>{doc?.name ?? 'Uusi hahmo'}</span>{doc && <span className="document-size">{doc.width} × {doc.height} px</span>}</div><span className="local-label"><span className="local-indicator"/>Tiedosto käsitellään selaimessa</span></div>
  {error && <div className="error-bar" role="alert"><AlertTriangle size={17}/><span>{error}</span><button className="tiny" aria-label="Sulje virheilmoitus" onClick={() => setError('')}><X size={16}/></button></div>}
  <div className="workspace">
   <aside className="layers-panel"><div className="panel-heading"><h2><Layers size={15}/>Tasot</h2><span>{nodes.filter(n => n.kind === 'layer').length}</span></div>
    {doc ? <><div className="layer-tree" aria-label="PSD-tasot">{tree(doc.layers)}</div><div className="layers-bottom"><span>{nodes.filter(n => n.kind === 'group').length} ryhmää · {nodes.filter(n => n.kind === 'layer').length} tasoa</span><button className="secondary full" disabled={exporting || !nodes.some(n => n.png)} onClick={() => void downloadAll()}>{exporting ? <LoaderCircle size={16} className="spin"/> : <Package size={16}/>}Lataa kaikki tasot</button></div></> : <div className="panel-empty"><Folder size={27}/><p>Tasosi tulevat tähän.</p><span>Avaa PSD, niin näet sen tasot ja ryhmät.</span></div>}
   </aside>
   <section className="preview-panel" aria-label="Kuvan esikatselu"><div className="preview-toolbar"><div className="view-tabs"><button className={mode !== 'original' ? 'active' : ''} onClick={() => setMode('layers')}>Tasoesikatselu</button><button disabled={!doc?.compositeImage} className={mode === 'original' ? 'active' : ''} onClick={() => setMode('original')}>PSD-esikatselu</button></div><div className="background-options" aria-label="Esikatselun tausta">{(['checker','dark','white'] as const).map(b => <button key={b} title={b === 'checker' ? 'Läpinäkyvyysruudukko' : b === 'dark' ? 'Tumma tausta' : 'Valkoinen tausta'} aria-label={b === 'checker' ? 'Läpinäkyvyysruudukko' : b === 'dark' ? 'Tumma tausta' : 'Valkoinen tausta'} aria-pressed={background === b} className={`swatch ${b} ${background === b ? 'chosen' : ''}`} onClick={() => setBackground(b)}/>)}</div></div>
    <div className={`stage ${drag ? 'dragging' : ''}`} ref={stage}>
     {doc ? <div className={`artboard ${background}`} style={{width: doc.width * scale, height: doc.height * scale}}><canvas ref={canvas}/>{current && mode !== 'original' && current.kind === 'layer' && <div className="selection-box" style={{left: `${current.left / doc.width * 100}%`, top: `${current.top / doc.height * 100}%`, width: `${current.width / doc.width * 100}%`, height: `${current.height / doc.height * 100}%`}}/>}</div> : <div className="import-card"><div className="import-symbol"><FileImage size={34} strokeWidth={1.4}/><span>.psd</span></div><span className="eyebrow">HAHMOSI ENSIMMÄINEN ASKEL</span><h2>Avaa hahmosi PSD.</h2><p>Jokainen taso omaksi osakseen.<br/>Ryhmät, sijainnit ja läpinäkyvyys mukana.</p><button className="primary large" onClick={() => input.current?.click()}><Upload size={17}/>Valitse PSD-tiedosto</button><span className="drop-hint">tai pudota tiedosto tähän</span><div className="import-divider"/><button className="text-button demo-button" onClick={() => void demo()}><Square size={15}/>Kokeile valmista tasotestiä</button><span className="format-note">RGB / harmaasävy · 8 bittiä · enintään 100 Mt</span></div>}
     {drag && <div className="drop-overlay"><Upload size={30}/><strong>Pudota PSD tähän</strong></div>}
     {busy && <div className="busy-overlay" role="status"><LoaderCircle className="spin" size={30}/><strong>{progress}</strong><button className="secondary" onClick={cancel}>Peruuta</button></div>}
    </div>
    <div className="preview-footer"><span>{mode === 'original' ? 'Photoshopin tallentama esikatselu' : mode === 'solo' ? 'Valittu taso eristettynä' : doc ? 'Näkyvät tasot' : 'Valmis avaamaan PSD:n'}</span><div className="zoom-controls"><button className="tiny" aria-label="Loitonna" disabled={!doc} onClick={() => setZoom(Math.max(.05, scale / 1.25))}><ZoomOut size={16}/></button><span>{doc ? `${Math.round(scale * 100)} %` : '—'}</span><button className="tiny" aria-label="Lähennä" disabled={!doc} onClick={() => setZoom(Math.min(4, scale * 1.25))}><ZoomIn size={16}/></button><button className="fit-button" disabled={!doc} onClick={() => setZoom(null)} title="Sovita kuva"><Scan size={15}/>Sovita</button></div></div>
   </section>
   <aside className="details-panel"><div className="panel-heading"><h2>Tason tiedot</h2></div>{current ? <div className="details-content"><div className={`detail-preview checker`}>{current.url ? <img src={current.url} alt={current.name}/> : <Folder size={40}/>}</div><span className="eyebrow">{current.kind === 'group' ? 'TASORYHMÄ' : 'TASO'}</span><h3>{current.name}</h3><p className="layer-path">{current.path}</p><dl className="properties"><div><dt>Leveys</dt><dd>{current.width} px</dd></div><div><dt>Korkeus</dt><dd>{current.height} px</dd></div><div><dt>X</dt><dd>{current.left} px</dd></div><div><dt>Y</dt><dd>{current.top} px</dd></div><div><dt>Peittävyys</dt><dd>{Math.round(current.opacity * 100)} %</dd></div><div><dt>Sekoitustila</dt><dd>{current.blendMode}</dd></div><div><dt>PSD-ID</dt><dd>{current.psdId ?? 'Ei tunnistetta'}</dd></div></dl><button className="secondary full" onClick={() => setMode(mode === 'solo' ? 'layers' : 'solo')}><Eye size={16}/>{mode === 'solo' ? 'Näytä kaikki tasot' : 'Näytä vain tämä'}</button>{current.png && <button className="secondary full" onClick={() => save(current.png!, `${safeName(current.name)}.png`)}><Download size={16}/>Lataa taso PNG:nä</button>}{current.warnings.map(w => <p className="layer-warning" key={w}><AlertTriangle size={14}/>{w}</p>)}</div> : <div className="panel-empty"><Scan size={27}/><p>Valitse taso.</p><span>Näet kuvan, sijainnin ja koon. Voit myös ladata tason PNG:nä.</span></div>}
    <div className="file-summary"><span className="eyebrow">TYÖNKULKU</span><div className="workflow-step"><span>01</span><strong>PSD-tuonti & tasot</strong><Check size={14}/></div><p>Seuraava vaihe: rig editor.<br/>Nimeämistä ei vaadita tässä vaiheessa.</p></div></aside>
  </div>
  {doc?.warnings.length ? <details className="warnings"><summary><AlertTriangle size={15}/>{doc.warnings.length} esikatseluhuomiota — PSD-esikatselu näyttää Photoshopin tallentaman kuvan.</summary><ul>{doc.warnings.map(w => <li key={w}>{w}</li>)}</ul></details> : null}
  <footer className="statusbar"><span><span className="status-dot"/>{doc ? 'PSD avattu' : 'Odottaa tiedostoa'}</span><span>Tasojen näkyvyysmuutokset eivät tallennu. Alkuperäinen PSD säilyy ennallaan.</span><span>PSD IMPORTER / 01</span></footer>
  {help && <div className="modal-backdrop" onClick={() => setHelp(false)}><section ref={helpDialog} className="help-modal" role="dialog" aria-modal="true" aria-labelledby="help-title" onClick={e => e.stopPropagation()}><div className="modal-heading"><h2 id="help-title">PSD valmiiksi animaatioon</h2><button autoFocus className="tiny" aria-label="Sulje ohje" onClick={() => setHelp(false)}><X size={20}/></button></div><p>Tallenna Photoshopissa tavallinen <strong>.psd-tiedosto, RGB, 8 bittiä / kanava</strong>. Jokainen liikutettava osa kannattaa piirtää omalle tasolleen.</p><ol><li>Pidä pää, vartalo, käsien osat ja jalkojen osat erillisinä tasoina.</li><li>Kokoa suun muodot ja silmien ilmeet omiin ryhmiinsä.</li><li>Voit käyttää mitä tahansa tasojen nimiä. Selkeät nimet helpottavat tulevaa riggausta.</li><li>Rasteroi tarvittaessa tasotehosteet ja leikkausmaskit, jotta tasoesikatselu vastaa Photoshopia.</li></ol><p><strong>Tasoesikatselu</strong> reagoi silmäpainikkeisiin. <strong>PSD-esikatselu</strong> näyttää Photoshopin tallentaman kokonaiskuvan, eikä reagoi näkyvyysmuutoksiin.</p><p className="muted">Enintään 100 Mt, 16 miljoonaa pikseliä, 1000 tasoa. PSB ja 16-/32-bittiset tiedostot eivät ole vielä tuettuja. Tässä vaiheessa tiedosto ja valinnat ovat avoimen välilehden muistissa.</p><a className="secondary" href={`${import.meta.env.BASE_URL}tasotesti.psd`} download="Tasotesti.psd"><Download size={16}/>Lataa esimerkki-PSD</a><button className="primary" onClick={() => setHelp(false)}>Selvä</button></section></div>}
 </main>;
}
