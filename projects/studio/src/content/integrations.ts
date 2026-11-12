import type { Id, Integration } from '../engine/types';

/**
 * THE ONLY PLACE where an integration may be marked 'verified'.
 * 'verified' requires verifiedOn + evidence (a real RIVECT delivery). Review every change here.
 * Everything else renders as "Simulación".
 */
const list: Integration[] = [
  { id: 'whatsapp', name: 'WhatsApp Business', status: 'simulated' },
  { id: 'assistant', name: 'Asistente con IA', status: 'simulated' },
  { id: 'catalog', name: 'Catálogo y stock', status: 'simulated' },
  { id: 'quotes', name: 'Generador de presupuestos', status: 'simulated' },
  { id: 'followup', name: 'Mensajes de seguimiento', status: 'simulated' },
  { id: 'crm', name: 'CRM', status: 'simulated' },
  { id: 'admin', name: 'Sistema administrativo', status: 'simulated' },
  { id: 'web', name: 'Web / tienda online', status: 'simulated' },
  { id: 'ads', name: 'Campañas en redes', status: 'simulated' },
  { id: 'calendar', name: 'Agenda online', status: 'simulated' },
];

export const integrations: Record<Id, Integration> = Object.fromEntries(list.map((i) => [i.id, i]));
