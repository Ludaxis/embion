import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  build: {
    // .vite/manifest.json: prerender.mjs uses it to inject modulepreload links
    // for the lazy 3D chunk graph (Scene/three/drei/postprocessing) so those
    // fetches start at HTML parse instead of after hydration.
    manifest: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        developers: resolve(__dirname, 'developers/index.html'),
        research: resolve(__dirname, 'research/index.html'),
        lerobot: resolve(__dirname, 'lerobot/index.html'),
        datasets: resolve(__dirname, 'datasets/index.html'),
        devkit: resolve(__dirname, 'devkit/index.html'),
        story: resolve(__dirname, 'story/index.html'),
        v3: resolve(__dirname, 'v3/index.html'),
        render: resolve(__dirname, 'render/index.html'),
      },
      // NOTE: no manualChunks — Vite's natural split already isolates three
      // and postprocessing into their own lazy chunks; both object and
      // function forms were tried and each pulled React into the post chunk,
      // making every subpage statically parse ~210 kB gz of postprocessing.
    },
  },
});
