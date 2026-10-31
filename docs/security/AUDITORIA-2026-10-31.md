# Auditoría de seguridad — RIVECT (portal) y LANDUR

**Fecha:** 31 de octubre de 2026
**Alcance:** portal RIVECT (`namecheap/server/`), montaje de LANDUR en `/landur` (`namecheap/server/landur.mjs`, `projects/landur/server/`) y cliente (`projects/landur/public/`). Incluye el servidor autónomo de LANDUR solo como comparación.
**Método:** revisión estática del código y pruebas dinámicas contra el portal real levantado en local con identidades sintéticas. Se aplicó la metodología de las skills instaladas `offensive-api-security` (OWASP API Top 10: BOLA, BFLA, asignación masiva, límites, exposición de datos), `offensive-jwt` (verificación de esquema de tokens) y `offensive-business-logic` (máquina de estados, importes, monedas, carreras, límites de confianza).
**Evidencia reproducible:** `tests/security-probe.test.mjs` (16 grupos, se ejecuta en cada despliegue).

## Resumen ejecutivo

| Severidad | Cantidad | Estado |
| --- | --- | --- |
| Crítica | 0 | — |
| Alta | 0 | — |
| Media | 2 | 1 requiere decisión del dueño; 1 requiere verificación en el hosting |
| Baja | 6 | Aceptadas con recomendación, sin explotación práctica |
| Informativa | 5 | Documentadas |

No se encontró una forma de leer datos de otro proyecto, escalar de `viewer` a `editor`, ejecutar código, inyectar HTML/CSV, fabricar dinero por manipulación de importes o duplicar cobros por concurrencia. Los controles de autorización, CSRF, aislamiento por proyecto y validación monetaria resistieron los intentos.

## Estado de remediación — 31/10/2026

Todo lo que dependía del código quedó corregido el mismo día, con prueba permanente. Lo único abierto es la verificación en el hosting (M-2) y los riesgos residuales anotados abajo.

| ID | Qué se hizo | Dónde | Prueba |
| --- | --- | --- | --- |
| M-1 | El borrado con historial exige escribir el nombre exacto de la cuenta **y** la contraseña de la sesión. Sin ambas no se toca nada. | `projects/landur/server/ledger.mjs`, `namecheap/server/landur.mjs`, `public/app.js` | `security-probe` · “borrado con historial: exige el nombre exacto y la contraseña” |
| M-2 | Segundo contador de intentos por cuenta, además del de IP: rotar `X-Forwarded-For` ya no multiplica los intentos. Queda pendiente confirmar en el host que el proxy sobrescriba la cabecera. | `namecheap/server/auth.mjs` | `security-probe` · “el límite de intentos no se evade rotando la IP declarada” |
| B-1 | Tope de 120 comandos por minuto y por sesión; las claves de idempotencia de comando se podan a los 30 días (las de importación no). | `namecheap/server/landur.mjs`, `projects/landur/server/ledger.mjs` | `security-probe` · “las escrituras tienen tope por sesión”; `ledger.test` · poda de claves |
| B-2 | La clave de idempotencia se guarda por usuario: dos cuentas con la misma clave ya no comparten resultado. | `projects/landur/server/ledger.mjs` | `security-probe` · “la clave de idempotencia es de cada usuario” |
| B-3 | El estado deja de publicar el identificador interno del espacio. | `ledger.mjs` (`snapshot`) | `security-probe` · asignación masiva |
| B-4 | Galleta `__Host-` en producción (se leen los dos nombres durante la transición) y cabeceras `Cross-Origin-Opener-Policy` / `Cross-Origin-Resource-Policy`. | `namecheap/server/auth.mjs`, `main.mjs` | `portal-projects` · nombre y atributos de la galleta |
| B-5 | Una galleta duplicada o vencida ya no anula la válida: se prueban todas las candidatas. | `auth.mjs` (`session`) | `security-probe` · galleta duplicada |
| B-6 | Reconfirmación de contraseña para el borrado total (5 intentos por 15 minutos). | `namecheap/server/landur.mjs` | misma prueba que M-1 |

**Riesgos residuales que quedan, con su motivo:** rotar la contraseña no invalida sesiones abiertas (no hay cambio de contraseña en la interfaz: se administra desde el hosting); el bloqueo por cuenta permite que un tercero deje a un usuario sin acceso 15 minutos; el `413` se lee bien, pero una subida de más de 16 MB se corta a nivel de socket; y la restauración de una cuenta borrada sigue siendo un procedimiento manual sobre la auditoría, sin botón.

