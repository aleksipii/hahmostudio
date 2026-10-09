import { createRoot } from 'react-dom/client';
import Editor from './components/editor';
// Komponenttien perustyylit (vanhat kerrokset) → KILSAT-kerros → Studio 2.0 -järjestelmä viimeisenä.
import './style.css';
import './studio-ui.css';
import './styles/tokens.css';
import './styles/app-shell.css';
import './styles/ui-minimal.css';
import './styles/studio-components.css';
import './styles/kilsat-app.css';
import './styles/studio2.css';
import './styles/koeta-premium.css';
import './styles/koeta-responsive.css';
import './styles/koeta-minimal.css';
if(location.pathname==='/export-worker')void import('./export-worker').then(m=>m.startExportWorker());else createRoot(document.getElementById('root')!).render(<Editor/>);
