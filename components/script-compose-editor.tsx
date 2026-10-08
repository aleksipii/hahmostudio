import {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent} from 'react';
import ScriptGuide from './script-guide';
import {buildStageNames, type BuildStage} from '../lib/episode-builder';
import {episodeTemplates} from '../lib/episode-templates';
import ScriptCommandPalette, {type ScriptCommandId} from './script-command-palette';
import {
  scanScriptLineAnnotations,
  scriptSceneBoundaryLines,
  snapDividerLine,
  SCRIPT_ANNOTATE_DEBOUNCE_MS,
  type ScriptLineAnnotation,
} from '../lib/script-line-annotations';
const OVERSCAN = 8;

function scriptLines(text: string): string[] {
  const norm = text.replace(/\r\n?/g, '\n');
  return norm.length ? norm.split('\n') : [''];
}

function replaceLine(text: string, index: number, next: string): string {
  const lines = scriptLines(text);
  lines[index] = next.replace(/\n/g, ' ');
  const joined = lines.join('\n');
  return joined.length > 60000 ? joined.slice(0, 60000) : joined;
}

function insertLine(text: string, index: number): string {
  const lines = scriptLines(text);
  lines.splice(index + 1, 0, '');
  return lines.join('\n').slice(0, 60000);
}

function removeLine(text: string, index: number): string {
  const lines = scriptLines(text);
  if (lines.length < 2) return '';
  lines.splice(index, 1);
  return lines.join('\n');
}