## Superficie auditada

```text
rivect.net
├── /                     landing (site.mjs — no está en este repo)
├── /login, /activate     cuenta RIVECT (account.html del hosting)
├── /auth/*               login, logout, me, activate
├── /portal               selector de proyectos
├── /api/projects         catálogo por permisos
├── /api/admin/*          usuarios, invitaciones, permisos por proyecto
├── /api/public/*         API pública del sitio (site.mjs — fuera de alcance)
├── /pulso, /api/*        Pulso (worker)
└── /landur
    ├── /landur/login         acceso propio (público)
    ├── /landur/api/login     credenciales de la cuenta
    ├── /landur/api/logout    cierre con CSRF
    ├── /landur/api/session   arranque del cliente
    ├── /landur/api/state     estado completo del espacio
    ├── /landur/api/commands  comandos financieros (idempotentes)
    ├── /landur/api/import/*  vista previa y confirmación de CSV
    ├── /landur/api/evidence  alta y lectura de comprobantes
    └── /landur/<recursos>    interfaz, PWA y marca
```

## Hallazgos

### M-1 · Un `editor` puede borrar el historial completo de una cuenta (decisión pendiente)

- **Categoría:** lógica de negocio / control de funciones sensibles (API5).
- **Qué pasa:** `account.delete` con `mode:'purge'` elimina la cuenta y todas sus operaciones, pagos, cobros, obligaciones, comisiones, contra-asientos y comprobantes. Está disponible para cualquier usuario con permiso de edición, sin segundo control, sin aprobación de un administrador y sin restauración desde la interfaz.
- **Mitigación existente:** exige `confirm:true`, usa clave idempotente y **antes de borrar** guarda en la auditoría una copia completa de las filas eliminadas. El contenido de los archivos de comprobantes no se conserva.
- **Impacto:** un editor (o una sesión comprometida) puede destruir el historial contable de una cuenta. La copia en auditoría permite recuperarlo por SQL, pero no hay botón ni procedimiento documentado; esto es riesgo de integridad, no de confidencialidad.
- **Recomendación (elegir una):**
  1. Restringir `mode:'purge'` a `role === 'admin'`; un editor solo puede trasladar o crear cuenta nueva.
  2. Mantenerlo para editores pero exigir que se escriba el nombre de la cuenta para confirmar.
  3. Dejarlo como está y documentar el procedimiento de restauración desde auditoría.
- **Esfuerzo:** 1–2 h con pruebas. No cambia importes ni cálculos.

### M-2 · El límite de intentos depende de cómo el proxy trate `X-Forwarded-For` (verificar en producción)

- **Categoría:** autenticación / API2.
- **Qué pasa:** detrás de LiteSpeed/Passenger el par del socket es loopback, así que el servidor confía en `X-Forwarded-For` y toma el **último** salto. Si el proxy *agrega* la IP real al final, el límite es correcto e imposible de falsear. Si el proxy reenvía la cabecera del cliente sin agregar nada, un atacante puede rotar el valor y saltarse los 10 intentos / 15 minutos.
- **Evidencia local:** con el par en loopback, `X-Forwarded-For: 203.0.113.x` crea un contador nuevo por valor; 60 intentos repartidos en 3 IPs dieron 30 × 401 y 30 × 429, es decir, el límite funciona por clave, no por conexión.
- **Cómo verificarlo en el servidor real (2 minutos):** repetir once veces lo mismo cambiando la cabecera. Si nunca aparece `429`, el límite es evadible.

```bash
for i in $(seq 1 11); do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST https://rivect.net/auth/login \
    -H 'Content-Type: application/json' -H "X-Forwarded-For: 198.51.100.$i" \
    -d '{"email":"nadie@example.com","password":"intento-invalido-largo"}'
done
```

- **Recomendación:** si aparece algún `200`/`401` después del décimo intento, fijar en LiteSpeed (`useIpInProxyHeader` / reescritura de la cabecera) que el proxy **sobrescriba** `X-Forwarded-For` con la IP del cliente, o pasar a un límite por cuenta además del límite por IP.

### B-1 · Sin límite de tasa en `/landur/api/commands`

