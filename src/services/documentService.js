import { auth } from '../firebase/config'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

/**
 * Service de IA pra processamento de documentos.
 *
 * Pós Fase E migration: chama `POST /api/v1/documents/process` (multipart) que
 * roda a pipeline Gemini SERVER-SIDE. Frontend não tem mais a API key do Gemini
 * exposta no bundle JS — refactor de segurança crítico.
 *
 * Backend response (English snake_case) é traduzido pra shape em português que os
 * componentes (`ProcessingResult.jsx`, `FaturaResult.jsx`) já consomem. Quando o
 * tempo permitir, refatorar consumers pra usar o shape nativo do backend e
 * remover esta camada de tradução.
 */

async function buildAuthHeader() {
  const user = auth.currentUser
  if (!user) throw new Error('Usuário não autenticado')
  const token = await user.getIdToken()
  return { Authorization: `Bearer ${token}` }
}

/**
 * Processa um documento (PDF, imagem) via backend.
 *
 * @param {File} file - Arquivo a processar
 * @param {string} documentType - 'auto' | 'fatura' | 'comprovante' | 'extrato'
 * @param {string|null} cardId - UUID do cartão associado (opcional, pra fatura)
 * @param {string|null} pdfPassword - Senha do PDF se o arquivo estiver cifrado (opcional). Não persistir no cliente.
 * @returns {Promise<Object>} shape em português compatível com consumers
 */
export async function processDocument(
  file,
  documentType = 'auto',
  cardId = null,
  pdfPassword = null
) {
  if (!file) throw new Error('Arquivo é obrigatório')

  const headers = await buildAuthHeader()
  const body = new FormData()
  body.append('file', file)
  body.append('document_type', documentType)
  if (cardId) body.append('card_id', cardId)
  const pwd = typeof pdfPassword === 'string' ? pdfPassword.trim() : ''
  if (pwd) body.append('pdf_password', pwd)

  const res = await fetch(`${API_BASE}/api/v1/documents/process`, {
    method: 'POST',
    headers,
    body,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    if (res.status === 413) throw new Error('Arquivo muito grande.')
    if (res.status === 422) throw new Error('Tipo de arquivo não suportado.')
    if (res.status === 504 || res.status === 502) {
      throw new Error('Tempo esgotado processando documento. Tente novamente.')
    }
    throw new Error(`Erro ao processar documento: ${res.status} ${text || ''}`.trim())
  }

  const raw = await res.json()
  return mapBackendResponseToLegacyShape(raw)
}

/**
 * Mapper: backend response (English snake_case) → shape em português que
 * `ProcessingResult.jsx` e `FaturaResult.jsx` consomem.
 *
 * Backend retorna:
 *   { import_id, document_type, file_url,
 *     billing_month, billing_year, total_amount,
 *     transactions: [{date, description, amount, category, transaction_type, confidence}] }
 *
 * Frontend espera (legado Gemini):
 *   - Single (comprovante/outro): { tipo_documento, descricao, valor, data,
 *                                   categoria_sugerida, confianca, dados_completos, file_url }
 *   - Fatura batch: { tipo_documento: 'fatura_batch', transacoes: [{id, descricao, valor, data, categoria_sugerida, transaction_type, confianca}],
 *                     mes_referencia, ano_referencia, valor_total, dados_completos, file_url }
 */
function mapBackendResponseToLegacyShape(backend) {
  const txns = Array.isArray(backend.transactions) ? backend.transactions : []
  const isFatura = backend.document_type === 'fatura' || txns.length > 1

  if (isFatura) {
    return {
      tipo_documento: 'fatura_batch',
      transacoes: txns.map((t, idx) => ({
        id: t.id ?? `${backend.import_id}_${idx}`,
        descricao: t.description,
        valor: parseFloat(t.amount),
        data: t.date,
        categoria_sugerida: t.category ?? null,
        transaction_type: t.transaction_type, // 'income' | 'expense'
        confianca: t.confidence,
      })),
      mes_referencia: backend.billing_month ?? null,
      ano_referencia: backend.billing_year ?? null,
      valor_total: backend.total_amount !== null && backend.total_amount !== undefined
        ? parseFloat(backend.total_amount)
        : null,
      file_url: backend.file_url ?? null,
      import_id: backend.import_id,
      dados_completos: backend,
    }
  }

  // Single transaction (comprovante / extrato com 1 item / outro)
  const first = txns[0] || {}
  return {
    tipo_documento: backend.document_type === 'fatura' ? 'fatura' : 'comprovante',
    descricao: first.description ?? '',
    valor: first.amount !== undefined ? parseFloat(first.amount) : 0,
    data: first.date ?? new Date().toISOString().slice(0, 10),
    categoria_sugerida: first.category ?? null,
    transaction_type: first.transaction_type ?? 'expense',
    confianca: first.confidence ?? 'media',
    file_url: backend.file_url ?? null,
    import_id: backend.import_id,
    dados_completos: backend,
  }
}

/**
 * Lista importações do usuário (substitui Firestore `users/{uid}/imports`).
 * Backend cria import_record automaticamente em cada /documents/process.
 */
export async function listImports() {
  const headers = await buildAuthHeader()
  const res = await fetch(`${API_BASE}/api/v1/documents/imports`, { headers })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Erro ao carregar importações: ${res.status} ${text}`)
  }

  const data = await res.json()
  return Array.isArray(data) ? data.map(mapImportRecord) : []
}

/**
 * Mapper: ImportRecordResponse → shape esperado por ImportHistory.jsx.
 *
 * Frontend esperava: { id, fileName, fileType, documentType, status, createdAt }
 * Backend tem:        { id, file_name, file_url, document_type, status,
 *                       items_imported, total_amount, ai_model, metadata, created_at }
 *
 * fileType (mime) não existe no backend — derivamos da extensão do nome.
 */
function mapImportRecord(r) {
  return {
    id: r.id,
    fileName: r.file_name ?? null,
    fileUrl: r.file_url ?? null,
    fileType: deriveFileTypeFromName(r.file_name),
    documentType: r.document_type ?? null,
    status: r.status ?? 'completed',
    itemsImported: r.items_imported ?? 0,
    totalAmount: r.total_amount !== null && r.total_amount !== undefined
      ? parseFloat(r.total_amount)
      : null,
    aiModel: r.ai_model ?? null,
    metadata: r.metadata ?? {},
    createdAt: r.created_at ? new Date(r.created_at) : null,
  }
}

function deriveFileTypeFromName(name) {
  if (!name) return null
  const ext = name.split('.').pop()?.toLowerCase()
  if (ext === 'pdf') return 'application/pdf'
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  if (ext === 'png') return 'image/png'
  return null
}
