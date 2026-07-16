import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        v3: resolve(__dirname, 'v3/index.html'),
        render: resolve(__dirname, 'render/index.html'),
      },
    },
  },
});
