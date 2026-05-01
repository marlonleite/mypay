import { auth } from '../firebase/config'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

/** `VITE_ENABLE_SSE=0` — sem conexão a `/api/v1/events` (evita CORS/500 ruidosos no dev local). */
const SSE_ENABLED = import.meta.env.VITE_ENABLE_SSE !== '0'
const SSE_MAX_RECONNECT = Math.max(1, Number(import.meta.env.VITE_SSE_MAX_RECONNECT ?? 6))

/**
 * SSE client pra `/api/v1/events` com pub/sub por entidade.
 *
 * Por que `fetch` + ReadableStream em vez de `EventSource`:
 * - `EventSource` browser API não permite header `Authorization`.
 *   Backend (`get_current_user`) exige Bearer token.
 * - `fetch` aceita headers; parsing SSE é trivial (split por `\n\n`).
 * - Reconexão manual com backoff (mais flexível que o auto-retry do EventSource).
 *
 * Backend payload (por evento):
 *   { entity: 'transaction'|'card'|'goal'|..., action: 'create'|'update'|'delete', id: UUID|null }
 *
 * Pub/sub:
 *   subscribe('transaction', cb)  // chama cb(payload) em todo evento de transaction
 *   subscribe('*', cb)            // chama cb(payload) em todos os eventos
 */

const SSE_RECONNECT_BASE_MS = 1000
const SSE_RECONNECT_MAX_MS = 30000
const KEEPALIVE_EVENT = 'ping'

const subscribers = new Map() // entity -> Set<fn>; '*' = todos
let abortController = null
let connected = false
let connecting = false
let reconnectAttempts = 0
let currentUserUid = null
// Loop async — não cancelar enquanto não chamar disconnect()
let runLoopActive = false

function notifyAll(payload) {
  const entitySubs = subscribers.get(payload.entity)
  const wildcardSubs = subscribers.get('*')

  if (entitySubs) {
    for (const fn of entitySubs) {
      try { fn(payload) } catch (err) { console.error('SSE subscriber error:', err) }
    }
  }
  if (wildcardSubs) {
    for (const fn of wildcardSubs) {
      try { fn(payload) } catch (err) { console.error('SSE wildcard subscriber error:', err) }
    }
  }
}

/**
 * Parse SSE stream chunks. Cada evento separado por `\n\n`; campos por `\n`.
 * Formato: `event: <name>\ndata: <json>\n\n`
 */
function parseSSEChunk(buffer) {
  const events = []
  const blocks = buffer.split('\n\n')
  // O último bloco pode estar incompleto; deixa pro próximo chunk.
  const remainder = blocks.pop() ?? ''

  for (const block of blocks) {
    if (!block.trim()) continue
    let eventName = 'message'
    let data = ''
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) eventName = line.slice(6).trim()
      else if (line.startsWith('data:')) data += line.slice(5).trim()
    }
    events.push({ eventName, data })
  }

  return { events, remainder }
}

async function runStream() {
  let buffer = ''

  try {
    const user = auth.currentUser
    if (!user) throw new Error('Sem usuário autenticado pra SSE')
    const token = await user.getIdToken()

    abortController = new AbortController()
    const res = await fetch(`${API_BASE}/api/v1/events`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: abortController.signal,
    })

    if (!res.ok) {
      throw new Error(`SSE handshake falhou: ${res.status}`)
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    connected = true
    reconnectAttempts = 0
    console.info('SSE: conectado')

    let streamDone = false
    while (!streamDone) {
      const { value, done } = await reader.read()
      if (done) { streamDone = true; break }

      buffer += decoder.decode(value, { stream: true })
      const { events, remainder } = parseSSEChunk(buffer)
      buffer = remainder

      for (const evt of events) {
        if (evt.eventName === KEEPALIVE_EVENT) continue
        if (!evt.data) continue
        try {
          const payload = JSON.parse(evt.data)
          notifyAll(payload)
        } catch (err) {
          console.warn('SSE: payload inválido', evt.data, err)
        }
      }
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      console.info('SSE: desconectado intencionalmente')
      return
    }
    console.warn('SSE: stream caiu —', err.message)
  } finally {
    connected = false
    connecting = false
  }
}

/**
 * Loop de conexão+reconexão com backoff exponencial.
 * Retorna quando `disconnect()` é chamado (runLoopActive=false).
 */
async function connectionLoop() {
  while (runLoopActive) {
    connecting = true
    await runStream()

    if (!runLoopActive) break

    if (reconnectAttempts >= SSE_MAX_RECONNECT) {
      console.info(
        'SSE: reconexão interrompida após várias falhas. Ajuste CORS/`/api/v1/events` na API ou use VITE_ENABLE_SSE=0 no .env.'
      )
      runLoopActive = false
      break
    }

    // Backoff exponencial até SSE_RECONNECT_MAX_MS
    reconnectAttempts++
    const delay = Math.min(
      SSE_RECONNECT_BASE_MS * Math.pow(2, reconnectAttempts - 1),
      SSE_RECONNECT_MAX_MS
    )
    console.info(`SSE: reconectando em ${delay}ms (tentativa ${reconnectAttempts})`)
    await new Promise(r => setTimeout(r, delay))
  }
}

/**
 * Inicia (ou re-inicia) o stream pro usuário atual.
 * Idempotente: chamadas repetidas são no-op se já conectado/conectando ao mesmo user.
 */
export function connect() {
  const user = auth.currentUser
  if (!user) return
  if (!SSE_ENABLED) return

  // Já conectado/conectando ao mesmo usuário? no-op.
  if ((connected || connecting) && currentUserUid === user.uid) return

  // Outro usuário — desconecta primeiro.
  if (currentUserUid && currentUserUid !== user.uid) {
    disconnect()
  }

  currentUserUid = user.uid
  reconnectAttempts = 0
  runLoopActive = true
  connectionLoop()
}

/**
 * Para o stream e cancela qualquer reconexão pendente.
 * Útil em logout.
 */
export function disconnect() {
  runLoopActive = false
  if (abortController) {
    try { abortController.abort() } catch (_) { /* noop */ }
    abortController = null
  }
  connected = false
  connecting = false
  currentUserUid = null
  reconnectAttempts = 0
}

/**
 * Subscribe a eventos de uma entidade (ou '*' pra todos).
 * Retorna função de unsubscribe.
 */
export function subscribe(entity, fn) {
  if (!subscribers.has(entity)) subscribers.set(entity, new Set())
  subscribers.get(entity).add(fn)

  return () => {
    const set = subscribers.get(entity)
    if (set) {
      set.delete(fn)
      if (set.size === 0) subscribers.delete(entity)
    }
  }
}

/**
 * Helper de conveniência pra hooks: subscribe a múltiplas entidades de uma vez.
 * Retorna função única que desinscreve todas.
 */
export function subscribeMany(entities, fn) {
  const unsubs = entities.map(e => subscribe(e, fn))
  return () => unsubs.forEach(u => u())
}

export function isConnected() {
  return connected
}
