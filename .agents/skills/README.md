# Skills del proyecto

Cada carpeta es una skill: `SKILL.md` con frontmatter `name` + `description`, y material de apoyo opcional. Se cargan bajo demanda según el tema de la conversación.

## Instaladas desde claude-red

- **Origen:** https://github.com/SnailSploit/claude-red (MIT, ver `.agents/claude-red-LICENSE`).
- **Instalado:** 29/10/2026, 79 skills de seguridad ofensiva (web, API, auth, cloud, contenedores, CI/CD, criptografía, escalada, post-explotación, redes inalámbricas, explotación, fuzzing, reconocimiento, ingeniería social, utilidades).
- **Cambio local:** 28 de esos archivos no traían frontmatter YAML; se les agregó `name` y `description` derivados de su propio contenido para que el cargador de skills los reconozca. El cuerpo de cada skill quedó intacto.
- **Uso:** metodología para pruebas de seguridad **autorizadas** —auditorías propias, pentesting contratado, bug bounty dentro del alcance— y para revisar este código. No son instrucciones para atacar sistemas de terceros.
- **No se despliega:** `.agents/` no está en `managedPaths` de `scripts/cpanel-deploy.mjs` ni en el paquete publicado.
