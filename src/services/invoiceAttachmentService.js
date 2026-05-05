import { auth } from '../firebase/config'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024
const ALLOWED_CONTENT_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
])

async function buildAuthHeader() {
  const user = auth.currentUser
  if (!user) throw new Error('Usuário não autenticado')
  const token = await user.getIdToken()
  return { Authorization: `Bearer ${token}` }
}

/**
 * Backend: { id, invoice_id, user_id, url, name, content_type, size_bytes, created_at }
 * UI:      { id, invoiceId, url, fileName, type, size, createdAt }
 */
export function mapInvoiceAttachment(raw) {
  if (!raw) return null
  return {
    id: raw.id,
    invoiceId: raw.invoice_id,
    url: raw.url,
    fileName: raw.name,
    type: raw.content_type,
    size: raw.size_bytes,
    createdAt: raw.created_at ? new Date(raw.created_at) : null,
  }
}

function validateFile(file) {
  if (!file) throw new Error('Arquivo inválido.')
  if (file.size > MAX_FILE_SIZE_BYTES) throw new Error('Arquivo muito grande. Máximo: 10MB.')
  if (file.type && !ALLOWED_CONTENT_TYPES.has(file.type)) {
    throw new Error('Tipo de arquivo não suportado. Use PDF, JPG ou PNG.')
  }
}

async function parseErrorMessage(res, fallback) {
  try {
    const text = await res.text()
    if (!text) return fallback
    try {
      const json = JSON.parse(text)
      return json.detail || json.message || fallback
    } catch {
      return text.slice(0, 200) || fallback
    }
  } catch {
    return fallback
  }
}

export async function listInvoiceAttachments(invoiceId) {
  if (!invoiceId) return []
  const headers = await buildAuthHeader()
  const res = await fetch(
    `${API_BASE}/api/v1/credit-card-invoices/${invoiceId}/attachments`,
    { headers }
  )
  if (!res.ok) {
    const msg = await parseErrorMessage(res, 'Erro ao carregar anexos da fatura.')
    throw new Error(`${res.status}: ${msg}`)
  }
  const data = await res.json()
  return Array.isArray(data) ? data.map(mapInvoiceAttachment) : []
}

export async function uploadInvoiceAttachment(invoiceId, file) {
  if (!invoiceId) throw new Error('Fatura inválida.')
  validateFile(file)

  const headers = await buildAuthHeader()
  const body = new FormData()
  body.append('file', file)

  const res = await fetch(
    `${API_BASE}/api/v1/credit-card-invoices/${invoiceId}/attachments`,
    { method: 'POST', headers, body }
  )

  if (!res.ok) {
    if (res.status === 422) {
      throw new Error('Tipo de arquivo não suportado. Use PDF, JPG ou PNG.')
    }
    if (res.status === 413) {
      throw new Error('Arquivo muito grande. Máximo: 10MB.')
    }
    if (res.status === 404) {
      throw new Error('Fatura não encontrada.')
    }
    const msg = await parseErrorMessage(res, 'Erro ao enviar anexo.')
    throw new Error(msg)
  }

  return mapInvoiceAttachment(await res.json())
}

export async function deleteInvoiceAttachment(attachmentId) {
  if (!attachmentId) throw new Error('Anexo inválido.')
  const headers = await buildAuthHeader()
  const res = await fetch(
    `${API_BASE}/api/v1/credit-card-invoices/attachments/${attachmentId}`,
    { method: 'DELETE', headers }
  )
  if (!res.ok && res.status !== 204) {
    const msg = await parseErrorMessage(res, 'Erro ao remover anexo.')
    throw new Error(msg)
  }
}
