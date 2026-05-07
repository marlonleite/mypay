/**
 * Recurrence rows materialized by the API often inherit DB default is_paid=true,
 * so future-dated occurrences incorrectly show as paid. We normalize display for
 * recurrence-linked rows with civil date strictly after today.
 *
 * Session overrides (sessionStorage) preserve explicit toggles in the same tab
 * until logout — prefer fixing materialization / defaults on the API long-term.
 */

const STORAGE_KEY = 'mypay_tx_paid_overrides_v1'

function safeParseOverrides() {
  if (typeof sessionStorage === 'undefined') return {}
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const o = JSON.parse(raw)
    return o && typeof o === 'object' ? o : {}
  } catch {
    return {}
  }
}

function writeOverrides(obj) {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(obj))
  } catch {
    /* quota / private mode */
  }
}

/** Civil calendar: transaction day strictly after local today (00:00). */
export function isCivilDateStrictlyAfterToday(dateVal) {
  if (!(dateVal instanceof Date) || Number.isNaN(dateVal.getTime())) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const row = new Date(dateVal.getFullYear(), dateVal.getMonth(), dateVal.getDate())
  return row > today
}

/**
 * @param {{ transactionId?: string, recurrenceId?: string|null, civilDate?: Date|null, rawIsPaid?: unknown }} p
 * @returns {boolean} UI paid flag (false = pendente)
 */
export function resolveRecurrenceLinkedPaid({
  transactionId,
  recurrenceId,
  civilDate,
  rawIsPaid,
}) {
  const overrides = safeParseOverrides()
  if (transactionId && Object.prototype.hasOwnProperty.call(overrides, transactionId)) {
    return Boolean(overrides[transactionId])
  }

  const basePaid = rawIsPaid !== false
  if (!recurrenceId) return basePaid
  if (isCivilDateStrictlyAfterToday(civilDate)) return false
  return basePaid
}

export function setPaidOverride(transactionId, paid) {
  if (!transactionId) return
  const next = safeParseOverrides()
  next[transactionId] = Boolean(paid)
  writeOverrides(next)
}

export function removePaidOverride(transactionId) {
  if (!transactionId) return
  const next = safeParseOverrides()
  delete next[transactionId]
  writeOverrides(next)
}

export function clearTransactionPaidOverrides() {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* noop */
  }
}
