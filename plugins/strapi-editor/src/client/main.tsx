import { createRoot } from 'react-dom/client';
import { PargooPanel } from './components/pargoo-panel/PargooPanel';
import { start } from './bridge';

createRoot(document.getElementById('root')!).render(<PargooPanel />);
void start();
