import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // Proxy /api/* requests to Vercel Functions during development
    // Use `vercel dev` to run this locally, or set up a local function server on port 3001
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  build: {
    outDir: 'dist',
    target: 'es2020',
  },
  resolve: {
    alias: {
      '@': '/',
    },
  },
});
