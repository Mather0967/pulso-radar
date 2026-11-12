import type { AssistantMessage, AssistantSession } from '@/domain/models'
import { uid } from '@/utils/format'

export function buildWelcomeSession(businessName: string): AssistantSession {
  const message: AssistantMessage = {
    id: uid('msg'),
    role: 'assistant',
    text: `¡Hola! Soy el asistente virtual de ${businessName} 👋\nPuedo ayudarte con modelos, talles, colores, precios y reservas.\n\n¿Qué estás buscando?`,
    at: new Date().toISOString(),
    quickReplies: ['Zapatillas negras talle 42', '¿Qué me recomiendan?', '¿Tienen algo más económico?'],
    meta: { intent: 'saludo' },
  }
  return {
    messages: [message],
    metrics: {
      conversationsStarted: 0,
      queriesResolved: 0,
      productsConsulted: 0,
      productsRecommended: 0,
      reservations: 0,
      purchaseOpportunities: 0,
    },
  }
}
