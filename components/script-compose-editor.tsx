import {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent} from 'react';
import ScriptGuide from './script-guide';
import ScriptCommandPalette, {type ScriptCommandId} from './script-command-palette';
import {
  scanScriptLineAnnotations,
  scriptSceneBoundaryLines,
  snapDividerLine,
  SCRIPT_ANNOTATE_DEBOUNCE_MS,
  type ScriptLineAnnotation,
} from '../lib/script-line-annotations';
const OVERSCAN = 8;

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
          <div className="script-compose-grid">
            {renderMarginSide('left')}
            <div className="script-main">
              <div className="script-editor">
                <label className="sr-only" htmlFor={fieldId}>
                  Käsikirjoitus (.md / .txt)
                </label>
                {!empty && variant !== 'hero' && <label htmlFor={fieldId}>Käsikirjoitus (.md / .txt)</label>}
                {variant !== 'hero' && !toolsHidden && (
                  <ScriptGuide empty={empty} disabled={scriptLocked} insert={onInsertGuide} />
                )}
                <div className="script-textarea-wrap">
                  <textarea
                    ref={textareaRef}
                    id={fieldId}
                    className="script-editor-field"
                    maxLength={60000}
                    rows={variant === 'hero' ? 16 : 9}
                    value={text}
                    disabled={scriptLocked}
                    placeholder={variant === 'hero' ? 'Kirjoita käsikirjoitus tai liitä teksti…' : undefined}
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
              <div className="script-sticky-bar">
                <button
                  type="button"
                  className="primary full"
                  disabled={parseDisabled}
                  title={parseTitle}
                  onClick={onRequestParse}
                >
                  Jaa kohtauksiin
                </button>
              </div>
            </div>
            {renderMarginSide('right')}
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
