# RIVECT · Portal (portal-ui)

Portal nuevo en React 18 + Vite 5 + TypeScript + Tailwind 3, con componentes estilo shadcn/ui. Se sirve en `/portal/`.

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:5174 (la API vive en el servidor de RIVECT)
npm test           # vitest
```

## Publicación

```bash
npm run build:portal   # tsc + build en dist-portal/ + copia a public/
```

`public/` es el artefacto que sirve `namecheap/server` (`createProjectSite` en `/portal/`). Se regenera
completo en cada publicación, así que los recursos estáticos van en `src/assets/` y se importan desde el código.
