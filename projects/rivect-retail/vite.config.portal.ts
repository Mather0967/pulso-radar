import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/**
 * Build del portal: la app vive en https://rivect.net/retail/.
 * `public/` es el artefacto que sirve namecheap/server (se publica con scripts/publish-portal.mjs).
 */
export default defineConfig({
  base: '/retail/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist-portal',
    emptyOutDir: true,
  },
})
