"""Build an allowlisted deployment ZIP; never package financial data or secrets."""
from pathlib import Path
import hashlib
import json
import zipfile

root = Path(__file__).resolve().parent.parent
version = json.loads((root / 'package.json').read_text())['version']
out = root / 'releases'
out.mkdir(exist_ok=True)
archive = out / f'landur-pwa-cpanel-{version}.zip'
files = [root / name for name in ['app.cjs', 'package.json', 'package-lock.json', '.env.example']]
for directory in ['server', 'public', 'tests']:
    files.extend(p for p in (root / directory).rglob('*') if p.is_file())
files.extend(root / 'scripts' / name for name in ['backup.mjs', 'check-host.mjs'])
files.extend(root / 'docs' / name for name in ['SUBIR-A-CPANEL.md', 'NAMECHEAP.md', 'API.md'])
for path in files:
    if path.is_symlink() or not path.exists():
        raise SystemExit(f'Unsafe or missing release input: {path}')
    if path.name == '.env' or '.sqlite' in path.name or any(x in path.parts for x in ['node_modules', 'data', 'backups']):
        raise SystemExit(f'Private artifact rejected: {path}')
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as z:
    for path in sorted(files):
        z.write(path, path.relative_to(root))
    z.writestr('README.md', '''# LANDUR — Paquete de despliegue alfa

Empezar por [SUBIR-A-CPANEL.md](docs/SUBIR-A-CPANEL.md).

Este ZIP no contiene datos ni credenciales. Subir su contenido a una aplicación
Node independiente, no a la raíz pública ni encima de Pulso.

Entrada Passenger: `app.cjs`. Requiere Node >=22.13 con SQLite integrado.
Instalación de producción: `npm ci --omit=dev`. Pruebas de backend: `npm test`.
La herramienta npm package y las pruebas de navegador se ejecutan desde el
repositorio de desarrollo, no desde este paquete reducido.

Alfa para pruebas; no habilitada para datos reales ni pentesting completado.
''')
checksum = hashlib.sha256(archive.read_bytes()).hexdigest()
(archive.with_suffix('.zip.sha256')).write_text(f'{checksum}  {archive.name}\n')
print(f'{archive}\nSHA256 {checksum}\n{len(files)} archivos permitidos + README de despliegue')
