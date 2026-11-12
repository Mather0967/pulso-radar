import { useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useSimulationStore } from '@/store/useSimulationStore'

export function ResetDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const resetSimulation = useSimulationStore((s) => s.resetSimulation)
  const [working, setWorking] = useState(false)

  const handleReset = async () => {
    setWorking(true)
    try {
      await resetSimulation()
      onClose()
    } finally {
      setWorking(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Restablecer la simulación"
      description="Se restauran los datos de demostración originales."
      width="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleReset} disabled={working}>
            <RotateCcw className="h-4 w-4" />
            {working ? 'Restableciendo…' : 'Restablecer todo'}
          </Button>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-slate-400">
        Se van a descartar los datos que ingresaste en el simulador, las reservas simuladas, los
        cambios de estado del CRM y las campañas creadas en esta sesión.
      </p>
      <ul className="mt-4 space-y-1.5 text-xs text-slate-500">
        <li>· Perfil del comercio → valores iniciales de la demo.</li>
        <li>· Conversaciones y oportunidades → estado original.</li>
        <li>· Inventario y escenarios → configuración de fábrica.</li>
      </ul>
      <p className="mt-4 rounded-lg border border-line bg-ink-900/70 px-3 py-2 text-[11px] text-slate-500">
        Esta acción no se puede deshacer.
      </p>
    </Modal>
  )
}