/** Hero-näkymän rivieditori. Lähde on edelleen yksi merkkijono. */
function ScriptLineSheet({
  text,
  locked,
  annotations,
  dividerLine,
  dragging,
  onDividerLine,
  onDrag,
  onTextChange,
  onSlash,
}: {
  text: string;
  locked: boolean;
  annotations: ScriptLineAnnotation[];
  dividerLine: number;
  dragging: boolean;
  onDividerLine: (line: number) => void;
  onDrag: (dragging: boolean) => void;
  onTextChange: (value: string) => void;
  onSlash: () => void;
}) {
  const lines = scriptLines(text);
  const byLine = new Map(annotations.map((a) => [a.line, a]));
  const sheet = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent) => {
      const rows = sheet.current?.querySelectorAll<HTMLElement>('[data-line]');
      if (!rows?.length) return;
      let line = lines.length;
      for (const row of rows) {
        const box = row.getBoundingClientRect();
        if (e.clientY < box.top + box.height / 2) {
          line = Number(row.dataset.line);
          break;
        }
      }
      onDividerLine(Math.max(1, Math.min(lines.length, line)));
    };
    const up = () => onDrag(false);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [dragging, lines.length, onDividerLine, onDrag]);

  return (
    <div className="script-line-sheet" ref={sheet}>
      {lines.map((line, index) => {
        const n = index + 1;
        const ann = byLine.get(n);
        const words = line.trim() ? line.trim().split(/\s+/).length : 0;
        return (
          <div key={n}>
            {n === dividerLine && n > 1 && (
              <div
                className={`script-line-split${dragging ? ' is-dragging' : ''}`}
                role="separator"
                aria-orientation="horizontal"
                tabIndex={0}
                onPointerDown={(e) => {
                  if (locked) return;
                  e.preventDefault();
                  onDrag(true);
                }}
              >
                <span>Jakoviiva</span>
              </div>
            )}
            <div className={`script-line-row${ann?.kind === 'scene' ? ' is-scene' : ''}`} data-line={n}>
              <div className="script-line-gutter">
                {ann?.kind === 'scene' && <strong>{ann.left ?? 'Kohtaus'}</strong>}
                {(ann?.kind === 'speaker' || ann?.kind === 'character') && <span>{ann.right}</span>}
              </div>
              <textarea
                className="script-line-field"
                rows={1}
                value={line}
                disabled={locked}
                aria-label={`Rivi ${n}`}
                spellCheck
                onChange={(e) => onTextChange(replaceLine(text, index, e.target.value))}
                onKeyDown={(e) => {
                  if (locked) return;
                  if (e.key === '/' && line === '') {
                    e.preventDefault();
                    onSlash();
                  } else if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    onTextChange(insertLine(text, index));
                  } else if (e.key === 'Backspace' && line === '' && lines.length > 1) {
                    e.preventDefault();
                    onTextChange(removeLine(text, index));
                  }
                }}
              />
              <div className={`script-line-meta${ann?.unrecognized ? ' is-unknown' : ann?.kind === 'body' && ann.right ? ' is-recognized' : ''}`} title={ann?.kind === 'body' && ann.right ? 'Sääntötunnistin: ' + ann.right : undefined}>{ann?.kind === 'body' && ann.right ? ann.right : words ? `${words} sanaa` : ''}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Jaettu käsikirjoituksen kirjoitusalue — focus, panel ja keskialue. */
export default function ScriptComposeEditor({
  text,
  scriptLocked,
  scriptLayout,
  sidebarDocked,
  variant = 'panel',
  toolsHidden = false,
  message,
  error,
  working,
  parseDisabled,
  parseTitle,
  onTextChange,
  onAbort,
  onRequestParse,
  onInsertGuide,
  onImportFile,
  onCommandAction,
  onTryExample,
  onTryExampleEn,
  onBuildEpisode,
  buildProgress,
  onPickTemplate,
}: {
  text: string;
  scriptLocked: boolean;
  scriptLayout: 'panel' | 'focus';
  sidebarDocked?: boolean;
  variant?: 'panel' | 'hero';
  toolsHidden?: boolean;
  message: string;
  error: string;
  working: boolean;
  parseDisabled: boolean;
  parseTitle?: string;
  onTextChange: (value: string) => void;
  onAbort: () => void;
  onRequestParse: () => void;
  onInsertGuide: (value: string) => void;
  onImportFile?: (text: string) => Promise<void>;
  onCommandAction?: (id: ScriptCommandId) => void;
  onTryExample?: () => void;
  /** Englanninkielinen esimerkki: Kokoro tuottaa vain englanninkielisten repliikkien äänen. */
  onTryExampleEn?: () => void;
  /** Rakenna jakso: koko ketju yhdellä kumottavalla muutoksella. */
  onBuildEpisode?: () => void;
  buildProgress?: { stage: BuildStage; episode?: number; episodes?: number } | null;
  /** Aloituspohja tyhjästä tilasta: asettaa tekstin, rakennus tehdään käyttäjän painalluksella. */
  onPickTemplate?: (id: string) => void;
}) {
  const empty = !text.trim();
  const uxHero = variant === 'hero';
  const [emptyDrag, setEmptyDrag] = useState(false);
  const [startedBlank, setStartedBlank] = useState(false);
  const fieldId = variant === 'hero' ? 'dialogue-script-hero' : 'dialogue-script';
  const lineCount = useMemo(() => (text ? text.replace(/\r\n?/g, '\n').split('\n').length : 1), [text]);

  const [annotations, setAnnotations] = useState<ScriptLineAnnotation[]>([]);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [dividerLine, setDividerLine] = useState(1);
  const [draggingDivider, setDraggingDivider] = useState(false);
  const [scrollTop, setScrollTop] = useState(0);
  const [lineHeightPx, setLineHeightPx] = useState(22);
  const [fieldPadTop, setFieldPadTop] = useState(0);
  const [viewportLines, setViewportLines] = useState(24);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const boundaries = useMemo(() => scriptSceneBoundaryLines(annotations), [annotations]);

  useEffect(() => {
    setDividerLine((prev) => snapDividerLine(prev || lineCount, boundaries, lineCount));
  }, [lineCount, boundaries]);

  useEffect(() => {
    if (!empty) setStartedBlank(false);
  }, [empty]);

  useEffect(() => {
    const t = window.setTimeout(
      () => setAnnotations(scanScriptLineAnnotations(text)),
      SCRIPT_ANNOTATE_DEBOUNCE_MS,
    );
    return () => window.clearTimeout(t);
  }, [text]);

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    const readMetrics = () => {
      const style = getComputedStyle(el);
      const lh = parseFloat(style.lineHeight);
      const pad = parseFloat(style.paddingTop);
      if (Number.isFinite(lh)) setLineHeightPx(lh);
      if (Number.isFinite(pad)) setFieldPadTop(pad);
      const lineH = Number.isFinite(lh) ? lh : 22;
      setViewportLines(Math.ceil(el.clientHeight / lineH) + 2);
    };
    readMetrics();
    const ro = new ResizeObserver(readMetrics);
    ro.observe(el);
    return () => ro.disconnect();
  }, [variant, scriptLayout]);

  const visibleRange = useMemo(() => {
    const first = Math.floor(scrollTop / lineHeightPx);
    const start = Math.max(0, first - OVERSCAN);
    const end = Math.min(lineCount, first + viewportLines + OVERSCAN);
    return { start, end };
  }, [scrollTop, lineHeightPx, viewportLines, lineCount]);

  const annByLine = useMemo(() => new Map(annotations.map((a) => [a.line, a])), [annotations]);

  const lineFromPointer = useCallback(
    (clientY: number) => {
      const el = textareaRef.current;
      if (!el) return 1;
      const rect = el.getBoundingClientRect();
      const y = clientY - rect.top + el.scrollTop - fieldPadTop;
      return snapDividerLine(Math.max(1, Math.floor(y / lineHeightPx) + 1), boundaries, lineCount);
    },
    [boundaries, fieldPadTop, lineCount, lineHeightPx],
  );

  useEffect(() => {
    if (!draggingDivider) return;
    const move = (e: PointerEvent) => setDividerLine(lineFromPointer(e.clientY));
    const up = () => setDraggingDivider(false);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [draggingDivider, lineFromPointer]);

  const importTextFile = (file: File) => {
    if (!onImportFile) return;
    void (async () => {
      if (file.size > 150000) throw Error('Tekstitiedosto on liian suuri.');
      await onImportFile(new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer()));
    })().catch(() => {});
  };

  const handleCommand = (id: ScriptCommandId) => {
    setPaletteOpen(false);
    if (id === 'import') fileRef.current?.click();
    else onCommandAction?.(id);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (scriptLocked) return;
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && onBuildEpisode && !parseDisabled) { e.preventDefault(); onBuildEpisode(); return; }
    const el = e.currentTarget;
    const pos = el.selectionStart;
    const before = text.slice(0, pos);
    const lineStart = before.lastIndexOf('\n') + 1;
    const col = before.slice(lineStart);
    if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey && col === '') {
      e.preventDefault();
      setPaletteOpen(true);
    }
  };

  const renderMarginSide = (side: 'left' | 'right') => (
    <div
      className={`script-margin script-margin--${side}`}
      aria-hidden={side === 'left' ? undefined : true}
      style={{ paddingTop: fieldPadTop + visibleRange.start * lineHeightPx }}
    >
      {Array.from({ length: visibleRange.end - visibleRange.start }, (_, i) => {
        const line = visibleRange.start + i + 1;
        const ann = annByLine.get(line);
        const pastDivider = line > dividerLine;
        const label = side === 'left' ? ann?.left : ann?.right;
        if (!label && side === 'right' && ann?.kind === 'comment') {
          return (
            <div
              key={line}
              className={`script-margin-line script-margin-line--dim${pastDivider ? ' script-margin-line--past-divider' : ''}`}
              style={{ height: lineHeightPx }}
            >
              <span>//</span>
            </div>
          );
        }
        if (!label) {
          return (
            <div
              key={line}
              className={`script-margin-line${pastDivider ? ' script-margin-line--past-divider' : ''}`}
              style={{ height: lineHeightPx }}
            />
          );
        }
        return (
          <div
            key={line}
            className={`script-margin-line script-margin-line--${ann?.kind ?? 'body'}${pastDivider ? ' script-margin-line--past-divider' : ''}`}
            style={{ height: lineHeightPx }}
            title={label}
          >
            <span>{label}</span>
          </div>
        );
      })}
    </div>
  );

  const dividerTop = fieldPadTop + (dividerLine - 1) * lineHeightPx - scrollTop;

  return (
    <div
      id="script-source"
      ref={editorRef}
      className={`script-compose script-compose-editor${variant === 'hero' ? ' script-compose--hero' : ''}${toolsHidden ? ' script-compose--tools-hidden' : ''}`}
      data-script-layout={scriptLayout}
      data-script-variant={variant}
      data-sidebar-docked={sidebarDocked ? 'true' : undefined}
    >
      <input
        ref={fileRef}
        type="file"
        accept=".md,.txt"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          importTextFile(f);
        }}
      />
      <ScriptCommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} onPick={handleCommand} />
      {empty && uxHero && !startedBlank ? (
        <div className="script-empty-hero" role="status">
          <div
            className={`script-empty-drop${emptyDrag ? ' is-dragover' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setEmptyDrag(true);
            }}
            onDragLeave={() => setEmptyDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setEmptyDrag(false);
              if (scriptLocked) return;
              const file = e.dataTransfer.files[0];
              if (file && /\.(md|txt)$/i.test(file.name)) importTextFile(file);
            }}
          >
            <h2>Vedä käsikirjoitus tähän</h2>
            <p>Tuo valmis teksti tai aloita esimerkki. Puhujat ja kohtaukset tunnistetaan automaattisesti.</p>
            <div className="script-empty-acts">
              {onTryExample && (
                <button type="button" className="primary" disabled={scriptLocked} onClick={onTryExample}>
                  Kokeile esimerkkiä
                </button>
              )}
              {onTryExampleEn && (
                <button type="button" className="secondary" disabled={scriptLocked} onClick={onTryExampleEn} title="Englanninkieliset repliikit: äänen voi luoda paikallisesti Kokorolla (Mac-sovellus)">
                  Try English example
                </button>
              )}
              <button
                type="button"
                className="ghost-btn"
                disabled={scriptLocked || !onImportFile}
                onClick={() => fileRef.current?.click()}
              >
                Tuo tiedosto
              </button>
              <button
                type="button"
                className="ghost-btn"
                disabled={scriptLocked}
                onClick={() => {
                  setStartedBlank(true);
                  onTextChange('');
                }}
              >
                Aloita tyhjästä
              </button>
            </div>
            {onPickTemplate && (
              <div className="script-templates" role="group" aria-label="Aloituspohjat">
                <span className="script-templates__title">Aloituspohjat</span>
                {episodeTemplates.map(t => (
                  <button key={t.id} type="button" className="ghost-btn script-template" disabled={scriptLocked} title={`${t.description} Esimerkkirepliikit korvataan omilla. Kesto ilman ääniä noin ${t.approxSeconds[0]}–${t.approxSeconds[1]} s.`} onClick={() => onPickTemplate(t.id)}>
                    {t.name}
                  </button>
                ))}
              </div>
            )}
            <p className="script-empty-hint">
              Tai kirjoita alusta: paina <kbd>/</kbd> työkaluille
            </p>
          </div>
        </div>
      ) : (
        <div className={uxHero ? 'script-compose-scroll' : undefined}>
          {uxHero && !empty && (
            <div className="script-compose-bar">
              <span className="script-compose-bar__title">Käsikirjoitus</span>
              <span className="script-compose-bar__grow" />
              <button type="button" className="ghost-btn" disabled={scriptLocked} onClick={() => setPaletteOpen(true)}>
                Työkalut <kbd>/</kbd>
              </button>
            </div>
          )}
          {uxHero ? (
            <ScriptLineSheet
              text={text}
              locked={scriptLocked}
              annotations={annotations}
              dividerLine={dividerLine}
              dragging={draggingDivider}
              onDividerLine={setDividerLine}
              onDrag={setDraggingDivider}
              onTextChange={onTextChange}
              onSlash={() => setPaletteOpen(true)}
            />
          ) : (
          <div className="script-compose-grid">
            {renderMarginSide('left')}
            <div className="script-main">
              <div className="script-editor">
                <label className="sr-only" htmlFor={fieldId}>
                  Käsikirjoitus (.md / .txt)
                </label>
                {!empty && <label htmlFor={fieldId}>Käsikirjoitus (.md / .txt)</label>}
                {!toolsHidden && (
                  <ScriptGuide empty={empty} disabled={scriptLocked} insert={onInsertGuide} />
                )}
                <div className="script-textarea-wrap">
                  <textarea
                    ref={textareaRef}
                    id={fieldId}
                    className="script-editor-field"
                    maxLength={60000}
                    rows={9}
                    value={text}
                    disabled={scriptLocked}
                    onChange={(e) => onTextChange(e.target.value)}
                    onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
                    onKeyDown={handleKeyDown}
                    spellCheck
                  />
                  {!empty && (
                    <div
                      className={`script-parse-divider script-parse-divider--live${draggingDivider ? ' is-dragging' : ''}`}
                      style={{ top: Math.max(0, dividerTop) }}
                      role="slider"
                      aria-orientation="horizontal"
                      aria-valuenow={dividerLine}
                      aria-valuemin={1}
                      aria-valuemax={lineCount}
                      aria-label="Jakoviiva ennen Jaa kohtauksiin -toimintoa"
                      tabIndex={0}
                      onPointerDown={(e) => {
                        if (scriptLocked) return;
                        e.preventDefault();
                        setDraggingDivider(true);
                        setDividerLine(lineFromPointer(e.clientY));
                      }}
                      onKeyDown={(e) => {
                        if (scriptLocked) return;
                        if (e.key === 'ArrowUp') setDividerLine((l) => snapDividerLine(l - 1, boundaries, lineCount));
                        if (e.key === 'ArrowDown') setDividerLine((l) => snapDividerLine(l + 1, boundaries, lineCount));
                      }}
                    />
                  )}
                </div>
              </div>
            </div>
            {renderMarginSide('right')}
          </div>
          )}
          <div className="script-status">
            <p role="status">{message}</p>
            {error && (
              <p role="alert" className="script-error">
                {error}
              </p>
            )}
            {working && (
              <button type="button" className="secondary" onClick={onAbort}>
                Peruuta käsittely
              </button>
            )}
          </div>
          {buildProgress && <BuildProgress progress={buildProgress} />}
          <div className={`script-sticky-bar${onBuildEpisode ? ' script-sticky-bar--build' : ''}`}>
            {onBuildEpisode && (
              <button
                type="button"
                className="primary full script-build-episode"
                disabled={parseDisabled}
                title="Tunnistaa käsikirjoituksen, roolittaa hahmot, valitsee taustat ja rakentaa liikkeet yhdellä kumottavalla muutoksella (⌘↵)"
                aria-keyshortcuts="Meta+Enter Control+Enter"
                onClick={onBuildEpisode}
              >
                Rakenna jakso
              </button>
            )}
            <button
              type="button"
              className={onBuildEpisode ? 'secondary' : 'primary full'}
              disabled={parseDisabled}
              title={parseTitle}
              onClick={onRequestParse}
            >
              Jaa kohtauksiin
            </button>
          </div>
          {uxHero && (
            <footer className="script-compose-meta" aria-label="Käsikirjoituksen tilastot">
              <span>{lineCount} riviä</span>
              <span aria-hidden>·</span>
              <span>{text.length} merkkiä</span>
              <span className="script-compose-meta__hint">
                <kbd>/</kbd> työkalut
              </span>
            </footer>
          )}
        </div>
      )}
    </div>
  );
}

const buildStages: BuildStage[] = ['recognize', 'cast', 'motion', 'audio', 'done'];
/** Rakennuksen vaiheet: tunnistus → roolitus → liikkeet → ääni → valmis. */
function BuildProgress({ progress }: { progress: { stage: BuildStage; episode?: number; episodes?: number } }) {
  const index = buildStages.indexOf(progress.stage);
  const label = (progress.episodes && progress.episodes > 1 ? `Jakso ${progress.episode}/${progress.episodes}: ` : '') + buildStageNames[progress.stage];
  return (
    <div className="build-progress" role="progressbar" aria-label="Jakson rakennus" aria-valuemin={0} aria-valuemax={buildStages.length - 1} aria-valuenow={index} aria-valuetext={label}>
      <ol>
        {buildStages.map((stage, i) => (
          <li key={stage} className={i < index ? 'is-done' : i === index ? 'is-current' : ''}>
            {buildStageNames[stage]}
          </li>
        ))}
      </ol>
      <span className="build-progress__label">{label}</span>
    </div>
  );
}
