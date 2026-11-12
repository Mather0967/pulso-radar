// Publica el build del portal en public/, que es lo que sirve el servidor de RIVECT.
// Se separa de Vite para no usar public/ como outDir (Vite borraría los estáticos propios).
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const from = path.join(root, 'dist-portal')
const to = path.join(root, 'public')

if (!fs.existsSync(from)) {
  console.error('No existe dist-portal. Ejecutá el build de Vite primero.')
  process.exit(1)
}

fs.rmSync(to, { recursive: true, force: true })
fs.cpSync(from, to, { recursive: true })
console.log('Retail Intelligence publicado en projects/rivect-retail/public/')
