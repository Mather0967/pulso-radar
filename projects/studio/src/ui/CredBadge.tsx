import { integrations } from '../content/integrations';
import type { Id } from '../engine/types';

/** "Simulación" unless the integration registry says verified. Scenario files cannot claim it. */
export function CredBadge({ integration, compact }: { integration?: Id; compact?: boolean }) {
  const i = integration ? integrations[integration] : undefined;
  const verified = i?.status === 'verified';
  return (
    <span className={`cred ${verified ? 'verified' : ''}`} title={verified ? `Integración verificada el ${i.verifiedOn}` : 'Datos y conexión de ejemplo para esta demostración'}>
      <i />
      {verified ? 'Integración verificada' : compact ? 'Simulación' : 'Simulación de ejemplo'}
    </span>
  );
}
