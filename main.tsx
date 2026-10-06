import { createRoot } from 'react-dom/client';
import Editor from './components/editor';
import './style.css';
import './studio-ui.css';
import './styles/tokens.css';
import './styles/app-shell.css';
import './styles/ui-minimal.css';
if(location.pathname==='/export-worker')void import('./export-worker').then(m=>m.startExportWorker());else createRoot(document.getElementById('root')!).render(<Editor/>);
