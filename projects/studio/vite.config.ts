import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// `--mode offline`: one index.html that opens from disk (file://), no server, no internet.
// `--mode portal`:  static build mounted by the RIVECT portal at /studio/ (served by Node behind the admin login).
export default defineConfig(({ mode }) => ({
  base: mode === 'portal' ? '/studio/' : '/',
  plugins: [react(), tailwindcss(), ...(mode === 'offline' ? [viteSingleFile()] : [])],
  build:
    mode === 'offline' ? { outDir: 'dist-offline', assetsInlineLimit: 100_000_000 }
    : mode === 'portal' ? { outDir: 'public', emptyOutDir: true, assetsInlineLimit: 0 }
    : {},
  publicDir: mode === 'portal' ? false : 'public',
  // polling: edits made outside the editor were missed by the native watcher on Windows
  server: { watch: { usePolling: true, interval: 300 } },
}))
