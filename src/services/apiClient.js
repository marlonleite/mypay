import { auth } from '../firebase/config'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

async function getAuthHeader() {
  const user = auth.currentUser
  if (!user) throw new Error('Usuário não autenticado')
  const token = await user.getIdToken()
  return { Authorization: `Bearer ${token}` }
}

/**
 * @param {string} method
 * @param {string} path
 * @param {object|undefined} body
 * @param {Record<string, string>} [extraHeaders]
 * @returns {Promise<{ status: number, body: object|null }>}
 */
async function requestJson(method, path, body, extraHeaders = {}) {
  const authHeader = await getAuthHeader()

  const headers = {
    ...authHeader,
    ...extraHeaders,
  }
  if (body !== undefined && method !== 'GET' && method !== 'HEAD') {
    headers['Content-Type'] = 'application/json'
  }

  const options = {
    method,
    headers,
  }

  if (body !== undefined) {
    options.body = JSON.stringify(body)
  }

  const res = await fetch(`${API_BASE}${path}`, options)
  const text = await res.text().catch(() => '')
  let parsed = null
  try {
    parsed = text ? JSON.parse(text) : null
  } catch {
    parsed = null
  }

  if (!res.ok) {
    const msg =
      (typeof parsed?.detail === 'string' && parsed.detail) ||
      (Array.isArray(parsed?.detail) && JSON.stringify(parsed.detail)) ||
      text ||
      res.statusText
    throw new Error(`API ${method} ${path} → ${res.status}: ${msg}`)
  }

  if (res.status === 204) return { status: res.status, body: null }
  return { status: res.status, body: parsed }
}

export const apiClient = {
  get: (path) => requestJson('GET', path, undefined).then((r) => r.body),
  /**
   * @param {string} path
   * @param {object} [body]
   * @param {{ headers?: Record<string, string> }} [options]
   */
  post: (path, body, options = {}) =>
    requestJson('POST', path, body, options.headers || {}),
  put: (path, body) => requestJson('PUT', path, body).then((r) => r.body),
  patch: (path, body) => requestJson('PATCH', path, body).then((r) => r.body),
  /** DELETE com body opcional (ex.: exclusão em série `scope` em transactions). */
  delete: (path, body) => requestJson('DELETE', path, body).then((r) => r.body),
  /** POST que devolve HTTP status (ex.: 201 vs 207). */
  postWithStatus: (path, body, options = {}) => requestJson('POST', path, body, options.headers || {}),
}
