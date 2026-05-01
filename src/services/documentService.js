import { auth } from '../firebase/config'
import { parseLocalDate } from '../utils/helpers'
import { apiClient } from './apiClient'
import { findBestCategory } from '../utils/categoryMapping'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

/** Alinhado a `.claude/map/services/transactions-batch.md` e `TransactionBatchCreate.items` (max 200). */
export const DOCUMENT_IMPORT_APPLY_MAX_ITEMS = 200

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
  const rows = Array.isArray(data)
    ? data
    : data.imports ?? data.data ?? data.items ?? []
  return Array.isArray(rows) ? rows.map(mapImportRecord) : []
}

function parseJsonIfString(value) {
  if (value == null || typeof value !== 'string') return null
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

const IMPORT_DETAIL_TX_ARRAY_KEYS = [
  'transactions',
  'items',
  'lines',
  'transacoes',
  'expense_lines',
  'line_items',
  'movimentos',
  'lancamentos',
  'expenses',
  'charges',
  'entries',
  'rows',
  'parsed_lines',
]

/**
 * Depois de espalhar camadas (metadata, extracted_json…), `transactions: no topo
 * pode vir [] enquanto o payload real só existe em metadata — o spread perde as linhas.
 */
function restoreNonEmptyTransactionArrays(target, ...sources) {
  if (!target || typeof target !== 'object') return target
  for (const key of IMPORT_DETAIL_TX_ARRAY_KEYS) {
    const cur = target[key]
    if (Array.isArray(cur) && cur.length > 0) continue
    for (const src of sources) {
      if (!src || typeof src !== 'object') continue
      let v = src[key]
      if (typeof v === 'string') {
        const p = parseJsonIfString(v)
        v = Array.isArray(p) ? p : null
      }
      if (Array.isArray(v) && v.length > 0) {
        target[key] = v
        break
      }
    }
  }
  return target
}

/** JSONB `metadata` + `metadata.payload` costumam guardar o resultado bruto da IA. */
function shallowMergeImportMetadata(root) {
  if (!root || typeof root !== 'object') return root
  let meta = root.metadata
  if (typeof meta === 'string') {
    const parsed = parseJsonIfString(meta)
    meta = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
  }
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return root

  const payload =
    meta.payload && typeof meta.payload === 'object' && !Array.isArray(meta.payload)
      ? meta.payload
      : null

  const merged = {
    ...(payload || {}),
    ...meta,
    ...root,
  }

  restoreNonEmptyTransactionArrays(merged, root, meta, payload || {})
  return merged
}

/**
 * Só considera arrays com linhas. Antes: o primeiro `transactions: []` do backend
 * era devolvido e impedia usar `movimentos` / metadata / outras chaves.
 */
function pickTransactionArrayFromObject(obj) {
  if (!obj || typeof obj !== 'object') return null
  for (const key of IMPORT_DETAIL_TX_ARRAY_KEYS) {
    let v = obj[key]
    if (typeof v === 'string') {
      const parsed = parseJsonIfString(v)
      v = parsed
    }
    if (Array.isArray(v) && v.length > 0) return v
  }
  return null
}

const TX_ROW_HINT_KEYS = new Set([
  'amount',
  'valor',
  'value',
  'amount_cents',
  'value_cents',
  'description',
  'descricao',
  'merchant',
  'date',
  'data',
  'historico',
  'estabelecimento',
  'lancamento',
  'text',
  'titulo',
])

function looksLikeTransactionRow(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return false
  for (const k of TX_ROW_HINT_KEYS) {
    if (k in o) return true
  }
  return false
}

/**
 * Último recurso: alguns backends aninham `transactions` em objetos profundos.
 */
function findTransactionArrayDeep(obj, depth = 0, maxDepth = 8) {
  if (depth > maxDepth || obj == null || typeof obj !== 'object') return null
  if (Array.isArray(obj)) {
    if (obj.length === 0) return null
    const score = obj.filter(looksLikeTransactionRow).length
    if (score > 0 && score >= Math.max(1, Math.ceil(obj.length * 0.35))) return obj
    return null
  }
  for (const v of Object.values(obj)) {
    const found = findTransactionArrayDeep(v, depth + 1, maxDepth)
    if (found && found.length) return found
  }
  return null
}

function extractRawTransactionsForImportDetail(root, body) {
  const tryOrder = [
    () => {
      const inner = body?.data?.import ?? body?.import
      if (!inner || typeof inner !== 'object') return null
      return pickTransactionArrayFromObject(shallowMergeImportMetadata({ ...inner }))
    },
    () => pickTransactionArrayFromObject(root),
    () => {
      const dc = root.dados_completos
      return dc && typeof dc === 'object' ? pickTransactionArrayFromObject(dc) : null
    },
    () =>
      pickTransactionArrayFromObject(root.extraction_result ?? root.extractionResult),
    () => (root.extraction ? pickTransactionArrayFromObject(root.extraction) : null),
    () => {
      const ed = root.extracted_data ?? root.extractedData ?? root.extracted
      return ed && typeof ed === 'object' ? pickTransactionArrayFromObject(ed) : null
    },
    () => (body && typeof body === 'object' ? pickTransactionArrayFromObject(body) : null),
    () => (body?.data && typeof body.data === 'object' ? pickTransactionArrayFromObject(body.data) : null),
  ]
  for (const fn of tryOrder) {
    const arr = fn()
    if (Array.isArray(arr) && arr.length > 0) return arr
  }
  const deep = findTransactionArrayDeep(root) || findTransactionArrayDeep(body)
  return Array.isArray(deep) ? deep : []
}

/**
 * mypay-api devolve `ImportRecordResponse`: linhas em `metadata.transactions`
 * (o merge com shallowMergeImportMetadata costuma subir isso para `transactions`,
 * mas garantimos leitura direta do nested e de `body` cru).
 */
function resolveImportDetailTransactions(root, body) {
  const tryPools = [
    root?.transactions,
    root?.metadata?.transactions,
    body?.transactions,
    body?.metadata?.transactions,
  ]
  for (const p of tryPools) {
    let v = p
    if (typeof v === 'string') {
      v = parseJsonIfString(v)
    }
    if (Array.isArray(v) && v.length > 0) return v
  }
  return extractRawTransactionsForImportDetail(root, body)
}

/** Valor monetário BR/US em string (ex.: "1.234,56", "R$ 10,00"). */
function parseAmountLoose(raw) {
  if (raw == null) return null
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw !== 'string') return null
  const s = raw.replace(/R\$\s*/gi, '').replace(/\u00a0/g, '').trim()
  if (!s) return null
  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')
  let norm = s.replace(/[^\d,.-]/g, '')
  if (lastComma > lastDot) {
    norm = norm.replace(/\./g, '').replace(',', '.')
  } else if (lastDot > lastComma) {
    norm = norm.replace(/,/g, '')
  } else if (lastComma >= 0) {
    norm = norm.replace(',', '.')
  }
  const n = parseFloat(norm)
  return Number.isFinite(n) ? n : null
}

