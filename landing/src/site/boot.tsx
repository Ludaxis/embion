import '@fontsource/geist-sans/400.css';
import '@fontsource/geist-sans/500.css';
import '@fontsource/geist-sans/600.css';
import '@fontsource/geist-mono/400.css';
import '@fontsource/geist-mono/500.css';
import '../v1/styles.css';
import './pages.css';
import type { ReactElement } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';

/** Hydrate the build-time prerendered HTML; fall back to a fresh render in dev. */
export function boot(app: ReactElement) {
  const el = document.getElementById('root')!;
  if (el.firstElementChild) hydrateRoot(el, app);
  else createRoot(el).render(app);
}
