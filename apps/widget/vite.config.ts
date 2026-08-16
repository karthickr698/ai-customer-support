import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vite';

const apiTarget = 'http://localhost:3000';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'widget-embed-dev-alias',
      configureServer(server) {
        server.middlewares.use((request, _response, next) => {
          if (request.url === '/widget.js' || request.url?.startsWith('/widget.js?')) {
            request.url = '/src/embed.ts';
          }
          next();
        });
      },
    },
  ],
  envDir: path.resolve(import.meta.dirname, '../..'),
  server: {
    port: 5174,
    cors: true,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
        ws: true,
      },
    },
  },
  preview: {
    port: 5174,
  },
  build: {
    rollupOptions: {
      input: {
        widget: path.resolve(import.meta.dirname, 'index.html'),
        embed: path.resolve(import.meta.dirname, 'src/embed.ts'),
      },
      output: {
        entryFileNames: (chunk) => (chunk.name === 'embed' ? 'widget.js' : 'assets/[name]-[hash].js'),
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});
