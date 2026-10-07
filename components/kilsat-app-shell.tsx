import type { CSSProperties, ReactNode } from 'react';
import { FileText, Image, Users, Volume2 } from 'lucide-react';
import StudioFlowTabs from './studio-flow-tabs';
import type { StudioFlowStep } from '../lib/studio-flow-scope';

/** HTML-luonnoksen kehys: brand, viisi vaihetta, sivuraili, sisältö. Logiikka editorissa. */
export default function KilsatAppShell({
  active,
  onSelectPhase,
  statusHint,
  menubar,
  headerActions,
  showRail,
  onRailScript,
  onRailCharacters,
  onRailLibrary,
  onRailAudio,
  railScriptActive,
  railCharactersActive,
  className,
  style,
  onDragOver,
  onDragLeave,
  onDrop,
  children,
}: {
  active: StudioFlowStep;
  onSelectPhase: (step: StudioFlowStep) => void;
  statusHint: string;
  menubar?: ReactNode;
  headerActions?: ReactNode;
  showRail: boolean;
  onRailScript: () => void;
  onRailCharacters: () => void;
  onRailLibrary: () => void;
  onRailAudio: () => void;
  railScriptActive: boolean;
  railCharactersActive: boolean;
  className?: string;
  style?: CSSProperties;
  onDragOver?: React.DragEventHandler;
  onDragLeave?: React.DragEventHandler;
  onDrop?: React.DragEventHandler;
  children: ReactNode;
}) {
  return (
    <main
      className={['kilsat-frame', className].filter(Boolean).join(' ')}
      style={style}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <header className="kilsat-top">
        <div className="kilsat-brand" aria-label="KOETA">
          <i className="kilsat-brand-mark" aria-hidden />
          <span>KOETA</span>
        </div>
        <StudioFlowTabs active={active} onSelect={onSelectPhase} />
        <span className="kilsat-saved" role="status">
          {statusHint}
        </span>
        {headerActions && <div className="kilsat-top-actions">{headerActions}</div>}
      </header>
      {menubar && <div className="kilsat-menubar">{menubar}</div>}
      <div className="kilsat-body">
        {showRail && (
          <aside className="kilsat-rail" role="toolbar" aria-label="Kirjasto">
            <button
              type="button"
              aria-label="Käsikirjoitus"
              title="Käsikirjoitus"
              aria-pressed={railScriptActive}
              onClick={onRailScript}
            >
              <FileText size={18} strokeWidth={1.7} />
            </button>
            <button
              type="button"
              aria-label="Hahmot"
              title="Hahmot"
              aria-pressed={railCharactersActive}
              onClick={onRailCharacters}
            >
              <Users size={18} strokeWidth={1.7} />
            </button>
            <button type="button" aria-label="Kuvat ja taustat" title="Kuvat" onClick={onRailLibrary}>
              <Image size={18} strokeWidth={1.7} />
            </button>
            <button type="button" aria-label="Äänet" title="Äänet" onClick={onRailAudio}>
              <Volume2 size={18} strokeWidth={1.7} />
            </button>
          </aside>
        )}
        <div className="kilsat-main">{children}</div>
      </div>
    </main>
  );
}