function unwrapImportTransactionRow(t) {
  if (!t || typeof t !== 'object') return t
  const inner = t.line ?? t.row ?? t.item ?? t.transaction ?? t.detalhe
  if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
    return { ...inner, ...t }
  }
  return t
}

/** Normaliza uma linha de transação vinda do GET import (snake/camel ou legado PT). */
function normalizeImportDetailTransaction(t, idx, importId) {
  const row = unwrapImportTransactionRow(t)
  if (!row || typeof row !== 'object') return null
  const id = row.id ?? row.transaction_id ?? `${importId}_row_${idx}`
  const description =
    row.description ??
    row.descricao ??
    row.merchant ??
    row.title ??
    row.titulo ??
    row.narrative ??
    row.memo ??
    row.historico ??
    row.estabelecimento ??
    row.lancamento ??
    row.text ??
    ''
  let amount = row.amount ?? row.valor ?? row.value
  if (amount == null && typeof row.amount_cents === 'number') amount = row.amount_cents / 100
  if (amount == null && typeof row.value_cents === 'number') amount = row.value_cents / 100
  if (typeof amount === 'string' && amount.trim() !== '') {
    amount = parseAmountLoose(amount)
  }
  if (typeof amount === 'number' && !Number.isFinite(amount)) amount = null

  const date = row.date ?? row.data ?? row.transaction_date ?? row.txn_date ?? row.due_date
  const category = row.category ?? row.categoria ?? row.categoria_sugerida
  const transaction_type = row.transaction_type ?? row.transactionType ?? 'expense'
  const confidence = row.confidence ?? row.confianca
  const hasSignal =
    (description != null && String(description).trim() !== '') ||
    amount != null ||
    date != null
  if (!hasSignal) return null
  return {
    id,
    description,
    amount,
    date,
    category,
    transaction_type,
    confidence,
  }
}

/**
 * GET /api/v1/documents/imports/{importId} — reidrata dados extraídos para revisão no front.
 * Aceita formatos com envelope (`data`, `detail`) ou payload direto; `transactions` pode estar
 * como array ou JSON string; tenta chaves alternativas (`items`, `lines`).
 */
