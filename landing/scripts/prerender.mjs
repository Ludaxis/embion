// Build-time prerendering: render each page's React tree to static HTML and
// inject it into the built dist/*.html, so every page serves real content
// without JavaScript (search engines, link previews, AI crawlers). The client
// entries hydrate the same tree on load.
//
// Runs after `vite build`. Uses a middleware-mode Vite server purely as a
// TS/JSX module loader for the SSR pass — nothing listens on a port.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createServer } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const PAGES = [
  { id: 'home', file: 'dist/index.html' },
  { id: 'developers', file: 'dist/developers/index.html' },
  { id: 'research', file: 'dist/research/index.html' },
  { id: 'lerobot', file: 'dist/lerobot/index.html' },
  { id: 'datasets', file: 'dist/datasets/index.html' },
  { id: 'devkit', file: 'dist/devkit/index.html' },
  { id: 'story', file: 'dist/story/index.html' },
  { id: 'v3', file: 'dist/v3/index.html' },
];

const MARKER = '<div id="root"></div>';

const vite = await createServer({
  root,
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
});

try {
  const { render } = await vite.ssrLoadModule('/src/ssg/entry-server.tsx');
  for (const page of PAGES) {
    const path = resolve(root, page.file);
    const html = await readFile(path, 'utf8');
    if (!html.includes(MARKER)) {
      throw new Error(`${page.file}: root marker not found — is the page already prerendered?`);
    }
    const app = render(page.id);
    if (!app || app.length < 500) {
      throw new Error(`${page.file}: suspiciously small prerender (${app.length} bytes)`);
    }
    await writeFile(path, html.replace(MARKER, `<div id="root">${app}</div>`));
    console.log(`prerendered ${page.file} (${(app.length / 1024).toFixed(1)} kB)`);
  }
} finally {
  await vite.close();
}
