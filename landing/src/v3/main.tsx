import '@fontsource/geist-sans/400.css';
import '@fontsource/geist-sans/500.css';
import '@fontsource/geist-sans/600.css';
import '@fontsource/geist-mono/400.css';
import './styles.css';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { App } from './App';

// Hydrate the build-time prerendered HTML; fresh render in dev.
const el = document.getElementById('root')!;
if (el.firstElementChild) hydrateRoot(el, <App />);
else createRoot(el).render(<App />);