export async function getImportDetail(importId) {
  if (!importId) throw new Error('importId é obrigatório')
  const headers = await buildAuthHeader()
  const res = await fetch(`${API_BASE}/api/v1/documents/imports/${importId}`, { headers })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    if (res.status === 404) {
      throw new Error('Importação não encontrada ou sem permissão.')
    }
    throw new Error(`Erro ao carregar importação: ${res.status} ${text}`.trim())
  }

  let body = await res.json()
  if (body == null) throw new Error('Resposta vazia do servidor.')

  let root = body.data ?? body.detail ?? body.import ?? body
  if (typeof root === 'string') {
    const parsed = parseJsonIfString(root)
    root = parsed && typeof parsed === 'object' ? parsed : body
  }

  root = shallowMergeImportMetadata(root)

  if (root.extracted_json != null) {
    const ej =
      typeof root.extracted_json === 'string'
        ? parseJsonIfString(root.extracted_json)
        : root.extracted_json
    if (ej && typeof ej === 'object' && !Array.isArray(ej)) {
      root = { ...ej, ...root }
      restoreNonEmptyTransactionArrays(root, ej)
    }
  }

  let transactions = resolveImportDetailTransactions(root, body)

  const resolvedImportId = root.id ?? root.import_id ?? importId
  const normalized = transactions
    .map((t, i) => normalizeImportDetailTransaction(t, i, resolvedImportId))
    .filter(Boolean)

  if (normalized.length === 0) {
    const metaTx = root?.metadata?.transactions
    const noPersistedLines = !Array.isArray(metaTx) || metaTx.length === 0
    const legacy =
      noPersistedLines &&
      (Number(root.items_imported) > 0 || Number(body?.items_imported) > 0)
    throw new Error(
      legacy
        ? 'Esta importação não tem prévia salva no servidor (registro antigo ou metadados vazios). Envie o arquivo de novo em Importar Documento ou edite os lançamentos em Cartões.'
        : 'Esta importação não retornou linhas para revisão. Se o arquivo já foi aplicado, edite os lançamentos em Cartões; caso contrário, processe o arquivo de novo.'
    )
  }

  const backendLike = {
    import_id: resolvedImportId,
    document_type:
      root.document_type ??
      root.documentType ??
      (normalized.length > 1 ? 'fatura' : 'comprovante'),
    transactions: normalized,
    billing_month: root.billing_month ?? root.billingMonth,
    billing_year: root.billing_year ?? root.billingYear,
    total_amount: root.total_amount ?? root.totalAmount,
    file_url: root.file_url ?? root.fileUrl,
  }

  return mapBackendResponseToLegacyShape(backendLike)
}

export function normalizeCategoryKey(name) {
  if (name == null || typeof name !== 'string') return ''
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Mapa nome (normalizado) → category_id para resolver strings da IA antes do apply.
 */
export function buildCategoryNameToIdMap(categories) {
  const m = new Map()
  if (!Array.isArray(categories)) return m
  for (const c of categories) {
    if (!c?.name || !c.id) continue
    const k = normalizeCategoryKey(c.name)
    if (k && !m.has(k)) m.set(k, c.id)
  }
  return m
}

export function buildTagNameToIdMap(tagsList) {
  const m = new Map()
  if (!Array.isArray(tagsList)) return m
  for (const t of tagsList) {
    if (!t?.name || !t.id) continue
    const k = normalizeCategoryKey(t.name)
    if (k && !m.has(k)) m.set(k, t.id)
  }
  return m
}

function looksLikeUuid(v) {
  return typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v)
}

/**
 * Resolve category_id final: UUID válido nas categorias do usuário, ou nome via mapa, ou findBestCategory.
 */
export function resolveCategoryIdForApply({
  categoryId,
  suggestedName,
  nameToIdMap,
  categories,
  type = 'expense',
}) {
  if (categoryId && looksLikeUuid(categoryId)) {
    if (categories.some((c) => c.id === categoryId)) return categoryId
  }
  if (suggestedName && nameToIdMap?.size) {
    const byName = nameToIdMap.get(normalizeCategoryKey(suggestedName))
    if (byName) return byName
  }
  return findBestCategory(suggestedName || '', categories, type) || null
}

/**
 * Monta linha do batch (shape POST /transactions) para compra no cartão; `client_line_id` opcional.
 * `expense.date` e `expense.originalDate`: YYYY-MM-DD ou Date; prefere data civil da linha quando válida.
 * `options.credit_card_invoice_id` ou `expense.creditCardInvoiceId`: fatura aberta (vencimento no contexto do app).
 */