- **Categoría:** consumo de recursos (API4). Solo importación, comprobantes y login tienen tope (30/min y 8–10 intentos).
- **Impacto:** un editor autenticado puede generar operaciones y filas de idempotencia sin tope. Crecimiento de base y de `requests`; no afecta la exactitud de los saldos. 100 escrituras en paralelo respondieron 200 en 1,4 s, así que no hay degradación inmediata.
- **Recomendación:** aplicar el `createRateLimiter` existente a los comandos (por ejemplo 120/min por usuario) y purgar `requests` con la misma política que los espacios demo.

### B-2 · Las claves de idempotencia son del espacio, no del usuario

- **Categoría:** lógica de negocio / API6.
- **Qué pasa:** `requests` se indexa por `(workspace, key)`. Si dos usuarios usan la misma clave con el mismo cuerpo, el segundo recibe la respuesta del primero (`replayed:true`) en lugar de ejecutar su propio comando; con otro cuerpo recibe 409.
- **Evidencia:** reproduce en local: `admin` reenvía la clave de `editor` → `200 replayed=true` con el `id` ajeno.
- **Impacto:** muy bajo. Las claves son UUID v4 (122 bits de entropía), así que solo alcanza a un cliente que reutilice su propia clave por un error de la aplicación. No filtra datos: el resultado es un identificador.
- **Recomendación:** prefijar la clave guardada con el actor (`actor + ':' + key`), dejando las claves deterministas de importación CSV como están, porque ahí la detección de duplicados entre usuarios es intencional.

### B-3 · El estado expone el identificador interno del espacio

- **Categoría:** exposición excesiva de datos (API3). `/landur/api/state` devuelve `workspace` en cada cuenta.
- **Impacto:** informativo; el valor es siempre `landur`. No habilita nada porque las consultas están fijadas al espacio.
- **Recomendación:** omitir `workspace` en la serialización para viewers (o en todas).

### B-4 · Endurecimiento de cookies y aislamiento de ventana

- **Qué pasa:** la galleta no usa prefijo `__Host-` y no se envía `Cross-Origin-Opener-Policy`.
- **Impacto:** ninguno explotable hoy: `HttpOnly`, `SameSite=Strict`, `Secure`, `Path=/` y revocación en servidor están bien. El prefijo `__Host-` protege contra un futuro error de configuración de dominio/path; COOP contra ventanas abiertas por terceros.
- **Recomendación:** si se renombra a `__Host-rivect_session`, hacerlo con migración (leer ambas durante una ventana) y agregar `Cross-Origin-Opener-Policy: same-origin`.

### B-5 · Una galleta duplicada anula la sesión válida

- **Qué pasa:** el servidor toma la **primera** aparición de `rivect_session`; con `rivect_session=basura; rivect_session=<válida>` responde 401.
- **Impacto:** solo disponibilidad, y solo para quien pueda escribir cookies del dominio (requiere XSS o un subdominio bajo control). No permite escalar privilegios.
- **Recomendación:** recorrer todas las apariciones y aceptar la primera que corresponda a una sesión viva.

### B-6 · Sesión de 8 horas sin reautenticación para acciones destructivas

- **Qué pasa:** `Max-Age=28800`, deslizante por login nuevo, sin reautenticación para `purge` ni para cambios de permisos.
- **Impacto:** en un teléfono perdido o desbloqueado, la ventana de 8 h alcanza para destruir historial.
- **Recomendación:** si se implementa M-1 opción 1, el `purge` de un admin ya queda detrás de rol; si no, pedir la contraseña otra vez en ese diálogo.

### Informativo (aceptado o fuera de alcance)

- **I-1 · Viewer lee todos los comprobantes y la auditoría.** Coherente con un espacio único de negocio; no hay tenants por usuario.
- **I-2 · `/api/ai/*` acepta POST de un `viewer`.** Decisión previa del proyecto (todos consultan IA, solo editan los editores). Implica costo de proveedor: el tope de 30/min y la clave del servidor lo acotan.
- **I-3 · Sin JWT en el producto.** Verificado: no hay emisión ni consumo de JWT; solo `Authorization: Bearer` **saliente** hacia proveedores de IA. El esquema propio (token opaco de 256 bits, hash SHA-256 en reposo, `timingSafeEqual`, revocación por fila) cubre los casos que atacaría `offensive-jwt`: no hay algoritmo que confundir, ni `kid`/`jku`, ni secreto que romper, ni claims que falsificar.
- **I-4 · `site.mjs`, la landing, `account.html`, `admin.html`, la configuración de LiteSpeed/Passenger y el TLS no están en este repositorio.** No se auditó su código; el fixture los reemplaza por contrato de rutas.
- **I-5 · Sin pentest externo ni prueba en iPhone real.** Esta auditoría es interna, del mismo autor del código.

