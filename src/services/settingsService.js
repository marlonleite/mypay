import { apiClient } from './apiClient'
import { subscribe as subscribeEventStream } from './eventStream'

/**
 * Service centralizado pra `/api/v1/settings`.
 *
 * Backend consolida em 1 row `user_settings` com UNIQUE (user_id):
 *   { id, user_id, theme, show_values, push_enabled, push_token,
 *     onboarding_completed, onboarding_step, created_at, updated_at }
 *
 * Os 4 contexts do frontend (Privacy/Theme/Onboarding/Notification) leem o
 * mesmo recurso. Pra evitar 4 GETs duplicados por mount, mantemos uma promise
 * compartilhada — todas as chamadas concorrentes resolvem com a mesma resposta.
 * Após qualquer PUT, invalidamos o cache pra que próximos GETs vejam o estado
 * atual.
 */

let inflightFetch = null
let cached = null
const subscribers = new Set() // notificados quando settings atualiza

function notify(settings) {
  for (const fn of subscribers) {
    try { fn(settings) } catch (err) { console.error('settings subscriber failed:', err) }
  }
}

// Transform: snake_case → camelCase. Frontend ainda usa camelCase nos contexts.
function mapSettings(s) {
  if (!s) return null
  return {
    id: s.id,
    theme: s.theme,
    showValues: s.show_values,
    pushEnabled: s.push_enabled,
    pushToken: s.push_token ?? null,
    onboardingCompleted: s.onboarding_completed,
    onboardingStep: s.onboarding_step,
    updatedAt: s.updated_at ? new Date(s.updated_at) : null,
  }
}

export async function fetchSettings({ force = false } = {}) {
  if (!force && cached) return cached
  if (!force && inflightFetch) return inflightFetch

  inflightFetch = (async () => {
    try {
      const raw = await apiClient.get('/api/v1/settings')
      cached = mapSettings(raw)
      return cached
    } finally {
      inflightFetch = null
    }
  })()
  return inflightFetch
}

export async function updateSettings(partial) {
  // partial usa camelCase (interface dos contexts); converte pra snake_case.
  const payload = {}
  if (partial.theme !== undefined) payload.theme = partial.theme
  if (partial.showValues !== undefined) payload.show_values = partial.showValues
  if (partial.pushEnabled !== undefined) payload.push_enabled = partial.pushEnabled
  if (partial.pushToken !== undefined) payload.push_token = partial.pushToken
  if (partial.onboardingCompleted !== undefined) payload.onboarding_completed = partial.onboardingCompleted
  if (partial.onboardingStep !== undefined) payload.onboarding_step = partial.onboardingStep

  const raw = await apiClient.put('/api/v1/settings', payload)
  cached = mapSettings(raw)
  notify(cached)
  return cached
}

// Subscribers: contexts que precisam reagir a mudanças (ex.: NotificationContext
// observa pushEnabled).
export function subscribeSettings(fn) {
  subscribers.add(fn)
  return () => subscribers.delete(fn)
}

// Limpa cache (útil em logout)
export function clearSettingsCache() {
  cached = null
  inflightFetch = null
}

// SSE: quando user_settings muda em outra aba/dispositivo, force-fetch + notifica.
// Subscribe é setado uma vez no carregamento do módulo — eventStream singleton
// dedupes por usuário; em logout o stream desconecta e events param.
subscribeEventStream('user_settings', async () => {
  try {
    const fresh = await fetchSettings({ force: true })
    notify(fresh)
  } catch (err) {
    console.warn('settingsService: refresh on SSE event failed:', err)
  }
})
