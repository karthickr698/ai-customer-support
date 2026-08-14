import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vite';

const apiTarget = 'http://localhost:3000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
  envDir: path.resolve(import.meta.dirname, '../..'),
  server: {
    port: 5173,
    proxy: {
      '/health': {
        target: apiTarget,
        changeOrigin: true,
      },
      '/ready': {
        target: apiTarget,
        changeOrigin: true,
      },
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
});