## Controles que resistieron (con evidencia)

| Ataque | Resultado | Dónde |
| --- | --- | --- |
| BOLA: comprobante con id inventado o de otro espacio | 404 sin filtrar | `security-probe` |
| BOLA: `/landur/api/state` de otro proyecto | 403 | `security-probe` |
| BFLA: viewer escribe, borra o cambia permisos | 403 | `security-probe` |
| BFLA: admin API con editor | 403 | `security-probe` |
| Asignación masiva (`id`, `workspace`, `balance`, `role`, `projects`) | ignorada o 400 | `security-probe` |
| Importes negativos, cero, `1.001`, `9e99` | 400 | `security-probe`, `ledger.test` |
| Moneda distinta entre cuentas, cobro y deuda | 400 / 404 | `security-probe` |
| Fecha anterior al corte o al registro relacionado | 400 | `ledger.test`, `security-probe` |
| Transferencia a la misma cuenta | 400 | `security-probe` |
| **Carrera de 5 cobros simultáneos del total** | 1 × 200, 4 × 409; aplicado exacto | `security-probe` |
| **Carrera de 2 reversiones simultáneas** | 1 × 200, 1 × 409 | `security-probe` |
| Baja de cuenta con historial sin decisión | 409, nada cambia | `security-probe` |
| `purge` sin confirmación, `move` a otra moneda o a id inventado | 400 / 404 | `security-probe` |
| Reutilizar clave idempotente con otro cuerpo | 409 | `ledger.test` |
| Inyección de fórmulas en el CSV exportado | neutralizada con comilla inicial | `security-probe` |
| XSS reflejado en `?e=` del acceso y en nombres de usuario | sin reflejo, escapado | `security-probe` |
| Inyección de cabeceras por nombre de archivo (`CRLF`) | sin cabecera nueva, nombre codificado | `security-probe` |
| `Authorization: Bearer`, `X-HTTP-Method-Override` | ignorados | `security-probe` |
| Galletas falsas, alteradas o con HTML | 401 | `security-probe` |
| Token después de logout, sesión vencida, usuario desactivado | 401 | `security-probe`, `portal-projects` |
| Fijación de sesión (token nuevo en cada login) | tokens distintos | local |
| Fuerza bruta: 20 y 60 intentos en paralelo | 429, sin errores 500 | local |
| Escrituras concurrentes (100 en paralelo) | 200, sin 500 ni deadlock | local |
| Enumeración de cuentas en los dos logins | mismo destino y mensaje | `security-probe` |
| Traversal, archivos internos, `.git`, base SQLite | 404 con y sin sesión | `security-probe` |
| Cuerpos de 4 MB, `text/plain`, JSON inválido o `null` | 413 / 415 / 400 | `security-probe` |
| Contaminación de prototipos | sin efecto | `security-probe` |
| Cabeceras defensivas y `no-store` en todas las rutas | presentes | `security-probe` |

## Plan de remediación

1. ~~**M-1** — control de `purge`~~ → hecho: nombre exacto + contraseña.
2. **M-2** — ejecutar la verificación de `X-Forwarded-For` en producción y ajustar el proxy si hace falta (lo único abierto; el límite por cuenta ya acota el daño).
3. ~~**B-1** — tope de comandos y poda de `requests`~~ → hecho.
4. ~~**B-5 / B-3 / B-4**~~ → hechos.
5. ~~**B-2** — claves por actor~~ → hecho.
6. **Siguiente paso recomendado:** documentar y automatizar la restauración desde auditoría de lo borrado con `purge`.

## Cómo reproducir

```bash
node --test tests/security-probe.test.mjs        # 16 grupos contra el portal en local
cd projects/landur && node --test tests/*.test.mjs  # reglas financieras y esquema
```

Las pruebas usan un portal temporal con identidades sintéticas. No acreditan el comportamiento del hosting real, la landing, el TLS ni un pentest externo.
