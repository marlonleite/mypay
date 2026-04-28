import { auth } from '../firebase/config'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

async function getAuthHeader() {
  const user = auth.currentUser
  if (!user) throw new Error('Usuário não autenticado')
  const token = await user.getIdToken()
  return { Authorization: `Bearer ${token}` }
}

async function request(method, path, body) {
  const authHeader = await getAuthHeader()

  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...authHeader,
    },
  }

  if (body !== undefined) {
    options.body = JSON.stringify(body)
  }

  const res = await fetch(`${API_BASE}${path}`, options)

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`API ${method} ${path} → ${res.status}: ${text}`)
  }

  if (res.status === 204) return null
  return res.json()
}

export const apiClient = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
  patch: (path, body) => request('PATCH', path, body),
  /** DELETE com body opcional (ex.: exclusão em série `scope` em transactions). */
  delete: (path, body) => request('DELETE', path, body),
}
