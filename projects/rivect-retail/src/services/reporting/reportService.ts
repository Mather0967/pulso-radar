import { analyzeInventory } from '@/domain/calculations/inventory'
import { calculateRecoveryMetrics, RECOVERY_STATUS_META } from '@/domain/calculations/recovery'
import { calculateSimulator } from '@/domain/calculations/simulator'
import { projectCampaign } from '@/domain/calculations/campaigns'
import { averagePrice } from '@/domain/calculations/campaigns'
import type {
  Campaign,
  CampaignProjection,
  CampaignSettings,
  InventoryThresholds,
  Product,
  RecoveryLead,
  ReportModel,
  ReportSection,
  ScenarioKey,
  StoreProfile,
} from '@/domain/models'
import { formatDateTime, money, num, pct } from '@/utils/format'

export interface ReportInput {
  profile: StoreProfile
  products: Product[]
  leads: RecoveryLead[]
  campaigns: Campaign[]
  thresholds: InventoryThresholds
  scenario: ScenarioKey
  settings: CampaignSettings
}

/**
 * El informe se construye siempre a partir del estado actual del simulador,
 * del catálogo y del CRM. No hay valores económicos estáticos.
 */
export function buildReport(input: ReportInput): ReportModel {
  const simulator = calculateSimulator(input.profile, input.scenario)
  const inventory = analyzeInventory(input.products, input.thresholds)
  const recovery = calculateRecoveryMetrics(input.leads, input.profile.contributionMargin)

  const lastCampaign = input.campaigns[0]
  let campaignProjection: CampaignProjection | null = null
  if (lastCampaign) {
    const prices = lastCampaign.productIds
      .map((id) => input.products.find((p) => p.id === id)?.price)
      .filter((p): p is number => typeof p === 'number')
    campaignProjection = projectCampaign({
      recipients: lastCampaign.recipients,
      discountPct: lastCampaign.discountPct,
      avgTicket: averagePrice(prices, input.profile.averageTicket),
      contributionMargin: input.profile.contributionMargin,
      settings: input.settings,
    })
  }

  const topLowRotation = [...inventory.items]
    .filter((i) => i.lowRotation)
    .sort((a, b) => b.inventoryCapital - a.inventoryCapital)
    .slice(0, 3)

  const sections: ReportSection[] = [
    {
      id: 'diagnostico',
      title: '1 · Diagnóstico del comercio',
      summary: `${input.profile.name} · ${input.profile.businessType}`,
      metrics: [
        { label: 'Consultas por mes', value: num(simulator.monthlyQueries) },
        { label: 'Ticket promedio', value: money(input.profile.averageTicket) },
        { label: 'Margen de contribución', value: pct(input.profile.contributionMargin) },
        { label: 'Canales', value: input.profile.channels.join(' · ') },
      ],
      bullets: [
        `Horario declarado: ${input.profile.operatingHours}.`,
        `${input.profile.employeesInService} personas involucradas en atención al cliente.`,
        `${input.profile.totalProducts} productos activos en catálogo.`,
        `Datos ingresados por el visitante y datos simulados de demostración.`,
      ],
    },
    {
      id: 'tiempo',
      title: '2 · Tiempo dedicado a tareas repetitivas',
      summary: 'Horas mensuales invertidas en responder consultas que podrían automatizarse.',
      metrics: [
        { label: 'Horas mensuales de atención', value: `${num(simulator.manualHours, 1)} h` },
        { label: 'Horas recuperables', value: `${num(simulator.recoverableHours, 1)} h` },
        { label: 'Jornadas equivalentes', value: num(simulator.fullWorkdaysRecovered, 1) },
        { label: 'Minutos recuperados por día', value: `${num(simulator.minutesRecoveredPerDay, 0)} min` },
      ],
      bullets: [
        `Se atienden ${num(simulator.monthlyQueries)} consultas por mes (${num(
          input.profile.dailyQueries,
        )} por día × ${num(input.profile.workingDays)} días).`,
        `Cada consulta consume ${num(input.profile.averageMinutesPerQuery, 1)} minutos en promedio.`,
        `Con ${pct(input.profile.automationPercentage)} de automatización se liberan ${num(
          simulator.recoverableHours,
          1,
        )} horas del equipo.`,
      ],
    },
    {
      id: 'atencion',
      title: '3 · Atención y capacidad operativa',
      summary: 'Capacidad adicional estimada sin ampliar el equipo actual.',
      metrics: [
        { label: 'Consultas automatizables', value: num(simulator.automatedQueries) },
        { label: 'Capacidad adicional', value: `${num(simulator.additionalCapacity)} consultas` },
        { label: 'Consultas sin compra', value: pct(input.profile.unresolvedQueries) },
        {
          label: 'Horas por persona',
          value: `${num(simulator.hoursPerEmployee, 1)} h`,
          hint: 'Antes de automatizar',
        },
      ],
      bullets: [
        'La capacidad adicional representa operaciones posibles, no ventas garantizadas.',
        `Hoy ${num(simulator.unattendedQueries)} consultas mensuales no terminan en compra.`,
        'El asistente virtual responde catálogo, stock y reservas en segundos.',
      ],
    },
    {
      id: 'ventas',
      title: '4 · Oportunidades de venta',
      summary: 'Escenario independiente de ventas recuperadas por seguimiento comercial.',
      metrics: [
        { label: 'Ventas recuperadas', value: `${num(input.profile.recoveredSales)} u./mes` },
        { label: 'Facturación adicional', value: money(simulator.additionalRevenue) },
        { label: 'Margen adicional', value: money(simulator.additionalContribution) },
        { label: 'Oportunidades abiertas', value: num(recovery.open), hint: 'CRM simulado' },
      ],
      bullets: [
        `${input.profile.customersWithoutFollowUp} clientes declarados sin seguimiento.`,
        `Valor esperado del pipeline: ${money(recovery.expectedValue)}.`,
        `Ventas ya recuperadas en la demo: ${money(recovery.recoveredRevenue)}.`,
      ],
    },
    {
      id: 'inventario',
      title: '5 · Inventario',
      summary: 'Riesgos de stock y capital inmovilizado detectados en el catálogo simulado.',
      metrics: [
        { label: 'Capital inmovilizado', value: money(inventory.totals.inventoryCapital) },
        { label: 'Productos en riesgo', value: num(inventory.totals.atRisk) },
        { label: 'Baja rotación', value: num(inventory.totals.lowRotation) },
        {
          label: 'Cobertura promedio',
          value: `${num(inventory.totals.averageCoverageDays, 0)} días`,
        },
      ],
      bullets: [
        `${inventory.totals.outOfStock} productos sin stock y ${inventory.totals.promoOpportunities} oportunidades de promoción.`,
        ...topLowRotation.map(
          (i) =>
            `${i.product.name}: ${i.product.stock} u. en stock, ${money(
              i.inventoryCapital,
            )} inmovilizados.`,
        ),
      ],
    },
    {
      id: 'recomendaciones',
      title: '6 · Automatizaciones recomendadas',
      summary: 'Plan de implementación sugerido por Rivect para este comercio.',
      metrics: [
        { label: 'Módulos sugeridos', value: '4' },
        { label: 'Prioridad', value: 'Atención + recuperación' },
      ],
      bullets: [
        'Asistente virtual en WhatsApp para catálogo, talles, stock y reservas.',
        'Seguimiento automático de conversaciones sin respuesta en menos de 24 h.',
        'Alertas de reposición para productos con cobertura menor al umbral configurado.',
        'Campañas segmentadas sobre clientes inactivos y productos de baja rotación.',
      ],
    },
    {
      id: 'impacto',
      title: '7 · Impacto estimado',
      summary: 'Comparación entre la operación actual y el escenario propuesto.',
      metrics: [
        { label: 'Margen actual', value: money(simulator.currentContribution) },
        { label: 'Margen proyectado', value: money(simulator.projectedContribution) },
        { label: 'Diferencia', value: money(simulator.additionalContribution) },
        { label: 'Mejora sobre margen', value: pct(simulator.upliftPct, 1) },
      ],
      bullets: [
        `Escenario ${input.scenario} con ${pct(input.profile.automationPercentage)} de automatización.`,
        `Horas recuperadas: ${num(simulator.recoverableHours, 1)} h por mes.`,
        campaignProjection
          ? `Campaña «${lastCampaign.name}»: ${money(campaignProjection.contribution)} de margen hipotético.`
          : 'Sin campañas configuradas al momento del informe.',
        'Estimaciones basadas en supuestos editables; no constituyen una proyección garantizada.',
      ],
    },
  ]

  return {
    generatedAt: new Date().toISOString(),
    storeName: input.profile.name,
    businessType: input.profile.businessType,
    simulator,
    inventory,
    recovery,
    campaign: campaignProjection,
    sections,
  }
}

export const recoveryStatusLabel = (status: keyof typeof RECOVERY_STATUS_META): string =>
  RECOVERY_STATUS_META[status].label

export const reportTimestamp = (report: ReportModel): string => formatDateTime(report.generatedAt)
