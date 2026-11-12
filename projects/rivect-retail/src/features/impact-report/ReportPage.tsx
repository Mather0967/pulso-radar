import { useMemo, useState } from 'react'
import { Download, FileSpreadsheet, FileText, Printer, ShieldCheck } from 'lucide-react'
import { AnimatedContent } from '@/components/reactbits/AnimatedContent'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { SectionHeading } from '@/components/ui/Card'
import { CompareBars } from '@/components/charts/CompareBars'
import { useSimulationStore } from '@/store/useSimulationStore'
import { buildReport } from '@/services/reporting/reportService'
import {
  downloadCsv,
  downloadReportPdf,
  inventoryCsvRows,
  leadsCsvRows,
  reportCsvRows,
} from '@/services/reporting/exporters'
import { formatDateTime, money, num, pct } from '@/utils/format'
import { ReportSectionCard } from './ReportSectionCard'

export function ReportPage() {
  const profile = useSimulationStore((s) => s.storeProfile)
  const products = useSimulationStore((s) => s.products)
  const leads = useSimulationStore((s) => s.recoveryLeads)
  const campaigns = useSimulationStore((s) => s.campaigns)
  const thresholds = useSimulationStore((s) => s.thresholds)
  const scenario = useSimulationStore((s) => s.scenario)
  const settings = useSimulationStore((s) => s.campaignSettings)
  const [message, setMessage] = useState<string | null>(null)

  const report = useMemo(
    () =>
      buildReport({
        profile,
        products,
        leads,
        campaigns,
        thresholds,
        scenario,
        settings,
      }),
    [profile, products, leads, campaigns, thresholds, scenario, settings],
  )

  const comparison = [
    { name: 'Margen actual', valor: report.simulator.currentContribution },
    { name: 'Margen proyectado', valor: report.simulator.projectedContribution },
  ]

  const status = report.simulator.additionalContribution > 0 ? 'oportunidad' : 'sin datos'

  return (
    <div className="space-y-5">
      <div className="no-print">
        <AnimatedContent>
          <SectionHeading
            eyebrow="Módulo 06 · Informe"
            title="Impact Report"
            description="Informe consolidado con los datos actuales del simulador, el CRM y el inventario. Se actualiza en tiempo real y puede descargarse en PDF o CSV."
            action={
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => window.print()}>
                  <Printer className="h-4 w-4" />
                  Imprimir
                </Button>
                <Button onClick={() => void downloadReportPdf(report)}>
                  <Download className="h-4 w-4" />
                  Descargar PDF
                </Button>
              </div>
            }
          />
        </AnimatedContent>
      </div>

      <div className="print-area space-y-4">
        <div className="relative overflow-hidden rounded-2xl border border-line bg-ink-900/70 p-5 sm:p-6">
          <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-brand-500/10 blur-3xl" />
          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display text-sm font-bold tracking-[0.16em] text-brand-300">
                  RIVECT
                </span>
                <span className="text-[10px] uppercase tracking-[0.2em] text-slate-600">
                  Retail Intelligence
                </span>
              </div>
              <h1 className="mt-3 font-display text-2xl font-semibold tracking-tight text-white">
                Informe de oportunidades
              </h1>
              <p className="mt-1 text-sm text-slate-400">
                {report.storeName} · {report.businessType}
              </p>
              <p className="mt-1 text-[11px] text-slate-600">
                Generado el {formatDateTime(report.generatedAt)} · escenario {scenario}
              </p>
            </div>
            <div className="flex flex-col items-start gap-1.5">
              <Badge tone="amber" dot>
                Datos simulados · demo
              </Badge>
              <Badge tone={status === 'oportunidad' ? 'mint' : 'neutral'}>
                {status === 'oportunidad' ? 'Oportunidad estimada' : 'Sin datos suficientes'}
              </Badge>
              <span className="text-[10px] text-slate-600">{num(products.length)} productos analizados</span>
            </div>
          </div>

          <div className="relative mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Summary label="Horas recuperables" value={`${num(report.simulator.recoverableHours, 1)} h/mes`} />
            <Summary label="Margen adicional" value={money(report.simulator.additionalContribution)} />
            <Summary
              label="Capital inmovilizado"
              value={money(report.inventory.totals.inventoryCapital)}
            />
            <Summary
              label="Mejora sobre margen"
              value={pct(report.simulator.upliftPct, 1)}
            />
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {report.sections.slice(0, 4).map((section) => (
            <ReportSectionCard key={section.id} section={section} />
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {report.sections.slice(4, 6).map((section) => (
            <ReportSectionCard key={section.id} section={section} />
          ))}
          <div className="print-panel rounded-2xl border border-line/90 bg-ink-850/60 p-5">
            <h3 className="font-display text-sm font-semibold text-white">Comparativa económica</h3>
            <p className="mt-1 text-[11px] text-slate-500">
              Margen de contribución mensual, escenario actual vs. propuesto.
            </p>
            <div className="mt-3">
              <CompareBars
                data={comparison}
                series={[{ key: 'valor', label: 'Margen', color: '#5b95ff' }]}
                colors={['#5b95ff', '#4ade9b']}
                height={200}
                formatter={(value) => money(value)}
              />
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
              Diferencia estimada de {money(report.simulator.additionalContribution)} mensuales. Cifra
              hipotética basada en supuestos editables.
            </p>
          </div>
        </div>

        <ReportSectionCard section={report.sections[6]} />

        <div className="rounded-2xl border border-line bg-ink-900/50 p-4 text-[10px] leading-relaxed text-slate-500">
          <p className="flex items-center gap-1.5 font-medium text-slate-400">
            <ShieldCheck className="h-3.5 w-3.5 text-mint-400" />
            Alcance del documento
          </p>
          <p className="mt-1">
            Informe generado automáticamente por Rivect Retail Intelligence con datos ingresados por
            el visitante (simulador) y datos ficticios de demostración (catálogo, clientes y
            conversaciones). Las probabilidades, márgenes y ventas recuperadas son estimaciones
            basadas en supuestos, no proyecciones garantizadas. No contiene datos personales reales
            ni se conecta a sistemas de la tienda.
          </p>
        </div>
      </div>

      <div className="no-print grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="panel panel-pad">
          <h3 className="font-display text-sm font-semibold text-white">Exportar datos</h3>
          <p className="mt-1 text-[11px] text-slate-500">
            Los CSV se generan con los datos actuales de esta sesión.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => downloadCsv('rivect-inventario.csv', inventoryCsvRows(report.inventory))}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Inventario
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => downloadCsv('rivect-oportunidades.csv', leadsCsvRows(leads, products))}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Oportunidades
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => downloadCsv('rivect-informe.csv', reportCsvRows(report))}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Resumen del informe
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setMessage('Los archivos se descargan en tu navegador.')}>
              <FileText className="h-3.5 w-3.5" />
              Ayuda
            </Button>
          </div>
          {message ? <p className="mt-2 text-[10px] text-slate-500">{message}</p> : null}
        </div>

        <div className="panel panel-pad">
          <h3 className="font-display text-sm font-semibold text-white">Recomendación ejecutiva</h3>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
            Con {pct(profile.automationPercentage)} de automatización sobre {num(report.simulator.monthlyQueries)}{' '}
            consultas mensuales, {report.storeName} podría liberar{' '}
            {num(report.simulator.recoverableHours, 0)} horas de atención y agregar{' '}
            {money(report.simulator.additionalContribution)} de margen mediante ventas recuperadas y
            seguimiento comercial.
          </p>
          <p className="mt-2 text-[10px] text-slate-600">
            Fuente: módulos Business Simulator, Customer Recovery y Stock Intelligence.
          </p>
        </div>
      </div>
    </div>
  )
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line/80 bg-ink-950/40 px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wider text-slate-600">{label}</p>
      <p className="mt-0.5 font-display text-sm font-semibold text-white">{value}</p>
    </div>
  )
}
