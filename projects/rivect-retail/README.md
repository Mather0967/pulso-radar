# Rivect Retail Intelligence

Demo comercial interactiva B2B para mostrar a comercios cuánto tiempo consumen las tareas
repetitivas, qué oportunidades comerciales quedan sin aprovechar y qué margen adicional podrían
generar con automatizaciones.

Todos los datos son ficticios o ingresados por el visitante. La aplicación no se conecta a
WhatsApp, POS, ERP, CRM ni modelos de IA, y no envía comunicaciones reales.

## Stack

- React 18 + TypeScript + Vite 5
- Tailwind CSS (sistema de diseño propio, tema oscuro con azul de marca)
- Recharts (gráficos), Lucide (iconografía), Framer Motion (transiciones)
- Zustand + `persist` (estado global y persistencia en `localStorage`)
- Efectos estilo **React Bits** (Aurora, SpotlightCard, CountUp, Shiny/GradientText,
  AnimatedContent, GlareHover) portados como componentes locales en
  `src/components/reactbits/`, sin dependencia de runtime adicional.
- Vitest para pruebas unitarias de los motores de cálculo.

## Ejecutar

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # pruebas de cálculos
npm run build      # typecheck + build de producción en dist/
npm run preview    # sirve el build en http://localhost:4173
```

Requiere Node 18+.

## Arquitectura por capas

```
Presentation   src/features/*, src/components/*, src/app/*
Business logic src/domain/calculations/*
Services       src/services/{assistant,inventory,recovery,campaigns,reporting}
Data           src/data/*.json, src/repositories/*
Integration    src/repositories/interfaces (contrato para futuras APIs)
```

Decisiones principales:

1. **Los componentes no conocen los datos simulados.** Toda lectura pasa por
   `RetailRepository`; la implementación actual es `MockRetailRepository`, que sirve los JSON de
   `src/data` con una promesa (contrato asíncrono real). Una integración futura implementa la misma
   interfaz y no toca la UI.
2. **Motores puros y testeables.** Los cálculos viven en `src/domain/calculations` como funciones
   sin React ni estado: reciben datos, devuelven métricas.
3. **Servicios como adaptadores.** `src/services` compone cálculos + datos (por ejemplo, mensaje de
   seguimiento con el producto y el perfil del comercio) y es el único punto a reemplazar cuando
   existan APIs reales.
4. **Estado único y persistido.** Zustand guarda perfil, catálogo, CRM, campañas, métricas del
   asistente y supuestos. El reinicio global restaura los fixtures.
5. **Asistente determinístico.** `services/assistant/engine.ts` interpreta intenciones con reglas
   (categoría, color, talle, precio, reserva) y consulta stock por variante. Sin IA externa ni
   credenciales.
6. **Escenarios separados del ahorro de horas.** El margen adicional se calcula con ventas
   recuperadas, nunca con horas ahorradas.

## Fórmulas documentadas

Business Simulator (`domain/calculations/simulator.ts`):

```
monthlyQueries         = dailyQueries × workingDays
manualHours            = (monthlyQueries × averageMinutesPerQuery) / 60
recoverableHours       = manualHours × (automationPercentage / 100)
additionalCapacity     = (recoverableHours × 60) / averageMinutesPerQuery
additionalRevenue      = recoveredSales × averageTicket
additionalContribution = additionalRevenue × (contributionMargin / 100)
upliftPct              = additionalContribution / (monthlySales × margin) × 100
```

Stock Intelligence (`domain/calculations/inventory.ts`):

```
dailySales        = monthlyUnitsSold / 30
coverageDays      = stock / dailySales        (null si no hubo ventas)
inventoryCapital  = stock × cost
riesgo            = coverageDays ≤ coverageThreshold
baja rotación     = monthlyUnitsSold ≤ lowRotationUnits OR días sin venta ≥ deadStockDays
```

Customer Recovery (`domain/calculations/recovery.ts`):

```
pipelineValue         = Σ ticket de oportunidades abiertas
expectedValue         = Σ ticket × probabilidad
recoveredRevenue      = Σ ticket de compras realizadas
recoveredContribution = recoveredRevenue × margen
```

Smart Campaigns (`domain/calculations/campaigns.ts`):

```
conversion   = baseConversion + descuento × conversionPerDiscountPoint   (tope 65%)
interactions = destinatarios × interactionRate / 100
sales        = interactions × conversion / 100
revenue      = sales × ticket × (1 − descuento / 100)
contribution = revenue × margen / 100
```

## Módulos

| Módulo | Ruta | Qué demuestra |
| --- | --- | --- |
| Overview | `/overview` | Resumen ejecutivo y estado de la demo |
| Business Simulator | `/simulator` | Motor económico, escenarios y fórmulas a la vista |
| Sales Assistant | `/assistant` | Chat tipo WhatsApp con catálogo de 30 productos |
| Customer Recovery | `/recovery` | CRM, estados, historial y seguimiento simulado |
| Stock Intelligence | `/stock` | Cobertura, capital inmovilizado y alertas |
| Smart Campaigns | `/campaigns` | Segmentos, campañas y proyección de resultados |
| Impact Report | `/report` | Informe consolidado con PDF, impresión y CSV |

## Datos de demostración

`src/data`: 30 productos con variantes, 18 clientes, 16 oportunidades, 12 conversaciones, 2
campañas y 3 escenarios. El perfil inicial es «Norte Calzado» (calzado y deportes). Todo el estado
se guarda en `localStorage` bajo `rivect-retail-intelligence-v1`; «Restablecer demo» restaura los
fixtures.

## Pruebas

`src/tests` cubre los cálculos financieros, porcentajes, cobertura de stock, conversión de
campañas y métricas del CRM (25 casos). `npm test` debe ejecutarse sin errores antes de publicar.

## Integraciones futuras

Preparadas como adaptadores detrás de `RetailRepository` / `src/services`:

- WhatsApp Business Cloud API e Instagram Messaging: reemplazar el motor del asistente por un
  servicio server-side (nunca exponer tokens en el navegador).
- POS / ERP / inventarios: nueva implementación del repositorio.
- Modelos de IA: llamadas desde un backend propio; el cliente solo consume respuestas.
- CRM externo: sincronización de `RecoveryLead` con mapeo de estados.

## Despliegue

`npm run build` genera `dist/`. Es un SPA: el hosting debe redirigir rutas desconocidas a
`index.html` (Vercel/Netlify/Cloudflare Pages o cualquier servidor estático). No requiere variables
de entorno ni backend en esta versión.
