import { createRoot } from 'react-dom/client';
import Editor from './components/editor';
import './styles/tokens.css';
import './styles/kilsat-app.css';
if(location.pathname==='/export-worker')void import('./export-worker').then(m=>m.startExportWorker());else createRoot(document.getElementById('root')!).render(<Editor/>);
