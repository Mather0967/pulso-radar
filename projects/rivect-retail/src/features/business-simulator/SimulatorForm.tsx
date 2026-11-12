import { AlertTriangle, Banknote, MessagesSquare, Store } from 'lucide-react'
import type { SalesChannel, StoreProfile } from '@/domain/models'
import { NumberField, RangeField, SelectField, TextField } from '@/components/ui/Field'
import { Panel } from '@/components/ui/Card'
import { money, pct } from '@/utils/format'

const BUSINESS_TYPES = [
  'Calzado y deportes',
  'Indumentaria y moda',
  'Hogar y deco',
  'Tecnología',
  'Belleza y cuidado',
  'Almacén / market',
  'Otro',
]

const CHANNELS: SalesChannel[] = ['WhatsApp', 'Instagram', 'Web', 'Presencial']

export function SimulatorForm({
  profile,
  onChange,
}: {
  profile: StoreProfile
  onChange: (patch: Partial<StoreProfile>) => void
}) {
  const warnings: string[] = []
  if (profile.workingDays <= 0) warnings.push('Definí al menos un día de funcionamiento al mes.')
  if (profile.averageMinutesPerQuery <= 0)
    warnings.push('El tiempo promedio por consulta debe ser mayor a cero.')
  if (profile.averageTicket <= 0) warnings.push('Sin ticket promedio no hay margen adicional posible.')

  const toggleChannel = (channel: SalesChannel) => {
    const has = profile.channels.includes(channel)
    onChange({
      channels: has
        ? profile.channels.filter((c) => c !== channel)
        : [...profile.channels, channel],
    })
  }

  return (
    <div className="space-y-4">
      <Panel className="panel-pad">
        <div className="mb-4 flex items-center gap-2">
          <Store className="h-4 w-4 text-brand-300" />
          <h2 className="font-display text-sm font-semibold text-white">Perfil del comercio</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Nombre del comercio"
            value={profile.name}
            onChange={(value) => onChange({ name: value })}
            placeholder="Ej. Norte Calzado"
          />
          <SelectField
            label="Tipo de comercio"
            value={profile.businessType}
            onChange={(value) => onChange({ businessType: value })}
            options={BUSINESS_TYPES.map((type) => ({ value: type, label: type }))}
          />
          <NumberField
            label="Cantidad de productos"
            value={profile.totalProducts}
            onChange={(value) => onChange({ totalProducts: value })}
            suffix="SKU"
          />
          <TextField
            label="Horarios comerciales"
            value={profile.operatingHours}
            onChange={(value) => onChange({ operatingHours: value })}
            placeholder="Lun a Sáb · 10:00 a 20:00"
          />
        </div>
        <div className="mt-4">
          <p className="field-label">Canales de atención</p>
          <div className="flex flex-wrap gap-2">
            {CHANNELS.map((channel) => {
              const active = profile.channels.includes(channel)
              return (
                <button
                  key={channel}
                  type="button"
                  onClick={() => toggleChannel(channel)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    active
                      ? 'border-brand-500/50 bg-brand-500/15 text-brand-200'
                      : 'border-line bg-ink-900/60 text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {channel}
                </button>
              )
            })}
          </div>
        </div>
      </Panel>

      <Panel className="panel-pad">
        <div className="mb-4 flex items-center gap-2">
          <MessagesSquare className="h-4 w-4 text-brand-300" />
          <h2 className="font-display text-sm font-semibold text-white">Atención al cliente</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField
            label="Consultas diarias"
            value={profile.dailyQueries}
            onChange={(value) => onChange({ dailyQueries: value })}
            suffix="/día"
          />
          <NumberField
            label="Minutos por consulta"
            value={profile.averageMinutesPerQuery}
            onChange={(value) => onChange({ averageMinutesPerQuery: value })}
            suffix="min"
            step={0.5}
          />
          <NumberField
            label="Días de funcionamiento"
            value={profile.workingDays}
            onChange={(value) => onChange({ workingDays: value })}
            suffix="/mes"
            max={31}
          />
          <NumberField
            label="Personas en atención"
            value={profile.employeesInService}
            onChange={(value) => onChange({ employeesInService: value })}
            suffix="pers."
          />
        </div>
        <div className="mt-4 space-y-4">
          <RangeField
            label="Consultas automatizables"
            value={profile.automationPercentage}
            onChange={(value) => onChange({ automationPercentage: value })}
            hint="Catálogo, stock, precios, reservas y preguntas frecuentes."
          />
          <RangeField
            label="Consultas que no terminan en compra"
            value={profile.unresolvedQueries}
            onChange={(value) => onChange({ unresolvedQueries: value })}
            hint="Se usa para dimensionar la oportunidad de seguimiento."
          />
        </div>
      </Panel>

      <Panel className="panel-pad">
        <div className="mb-4 flex items-center gap-2">
          <Banknote className="h-4 w-4 text-brand-300" />
          <h2 className="font-display text-sm font-semibold text-white">Información comercial</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField
            label="Ventas mensuales"
            value={profile.monthlySales}
            onChange={(value) => onChange({ monthlySales: value })}
            prefix="$"
            step={100000}
            hint={money(profile.monthlySales)}
          />
          <NumberField
            label="Ticket promedio"
            value={profile.averageTicket}
            onChange={(value) => onChange({ averageTicket: value })}
            prefix="$"
            step={1000}
            hint={money(profile.averageTicket)}
          />
          <NumberField
            label="Ventas recuperadas por mes"
            value={profile.recoveredSales}
            onChange={(value) => onChange({ recoveredSales: value })}
            suffix="u."
            hint="Escenario independiente de ventas recuperadas"
          />
          <NumberField
            label="Clientes sin seguimiento"
            value={profile.customersWithoutFollowUp}
            onChange={(value) => onChange({ customersWithoutFollowUp: value })}
            suffix="clientes"
          />
        </div>
        <div className="mt-4">
          <RangeField
            label="Margen de contribución"
            value={profile.contributionMargin}
            onChange={(value) => onChange({ contributionMargin: value })}
            hint={`Margen actual sobre ventas: ${money(
              profile.monthlySales * (profile.contributionMargin / 100),
            )} (${pct(profile.contributionMargin)}).`}
          />
        </div>
      </Panel>

      {warnings.length > 0 ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.07] p-3">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5" />
            Revisá estos datos
          </div>
          <ul className="mt-1.5 space-y-0.5 text-[11px] text-amber-200/80">
            {warnings.map((warning) => (
              <li key={warning}>· {warning}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