export function buildInvoiceCardExpenseApiItem(expense, options) {
  const { category_id, client_line_id, tagIdByName, credit_card_invoice_id: invoiceIdOpt } = options
  if (!expense.cardId) throw new Error('cardId é obrigatório')

  let dateIso
  const rawLine =
    typeof expense.originalDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(expense.originalDate.trim())
      ? expense.originalDate.trim()
      : null
  if (rawLine) {
    const d = parseLocalDate(rawLine)
    dateIso = d.toISOString().slice(0, 10)
  } else {
    const parsedDate = expense.date instanceof Date ? expense.date : parseLocalDate(expense.date)
    dateIso = parsedDate.toISOString().slice(0, 10)
  }

  const txType = expense.type === 'income' || expense.type === 'expense' ? expense.type : 'expense'

  let tag_ids
  if (Array.isArray(expense.tags) && expense.tags.length > 0 && tagIdByName?.size) {
    if (expense.tags.every(looksLikeUuid)) {
      tag_ids = expense.tags
    } else {
      tag_ids = expense.tags
        .map((nm) => tagIdByName.get(normalizeCategoryKey(nm)))
        .filter(Boolean)
    }
  }

  const item = {
    description: expense.description,
    amount: expense.amount,
    type: txType,
    date: dateIso,
    credit_card_id: expense.cardId,
    category_id: category_id || null,
    notes: expense.notes ?? null,
    is_paid: true,
    installment: expense.installment || 1,
    total_installments: expense.totalInstallments || 1,
    installment_group_id: expense.installmentGroupId ?? null,
  }
  const invId = invoiceIdOpt ?? expense.creditCardInvoiceId
  if (invId) item.credit_card_invoice_id = invId
  if (tag_ids && tag_ids.length > 0) item.tag_ids = tag_ids
  if (client_line_id) item.client_line_id = client_line_id
  return item
}

/** Usado no fluxo 1× `POST /transactions` (ex.: useDocumentImport.addCardExpense sem apply). */
export async function buildCardExpenseBatchItem(data) {
  if (!data.cardId) throw new Error('cardId é obrigatório')

  const parsedDate = data.date instanceof Date ? data.date : parseLocalDate(data.date)
  const dateIso = parsedDate.toISOString().slice(0, 10)

  let tag_ids
  if (Array.isArray(data.tags) && data.tags.length > 0) {
    const looksLikeId = (v) => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v)
    if (data.tags.every(looksLikeId)) {
      tag_ids = data.tags
    } else {
      const allTags = await apiClient.get('/api/v1/tags')
      tag_ids = data.tags
        .map((name) => allTags.find((t) => t.name === name)?.id)
        .filter(Boolean)
    }
  }

  const item = {
    description: data.description,
    amount: data.amount,
    type: data.type || 'expense',
    date: dateIso,
    credit_card_id: data.cardId,
    category_id: data.category || data.categoryId || null,
    notes: data.notes ?? null,
    is_paid: true,
    installment: data.installment || 1,
    total_installments: data.totalInstallments || 1,
    installment_group_id: data.installmentGroupId ?? null,
  }
  if (data.creditCardInvoiceId) item.credit_card_invoice_id = data.creditCardInvoiceId
  if (tag_ids && tag_ids.length > 0) item.tag_ids = tag_ids
  return item
}

/**
 * Aplica a **fatura inteira** em uma requisição após a IA (`POST /documents/process`).
 *
 * Contrato mypay-api: `.cursor/plans/transactions_batch_endpoint_344b7586.plan.md` (Onda 2).
 * `POST /api/v1/documents/imports/{import_id}/apply` é um wrapper que injeta `import_id` no
 * payload e delega a `TransactionUseCase.batch_create` (mesmo motor que `POST /transactions/batch`:
 * resolução de fatura agrupada, SAVEPOINT por linha, 201/207). Não fatiar o array no cliente:
 * um body com até `DOCUMENT_IMPORT_APPLY_MAX_ITEMS` linhas.
 *
 * @returns {Promise<{ httpStatus: number, succeeded: number, failed: number, results: object[] }>}
 */
export async function applyDocumentImport(importId, items, options = {}) {
  const { atomic = false, idempotencyKey = null } = options
  const headers = {}
  if (idempotencyKey) headers['Idempotency-Key'] = String(idempotencyKey).slice(0, 200)

  const { status, body } = await apiClient.postWithStatus(
    `/api/v1/documents/imports/${importId}/apply`,
    { items, atomic },
    { headers }
  )
  if (!body || typeof body.succeeded !== 'number') {
    throw new Error('Resposta inválida do servidor ao aplicar importação')
  }
  return {
    httpStatus: status,
    succeeded: body.succeeded,
    failed: body.failed,
    results: body.results || [],
  }
}

/** ImportRecordResponse → shape esperado por ImportHistory.jsx */
function mapImportRecord(r) {
  return {
    id: r.id,
    fileName: r.file_name ?? null,
    fileUrl: r.file_url ?? null,
    fileType: deriveFileTypeFromName(r.file_name),
    documentType: r.document_type ?? null,
    status: r.status ?? 'processed',
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
