import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// `public/` también aloja las demos que se copian ahí (restaurantes/, odontologia/). Vite vaciaría la carpeta entera
// al compilar; en modo portal sólo se borra lo que genera el propio Studio: index.html y assets/.
const cleanOwnOutput = () => ({
  name: 'clean-own-output',
  buildStart() {
    for (const name of ['index.html', 'assets']) rmSync(fileURLToPath(new URL(`./public/${name}`, import.meta.url)), { recursive: true, force: true })
  },
})

// `--mode offline`: one index.html that opens from disk (file://), no server, no internet.
// `--mode portal`:  static build mounted by the RIVECT portal at /studio/ (served by Node behind the admin login).
export default defineConfig(({ mode }) => ({
  base: mode === 'portal' ? '/studio/' : '/',
  plugins: [react(), tailwindcss(), ...(mode === 'offline' ? [viteSingleFile()] : []), ...(mode === 'portal' ? [cleanOwnOutput()] : [])],
  build:
    mode === 'offline' ? { outDir: 'dist-offline', assetsInlineLimit: 100_000_000 }
    : mode === 'portal' ? { outDir: 'public', emptyOutDir: false, assetsInlineLimit: 0 }
    : {},
  publicDir: mode === 'portal' ? false : 'public',
  // polling: edits made outside the editor were missed by the native watcher on Windows
  server: { watch: { usePolling: true, interval: 300 } },
}))
