import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { OverviewPage } from '@/features/retail-overview/OverviewPage'
import { SimulatorPage } from '@/features/business-simulator/SimulatorPage'
import { AssistantPage } from '@/features/sales-assistant/AssistantPage'
import { RecoveryPage } from '@/features/customer-recovery/RecoveryPage'
import { StockPage } from '@/features/stock-intelligence/StockPage'
import { CampaignsPage } from '@/features/smart-campaigns/CampaignsPage'
import { ReportPage } from '@/features/impact-report/ReportPage'
import { PresentationShell } from '@/presentation/PresentationShell'
import { Button } from '@/components/ui/Button'

function NotFound() {
  const navigate = useNavigate()
  return (
    <div className="panel panel-pad mx-auto max-w-lg text-center">
      <p className="kpi-label">Error 404</p>
      <h1 className="mt-2 font-display text-2xl text-white">Sección no encontrada</h1>
      <p className="mt-2 text-sm text-slate-400">
        La ruta que buscás no forma parte de la demostración de Retail Intelligence.
      </p>
      <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Button onClick={() => navigate('/escena/1')}>Volver a la presentación</Button>
        <Button variant="secondary" onClick={() => navigate('/overview')}>
          Volver al resumen
        </Button>
      </div>
    </div>
  )
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/escena/1" replace />} />
      <Route path="/escena" element={<Navigate to="/escena/1" replace />} />
      <Route path="/escena/:n" element={<PresentationShell />} />

      <Route element={<AppShell />}>
        <Route path="/overview" element={<OverviewPage />} />
        <Route path="/simulator" element={<SimulatorPage />} />
        <Route path="/assistant" element={<AssistantPage />} />
        <Route path="/recovery" element={<RecoveryPage />} />
        <Route path="/stock" element={<StockPage />} />
        <Route path="/campaigns" element={<CampaignsPage />} />
        <Route path="/report" element={<ReportPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
