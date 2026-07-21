// Generates 1200x630 per-page OG images from the existing product renders in
// renders/ (real EMB-01 stills from the render rig — dark, product-forward).
// Run manually after re-rendering stills: node scripts/og-images.mjs
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const MAP = {
  home: 'emb01-hero-dark-4k.png',
  developers: 'emb01-lidar-detail-dark-4k.png',
  research: 'emb01-rear-dark-4k.png',
  lerobot: 'emb01-three-quarter-dark-4k.png',
  datasets: 'emb01-three-quarter-dark-4k.png',
  devkit: 'emb01-hero-dark-4k.png',
  story: 'emb01-rear-dark-4k.png',
  v3: 'emb01-three-quarter-dark-4k.png',
};

await mkdir(resolve(root, 'public/og'), { recursive: true });
for (const [slug, file] of Object.entries(MAP)) {
  const out = resolve(root, `public/og/${slug}.jpg`);
  await sharp(resolve(root, 'renders', file))
    .resize(1200, 630, { fit: 'cover', position: 'centre' })
    .jpeg({ quality: 80, mozjpeg: true })
    .toFile(out);
  console.log(`og/${slug}.jpg`);
}
