/**
 * Busca textual / valor / data sobre transações já carregadas (client-side).
 */

/** @param {string|undefined} str */
export function normalizeSearchText(str) {
  if (!str || typeof str !== 'string') return ''
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

const AMOUNT_OP_RE = /^(>=|<=|>|<)\s*([0-9.,]+)\s*$/i
const AMOUNT_BETWEEN_RE = /^([0-9.,]+)\s*\.\.\s*([0-9.,]+)\s*$/i
const AMOUNT_CURRENCY_RE = /^(?:R\$\s*)?([0-9.,]+)\s*$/i

/**
 * @param {string} raw
 * @returns {number|null}
 */
function parseBRLNumber(raw) {
  if (!raw || typeof raw !== 'string') return null
  const s = raw.trim().replace(/\s/g, '').replace(/R\$/gi, '')
  if (!s) return null
  if (s.includes(',') && s.includes('.')) {
    return parseFloat(s.replace(/\./g, '').replace(',', '.'))
  }
  if (s.includes(',') && !s.includes('.')) {
    return parseFloat(s.replace(',', '.'))
  }
  return parseFloat(s)
}

/**
 * @param {string} q
 * @returns {{ type: 'none' }|{ type: 'op', op: 'gt'|'gte'|'lt'|'lte', n: number }|{ type: 'between', a: number, b: number }|{ type: 'close', n: number }}
 */
export function parseAmountQuery(q) {
  const t = (q || '').trim()
  if (!t) return { type: 'none' }
  const am = t.match(AMOUNT_OP_RE)
  if (am) {
    const n = parseBRLNumber(am[2])
    if (n === null || Number.isNaN(n)) return { type: 'none' }
    const map = { '>': 'gt', '<': 'lt', '>=': 'gte', '<=': 'lte' }
    return { type: 'op', op: map[am[1].toLowerCase()], n }
  }
  const bet = t.match(AMOUNT_BETWEEN_RE)
  if (bet) {
    const a = parseBRLNumber(bet[1])
    const b = parseBRLNumber(bet[2])
    if (a === null || b === null || Number.isNaN(a) || Number.isNaN(b)) return { type: 'none' }
    return { type: 'between', a: Math.min(a, b), b: Math.max(a, b) }
  }
  const cur = t.match(AMOUNT_CURRENCY_RE)
  if (cur) {
    const n = parseBRLNumber(cur[1])
    if (n === null || Number.isNaN(n)) return { type: 'none' }
    return { type: 'close', n }
  }
  return { type: 'none' }
}

const TODAY = 'hoje'
const YESTERDAY = 'ontem'

/**
 * @param {string} q
 * @returns {{ type: 'none' }|{ type: 'month', y: number, m: number }|{ type: 'day', d: Date }}
 */
export function parseDateQuery(q) {
  const t = (q || '').trim().toLowerCase()
  if (!t) return { type: 'none' }
  if (t === normalizeSearchText(TODAY)) {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return { type: 'day', d }
  }
  if (t === normalizeSearchText(YESTERDAY)) {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    d.setHours(0, 0, 0, 0)
    return { type: 'day', d }
  }
  const mmyyyy = t.match(/^(\d{1,2})\/(\d{4})$/)
  if (mmyyyy) {
    const mm = parseInt(mmyyyy[1], 10)
    const yyyy = parseInt(mmyyyy[2], 10)
    if (mm >= 1 && mm <= 12) return { type: 'month', y: yyyy, m: mm }
  }
  const yyyymm = t.match(/^(\d{4})-(\d{1,2})$/)
  if (yyyymm) {
    const yyyy = parseInt(yyyymm[1], 10)
    const mm = parseInt(yyyymm[2], 10)
    if (mm >= 1 && mm <= 12) return { type: 'month', y: yyyy, m: mm }
  }
  const dmy = t.match(/^(\d{1,2})\/(\d{1,2})\s*\.\.\s*(\d{1,2})\/(\d{1,2})$/)
  if (dmy) {
    // dd/mm..dd/mm same year? ambiguous — only support with year in extended form: skip
  }
  return { type: 'none' }
}

function isSameLocalDay(d, tDate) {
  if (!tDate) return false
  const tx = tDate instanceof Date ? tDate : new Date(tDate + (typeof tDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(tDate) ? 'T12:00:00' : ''))
  if (Number.isNaN(tx.getTime())) return false
  return (
    tx.getFullYear() === d.getFullYear() &&
    tx.getMonth() === d.getMonth() &&
    tx.getDate() === d.getDate()
  )
}

function inMonth(d, tDate) {
  if (!tDate) return false
  const tx = tDate instanceof Date ? tDate : new Date(tDate + (typeof tDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(tDate) ? 'T12:00:00' : ''))
  if (Number.isNaN(tx.getTime())) return false
  return tx.getFullYear() === d.y && tx.getMonth() + 1 === d.m
}

/**
 * @param {number} amount
 * @param {ReturnType<typeof parseAmountQuery>} p
 * @returns {boolean}
 */
function matchAmountPredicate(amount, p) {
  const a = typeof amount === 'number' ? amount : parseFloat(amount)
  if (Number.isNaN(a)) return true
  if (p.type === 'none' || p.type === undefined) return true
  if (p.type === 'op') {
    if (p.op === 'gt') return a > p.n
    if (p.op === 'gte') return a >= p.n
    if (p.op === 'lt') return a < p.n
    if (p.op === 'lte') return a <= p.n
  }
  if (p.type === 'between') return a >= p.a && a <= p.b
  if (p.type === 'close') return Math.abs(a - p.n) < 0.01
  return true
}

/**
 * @param {object} t — transação após mapTransaction
 * @param {string} fullQuery
 * @param {object} ctx
 * @param {Array<{id: string, name: string}>} [ctx.categories]
 * @param {Array<{id: string, name: string}>} [ctx.accounts]
 */
/**
 * Só trata o token como filtro de valor se tiver operador, cifrão ou "a..b".
 * Evita que o número "10" sozinho vire filtro de valor.
 */
function tokenLooksLikeAmount(tok) {
  const s = tok.trim()
  if (/[><]/.test(s) && /\d/.test(s)) return true
  if (/R\$/i.test(s)) return true
  if (/\d+\s*\.\.\s*\d+/.test(s)) return true
  return false
}

export function matchTransaction(t, fullQuery, ctx = {}) {
  if (!fullQuery || typeof fullQuery !== 'string') return true
  const qRaw = fullQuery.trim()
  if (!qRaw) return true

  const tokens = qRaw.split(/\s+/).filter(Boolean)
  const { categories = [], accounts = [] } = ctx

  const categoryName = categories.length && t.categoryId
    ? categories.find((c) => c.id === t.categoryId)?.name
    : ''
  const accountName = accounts.length && t.accountId
    ? accounts.find((a) => a.id === t.accountId)?.name
    : ''

  const textBlob = [
    t.description,
    t.notes,
    categoryName,
    accountName,
    ...(Array.isArray(t.tags) ? t.tags : []),
  ]
    .filter(Boolean)
    .map((s) => normalizeSearchText(String(s)))
    .join(' ')

  for (const tok of tokens) {
    const nTok = normalizeSearchText(tok)
    if (!nTok) continue

    const amt = tokenLooksLikeAmount(tok) ? parseAmountQuery(tok) : { type: 'none' }
    if (amt.type !== 'none') {
      if (!matchAmountPredicate(t.amount, amt)) return false
      continue
    }

    const dspec = parseDateQuery(tok)
    if (dspec.type === 'day') {
      if (!isSameLocalDay(dspec.d, t.date)) return false
      continue
    }
    if (dspec.type === 'month') {
      if (!inMonth(dspec, t.date)) return false
      continue
    }

    if (!textBlob.includes(nTok)) return false
  }

  return true
}
