# Pedido a Codex: diseño visual de las integraciones de LANDUR

Borrador para revisar antes de enviarlo. No contiene datos reales: las capturas de `referencias/` salen de una demo con datos sintéticos y tokens de ejemplo.

## Qué necesitamos
Propuestas de **imagen** (pantallas de iPhone) para rediseñar la hoja «Conexiones» de LANDUR, donde Rafa conecta Shopify (ventas) y Meta Ads (gasto publicitario) y sincroniza. Queremos **2 o 3 direcciones distintas**, cada una con las pantallas de abajo, en **tema oscuro y tema claro**.

Después elegimos una y la implementamos nosotros en HTML/CSS. Las imágenes son para decidir, no se van a copiar píxel por píxel.

## Quién es el usuario
Rafa es un comerciante ocupado, no técnico. Usa LANDUR desde el iPhone (PWA) para ver cuánto dinero tiene y qué requiere su atención. Entra a Conexiones muy pocas veces (para conectar) y sincroniza a menudo. Habla español rioplatense (voseo: «Guardá», «Conectá»).

## Estética de LANDUR (ya definida: respetarla)
- Móvil primero, 375 pt de ancho, hojas inferiores con esquinas muy redondeadas (28 pt). Sin tarjetas con borde por todas partes: la jerarquía se hace con tipografía, espacio y líneas finas.
- Tipografía del sistema (SF Pro). Cifras grandes y ligeras, con el símbolo y los decimales más pequeños. Texto secundario en gris.
- Marca: azul marino `#242253` (con degradado lavanda en claro y azul profundo en oscuro) y menta `#5FD9AE` como acción principal en oscuro.
- Fondos: claro `#F4F3FA` con superficies blancas; oscuro `#0B0C14` con superficies `#12131C`.
- Significado del color: **verde** = entrada o conectado; **ámbar** = pendiente o aviso; **rojo** = error o vencido; **azul** = por cobrar. No usar los colores de Shopify ni de Meta.
- Filas grandes y tocables (mínimo 44 pt), con icono en cuadro redondeado de color, título, línea de apoyo y flecha. Ver `referencias/04-cuentas-oscuro.jpg` y `05-configuracion-oscuro.jpg`.
- Iconos de línea fina. Sin ilustraciones decorativas, sin gráficos que no representen datos reales.

## Pantallas a diseñar
1. **Configuración → grupo «Integraciones».** La fila «Conexiones» debe resumir el estado: por ejemplo «Shopify conectado · Meta sin conectar · sincronizado hace 2 h».
2. **Lista de conexiones.** Una fila por servicio con su estado. Tocar abre su hoja.
3. **Hoja de una conexión ya conectada.** Resumen arriba (tienda o cuenta publicitaria, cuenta donde se registra, token enmascarado, última sincronía con hora). Un botón grande **«Sincronizar ahora»** como acción principal. La configuración queda plegada en «Editar conexión».
4. **Resultado de una sincronización**, dentro de esa hoja: cifra grande («14 registros nuevos»), desglose («7 ventas · 7 cobros»), lo omitido en palabras claras («3 ya estaban · 1 de prueba · 2 sin cobro todavía»), el período y la hora, y un bloque de **avisos** que se abre para ver qué pedido falló y por qué.
5. **Estados de la sincronización:** sincronizando (en curso), sin novedades («Nada nuevo · 4 ya estaban»), y error de token («El token no es válido o perdió el permiso. Actualizalo»).
6. **Alta de una conexión nueva, en pasos.** Cada dato (tienda, cuenta, token) en su propia hoja pequeña, como en el registro de operaciones. Con una ayuda corta «Cómo conseguirlo». El campo del token debe poder pegarse cómodo desde el iPhone.
7. **Fuera de la hoja:** a) una etiqueta pequeña «Shopify» o «Meta» en las filas de la pantalla Actividad que llegaron por sincronía; b) una línea en la sección «Requiere atención» de Inicio cuando una conexión falló o lleva días sin sincronizar.

## Qué mejora respecto de hoy (ver `referencias/06` a `08`)
- Hoy la hoja es larga (más de dos pantallas), con ocho campos y cuatro notas siempre abiertos.
- Hoy el botón principal es «Guardar», y «Sincronizar» es pequeño y secundario. Debe ser al revés una vez conectado.
- Hoy el estado «Conectado» aparece en dos sitios distintos y el vocabulario es técnico («System User», «ads_read», «act_número»).

## Texto y datos de ejemplo (usar estos, son ficticios)
- Tienda: `tienda-demo.myshopify.com`. Cuenta publicitaria: `1234567890`. Token enmascarado: `shpat_…cdef`.
- Resultado: 14 registros nuevos (7 ventas, 7 cobros); 3 ya estaban, 1 de prueba, 2 sin cobro todavía; del 3 de octubre al 2 de noviembre; sincronizado a las 23:49; 1 aviso («#1042 · La moneda EUR no está admitida»).
- Moneda: pesos uruguayos (`$ 1.800,00`).

## Reglas que no se pueden romper
- No mostrar saldos, cifras ni indicadores inventados fuera de los ejemplos de arriba.
- Distinguir siempre lo confirmado de lo estimado o pendiente.
- Texto legible con contraste suficiente en claro y en oscuro.
- No incluir ningún dato real de personas, tiendas, cuentas o tokens.

## Entrega
- Por cada dirección: las pantallas 1 a 7 en tema oscuro y las pantallas 3 y 4 también en claro. Formato PNG de 1170 × 2532 px (iPhone), guardadas en `docs/diseno-conexiones/propuestas/direccion-A/`, `direccion-B/`, etc., con nombres como `03-hoja-conectada-oscuro.png`.
- Un archivo corto `NOTAS.md` por dirección: la idea en tres líneas y qué componentes de LANDUR reutiliza.
