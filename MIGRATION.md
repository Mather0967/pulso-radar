# Migración de la demo

Se conserva todo src/, pruebas y roadmap de la versión 0.2. Se retira la identidad del Site, metadatos del hosting, compilados y el historial Git de la publicación.

Adaptaciones para desarrollo interno:
- Build independiente de .openai/hosting.json.
- Adaptador Node con cuerpos y headers, límites y acceso por loopback.
- Sustitución de R2 por archivos con contrato get/put y escritura atómica.
- Comando y botón de revisión manual; sin horarios externos activados.
- Reinicio al modificar fuentes y configuración por .env.
- Pruebas reproducibles desde un clon limpio, CI y archivos generados ignorados.

No se incluyen credenciales, datos privados, historial remoto ni despliegue. La demo anterior queda independiente. La interfaz conserva perfil, notas y favoritos en el navegador.

