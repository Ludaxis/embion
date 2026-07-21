import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  build: {
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
    },
  },
});
